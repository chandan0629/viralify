import requests
import json
import time

url_analyze = 'http://localhost:7860/api/analyze-audio'
url_mutate = 'http://localhost:7860/api/mutate-audio'

print("Analyzing audio...")
with open('dummy_test.wav', 'rb') as f:
    r = requests.post(url_analyze, files={'file': f})
    
if r.status_code != 200:
    print(f"Analysis failed: {r.text}")
    exit(1)

data = r.json()
analysis_id = data.get('analysisId')
features = data.get('features')
print(f"Analysis success! ID: {analysis_id}")
print(f"Suggestions returned: {len(data.get('suggestions', []))}")

print("Testing mutation...")
payload = {
    'analysisId': analysis_id,
    'target_tempo': 130,
    'original_tempo': features.get('tempo'),
    'target_key': 3,
    'original_key': features.get('key'),
    'target_loudness': -1.0,
    'original_loudness': features.get('loudness')
}

r2 = requests.post(url_mutate, json=payload)
if r2.status_code != 200:
    print(f"Mutation failed: {r2.text}")
else:
    print(f"Mutation success! Received bytes: {len(r2.content)}")
    
