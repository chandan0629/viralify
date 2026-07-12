import pandas as pd

def test_suggestions():
    # Mocking song features
    original_features = pd.DataFrame([{
        'danceability': 0.77,
        'energy': 0.44,
        'valence': 0.50,
        'acousticness': 0.23,
        'speechiness': 0.37,
        'instrumentalness': 0.08,
        'liveness': 0.27,
        'tempo': 117.45,
        'loudness': -3.0,
        'key': 9,
        'mode': 1
    }])
    
    musical_dna_features = ['tempo', 'loudness', 'key', 'energy', 'liveness', 'acousticness', 'danceability', 'valence', 'speechiness', 'instrumentalness', 'mode']
    
    optimal_ranges = {f: {'optimal_value': 0.5, 'importance': 'NORMAL'} for f in musical_dna_features}
    
    # Mock prediction
    def predict_song_hit_probability(features):
        # Dummy prediction that increases as we move away from original
        diff = sum(abs(features[f].iloc[0] - original_features[f].iloc[0]) for f in musical_dna_features)
        return {'hit_probability': 0.732 + diff * 0.1, 'confidence': 0.8, 'is_hit_prediction': True}
        
    original_prob = 0.732
    suggestions = []
    
    mutable_features = [
        'tempo', 'loudness', 'key', 'energy', 'liveness', 
        'acousticness', 'danceability', 'valence', 'speechiness', 'instrumentalness'
    ]
    
    for feature in musical_dna_features:
        if feature not in original_features.columns or feature not in optimal_ranges:
            continue
            
        if feature not in mutable_features:
            continue
            
        current_value = original_features[feature].iloc[0]
        optimal_range = optimal_ranges[feature]
        optimal_val = optimal_range['optimal_value']
        
        test_features = original_features.copy()
        
        max_deltas = {
            'tempo': current_value * 0.25 if current_value > 0 else 25.0, # Max 25% tempo shift
            'loudness': 8.0, # Max 8dB shift
            'key': 4.0, # Max 4 semitones
            'energy': 0.30,
            'liveness': 0.30,
            'acousticness': 0.40,
            'danceability': 0.30,
            'valence': 0.30,
            'speechiness': 0.20,
            'instrumentalness': 0.30
        }
        
        max_delta = max_deltas.get(feature, 0.20)
        
        best_improvement = 0.0
        best_suggested_val = current_value
        best_direction = "OPTIMAL"
        best_new_prob = original_prob
        
        steps = 8
        step_size = max_delta / steps
        
        for direction_sign in [1, -1]:
            for step in range(1, steps + 1):
                test_val = current_value + (direction_sign * step * step_size)
                
                if feature == 'loudness':
                    test_val = min(test_val, 0.0)
                elif feature != 'tempo' and feature != 'loudness' and feature != 'key':
                    test_val = max(0.0, min(test_val, 1.0))
                else:
                    test_val = max(0.0, test_val)
                    
                test_features[feature] = test_val
                new_pred = predict_song_hit_probability(test_features)
                
                if new_pred:
                    test_prob = new_pred['hit_probability']
                    improvement = test_prob - original_prob
                    
                    if improvement > best_improvement:
                        best_improvement = improvement
                        best_suggested_val = test_val
                        best_new_prob = test_prob
                        best_direction = "INCREASE" if direction_sign == 1 else "DECREASE"
                        
        if best_improvement > 0.001:
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
            
    print(len(suggestions), "suggestions found")
    for s in suggestions:
        print(s['feature'], s['improvement'])

test_suggestions()
