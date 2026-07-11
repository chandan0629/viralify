import requests
import numpy as np
import soundfile as sf
import io

# Create a dummy silent wav file
data = np.zeros(22050)
sf.write('dummy.wav', data, 22050)

# Send to backend
url = 'http://127.0.0.1:5000/api/analyze-audio'
files = {'audio': open('dummy.wav', 'rb')}
try:
    response = requests.post(url, files=files)
    print("Status:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Exception:", e)
