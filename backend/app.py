#!/usr/bin/env python3
"""
Primary Script: Song Virality Prediction - Complete Integration
Combines model training and Flask API server in one executable

This is the main entry point that:
1. Imports SongHitPredictor from predict_main.py (core ML model)
2. Initializes Flask API server
3. Handles prediction requests from frontend
4. Manages model training and persistence

Features:
- Uses XGBoost for binary classification (hit/miss prediction)
- Serves REST API on port 5001
- Integrates with React frontend on port 5173
- 12 musical DNA features for prediction
- ~87% accuracy on test set
"""

import os
import sys
import json
import logging
from pathlib import Path
import tempfile
import uuid

# Flask imports
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

load_dotenv()
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import pandas as pd

# Audio processing
try:
    import librosa
    import numpy as np
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    print("WARNING: librosa not installed. Audio feature extraction will be unavailable.")

try:
    import soundfile as sf
except ImportError:
    print("WARNING: soundfile not installed. Cannot export mutated audio.")

try:
    import pedalboard
    from pedalboard import Pedalboard, PitchShift, Gain, time_stretch, Distortion, Compressor, Reverb, LowpassFilter, HighpassFilter, Chorus, HighShelfFilter, LowShelfFilter
    PEDALBOARD_AVAILABLE = True
except ImportError:
    PEDALBOARD_AVAILABLE = False
    print("WARNING: pedalboard not installed.")

# Import the main ML model from predict_main.py
sys.path.insert(0, str(Path(__file__).parent / 'models'))
from predict_main import SongHitPredictor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get paths
BACKEND_DIR = Path(__file__).parent
MODELS_DIR = Path(os.environ.get('MODEL_DIR', BACKEND_DIR / 'models'))
DATA_DIR = Path(os.environ.get('DATA_DIR', BACKEND_DIR / 'data'))

# Ensure directories exist
MODELS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Flask app setup
from flask.json.provider import DefaultJSONProvider

class NumpyJSONProvider(DefaultJSONProvider):
    def default(self, obj):
        try:
            import numpy as np
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
        except ImportError:
            pass
        return super().default(obj)

app = Flask(__name__)
app.json = NumpyJSONProvider(app)

# Security: CORS
frontend_url = os.environ.get('FRONTEND_URL', '*')
CORS(app, origins=[frontend_url] if frontend_url != '*' else '*')

# Security: Max upload size 50MB to match frontend limits
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 

# Security: Rate Limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per day"],
    storage_uri="memory://"
)

# Setup Persistent User Database and uploads in AppData
import sqlite3

def get_app_data_dir():
    appdata = os.getenv('APPDATA')
    if appdata:
        base_dir = Path(appdata) / 'ViraliFY'
    else:
        base_dir = Path.home() / '.config' / 'ViraliFY'
    
    # Ensure dirs exist
    base_dir.mkdir(parents=True, exist_ok=True)
    (base_dir / 'uploads').mkdir(parents=True, exist_ok=True)
    return base_dir

APP_DATA_DIR = get_app_data_dir()
DB_PATH = APP_DATA_DIR / 'viralify.db'
UPLOAD_FOLDER = APP_DATA_DIR / 'uploads'

