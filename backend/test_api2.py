import requests
url = 'http://127.0.0.1:5000/api/analyze-audio'
files = {'file': open('dummy.wav', 'rb')}
response = requests.post(url, files=files)
print("Status:", response.status_code)
print("Response:", response.text)
