import requests
url = 'http://localhost:7860/api/analyze-audio'
files = {'file': open('dummy_test.wav', 'rb')}
r = requests.post(url, files=files)
print(r.status_code)
print(r.json().get('suggestions', []))
