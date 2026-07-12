import json
from backend.models.predict_main import HitPredictor
import logging

logging.basicConfig(level=logging.INFO)
predictor = HitPredictor()

data = {
    "danceability": 0.77,
    "energy": 0.44,
    "valence": 0.50,
    "acousticness": 0.23,
    "speechiness": 0.37,
    "instrumentalness": 0.08,
    "liveness": 0.27,
    "tempo": 117.45,
    "loudness": -3.0,
    "key": 9,
    "mode": 1,
    "duration_ms": 223000
}

suggestions = predictor.suggest_feature_improvements(data)
print(json.dumps(suggestions, indent=2))
