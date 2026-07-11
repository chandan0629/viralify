import numpy as np
import librosa
import soundfile as sf

def is_speech_robust(y, sr):
    # 1. Silence Ratio (Speech has pauses)
    rms = librosa.feature.rms(y=y)[0]
    normalized_rms = rms / (np.max(rms) + 1e-10)
    silence_ratio = np.mean(normalized_rms < 0.15)
    
    # 2. Harmonic to Noise Ratio
    y_harmonic, y_percussive = librosa.effects.hpss(y)
    harmonic_energy = np.sum(y_harmonic**2)
    percussive_energy = np.sum(y_percussive**2)
    harmonic_ratio = harmonic_energy / (harmonic_energy + percussive_energy + 1e-10)
    
    # 3. Zero Crossing Rate
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    zcr_mean = np.mean(zcr)
    
    # 4. Spectral Flatness
    flatness = librosa.feature.spectral_flatness(y=y)[0]
    flatness_mean = np.mean(flatness)
    
    print(f"Silence Ratio: {silence_ratio:.3f}")
    print(f"Harmonic Ratio: {harmonic_ratio:.3f}")
    print(f"ZCR Mean: {zcr_mean:.3f}")
    print(f"Flatness: {flatness_mean:.3f}")
    
    # Heuristic scoring
    score = 0
    if silence_ratio > 0.15: score += 1.5 # Strong speech indicator
    if harmonic_ratio < 0.6: score += 1.0 # Less harmonic = speech/noise
    if zcr_mean > 0.08: score += 0.5 # Consonants
    if flatness_mean > 0.01: score += 0.5
    
    print(f"Speech Score: {score:.1f} / 3.5")
    return score >= 2.0

# Generate dummy sine wave (music-like)
sr = 22050
t = np.linspace(0, 5, 5 * sr)
y_music = np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 880 * t) * 0.5
print("Testing Music...")
is_speech_robust(y_music, sr)

# Generate dummy speech-like (bursts of noise/tones with pauses)
y_speech = np.zeros_like(t)
for i in range(5):
    start = int((i + 0.1) * sr)
    end = int((i + 0.5) * sr)
    y_speech[start:end] = np.random.randn(end - start) * 0.5 + np.sin(2 * np.pi * 200 * t[start:end])
print("\nTesting Speech...")
is_speech_robust(y_speech, sr)
