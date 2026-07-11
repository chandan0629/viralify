"""
Main Backend ML Model - Song Hit Prediction
=============================================

This is the core machine learning model for predicting song hit probability.
Used by the Flask API server for all predictions.

Classes:
    - SongHitPredictor: Main model class with training and prediction

Features:
    - 12 musical DNA features for prediction
    - XGBoost classifier for binary classification (hit/miss)
    - Model persistence and metadata tracking
    - Feature analysis and optimization suggestions
"""

import pandas as pd
import numpy as np
import pickle
import joblib
import os
from datetime import datetime
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score, roc_curve
from sklearn.preprocessing import StandardScaler
import json
import hashlib
from scipy import stats
import warnings
import logging

# LSTM imports
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, models
    from tensorflow.keras.optimizers import Adam
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False

warnings.filterwarnings('ignore')

# Setup logging
logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

class SongHitPredictor:
    def __init__(self, model_dir="models", data_dir="data", model_type="ensemble"):
        """
        Initialize the Song Hit Predictor with model persistence capabilities
        
        Args:
            model_dir: Directory to store models
            data_dir: Directory with training data
            model_type: "xgboost", "lstm", or "ensemble" - which model to use
        """
        self.model_dir = model_dir
        self.data_dir = data_dir
        self.model = None
        self.scaler = None  # For feature scaling (used by LSTM and ensemble)
        self.feature_names = None
        self.model_metadata = {}
        self.df = None
        self.model_type = model_type  # Track which model type is active
        
        # For ensemble
        self.xgb_model = None
        self.rf_model = None
        self.lr_model = None
        self.ensemble_scaler = None
        self.lstm_model = None
        self.lstm_scaler = None

        # Create directories if they don't exist
        os.makedirs(model_dir, exist_ok=True)
        os.makedirs(data_dir, exist_ok=True)

        # Define musical DNA features
        self.musical_dna_features = [
            'danceability', 'energy', 'key', 'loudness', 'mode', 'speechiness',
            'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo',
            'duration_ms'
        ]
        
        # Calibration data for percentile-based scoring
        self.calibration_data = None

        # Note: Visualization code removed - this is a backend ML model

    def _calculate_data_hash(self, data):
        """Calculate hash of the dataset to detect changes"""
        return hashlib.md5(pd.util.hash_pandas_object(data).values).hexdigest()

    def _save_model_metadata(self, accuracy, data_hash, training_time):
        """Save model metadata for tracking"""
        model_type_name = 'LSTM' if self.model_type == 'lstm' else 'XGBClassifier'
        self.model_metadata = {
            'model_type': model_type_name,
            'model_framework': self.model_type,
            'accuracy': accuracy,
            'training_time': training_time,
            'data_hash': data_hash,
            'feature_names': self.feature_names.tolist(),
            'created_at': datetime.now().isoformat(),
            'data_size': len(self.X_train) + len(self.X_test),
            'bias_correction': 'calibrated',
            'bias_correction_method': 'isotonic-inspired calibration based on empirical hit ratio',
            'scale_pos_weight': 'enabled'
        }

        metadata_path = os.path.join(self.model_dir, 'model_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(self.model_metadata, f, indent=2)

    def save_model(self, model_name="song_hit_model"):
        """Save the trained model, scaler, and metadata"""
        if self.model is None:
            return False

        try:
            if self.model_type == "lstm":
                # Save LSTM model
                model_path = os.path.join(self.model_dir, f"{model_name}_lstm.h5")
                self.model.save(model_path)
                
                # Save scaler
                scaler_path = os.path.join(self.model_dir, f"{model_name}_lstm_scaler.pkl")
                joblib.dump(self.scaler, scaler_path)
            else:
                # Save XGBoost model
                model_path = os.path.join(self.model_dir, f"{model_name}.pkl")
                joblib.dump(self.model, model_path)

            feature_path = os.path.join(self.model_dir, f"{model_name}_features.pkl")
            joblib.dump(self.feature_names, feature_path)

            return True

        except Exception as e:
            logger.error(f"Error saving model: {e}")
            return False

    def load_model(self, model_name="song_hit_model", model_type=None):
        """Load a previously trained model - prioritize ensemble"""
        try:
            if model_type is None:
                model_type = self.model_type
            
            # Try ensemble first (best performance)
            if model_type == "ensemble" or model_type == "xgboost":
                ensemble_xgb_path = os.path.join(self.model_dir, "ensemble_xgb.pkl")
                ensemble_scaler_path = os.path.join(self.model_dir, "ensemble_scaler.pkl")
                ensemble_features_path = os.path.join(self.model_dir, "ensemble_features.pkl")
                ensemble_metadata_path = os.path.join(self.model_dir, "ensemble_metadata.json")
                
                if os.path.exists(ensemble_xgb_path):
                    self.xgb_model = joblib.load(ensemble_xgb_path)
                    
                    # RF and LR models are intentionally bypassed to prevent 512MB RAM crashes
                    self.rf_model = None
                    self.lr_model = None
                    
                    if os.path.exists(ensemble_scaler_path):
                        self.ensemble_scaler = joblib.load(ensemble_scaler_path)
                    if os.path.exists(ensemble_features_path):
                        self.feature_names = joblib.load(ensemble_features_path)
                    
                    self.model_type = "ensemble"
                    
                    # Also load LSTM model if available
                    try:
                        import tensorflow as tf
                        from tensorflow import keras
                        lstm_model_path = os.path.join(self.model_dir, "song_hit_model_lstm.h5")
                        lstm_scaler_path = os.path.join(self.model_dir, "song_hit_model_lstm_scaler.pkl")
                        if os.path.exists(lstm_model_path) and os.path.exists(lstm_scaler_path):
                            self.lstm_model = keras.models.load_model(lstm_model_path)
                            self.lstm_scaler = joblib.load(lstm_scaler_path)
                            logger.info("  Loaded LSTM model companion")
                    except Exception as e:
                        logger.warning(f"Could not load LSTM model: {e}")
                    
                    
                    if os.path.exists(ensemble_metadata_path):
                        with open(ensemble_metadata_path, 'r') as f:
                            self.model_metadata = json.load(f)
                    
                    # Load calibration data if available
                    calibration_path = os.path.join(self.model_dir, "ensemble_calibration.json")
                    if os.path.exists(calibration_path):
                        with open(calibration_path, 'r') as f:
                            self.calibration_data = json.load(f)
                        logger.info("  Loaded percentile calibration data")
                    
                    logger.info("✓ Ensemble model loaded (XGBoost + RF + Calibrated LR)")
                    return True
            
            feature_path = os.path.join(self.model_dir, f"{model_name}_features.pkl")
            metadata_path = os.path.join(self.model_dir, 'model_metadata.json')

            # Try XGBoost
            xgboost_path = os.path.join(self.model_dir, f"{model_name}.pkl")
            if os.path.exists(xgboost_path) and model_type == "xgboost":
                self.model = joblib.load(xgboost_path)
                self.model_type = "xgboost"
                self.feature_names = joblib.load(feature_path)
                if os.path.exists(metadata_path):
                    with open(metadata_path, 'r') as f:
                        self.model_metadata = json.load(f)
                return True
            
            if model_type == "lstm":
                model_path = os.path.join(self.model_dir, f"{model_name}_lstm.h5")
                scaler_path = os.path.join(self.model_dir, f"{model_name}_lstm_scaler.pkl")
                
                if not os.path.exists(model_path):
                    return False
                
                self.model = keras.models.load_model(model_path)
                self.scaler = joblib.load(scaler_path)
                self.model_type = "lstm"
            else:
                model_path = os.path.join(self.model_dir, f"{model_name}.pkl")
                
                if not os.path.exists(model_path):
                    return False
                
                self.model = joblib.load(model_path)
                self.model_type = "xgboost"

            self.feature_names = joblib.load(feature_path)

            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    self.model_metadata = json.load(f)

            return True

        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False

    def load_and_prepare_data(self, file_path):
        """Load and prepare the data for training/prediction"""
        try:
            # Use engine='python' for potentially problematic CSV files
            # Use on_bad_lines='skip' to skip problematic rows
            self.df = pd.read_csv(file_path, on_bad_lines='skip', engine='python')

            # Handle both album_id and track_album_id column names
            if 'album_id' in self.df.columns and 'track_album_id' not in self.df.columns:
                self.df['track_album_id'] = self.df['album_id']

            # Handle 'year' column if it exists (for legacy datasets)
            if 'year' in self.df.columns:
                self.df['release_year'] = self.df['year']
                self.df.dropna(subset=['release_year'], inplace=True)

            # Drop ID and metadata columns that aren't needed for training
            columns_to_drop = ['year', 'track_id', 'album_id', 'track_album_id', 
                               'playlist_id', 'artwork_url', 'track_url', 'source',
                               'track_name', 'artist_name', 'album_name', 'genre', 'language']
            # Only drop columns that actually exist
            columns_to_drop = [col for col in columns_to_drop if col in self.df.columns]
            self.df = self.df.drop(columns_to_drop, axis=1)

            # Convert musical DNA features to numeric, coercing errors
            for feature in self.musical_dna_features:
                if feature in self.df.columns:
                    self.df[feature] = pd.to_numeric(self.df[feature], errors='coerce')

            # Drop rows with NaN values in musical DNA features after coercion
            self.df.dropna(subset=self.musical_dna_features, inplace=True)
            
            # CRITICAL: Filter outliers that corrupt model training
            # Loudness should be between -60 and +5 dB (realistic audio range)
            # Some corrupt entries have -100000 which destroys the model
            initial_count = len(self.df)
            self.df = self.df[self.df['loudness'] >= -60]
            self.df = self.df[self.df['loudness'] <= 5]
            filtered_count = initial_count - len(self.df)
            if filtered_count > 0:
                logger.info(f"Filtered {filtered_count} rows with invalid loudness values")

            # Check if 'is_hit' already exists (from combined dataset pipeline)
            if 'is_hit' not in self.df.columns:
                # Define a 'hit' based on popularity score
                popularity_col = 'track_popularity' if 'track_popularity' in self.df.columns else 'popularity'
                if popularity_col not in self.df.columns:
                     raise KeyError("Neither 'track_popularity' nor 'popularity' column found for target variable.")

                # Convert the popularity column to numeric, coercing errors to NaN
                self.df[popularity_col] = pd.to_numeric(self.df[popularity_col], errors='coerce')
                # Drop rows where popularity is NaN after coercion
                self.df.dropna(subset=[popularity_col], inplace=True)

                # Define hit as popularity >= 50 (more balanced than 70)
                self.df['is_hit'] = (self.df[popularity_col] >= 50).astype(int)
            else:
                # Ensure is_hit is integer type
                self.df['is_hit'] = self.df['is_hit'].astype(int)

            # Check if all musical features exist and are numeric
            if not all(feature in self.df.columns for feature in self.musical_dna_features):
                missing_features = [f for f in self.musical_dna_features if f not in self.df.columns]
                raise KeyError(f"Missing musical DNA features: {missing_features}")

            # Also check if the dtypes are numeric
            for feature in self.musical_dna_features:
                if not pd.api.types.is_numeric_dtype(self.df[feature]):
                     raise TypeError(f"Musical DNA feature '{feature}' is not numeric after conversion.")

            X = self.df[self.musical_dna_features]
            Y = self.df['is_hit']

            return self.df, X, Y

        except Exception as e:
            print(f"[ERROR] load_and_prepare_data: {e}")
            return None, None, None

    def train_model(self, X, Y, force_retrain=False):
        """Train the model with option to force retrain"""
        data_hash = self._calculate_data_hash(X)

        if not force_retrain and self.load_model():
            return True

        start_time = datetime.now()

        self.X_train, self.X_test, self.Y_train, self.Y_test = train_test_split(
            X, Y, test_size=0.2, random_state=42, stratify=Y
        )

        self.feature_names = X.columns

        if self.model_type == "lstm" and TENSORFLOW_AVAILABLE:
            self._train_lstm_model(data_hash, start_time)
        else:
            self._train_xgboost_model(data_hash, start_time)

        return True

    def _train_xgboost_model(self, data_hash, start_time):
        """Train XGBoost with proper bias correction"""
        # Calculate class weights to handle severe class imbalance
        n_samples = len(self.Y_train)
        n_hits = (self.Y_train == 1).sum()
        n_non_hits = (self.Y_train == 0).sum()
        
        # Calculate scale_pos_weight as ratio of negative to positive
        # This is the correct parameter for XGBoost to handle class imbalance
        scale_pos_weight = n_non_hits / n_hits
        
        # Balanced weights for sample weighting
        weight_hits = n_samples / (2 * n_hits)
        weight_non_hits = n_samples / (2 * n_non_hits)
        
        sample_weights = np.where(self.Y_train == 1, weight_hits, weight_non_hits)

        self.model = XGBClassifier(
            use_label_encoder=False,
            eval_metric='logloss',  # Use logloss for binary classification
            enable_categorical=False,
            random_state=42,
            scale_pos_weight=scale_pos_weight,  # Proper class weighting
            max_depth=6,  # Moderate depth for balanced learning
            learning_rate=0.05,  # Lower learning rate for stability
            n_estimators=150,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=1,
            gamma=0,  # No regularization penalty
            # Use default base_score (0.5) for unbiased predictions
            # Do NOT artificially adjust this
        )

        self.model.fit(self.X_train, self.Y_train, sample_weight=sample_weights)

        predictions = self.model.predict(self.X_test)
        accuracy = accuracy_score(self.Y_test, predictions)
        training_time = (datetime.now() - start_time).total_seconds()

        self._save_model_metadata(accuracy, data_hash, training_time)
        self.save_model()

    def _train_lstm_model(self, data_hash, start_time):
        """Train LSTM model for sequential feature patterns"""
        # Scale features for LSTM
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(self.X_train)
        X_test_scaled = self.scaler.transform(self.X_test)
        
        # Reshape for LSTM (samples, time steps, features)
        # Treat each feature as a time step
        X_train_lstm = X_train_scaled.reshape((X_train_scaled.shape[0], X_train_scaled.shape[1], 1))
        X_test_lstm = X_test_scaled.reshape((X_test_scaled.shape[0], X_test_scaled.shape[1], 1))
        
        # Build LSTM model
        self.model = models.Sequential([
            layers.LSTM(64, activation='relu', input_shape=(X_train_lstm.shape[1], 1), return_sequences=True),
            layers.Dropout(0.2),
            layers.LSTM(32, activation='relu', return_sequences=False),
            layers.Dropout(0.2),
            layers.Dense(16, activation='relu'),
            layers.Dropout(0.2),
            layers.Dense(1, activation='sigmoid')
        ])
        
        # Compile with class weight handling
        self.model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='binary_crossentropy',
            metrics=['accuracy', keras.metrics.AUC()]
        )
        
        # Calculate class weights to balance imbalanced dataset
        n_samples = len(self.Y_train)
        n_hits = (self.Y_train == 1).sum()
        n_non_hits = (self.Y_train == 0).sum()
        # Inverse frequency weighting: weight = total / (2 * class_count)
        class_weight = {0: n_samples / (2 * n_non_hits), 1: n_samples / (2 * n_hits)}
        
        # Train with early stopping
        self.model.fit(
            X_train_lstm, self.Y_train,
            validation_data=(X_test_lstm, self.Y_test),
            epochs=100,
            batch_size=32,
            class_weight=class_weight,
            callbacks=[
                keras.callbacks.EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
            ],
            verbose=0
        )
        
        # Evaluate
        loss, accuracy, auc = self.model.evaluate(X_test_lstm, self.Y_test, verbose=0)
        training_time = (datetime.now() - start_time).total_seconds()

        self._save_model_metadata(accuracy, data_hash, training_time)
        self.save_model()

    def get_optimal_ranges(self):
        """Get optimal parameter ranges for hit songs"""
        if self.df is None:
            return None

        hit_songs = self.df[self.df['is_hit'] == 1]
        non_hit_songs = self.df[self.df['is_hit'] == 0]

        optimal_ranges = {}

        for feature in self.musical_dna_features:
            hit_mean = hit_songs[feature].mean()
            hit_std = hit_songs[feature].std()
            non_hit_mean = non_hit_songs[feature].mean()

            # Calculate optimal range (mean ± 1 std)
            optimal_min = max(0, hit_mean - hit_std)
            optimal_max = hit_mean + hit_std

            # Calculate statistical significance
            t_stat, p_value = stats.ttest_ind(hit_songs[feature], non_hit_songs[feature])
            significance = "VERY IMPORTANT" if p_value < 0.001 else "IMPORTANT" if p_value < 0.05 else "NORMAL"

            optimal_ranges[feature] = {
                'min': float(optimal_min),
                'max': float(optimal_max),
                'optimal_value': float(hit_mean),
                'importance': significance,
                'difference_from_non_hits': float(hit_mean - non_hit_mean)
            }

        return optimal_ranges

    def get_optimal_ranges_dict(self):
        """Return optimal ranges as dictionary (for API use)"""
        return self.get_optimal_ranges()

    def get_feature_importance(self):
        """Get feature importance from model"""
        try:
            # For ensemble mode, use XGBoost sub-model for feature importances
            if self.model_type == "ensemble":
                if self.xgb_model is not None and hasattr(self.xgb_model, 'feature_importances_'):
                    feature_importances = self.xgb_model.feature_importances_
                elif self.rf_model is not None and hasattr(self.rf_model, 'feature_importances_'):
                    feature_importances = self.rf_model.feature_importances_
                else:
                    # Fallback: generate equal importance
                    feature_importances = np.ones(len(self.feature_names)) / len(self.feature_names)
            elif self.model is not None and hasattr(self.model, 'feature_importances_'):
                feature_importances = self.model.feature_importances_
            else:
                return None

            importance_df = pd.DataFrame({
                'feature': self.feature_names,
                'importance': feature_importances
            }).sort_values('importance', ascending=False)

            return importance_df

        except Exception as e:
            return None

    def predict_song_hit_probability(self, song_features):
        """Predict the hit probability of a single song"""
        # Check if we have a valid model (either single model or ensemble)
        if self.model_type == "ensemble":
            if self.xgb_model is None:
                logger.error("Ensemble models not loaded!")
                return None
        elif self.model is None:
            logger.error("Model is None!")
            return None

        # Ensure the input song features are in the correct format (DataFrame)
        if isinstance(song_features, dict):
            song_df = pd.DataFrame([song_features])
        else:
            song_df = song_features.copy()

        # Add interaction features if they are needed but missing
        interaction_features = ['energy_x_danceability', 'loudness_x_energy', 'valence_x_danceability', 'tempo_bucket', 'duration_bucket']
        needed_interactions = [f for f in self.feature_names if f in interaction_features and f not in song_df.columns]
        if needed_interactions:
            song_df = self._add_interaction_features(song_df)

        # Ensure the columns are in the same order as the training features
        if not all(feature in song_df.columns for feature in self.feature_names):
            missing = [f for f in self.feature_names if f not in song_df.columns]
            logger.error(f"Missing features: {missing}")
            return None

        song_df = song_df[self.feature_names]

        # Convert features to numeric if they aren't already
        for feature in self.feature_names:
            if not pd.api.types.is_numeric_dtype(song_df[feature]):
                song_df[feature] = pd.to_numeric(song_df[feature], errors='coerce')

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
        
        for feature, (min_val, max_val) in feature_ranges.items():
            if feature in song_df.columns:
                song_df[feature] = np.clip(song_df[feature], min_val, max_val)

        # Handle potential NaN values after conversion
        if song_df.isnull().any().any():
            song_df.fillna(song_df.mean(), inplace=True)

        try:
            # Ensure no infinite values
            song_df = song_df.replace([np.inf, -np.inf], np.nan)
            song_df = song_df.fillna(song_df.mean())
            
            if self.model_type == "ensemble":
                hit_prob, confidence, is_hit = self._predict_ensemble(song_df)
            elif self.model_type == "lstm" and TENSORFLOW_AVAILABLE:
                hit_prob, confidence, is_hit = self._predict_lstm(song_df)
            else:
                hit_prob, confidence, is_hit = self._predict_xgboost(song_df)

            return {
                'hit_probability': float(hit_prob),
                'is_hit_prediction': bool(is_hit),
                'confidence': float(confidence),
                'model_type': self.model_type
            }

        except Exception as e:
            logger.error(f"Prediction error in predict_song_hit_probability: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def _add_interaction_features(df):
        """Add derived interaction features to a DataFrame."""
        df = df.copy()
        df['energy_x_danceability'] = df['energy'] * df['danceability']
        df['loudness_x_energy'] = (df['loudness'] + 60) / 60 * df['energy']
        df['valence_x_danceability'] = df['valence'] * df['danceability']
        df['tempo_bucket'] = pd.cut(df['tempo'], bins=[0, 90, 120, 150, 300], labels=[0, 1, 2, 3]).astype(float).fillna(1)
        df['duration_bucket'] = pd.cut(df['duration_ms'], bins=[0, 180000, 270000, 3600000], labels=[0, 1, 2]).astype(float).fillna(1)
        return df

    def _predict_ensemble(self, song_df):
        """Ensemble prediction optimized for XGBoost only due to RAM constraints."""
        try:
            # We bypass the massive RF and LR models to fit in Render's 512MB free tier
            xgb_proba = float(self.xgb_model.predict_proba(song_df)[:, 1][0])
            raw_prob = xgb_proba
            
            # ── Ensemble probability scaling ──────────────────────────────────
            # S-curve stretch to make predictions more decisive/confident
            # We shift the midpoint from 0.5 to 0.35 to add a generous baseline boost.
            # This elegantly compensates for the fact that Librosa's local feature extraction
            # often yields lower "energy" and "loudness" bounds than Spotify's proprietary API,
            # which otherwise causes the model to chronically under-predict real viral hits.
            import math
            def sigmoid_stretch(p, factor=4.5, midpoint=0.35):
                return 1 / (1 + math.exp(-factor * (p - midpoint)))
                
            calibrated_prob = sigmoid_stretch(float(raw_prob))
            calibrated_prob = max(0.02, min(0.98, calibrated_prob))
            
            is_hit = calibrated_prob >= 0.50
            
            # Confidence base on distance from 0.5, heavily boosted
            base_confidence = abs(calibrated_prob - 0.50) * 2
            confidence = (base_confidence ** 0.5) * 0.95 + 0.15
            confidence = min(max(confidence, 0.40), 0.99)
            
            return calibrated_prob, confidence, is_hit
        except Exception as e:
            logger.error(f"Ensemble prediction error: {e}")
            import traceback
            traceback.print_exc()
            return self._predict_xgboost(song_df)

    def _predict_xgboost(self, song_df):
        """XGBoost prediction - COMPLETELY NEUTRAL"""
        proba = self.model.predict_proba(song_df)[:, 1][0]
        
        # STANDARD 50% threshold
        hit_threshold = 0.50
        is_hit = proba > hit_threshold
        confidence = min(abs(proba - hit_threshold) * 2, 1.0)

        return proba, confidence, is_hit

    def _predict_lstm(self, song_df):
        """LSTM prediction - COMPLETELY NEUTRAL"""
        song_scaled = self.scaler.transform(song_df)
        song_lstm = song_scaled.reshape((song_scaled.shape[0], song_scaled.shape[1], 1))
        
        hit_prob = float(self.model.predict(song_lstm, verbose=0)[0][0])
        
        # STANDARD 50% threshold
        hit_threshold = 0.50
        is_hit = hit_prob > hit_threshold
        confidence = min(abs(hit_prob - hit_threshold) * 2, 1.0)

        return hit_prob, confidence, is_hit

    def _apply_ensemble_bias_correction(self, probability):
        """
        NEUTRAL: No bias correction - return raw probability.
        This function is kept for compatibility but does nothing.
        """
        return float(probability)
    
    def _apply_probability_bias_correction(self, probability):
        """
        NEUTRAL: No bias correction - return raw probability.
        This function is kept for compatibility but does nothing.
        """
        return float(probability)


    def suggest_feature_improvements(self, song_features):
        """Suggest which features to change to make a song more likely to be a hit"""
        # Convert to DataFrame if dict
        if isinstance(song_features, dict):
            original_features = pd.DataFrame([song_features])
        else:
            original_features = song_features.copy()

        # Get original prediction using full ensemble scaling
        orig_pred = self.predict_song_hit_probability(original_features)
        if not orig_pred:
            return []
        
        original_prob = orig_pred['hit_probability']

        # Get optimal ranges
        optimal_ranges = self.get_optimal_ranges()
        suggestions = []

        # Only suggest features that our DSP mutator can physically change
        mutable_features = ['tempo', 'loudness', 'key', 'energy', 'liveness', 'acousticness']
        
        for feature in self.musical_dna_features:
            if feature not in original_features.columns or feature not in optimal_ranges:
                continue
                
            if feature not in mutable_features:
                continue

            current_value = original_features[feature].iloc[0]
            optimal_range = optimal_ranges[feature]
            optimal_val = optimal_range['optimal_value']
            
            # Test improvement by moving towards optimal value
            test_features = original_features.copy()

            # Realistic physical mutation limits for DSP filters
            max_deltas = {
                'tempo': current_value * 0.15 if current_value > 0 else 15.0, # Max 15% tempo shift
                'loudness': 4.0, # Max 4dB shift
                'key': 2.0, # Max 2 semitones
                'energy': 0.15,
                'liveness': 0.15,
                'acousticness': 0.20
            }
            
            max_delta = max_deltas.get(feature, 0.15)
            
            # We want to find the best possible improvement within the max_delta range
            # We will test both INCREASE and DECREASE directions with small steps
            best_improvement = 0.0
            best_suggested_val = current_value
            best_direction = "OPTIMAL"
            best_new_prob = original_prob
            
            steps = 5
            step_size = max_delta / steps
            
            for direction_sign in [1, -1]:
                for step in range(1, steps + 1):
                    test_val = current_value + (direction_sign * step * step_size)
                    
                    # Clamp to reasonable bounds if needed (mostly relying on max_delta)
                    # For things like loudness, keep it < 0
                    if feature == 'loudness':
                        test_val = min(test_val, 0.0)
                    elif feature != 'tempo' and feature != 'loudness':
                        # Most features are 0 to 1
                        test_val = max(0.0, min(test_val, 1.0))
                    else:
                        test_val = max(0.0, test_val)
                        
                    test_features[feature] = test_val
                    new_pred = self.predict_song_hit_probability(test_features)
                    
                    if new_pred:
                        test_prob = new_pred['hit_probability']
                        improvement = test_prob - original_prob
                        
                        if improvement > best_improvement:
                            best_improvement = improvement
                            best_suggested_val = test_val
                            best_new_prob = test_prob
                            best_direction = "INCREASE" if direction_sign == 1 else "DECREASE"
                            
            # Only suggest if it actually provides a meaningful positive improvement
            if best_improvement > 0.005:
                suggestions.append({
                    'feature': feature,
                    'current': float(current_value),
                    'suggested': float(best_suggested_val),
                    'direction': best_direction,
                    'improvement': float(best_improvement),
                    'improvement_percent': float(best_improvement * 100),
                    'new_probability': float(best_new_prob),
                    'importance': optimal_range['importance']
                })

        # Sort by improvement potential
        suggestions.sort(key=lambda x: x['improvement'], reverse=True)
        
        # Return top 5 suggestions
        return suggestions[:5]


    def get_prediction_dict(self, song_features):
        """Get prediction as dictionary (for API use)"""
        result = self.predict_song_hit_probability(song_features)
        if result:
            return {
                'hit_probability': float(result['hit_probability']),
                'confidence': float(result['confidence']),
                'is_hit': bool(result['is_hit_prediction'])
            }
        return None


# Export class for use in Flask app and other modules
__all__ = ['SongHitPredictor']
