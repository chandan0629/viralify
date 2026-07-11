import sys
sys.path.append('backend')
from models.predict_main import SongHitPredictor

print("Loading models...")
predictor = SongHitPredictor(model_dir="backend/models", data_dir="backend/data")
success = predictor.load_model()
print(f"Model loaded: {success}")
if not success:
    print("FAILED to load models.")
    sys.exit(1)

test_features = {
    'danceability': 0.8,
    'energy': 0.7,
    'key': 5,
    'loudness': -5.0,
    'mode': 1,
    'speechiness': 0.05,
    'acousticness': 0.1,
    'instrumentalness': 0.0,
    'liveness': 0.1,
    'valence': 0.6,
    'tempo': 120.0,
    'duration_ms': 200000,
    'target_year': 2024
}

print("Predicting hit probability...")
result = predictor.predict_song_hit_probability(test_features)
print(f"Result: {result}")

if result is not None and 'hit_probability' in result:
    print("Prediction SUCCESSFUL")
else:
    print("Prediction FAILED")
