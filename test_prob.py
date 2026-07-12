import requests
url = "https://viralify-backend-506139712110.us-central1.run.app/api/predict"
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
res = requests.post(url, json=data)
print(res.json())
