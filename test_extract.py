import sys
sys.path.append('backend')
from data_pipeline import AudioFeatureExtractor
extractor = AudioFeatureExtractor()
features = extractor.extract_features('backend/dummy.wav')
print(features)