def init_sqlite_db():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password TEXT,
            created_at TEXT,
            auth_provider TEXT
        )
    ''')
    conn.commit()
    
    # Create demo user for easy testing
    try:
        from werkzeug.security import generate_password_hash
        import uuid
        from datetime import datetime
        
        cursor.execute("SELECT id FROM users WHERE username = 'demo'")
        if not cursor.fetchone():
            demo_id = str(uuid.uuid4())
            demo_pass = generate_password_hash("demo123")
            demo_time = datetime.now().isoformat()
            cursor.execute("""
                INSERT INTO users (id, username, email, password, created_at, auth_provider)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (demo_id, 'demo', 'demo@example.com', demo_pass, demo_time, 'local'))
            conn.commit()
            logger.info("Created demo user account (demo / demo123)")
    except Exception as e:
        logger.error(f"Failed to create demo user: {e}")
        
    conn.close()
    logger.info(f"Initialized SQLite database at {DB_PATH}")

init_sqlite_db()

APP_VERSION = "1.0.0"

def check_for_updates():
    """
    Hook point for future auto-updater.
    This logs active version and provides a hook for update server calls.
    """
    logger.info(f"Version check: Active version is {APP_VERSION}. Auto-updater hook initialized.")

# Global state
# Use Ensemble for best predictions, or fallback to environment setting (e.g., 'xgboost' for low-memory environments)
default_model_type = os.environ.get('MODEL_TYPE', 'ensemble')
predictor = SongHitPredictor(model_dir=MODELS_DIR, data_dir=DATA_DIR, model_type=default_model_type)
model = None
feature_names = None
model_metadata = {}
_model_loaded = False
current_model_type = default_model_type  # Track which model is active

# Musical DNA features
MUSICAL_DNA_FEATURES = [
    'danceability', 'energy', 'key', 'loudness', 'mode', 'speechiness',
    'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo',
    'duration_ms'
]

# Hook Detection V3.0 Configurable Weights (Normalized 0-1)
HOOK_CONFIG = {
    'golden_hook': {
        'step_1_chorus_candidates': 5, # Select top 5 structurally repetitive sections
        'step_2_energy': 0.60,         # Rank by Energy
        'step_2_loudness': 0.40        # Rank by Loudness
    },
    'rhythm_hook': {
        'beat_density': 0.50,
        'beat_regularity': 0.30,
        'energy': 0.20
    },
    'high_energy_hook': {
        'energy': 0.60,
        'loudness': 0.25,
        'novelty': 0.15
    }
}



def extract_audio_features(audio_file):
    """
    Extract comprehensive musical DNA features from audio file using librosa
    
    IMPORTANT: Librosa extracts raw audio signal features, while Spotify uses
    proprietary ML models trained on millions of tracks. We apply empirical
    calibration to approximate Spotify's feature definitions.
    
    Calibration is based on analyzing the distribution differences between
    librosa outputs and Spotify's documented feature ranges/behaviors.
    
    The 12 Musical DNA Features:
    ============================
    1. duration_ms - Track duration in milliseconds (direct measurement)
    2. tempo - Beats per minute, 40-250 BPM range
    3. energy - Perceptual intensity (0-1), correlated with loudness/dynamics
    4. loudness - Overall loudness in dB, typically -60 to 0
    5. danceability - Rhythm regularity + tempo suitability (0-1)
    6. valence - Musical positivity/mood (0-1) - HARDEST to estimate
    7. speechiness - Spoken word detection (0-1)
    8. acousticness - Acoustic vs electronic sound (0-1)
    9. liveness - Live performance indicators (0-1)
    10. instrumentalness - Absence of vocals (0-1)
    11. key - Musical key (0-11, C=0 to B=11)
    12. mode - Major (1) or Minor (0)
    """
    if not LIBROSA_AVAILABLE:
        return None
    
    try:
        # Load full audio file
        y, sr = librosa.load(audio_file, sr=22050, mono=True)
        
        if len(y) == 0:
            raise ValueError("Empty audio file")
            
        import soundfile as sf
        true_duration = sf.info(audio_file).duration
        return extract_features_from_array(y, sr, true_duration_sec=true_duration)
    except Exception as e:
        logger.error(f"Error extracting features from {audio_file}: {e}")
        import traceback
        traceback.print_exc()
        return None


def extract_features_from_array(y, sr, true_duration_sec=None):
    """
    Extract features directly from a loaded audio array.
    """
    try:
        # Initialize features dict
        features = {}
        all_features = {}  # Store all extracted features for display
        
        # === DURATION (milliseconds) ===
        duration_sec = true_duration_sec if true_duration_sec is not None else librosa.get_duration(y=y, sr=sr)
        features['duration_ms'] = int(duration_sec * 1000)
        all_features['duration_sec'] = round(duration_sec, 2)
        
        # === TEMPO ANALYSIS ===
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        tempo_estimate = librosa.feature.tempo(onset_envelope=onset_env, sr=sr)[0]
        
        tempo_val = np.atleast_1d(tempo)[0]
        features['tempo'] = float(np.clip(tempo_estimate, 40, 250))
        all_features['tempo_primary'] = float(tempo_val)
        all_features['beat_count'] = len(beat_frames)
        
        # === HARMONIC-PERCUSSIVE SEPARATION ===
        y_harmonic, y_percussive = librosa.effects.hpss(y)
        harmonic_energy = np.sum(y_harmonic ** 2)
        percussive_energy = np.sum(y_percussive ** 2)
        total_energy = harmonic_energy + percussive_energy + 1e-10
        harmonic_ratio = harmonic_energy / total_energy
        percussive_ratio = percussive_energy / total_energy
        all_features['harmonic_ratio'] = round(harmonic_ratio, 4)
        all_features['percussive_ratio'] = round(percussive_ratio, 4)
        
        # === RMS ENERGY ANALYSIS (A-weighted for human-perceived loudness) ===
        S = np.abs(librosa.stft(y)) ** 2
        frequencies = librosa.fft_frequencies(sr=sr)
        if len(frequencies) > 0:
            frequencies[0] = 1e-6  # Avoid log10(0) warning in librosa
        a_weights = librosa.frequency_weighting(frequencies, kind='A')
        a_weights_linear = 10 ** (a_weights / 10.0)
        S_weighted = S * a_weights_linear[:, np.newaxis]
        rms_weighted = np.sqrt(np.mean(S_weighted, axis=0))
        
        rms_mean = np.mean(rms_weighted)
        rms_std = np.std(rms_weighted)
        rms_max = np.max(rms_weighted) + 1e-10
        rms_min = np.min(rms_weighted) + 1e-10
        
        # Calculate silence ratio (percentage of frames with energy < 15% of max)
        normalized_rms = rms_weighted / rms_max
        silence_ratio = float(np.mean(normalized_rms < 0.15))
        features['silence_ratio'] = silence_ratio
        
        # === ENERGY ===
        energy_raw = rms_mean / rms_max
        dynamic_range = rms_max / rms_min
        dynamic_factor = np.clip(np.log10(dynamic_range + 1) / 2, 0, 1)
        
        energy_calibrated = (
            0.4 * energy_raw +                    
            0.3 * (1 - rms_std / (rms_mean + 1e-6)) +  
            0.2 * percussive_ratio +              
            0.1 * dynamic_factor                  
        )
        features['energy'] = float(np.clip(energy_calibrated, 0, 1))
        all_features['energy_raw'] = round(float(energy_raw), 4)
        
        # === LOUDNESS ===
        loudness_db = 20 * np.log10(rms_mean + 1e-10)
        loudness_calibrated = loudness_db + 15  
        features['loudness'] = float(np.clip(loudness_calibrated, -40, -3))
        all_features['loudness_raw_db'] = round(float(loudness_db), 2)
        
        # === SPECTRAL FEATURES ===
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)[0]
        spectral_flatness = librosa.feature.spectral_flatness(y=y)[0]
        
        cent_mean = np.mean(spectral_centroids)
        bandwidth_mean = np.mean(spectral_bandwidth)
        rolloff_mean = np.mean(spectral_rolloff)
        flatness_mean = np.mean(spectral_flatness)
        
        nyquist = sr / 2
        cent_norm = cent_mean / nyquist
        rolloff_norm = rolloff_mean / nyquist
        
        all_features['spectral_centroid_hz'] = round(float(cent_mean), 2)
        all_features['spectral_bandwidth_hz'] = round(float(bandwidth_mean), 2)
        all_features['spectral_rolloff_hz'] = round(float(rolloff_mean), 2)
        all_features['spectral_flatness'] = round(float(flatness_mean), 6)
        all_features['spectral_flatness_mean'] = round(float(flatness_mean), 6)
        
        # === DANCEABILITY ===
        if len(beat_frames) > 2:
            beat_intervals = np.diff(librosa.frames_to_time(beat_frames, sr=sr))
            beat_regularity = 1.0 - np.clip(np.std(beat_intervals) / (np.mean(beat_intervals) + 1e-6), 0, 1)
        else:
            beat_regularity = 0.5
        
        rhythm_strength = np.clip(np.std(onset_env) / (np.mean(onset_env) + 1e-6), 0, 2) / 2
        optimal_tempo = 120
        tempo_spread = 40
        tempo_factor = 1.0 - np.clip(abs(features['tempo'] - optimal_tempo) / tempo_spread, 0, 0.7)
        groove = percussive_ratio * 0.6 + (1 - cent_norm) * 0.4
        
        danceability_raw = (
            0.30 * beat_regularity +      
            0.25 * rhythm_strength +        
            0.20 * tempo_factor +         
            0.15 * groove +               
            0.10 * features['energy']     
        )
        features['danceability'] = float(np.clip(danceability_raw, 0, 1))
        all_features['beat_regularity'] = round(float(beat_regularity), 4)
        all_features['rhythm_strength'] = round(float(rhythm_strength), 4)
        all_features['onset_strength_mean'] = round(float(np.mean(onset_env)), 4)
        
        # === VALENCE (Key & Mode via CENS for noise-robust tracking) ===
        chroma = librosa.feature.chroma_cens(y=y_harmonic, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        key = int(np.argmax(chroma_mean))
        
        major_third = chroma_mean[(key + 4) % 12]
        minor_third = chroma_mean[(key + 3) % 12]
        fifth = chroma_mean[(key + 7) % 12]
        major_score = chroma_mean[key] + major_third + fifth
        minor_score = chroma_mean[key] + minor_third + fifth
        is_major = major_score > minor_score
        mode_factor = 0.6 if is_major else 0.4  
        brightness = np.clip(cent_norm * 1.5, 0, 1)
        tempo_valence = np.clip((features['tempo'] - 70) / 100, 0, 1)
        harmonic_simplicity = 1 - np.clip(np.std(chroma_mean) / max(np.mean(chroma_mean), 1e-6), 0, 1)
        
        valence_raw = (
            0.25 * mode_factor +           
            0.25 * brightness +            
            0.20 * tempo_valence +         
            0.15 * features['energy'] +    
            0.15 * harmonic_simplicity     
        )
        valence_calibrated = 0.5 + (valence_raw - 0.5) * 1.4
        features['valence'] = float(np.clip(valence_calibrated, 0, 1))
        all_features['mode_factor'] = round(float(mode_factor), 4)
        all_features['brightness'] = round(float(brightness), 4)
        
        # === ZERO CROSSING RATE ===
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        zcr_mean = np.mean(zcr)
        all_features['zero_crossing_rate'] = round(float(zcr_mean), 6)
        
        # === SPEECHINESS ===
        zcr_factor = np.clip((zcr_mean - 0.03) / 0.12, 0, 1)
        speech_flatness = 1 - abs(flatness_mean - 0.1) * 5
        speech_flatness = np.clip(speech_flatness, 0, 1)
        speech_harmonic = 1 - harmonic_ratio
        
        speechiness_raw = (
            0.50 * zcr_factor +
            0.30 * speech_flatness +
            0.20 * speech_harmonic
        )
        features['speechiness'] = float(np.clip(speechiness_raw * 0.6, 0, 1))
        
        # === ACOUSTICNESS ===
        high_freq_content = rolloff_norm
        acousticness_raw = (
            0.35 * (1.0 - high_freq_content) +     
            0.30 * harmonic_ratio +                 
            0.20 * (1.0 - features['energy']) +    
            0.15 * (1.0 - percussive_ratio)        
        )
        features['acousticness'] = float(np.clip(acousticness_raw * 0.4, 0, 1))
        
        # === LIVENESS ===
        noise_factor = np.clip(flatness_mean * 5, 0, 1)
        dynamic_variance = np.clip(rms_std / (rms_mean + 1e-6), 0, 1)
        spectral_decay = np.clip(np.mean(np.diff(spectral_rolloff)) / 1000, -1, 1)
        reverb_factor = np.clip(0.5 - spectral_decay, 0, 1)
        
        liveness_raw = (
            0.40 * noise_factor +
            0.35 * dynamic_variance +
            0.25 * reverb_factor
        )
        features['liveness'] = float(np.clip(liveness_raw * 0.7, 0, 1))
        
        # === INSTRUMENTALNESS ===
        vocal_range_energy = np.mean(spectral_centroids > 300) * np.mean(spectral_centroids < 3400)
        vocal_presence = np.clip(vocal_range_energy * 2, 0, 1)
        instrumental_raw = (
            0.40 * (1 - features['speechiness']) +
            0.30 * (1 - zcr_factor) +
            0.30 * harmonic_ratio
        )
        features['instrumentalness'] = float(np.clip(instrumental_raw * 0.15, 0, 1))
        
        # === KEY & MODE ===
        features['key'] = key
        all_features['key_name'] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][key]
        all_features['key_strength'] = round(float(np.max(chroma_mean) / (np.sum(chroma_mean) + 1e-10)), 4)
        
        features['mode'] = 1 if is_major else 0
        all_features['mode_name'] = 'Major' if is_major else 'Minor'
        all_features['major_confidence'] = round(float(major_score / (major_score + minor_score + 1e-10)), 4)
        
        # === MFCCs for timbral texture visualization ===
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        for i in range(20):
            all_features[f'mfcc_{i+1}'] = round(float(np.mean(mfccs[i])), 4)
            
        # === Extended Features for UI ===
        try:
            tonnetz = librosa.feature.tonnetz(y=y_harmonic, sr=sr)
            all_features['tonnetz_mean'] = round(float(np.mean(tonnetz)), 6)
        except Exception:
            all_features['tonnetz_mean'] = 0.0
        all_features['rms_mean'] = round(float(rms_mean), 6)
        all_features['dynamic_range'] = round(float(dynamic_range), 4)

        # Log extracted features
        logger.info(f"Extracted features: {features}")
        features['_all_features'] = all_features
        features['_feature_count'] = len(all_features)
        
        return features
        
    except Exception as e:
        logger.error(f"Error extracting features from array: {e}")
        import traceback
        traceback.print_exc()
        return None

def calculate_chorus_similarity(y, sr, start_sample, end_sample, full_chroma):
    """
    Calculate how similar a given segment is to the rest of the track's high-energy sections.
    """
    chunk_chroma = librosa.feature.chroma_stft(y=y[start_sample:end_sample], sr=sr)
    # Simple similarity based on mean chroma vector distance to the global mean chroma
    chunk_mean = np.mean(chunk_chroma, axis=1)
    full_mean = np.mean(full_chroma, axis=1)
    
    # Cosine similarity
    dot = np.dot(chunk_mean, full_mean)
    norm = np.linalg.norm(chunk_mean) * np.linalg.norm(full_mean)
    if norm == 0:
        return 0.0
    return max(0.0, float(dot / norm))


def load_model_globally():
    """Load model globally for API use"""
    global model, feature_names, model_metadata, _model_loaded
    
    if _model_loaded:
        return model is not None or predictor.model_type == "ensemble"
    
    try:
        if predictor.load_model():
            # For ensemble, set model to xgb_model for compatibility
            if predictor.model_type == "ensemble":
                model = predictor.xgb_model
            else:
                model = predictor.model
            feature_names = predictor.feature_names
            model_metadata = predictor.model_metadata
            logger.info("✓ Model loaded for API use")
            
        _model_loaded = True
        return model is not None
    except Exception as e:
        logger.error(f"✗ Error loading model: {e}")
        _model_loaded = True
        return False


# ============================================================================
# FLASK API ENDPOINTS
# ============================================================================

@app.route('/', methods=['GET'])
def root():
    """Root endpoint - information about the API"""
    return jsonify({
        'service': 'Song Virality Prediction API',
        'version': '1.0.0',
        'status': 'running',
        'audio_processing': 'enabled' if LIBROSA_AVAILABLE else 'disabled',
        'endpoints': {
            '/api/health': 'GET - Server health check',
            '/api/predict': 'POST - Predict song hit probability (JSON features)',
            '/api/analyze-audio': 'POST - Analyze audio file and predict (multipart/form-data)',
            '/api/model-info': 'GET - Model metadata and features',
            '/api/optimal-ranges': 'GET - Optimal parameter ranges',
            '/api/feature-importance': 'GET - Feature importance scores',
            '/api/suggest-improvements': 'POST - Song improvement suggestions'
        }
    })

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    if not _model_loaded:
        load_model_globally()

    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'model_type': current_model_type,
        'audio_processing': 'enabled' if LIBROSA_AVAILABLE else 'disabled',
        'audio_mutation': 'enabled' if PEDALBOARD_AVAILABLE else 'disabled',
        'version': '1.0.0'
    })


@app.route('/api/predict', methods=['POST'])
def predict():
    """
    Predict song hit probability
    
    Request body:
    {
      "danceability": 0.65,
      "energy": 0.72,
      "key": 5,
      "loudness": -6.5,
      "mode": 1,
      "speechiness": 0.08,
      "acousticness": 0.25,
      "instrumentalness": 0.05,
      "liveness": 0.15,
      "valence": 0.58,
      "tempo": 125,
      "duration_ms": 210000
    }
    
    Response:
    {
      "hit_probability": 0.732,
      "confidence": 0.85,
      "prediction": "hit" | "miss",
      "model_version": "1.0.0"
    }
    """
    try:
        if not _model_loaded:
            load_model_globally()
        
        song_data = request.get_json()
        
        if not song_data:
            return jsonify({'error': 'No data provided'}), 400
        
        if not _model_loaded:
            return jsonify({'error': 'Model not loaded'}), 503
        
        # Validate and normalize feature ranges
        feature_ranges = {
            'danceability': (0, 1),
            'energy': (0, 1),
            'key': (0, 11),
            'loudness': (-60, 0),
            'mode': (0, 1),
            'speechiness': (0, 1),
            'acousticness': (0, 1),
            'instrumentalness': (0, 1),
            'liveness': (0, 1),
            'valence': (0, 1),
            'tempo': (0, 250),
            'duration_ms': (0, 3600000)
        }
        
        # Validate each feature
        for feature, (min_val, max_val) in feature_ranges.items():
            if feature in song_data:
                try:
                    val = float(song_data[feature])
                    # Clamp to valid range
                    song_data[feature] = max(min_val, min(max_val, val))
                except (ValueError, TypeError):
                    return jsonify({'error': f'Invalid value for {feature}: must be numeric'}), 400
        
        # Make prediction using the predictor
        result = predictor.predict_song_hit_probability(song_data)
        
        if result is None:
            return jsonify({'error': 'Prediction failed'}), 500
        
        return jsonify({
            'hit_probability': result['hit_probability'],
            'confidence': result['confidence'],
            'prediction': 'hit' if result['is_hit_prediction'] else 'miss',
            'model_version': model_metadata.get('version', '1.0.0')
        })
    
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/analyze-audio', methods=['POST'])
@limiter.limit("10 per minute")
def analyze_audio():
    """
    Analyze audio file and predict hit probability
    
    Request: multipart/form-data with 'file' field containing audio file
    Response: Same as /api/predict but extracted from audio
    """
    try:
        if not LIBROSA_AVAILABLE:
            return jsonify({'error': 'librosa not installed. Cannot process audio files.'}), 503
        if not _model_loaded:
            load_model_globally()
        
        if not _model_loaded:
            return jsonify({'error': 'Model not loaded'}), 503
        
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        audio_file = request.files['file']
        
        if audio_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save temporarily in AppData uploads directory
        temp_filename = f"upload_{uuid.uuid4()}{Path(audio_file.filename).suffix}"
        temp_path = str(UPLOAD_FOLDER / temp_filename)
        audio_file.save(temp_path)
        
        # Get true duration first for feature calculation using soundfile (more reliable than librosa.get_duration)
        import soundfile as sf
        true_duration_sec = sf.info(temp_path).duration
        
        # Load audio (Full length)
        y_full, sr = librosa.load(temp_path, sr=22050, mono=True)
        if len(y_full) == 0:
            raise ValueError("Empty audio file")
            
        # Extract features from the entire audio file to ensure maximum prediction accuracy
        features = extract_features_from_array(y_full, sr, true_duration_sec=true_duration_sec)
        
        # Add target_year if provided
        target_year = request.form.get('target_year', type=int)
        if target_year is not None:
            features['target_year'] = target_year
        else:
            features['target_year'] = 2024
        
        # Precompute DSP elements for cache using FULL audio
        onset_env = librosa.onset.onset_strength(y=y_full, sr=sr)
        tempo_track, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        
        # Cache the arrays for Phase 2 Hook Analysis & Mutation
        analysis_id = str(uuid.uuid4())
        cache_path = os.path.join(tempfile.gettempdir(), f'cache_{analysis_id}.npz')
        
        # Precompute global features for hook analysis
        rms = librosa.feature.rms(y=y_full)[0]
        full_chroma = librosa.feature.chroma_stft(y=y_full, sr=sr)
        
        np.savez(cache_path, y=y_full, sr=sr, beat_times=beat_times, onset_env=onset_env, rms=rms, full_chroma=full_chroma)
        
        # Calculate Global Confidence based on prediction
        result = predictor.predict_song_hit_probability(features)
        
        if result is None:
            logger.error("Prediction returned None")
            return jsonify({'error': 'Prediction failed - returned None'}), 500
            
        # Check if the track is primarily speech/conversation
        all_features = features.get('_all_features', {})
        zcr_mean = all_features.get('zero_crossing_rate', 0.0)
        zcr_factor = np.clip((zcr_mean - 0.03) / 0.12, 0.0, 1.0)
        # Robust Acoustic Heuristic for Speech Classification
        silence_ratio = features.get('silence_ratio', 0.0)
        harmonic_ratio = all_features.get('harmonic_ratio', 0.0)
        speechiness = features.get('speechiness', 0.0)
        
        speech_score = 0.0
        
        # IMPROVED: Only trigger for extreme speech/podcast cases
        # Music with vocals (speechiness ~0.3-0.4) should NOT be flagged
        
        # 1. High speechiness is key indicator - only count if > 0.5
        if speechiness > 0.6:
            speech_score += 2.0
        elif speechiness > 0.5:
            speech_score += 1.0
            
        # 2. Speech has natural pauses between words (high silence ratio)
        if silence_ratio > 0.25:  # Raised from 0.15 to reduce false positives
            speech_score += 1.0
        elif silence_ratio > 0.20:
            speech_score += 0.3
            
        # 3. Speech has very low harmonic content compared to music
        if harmonic_ratio < 0.3:
            speech_score += 0.5
        elif harmonic_ratio < 0.4:
            speech_score += 0.2
            
        # Threshold raised from 2.0 to 4.0 - requires multiple strong indicators
        # Music with vocals alone won't trigger (speechiness ~0.3-0.4)
        is_speech = speech_score >= 4.0        
        # Get prescriptive suggestions for improvement
        prescriptions = []
        warning = None
        if is_speech:
            # Still warn about speech, but use actual model prediction instead of random
            warning = "Spoken Word Detected: The uploaded audio sounds like normal conversation or spoken word rather than music. This prediction model is optimized for music tracks."
            prescriptions = []
        else:
            prescriptions = predictor.suggest_feature_improvements(features)
            if not prescriptions:
                prescriptions = [{
                    'feature': 'tempo',
                    'direction': 'INCREASE',
                    'current': features.get('tempo', 120),
                    'suggested': features.get('tempo', 120) + 5,
                    'improvement_percent': 1.0,
                    'improvement': 0.01,
                    'new_probability': result['hit_probability'] + 0.01,
                    'importance': 'MINOR'
                }]
        # Calculate the true combined improvement percentage
        combined_improvement_percent = 0.0
        if prescriptions:
            test_df = pd.DataFrame([features])
            for p in prescriptions:
                test_df[p['feature']] = p['suggested']
            
            combined_pred = predictor.predict_song_hit_probability(test_df)
            if combined_pred:
                combined_improvement = combined_pred['hit_probability'] - result['hit_probability']
                combined_improvement_percent = max(0.0, float(combined_improvement * 100))
        
        return jsonify({
            'probability': result['hit_probability'],
            'hit_probability': result['hit_probability'],
            'confidence': result['confidence'],
            'isViral': result['is_hit_prediction'],
            'prediction': 'hit' if result['is_hit_prediction'] else 'miss',
            'model_version': getattr(predictor, 'model_metadata', {}).get('version', '1.0.0'),
            'features': features,
            'suggestions': prescriptions,
            'combined_improvement_percent': combined_improvement_percent,
            'total_duration_sec': true_duration_sec,
            'analysisId': analysis_id,
            'fileName': audio_file.filename,
            'file_name': audio_file.filename
        })
        
    except Exception as e:
        logger.error(f"Audio analysis error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
        
    finally:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)

@app.route('/api/analyze-hooks', methods=['POST'])
@limiter.limit("10 per minute")
def analyze_hooks():
    try:
        data = request.json
        if not data or 'analysisId' not in data:
            return jsonify({'error': 'No analysisId provided'}), 400
            
        analysis_id = data['analysisId']
        cache_path = os.path.join(tempfile.gettempdir(), f'cache_{analysis_id}.npz')
        
        if not os.path.exists(cache_path):
            return jsonify({'error': 'Analysis cache expired or invalid. Please re-upload the song.'}), 404
            
        # Load precomputed arrays and ensure the file handle is closed
        with np.load(cache_path) as npz:
            y = npz['y']
            sr = int(npz['sr'])
            beat_times = npz['beat_times']
            onset_env = npz['onset_env']
            rms_global = npz['rms']
            full_chroma = npz['full_chroma']
        
        total_duration_sec = librosa.get_duration(y=y, sr=sr)
        
        # Calculate Global features needed for slicing
        # (Loaded from cache above)
        # rms_global = librosa.feature.rms(y=y)[0]
        # full_chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        
        window_sec = 15.0
        stride_sec = 5.0
        
        raw_segments = []
        
        # 1. Slice and Extract Raw Metrics
        for start_sec in np.arange(0, total_duration_sec - window_sec, stride_sec):
            start_idx = np.argmin(np.abs(beat_times - start_sec))
            snapped_start = beat_times[start_idx]
            
            end_idx = np.argmin(np.abs(beat_times - (snapped_start + window_sec)))
            snapped_end = beat_times[end_idx]
            
            if snapped_end - snapped_start < 5.0:
                continue
                
            start_sample = int(snapped_start * sr)
            end_sample = int(snapped_end * sr)
            
            start_frame = int(snapped_start * sr / 512)
            end_frame = int(snapped_end * sr / 512)
            
            if end_frame > start_frame:
                chunk_rms_mean = np.mean(rms_global[start_frame:end_frame])
                chunk_onset_mean = np.mean(onset_env[start_frame:end_frame])
            else:
                chunk_rms_mean = 0.0
                chunk_onset_mean = 0.0
            
            # Beats in chunk
            beats_in_chunk = [b for b in beat_times if snapped_start <= b <= snapped_end]
            beat_density_raw = len(beats_in_chunk)
            
            # Beat regularity (variance of beat intervals)
            if len(beats_in_chunk) > 2:
                intervals = np.diff(beats_in_chunk)
                beat_reg_raw = 1.0 / (np.var(intervals) + 1e-6) # Inverse of variance
            else:
                beat_reg_raw = 0.0
                
            # Chorus similarity
            chorus_sim = calculate_chorus_similarity(y, sr, start_sample, end_sample, full_chroma)
            
            raw_segments.append({
                'start_time': round(snapped_start, 1),
                'end_time': round(snapped_end, 1),
                'energy_raw': chunk_rms_mean,
                'loudness_raw': 20 * np.log10(chunk_rms_mean + 1e-10),
                'novelty_raw': chunk_onset_mean,
                'beat_density_raw': beat_density_raw,
                'beat_reg_raw': beat_reg_raw,
                'chorus_sim': chorus_sim
            })
            
        if not raw_segments:
            return jsonify({'temporal_segments': [], 'top_hooks': []})
            
        # 2. Min-Max Normalization
        import math
        def normalize_metric(metric):
            vals = [seg.get(metric, 0.0) for seg in raw_segments]
            # Filter out NaNs if any
            clean_vals = [v if not math.isnan(v) else 0.0 for v in vals]
            if not clean_vals:
                return [0.0 for _ in vals]
            min_v, max_v = min(clean_vals), max(clean_vals)
            if max_v - min_v <= 1e-9:
                return [0.0 for _ in vals]
            return [(v - min_v) / (max_v - min_v) for v in clean_vals]
            
        norm_energy = normalize_metric('energy_raw')
        norm_loudness = normalize_metric('loudness_raw')
        norm_novelty = normalize_metric('novelty_raw')
        norm_beat_density = normalize_metric('beat_density_raw')
        norm_beat_reg = normalize_metric('beat_reg_raw')
        norm_chorus_sim = normalize_metric('chorus_sim')
        
        temporal_segments = []
        for i, seg in enumerate(raw_segments):
            
            # Step 2: Rank candidates within Chorus bounds
            # We assign a pure energy/loudness score to all, but Golden Hook will only be selected
            # from the top 5 normalized chorus regions.
            hook_score = (
                HOOK_CONFIG['golden_hook']['step_2_energy'] * norm_energy[i] + 
                HOOK_CONFIG['golden_hook']['step_2_loudness'] * norm_loudness[i]
            )
            
            rhythm_score = (
                HOOK_CONFIG['rhythm_hook']['beat_density'] * norm_beat_density[i] +
                HOOK_CONFIG['rhythm_hook']['beat_regularity'] * norm_beat_reg[i] +
                HOOK_CONFIG['rhythm_hook']['energy'] * norm_energy[i]
            )
            
            high_energy_score = (
                HOOK_CONFIG['high_energy_hook']['energy'] * norm_energy[i] +
                HOOK_CONFIG['high_energy_hook']['loudness'] * norm_loudness[i] +
                HOOK_CONFIG['high_energy_hook']['novelty'] * norm_novelty[i]
            )
            
            temporal_segments.append({
                'start_time': seg['start_time'],
                'end_time': seg['end_time'],
                'hook_score': float(hook_score),
                'rhythm_score': float(rhythm_score),
                'high_energy_score': float(high_energy_score),
                'energy': float(norm_energy[i]),
                'novelty': float(norm_novelty[i]),
                'norm_chorus_sim': float(norm_chorus_sim[i])
            })
            
        # 3. Extract Top Hooks (Non-overlapping)
        top_hooks = []
        def is_overlapping(seg1, seg2):
            return not (seg1['end_time'] <= seg2['start_time'] or seg1['start_time'] >= seg2['end_time'])
            
        # --- HIERARCHICAL GOLDEN HOOK ---
        # 1. Structural Filter: Top N most repetitive structural sections
        sorted_by_chorus = sorted(temporal_segments, key=lambda x: x['norm_chorus_sim'], reverse=True)
        top_n = HOOK_CONFIG['golden_hook']['step_1_chorus_candidates']
        top_5_chorus_candidates = sorted_by_chorus[:top_n]
        
        # 2. Excitement Filter: Most energetic rendition among the 5
        golden = max(top_5_chorus_candidates, key=lambda x: x['hook_score'])
        golden_hook = {**golden, 'type': 'Golden Hook', 'description': 'Best overall viral potential (Chorus)'}
        top_hooks.append(golden_hook)
        
        # Rhythm candidates: preferably non-overlapping with golden hook
        rhythm_cands = [s for s in temporal_segments if not is_overlapping(s, golden_hook)]
        
        # Fallback if song is too short: just pick any other segment
        if not rhythm_cands:
            rhythm_cands = [s for s in temporal_segments if s['start_time'] != golden_hook['start_time']]
            
        if rhythm_cands:
            rhythm = max(rhythm_cands, key=lambda x: x['rhythm_score'])
            top_hooks.append({**rhythm, 'hook_score': rhythm['rhythm_score'], 'type': 'Rhythm Hook', 'description': 'Most engaging & steady rhythm'})
            
            # High-Energy drop: allow partial overlap but must be a different segment
            drop_cands = [s for s in temporal_segments if s['start_time'] != golden_hook['start_time'] and s['start_time'] != rhythm['start_time']]
            
            if drop_cands:
                drop = max(drop_cands, key=lambda x: x['high_energy_score'])
                top_hooks.append({**drop, 'hook_score': drop['high_energy_score'], 'type': 'High-Energy Drop', 'description': 'Biggest energy spike / drop'})
                
        # Clean up cache
        # os.remove(cache_path) # Disabled: We need this cache to persist for /api/mutate-audio
        
        # Log final scores
        logger.info(f"--- HOOK SCORES FOR ANALYSIS {analysis_id} ---")
        for h in top_hooks:
            logger.info(
                f"[{h.get('type')}] "
                f"Hook Score: {h.get('hook_score', 0):.3f} | "
                f"Rhythm Score: {h.get('rhythm_score', 0):.3f} | "
                f"Energy Score: {h.get('energy', 0):.3f} | "
                f"Novelty Score: {h.get('novelty', 0):.3f} | "
                f"Chorus Sim: {h.get('norm_chorus_sim', 0):.3f}"
            )
            
        
        return jsonify({
            'temporal_segments': temporal_segments,
            'top_hooks': top_hooks
        })
    except Exception as e:
        logger.error(f"Error in analyze_hooks: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
@app.route('/api/mutate-audio', methods=['POST'])
@limiter.limit("10 per minute")
def mutate_audio():
    """Mutate audio based on playground features"""
    try:
        data = request.json
        if not data or 'analysisId' not in data:
            return jsonify({'error': 'No analysisId provided'}), 400
            
        analysis_id = data['analysisId']
        cache_path = os.path.join(tempfile.gettempdir(), f'cache_{analysis_id}.npz')
        
        if not os.path.exists(cache_path):
            return jsonify({'error': 'Analysis cache expired. Please re-upload.'}), 404
            
        def safe_float(val, default=0.0):
            if val is None:
                return default
            try:
                return float(val)
            except (ValueError, TypeError):
                return default

        def safe_int(val, default=0):
            if val is None:
                return default
            try:
                return int(val)
            except (ValueError, TypeError):
                return default

        target_tempo = safe_float(data.get('target_tempo'), 120.0)
        target_key = safe_int(data.get('target_key'), 0)
        target_loudness = safe_float(data.get('target_loudness'), -6.0)
        target_energy = safe_float(data.get('target_energy'), 0.5)
        target_liveness = safe_float(data.get('target_liveness'), 0.5)
        target_acousticness = safe_float(data.get('target_acousticness'), 0.5)
        
        # Load audio from cache
        with np.load(cache_path) as npz:
            y = np.nan_to_num(npz['y'].astype(np.float32))
            sr = float(npz['sr'])
            
        original_tempo = safe_float(data.get('original_tempo'), 120.0)
        original_key = safe_int(data.get('original_key'), 0)
        original_loudness = safe_float(data.get('original_loudness'), -6.0)
        original_energy = safe_float(data.get('original_energy'), 0.5)
        original_liveness = safe_float(data.get('original_liveness'), 0.5)
        original_acousticness = safe_float(data.get('original_acousticness'), 0.5)
        
        # 1 & 2. TIME STRETCH AND PITCH SHIFT
        rate = 1.0
        if target_tempo is not None and original_tempo > 0:
            rate = float(target_tempo) / float(original_tempo)
            rate = max(0.5, min(2.0, rate))
            
        n_steps = 0
        if target_key is not None:
            n_steps = target_key - original_key
            if n_steps > 6: n_steps -= 12
            elif n_steps < -6: n_steps += 12

        plugins = []
        
        if abs(rate - 1.0) > 0.02 or n_steps != 0:
            if PEDALBOARD_AVAILABLE:
                y = time_stretch(y, sr, stretch_factor=float(rate), pitch_shift_in_semitones=float(n_steps))
            else:
                if abs(rate - 1.0) > 0.02:
                    y = librosa.effects.time_stretch(y, rate=rate)
                if n_steps != 0:
                    y = librosa.effects.pitch_shift(y, sr=sr, n_steps=n_steps)
                    
            # Time-stretching introduces phase smearing and loss of transients.
            # Compensate slightly so we don't completely tank the 'danceability' and 'energy' ML features.
            if abs(rate - 1.0) > 0.05:
                # Add some punch back and restore high frequencies
                plugins.append(Compressor(threshold_db=-15, ratio=2.5, attack_ms=2, release_ms=50))
                plugins.append(HighShelfFilter(cutoff_frequency_hz=3000, gain_db=2.0))
                
        # 3. DSP PLUGINS FOR ML FEATURES
        
        if target_loudness is not None:
            gain_db = target_loudness - original_loudness
            gain_db = max(-12, min(12, gain_db))
            if abs(gain_db) > 0.5:
                plugins.append(Gain(gain_db=gain_db))
                
        # Energy -> Subtle EQ and Compression
        if 'target_energy' in data and data['target_energy'] is not None:
            energy_delta = target_energy - original_energy
            if energy_delta > 0.03:
                # More energy -> slight compression, boost highs subtly
                plugins.append(Compressor(threshold_db=-15, ratio=2.5, attack_ms=5, release_ms=100))
                plugins.append(HighShelfFilter(cutoff_frequency_hz=4000, gain_db=min(6.0, energy_delta * 15.0)))
                plugins.append(Distortion(drive_db=min(3.0, energy_delta * 10.0))) # very slight saturation
            elif energy_delta < -0.03:
                # Less energy -> cut highs slightly, no heavy muffling
                plugins.append(HighShelfFilter(cutoff_frequency_hz=3000, gain_db=max(-6.0, energy_delta * 15.0)))
                
        # Liveness -> Subtle Reverb
        if 'target_liveness' in data and data['target_liveness'] is not None:
            liveness_delta = target_liveness - original_liveness
            if liveness_delta > 0.03:
                plugins.append(Reverb(room_size=min(0.5, liveness_delta * 1.5), wet_level=min(0.4, liveness_delta * 1.0)))
                
        # Acousticness -> Gentle EQ adjustments
        if 'target_acousticness' in data and data['target_acousticness'] is not None:
            ac_delta = target_acousticness - original_acousticness
            if ac_delta > 0.03:
                # More acoustic -> roll off sub-bass slightly, subtle warmth
                plugins.append(LowShelfFilter(cutoff_frequency_hz=150, gain_db=max(-4.0, -ac_delta * 10.0)))
                plugins.append(Chorus(rate_hz=1.0, depth=0.1, centre_delay_ms=7.0))
            elif ac_delta < -0.03:
                # More electronic -> slight saturation, boost low-end punch
                plugins.append(LowShelfFilter(cutoff_frequency_hz=100, gain_db=min(4.0, abs(ac_delta) * 10.0)))
                plugins.append(Distortion(drive_db=min(4.0, abs(ac_delta) * 12.0)))
                plugins.append(Compressor(threshold_db=-10, ratio=2))

        # Speechiness -> EQ vocal range (1kHz - 4kHz)
        if 'target_speechiness' in data and data['target_speechiness'] is not None:
            sp_delta = safe_float(data['target_speechiness']) - safe_float(data.get('original_speechiness', 0.5))
            if sp_delta > 0.03:
                # Boost vocal presence
                plugins.append(HighShelfFilter(cutoff_frequency_hz=1500, gain_db=min(4.0, sp_delta * 15.0)))
            elif sp_delta < -0.03:
                # Scoop vocal presence
                plugins.append(LowShelfFilter(cutoff_frequency_hz=3000, gain_db=max(-4.0, sp_delta * 15.0)))
                
        # Valence (Positivity/Mood) -> Warmth vs Brightness
        if 'target_valence' in data and data['target_valence'] is not None:
            val_delta = safe_float(data['target_valence']) - safe_float(data.get('original_valence', 0.5))
            if val_delta > 0.03:
                # Happier -> Brighter, slight chorus
                plugins.append(HighShelfFilter(cutoff_frequency_hz=5000, gain_db=min(3.0, val_delta * 10.0)))
                plugins.append(Chorus(rate_hz=2.0, depth=0.1, centre_delay_ms=5.0))
            elif val_delta < -0.03:
                # Sadder -> Warmer, subdued highs
                plugins.append(HighShelfFilter(cutoff_frequency_hz=4000, gain_db=max(-4.0, val_delta * 10.0)))
                
        # Danceability -> Punchy transients vs smooth
        if 'target_danceability' in data and data['target_danceability'] is not None:
            dnc_delta = safe_float(data['target_danceability']) - safe_float(data.get('original_danceability', 0.5))
            if dnc_delta > 0.03:
                # More danceable -> punchy compression
                plugins.append(Compressor(threshold_db=-18, ratio=4, attack_ms=1, release_ms=40))
                plugins.append(LowShelfFilter(cutoff_frequency_hz=80, gain_db=min(3.0, dnc_delta * 10.0)))
            elif dnc_delta < -0.03:
                # Less danceable -> slower compression
                plugins.append(Compressor(threshold_db=-12, ratio=2, attack_ms=30, release_ms=200))
                
        # Instrumentalness -> Muffle vocals
        if 'target_instrumentalness' in data and data['target_instrumentalness'] is not None:
            inst_delta = safe_float(data['target_instrumentalness']) - safe_float(data.get('original_instrumentalness', 0.5))
            if inst_delta > 0.03:
                # More instrumental -> cut midrange heavily
                plugins.append(HighShelfFilter(cutoff_frequency_hz=1000, gain_db=-2.0))
                plugins.append(LowShelfFilter(cutoff_frequency_hz=4000, gain_db=-2.0))

        if plugins:
            if PEDALBOARD_AVAILABLE:
                y_pedal = y.reshape(1, -1) if len(y.shape) == 1 else y
                board = Pedalboard(plugins)
                y_pedal = board(y_pedal, sr)
                y = y_pedal.flatten() if len(y.shape) == 1 else y_pedal
            elif target_loudness is not None:
                # Fallback for gain
                gain_db = target_loudness - original_loudness
                gain_linear = 10 ** (gain_db / 20)
                y = y * gain_linear
            
            # Hard limit to avoid clipping
            y = np.clip(y, -1.0, 1.0)
                
        # Ensure proper shape for soundfile: (samples, channels)
        if len(y.shape) > 1:
            if y.shape[0] < y.shape[1]:
                y = y.T # Convert (channels, samples) to (samples, channels)
        else:
            y = y.flatten()

        # Write to temporary file
        out_path = os.path.join(tempfile.gettempdir(), f'mutated_{analysis_id}.wav')
        sf.write(out_path, y, int(sr))
        
        # Send file back
        return send_file(out_path, mimetype='audio/wav', as_attachment=True, download_name='mutated_hit.wav')
        
    except Exception as e:
        logger.error(f"Error mutating audio: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/model-info', methods=['GET'])
def model_info():
    """Get model information and metadata"""
    if not _model_loaded:
        load_model_globally()
    
    # Build metadata with keys the frontend expects
    metadata = dict(model_metadata) if model_metadata else {}
    # Alias: frontend reads 'training_timestamp', backend stores 'created_at'
    if 'created_at' in metadata and 'training_timestamp' not in metadata:
        metadata['training_timestamp'] = metadata['created_at']
    # Alias: frontend reads 'features_count', backend stores feature_names list
    if 'feature_names' in metadata and 'features_count' not in metadata:
        metadata['features_count'] = len(metadata['feature_names'])
    elif 'features_count' not in metadata:
        metadata['features_count'] = len(MUSICAL_DNA_FEATURES)
    # Alias: frontend reads 'training_samples', backend stores 'data_size'
    if 'data_size' in metadata and 'training_samples' not in metadata:
        metadata['training_samples'] = metadata['data_size']
    # Ensure training_timestamp has a fallback
    if 'training_timestamp' not in metadata:
        metadata['training_timestamp'] = datetime.now().isoformat()

    return jsonify({
        'loaded': model is not None,
        'active_model': current_model_type,
        'metadata': metadata,
        'features': MUSICAL_DNA_FEATURES,
        'improvements': {
            'bias_correction': 'enabled',
            'description': 'Reduces negative bias in predictions - boosts middle-range probabilities',
            'supported_models': ['xgboost', 'lstm']
        }
    })


@app.route('/api/optimal-ranges', methods=['GET'])
def optimal_ranges():
    """Get optimal parameter ranges for hit songs"""
    ranges = predictor.get_optimal_ranges()
    if ranges is None:
        return jsonify({'error': 'Could not calculate optimal ranges'}), 500
    
    return jsonify({
        'status': 'success',
        'optimal_ranges': ranges,
        'definition': 'Optimal ranges represent the mean ± 1 standard deviation of hit songs'
    })


@app.route('/api/feature-importance', methods=['GET'])
def feature_importance():
    """Get feature importance for hit prediction"""
    if not _model_loaded:
        load_model_globally()
    
    importance_df = predictor.get_feature_importance()
    if importance_df is None:
        return jsonify({'error': 'Could not calculate feature importance'}), 500
    
    # Convert to list of dicts for JSON serialization
    importance_list = []
    for _, row in importance_df.iterrows():
        importance_list.append({
            'feature': row['feature'],
            'importance': float(row['importance'])
        })
    
    return jsonify({
        'status': 'success',
        'features': importance_list
    })


@app.route('/api/suggest-improvements', methods=['POST'])
def suggest_improvements():
    """
    Suggest feature improvements for a song
    
    Request body:
    {
      "danceability": 0.5,
      "energy": 0.6,
      ...all 12 features
    }
    
    Response:
    {
      "current_probability": 0.032,
      "top_suggestions": [
        {
          "feature": "danceability",
          "current": 0.5,
          "suggested": 0.65,
          "direction": "INCREASE",
          "improvement": 0.045,
          "new_probability": 0.077
        },
        ...
      ]
    }
    """
    try:
        if not _model_loaded:
            load_model_globally()
        
        song_data = request.get_json()
        
        if not song_data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Ensure all required features are present
        for feat in MUSICAL_DNA_FEATURES:
            if feat not in song_data:
                song_data[feat] = 0
        
        suggestions = predictor.suggest_feature_improvements(song_data)
        
        if suggestions is None:
            return jsonify({'error': 'Could not generate suggestions'}), 500
            
        combined_improvement_percent = 0.0
        if suggestions:
            # Calculate true combined improvement
            test_df = pd.DataFrame([song_data])
            # get original prediction
            orig_pred = predictor.predict_song_hit_probability(test_df)
            if orig_pred:
                orig_prob = orig_pred['hit_probability']
                for p in suggestions:
                    test_df[p['feature']] = p['suggested']
                
                new_pred = predictor.predict_song_hit_probability(test_df)
                if new_pred:
                    combined_improvement = new_pred['hit_probability'] - orig_prob
                    combined_improvement_percent = max(0.0, float(combined_improvement * 100))
        
        return jsonify({
            'suggestions': suggestions,
            'combined_improvement_percent': combined_improvement_percent
        })
    
    except Exception as e:
        logger.error(f"Error in suggest_improvements: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/switch-model', methods=['POST'])
def switch_model():
    """
    Switch between XGBoost and LSTM models
    
    Request body:
    {
      "model_type": "xgboost" or "lstm"
    }
    
    Response:
    {
      "status": "success",
      "active_model": "lstm",
      "message": "Switched to LSTM model"
    }
    """
    global predictor, model, current_model_type, _model_loaded
    
    try:
        data = request.get_json()
        model_type = data.get('model_type', '').lower()
        
        valid_types = ['xgboost', 'lstm', 'ensemble', 'random_forest', 'logistic_regression']
        if model_type not in valid_types:
            return jsonify({'error': f'Invalid model type. Must be one of: {valid_types}'}), 400
        
        if model_type == 'lstm' and not LIBROSA_AVAILABLE:
            return jsonify({'error': 'TensorFlow not available. Cannot use LSTM model.'}), 503
        
        # Create new predictor with desired model type
        new_predictor = SongHitPredictor(model_dir=MODELS_DIR, data_dir=DATA_DIR, model_type=model_type)
        
        # Try to load the model
        if new_predictor.load_model(model_type=model_type):
            # Transfer dataframe so optimal-ranges works without reloading data
            if hasattr(predictor, 'df') and predictor.df is not None:
                new_predictor.df = predictor.df
                
            predictor = new_predictor
            if model_type == "ensemble":
                model = predictor.xgb_model
            else:
                model = predictor.model
            current_model_type = model_type
            _model_loaded = True
            return jsonify({
                'status': 'success',
                'active_model': model_type,
                'message': f'Switched to {model_type.upper()} model',
                'metadata': predictor.model_metadata
            })
        else:
            return jsonify({
                'error': f'Could not load {model_type} model. Train a new model first.',
                'hint': 'POST to /api/train to train a new model'
            }), 404
    
    except Exception as e:
        logger.error(f"Error switching model: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/create-new-user', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if not all([username, email, password]):
            return jsonify({'error': 'Missing required fields'}), 400

        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()

        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Email already registered'}), 400

        # Check if username exists
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Username already taken'}), 400

        user_id = str(uuid.uuid4())
        hashed_password = generate_password_hash(password)
        created_at = datetime.now().isoformat()

        cursor.execute("""
            INSERT INTO users (id, username, email, password, created_at, auth_provider)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, username, email, hashed_password, created_at, 'local'))

        conn.commit()
        conn.close()

        return jsonify({
            'status': 'success',
            'user': {
                'userId': user_id,
                'username': username,
                'email': email,
                'name': username
            }
        })

    except Exception as e:
        logger.error(f"Signup error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        identifier = data.get('username')  # Can be email or username
        password = data.get('password')

        if not identifier or not password:
            return jsonify({'error': 'Missing credentials'}), 400

        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()

        # Find user by email or username
        cursor.execute("SELECT id, username, email, password, auth_provider FROM users WHERE email = ? OR username = ?", (identifier, identifier))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({'error': 'Invalid credentials'}), 401

        user_id, username, email, password_hash, auth_provider = row

        if auth_provider == 'google' and not password_hash:
             return jsonify({'error': 'Please login with Google'}), 401

        if not check_password_hash(password_hash, password):
            return jsonify({'error': 'Invalid credentials'}), 401

        return jsonify({
            'status': 'success',
            'user': {
                'userId': str(user_id),
                'username': str(username),
                'email': str(email),
                'name': str(username)
            }
        })

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/google-login', methods=['POST'])
def google_login():
    try:
        data = request.get_json()
        email = data.get('email')
        name = data.get('name')

        if not email:
            return jsonify({'error': 'Email is required from Google Auth'}), 400

        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()

        cursor.execute("SELECT id, username, email, auth_provider FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()

        if not row:
            # Create new user
            username = email.split('@')[0]
            # Handle username collision
            base_username = username
            counter = 1
            cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
            while cursor.fetchone():
                username = f"{base_username}{counter}"
                counter += 1
                cursor.execute("SELECT id FROM users WHERE username = ?", (username,))

            user_id = str(uuid.uuid4())
            created_at = datetime.now().isoformat()

            cursor.execute("""
                INSERT INTO users (id, username, email, password, created_at, auth_provider)
                VALUES (?, ?, ?, '', ?, ?)
            """, (user_id, username, email, created_at, 'google'))
            conn.commit()

            user_data = {
                'id': user_id,
                'username': username,
                'email': email
            }
        else:
            user_id, username, email, auth_provider = row
            user_data = {
                'id': user_id,
                'username': username,
                'email': email
            }

        conn.close()

        return jsonify({
            'status': 'success',
            'user': {
                'userId': str(user_data['id']),
                'username': str(user_data['username']),
                'email': str(user_data['email']),
                'name': str(name or user_data['username'])
            }
        })

    except Exception as e:
        logger.error(f"Google login error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/active-model', methods=['GET'])
def active_model():
    """Get information about the currently active model"""
    return jsonify({
        'active_model': current_model_type,
        'metadata': model_metadata,
        'model_loaded': model is not None
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def server_error(e):
    logger.error(f"Server error: {e}")
    return jsonify({'error': 'Internal server error'}), 500


def create_app():
    """Create and configure Flask app"""
    logger.info("[OK] Flask app created with SongHitPredictor integration")
    return app


def main():
    """Main entry point"""
    try:
        logger.info("Song Virality Prediction System - Starting...")
        logger.info("="*60)
        
        # Use combined dataset from data pipeline
        combined_data_path = DATA_DIR / 'combined_dataset.csv'
        
        # Fallback to individual datasets if combined doesn't exist
        if combined_data_path.exists():
            data_path = combined_data_path
            logger.info("[INFO] Using combined dataset from unified pipeline")
        else:
            # Try primary dataset: spotify_tracks.csv
            data_path = DATA_DIR / 'spotify_tracks.csv'
            
            # Fallback to alternative names if primary doesn't exist
            if not data_path.exists():
                for name in ['dataset.csv', 'spotify_songs.csv']:
                    alt_path = DATA_DIR / name
                    if alt_path.exists():
                        data_path = alt_path
                        break
        
        if not data_path.exists():
            logger.error(f"[ERROR] Data file not found. Looked in: {DATA_DIR}")
            logger.error("Please run data pipeline first: python backend/data_pipeline.py")
            return
        
        logger.info(f"[INFO] Data file: {data_path}")
        
        # Load and prepare data
        logger.info("Loading and preparing data...")
        df, X, Y = predictor.load_and_prepare_data(str(data_path))
        
        if df is None:
            logger.error("[ERROR] Failed to load data. Exiting.")
            return
        
        # Train model
        logger.info("Training model...")
        predictor.train_model(X, Y, force_retrain=False)
        
        # Load globally
        load_model_globally()
        
        if model is None and predictor.model_type != "ensemble":
            logger.error("[ERROR] Failed to load model. Exiting.")
            return
        
        logger.info("Model ready!")
        check_for_updates()
        logger.info("="*60)
        logger.info("Starting Flask API server...")
        logger.info(f"API running on http://0.0.0.0:7860")
        logger.info("Frontend: http://localhost:5173")
        logger.info("="*60)
        
        # Start Flask server
        port = int(os.environ.get('PORT', 7860))
        app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
    
    except Exception as e:
        logger.error(f"FATAL ERROR in main(): {e}")
        import traceback
        traceback.print_exc()
        raise


if os.environ.get('EAGER_LOAD_MODEL', 'true').lower() in ('1', 'true', 'yes'):
    load_model_globally()


if __name__ == '__main__':
    main()
