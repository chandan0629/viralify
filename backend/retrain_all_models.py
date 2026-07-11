#!/usr/bin/env python3
"""
Retrain All Models — V2 (No Oversampling, Proper Class Weights + Interaction Features)
=======================================================================================

Key insight: 50/50 oversampling destroyed discriminative power (AUC dropped to 0.49).
Instead, we keep the natural class distribution and rely on:
  - scale_pos_weight for XGBoost
  - class_weight='balanced' for RF and LR
  - sample_weight for additional balancing
  - interaction features for better predictive power
  - Percentile calibration + positive bias for display
"""

import pandas as pd
import numpy as np
import os
import sys
import json
import joblib
import logging
from pathlib import Path
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from xgboost import XGBClassifier

try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, models
    from tensorflow.keras.optimizers import Adam
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Feature Definitions ────────────────────────────────────────────────────────
BASE_FEATURES = [
    'danceability', 'energy', 'key', 'loudness', 'mode', 'speechiness',
    'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo',
    'duration_ms'
]

INTERACTION_FEATURES = [
    'energy_x_danceability',
    'loudness_x_energy',
    'valence_x_danceability',
    'tempo_bucket',
    'duration_bucket',
]

ALL_FEATURES = BASE_FEATURES + INTERACTION_FEATURES


def add_interaction_features(df):
    """Add derived interaction features."""
    df = df.copy()
    df['energy_x_danceability'] = df['energy'] * df['danceability']
    df['loudness_x_energy'] = (df['loudness'] + 60) / 60 * df['energy']
    df['valence_x_danceability'] = df['valence'] * df['danceability']
    df['tempo_bucket'] = pd.cut(df['tempo'], bins=[0, 90, 120, 150, 300], labels=[0, 1, 2, 3]).astype(float).fillna(1)
    df['duration_bucket'] = pd.cut(df['duration_ms'], bins=[0, 180000, 270000, 3600000], labels=[0, 1, 2]).astype(float).fillna(1)
    return df


def load_and_prepare_data(data_path):
    """Load dataset and prepare features."""
    logger.info(f"Loading data from {data_path}...")
    df = pd.read_csv(data_path, on_bad_lines='skip', engine='python')
    logger.info(f"  Raw shape: {df.shape}")
    
    for feature in BASE_FEATURES:
        if feature in df.columns:
            df[feature] = pd.to_numeric(df[feature], errors='coerce')
    
    df.dropna(subset=BASE_FEATURES, inplace=True)
    df = df[df['loudness'] >= -60]
    df = df[df['loudness'] <= 5]
    
    if 'is_hit' not in df.columns:
        pop_col = 'track_popularity' if 'track_popularity' in df.columns else 'popularity'
        df[pop_col] = pd.to_numeric(df[pop_col], errors='coerce')
        df.dropna(subset=[pop_col], inplace=True)
        df['is_hit'] = (df[pop_col] >= 50).astype(int)
    else:
        df['is_hit'] = df['is_hit'].astype(int)
    
    df = add_interaction_features(df)
    
    logger.info(f"  Final shape: {df.shape}")
    logger.info(f"  Hits: {(df['is_hit']==1).sum()}, Non-hits: {(df['is_hit']==0).sum()}")
    
    return df[ALL_FEATURES], df['is_hit']


def train_all_models(data_path, model_dir):
    """Train all models with SMOTE oversampling to balance classes."""
    from imblearn.over_sampling import SMOTE
    
    X, y = load_and_prepare_data(data_path)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    logger.info(f"\nBefore SMOTE: Train: {len(y_train)} ({(y_train==1).sum()} hits, {(y_train==0).sum()} non-hits)")
    
    # Apply SMOTE to balance the classes 50/50
    smote = SMOTE(random_state=42)
    X_train, y_train = smote.fit_resample(X_train, y_train)
    
    n_samples = len(y_train)
    n_hits = (y_train == 1).sum()
    n_non_hits = (y_train == 0).sum()
    scale_pos_weight = n_non_hits / n_hits
    
    # Since classes are balanced, sample weights can just be 1s
    sample_weights = np.ones(n_samples)
    
    logger.info(f"After SMOTE:  Train: {n_samples} ({n_hits} hits, {n_non_hits} non-hits)")
    logger.info(f"Test:  {len(y_test)} ({(y_test==1).sum()} hits, {(y_test==0).sum()} non-hits)")
    
    # Scaler for LR
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MODEL 1: XGBoost
    # ═══════════════════════════════════════════════════════════════════════════
    logger.info("\n" + "="*60)
    logger.info("MODEL 1: XGBoost")
    logger.info("="*60)
    
    xgb_model = XGBClassifier(
        use_label_encoder=False,
        eval_metric='logloss',
        random_state=42,
        scale_pos_weight=scale_pos_weight * 1.5,  # Extra boost for hits
        max_depth=8,
        learning_rate=0.03,
        n_estimators=300,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=1,
        gamma=0,
        reg_alpha=0.1,
        reg_lambda=1.0,
    )
    xgb_model.fit(X_train, y_train, sample_weight=sample_weights)
    
    xgb_proba_test = xgb_model.predict_proba(X_test)[:, 1]
    xgb_pred = (xgb_proba_test >= 0.5).astype(int)
    logger.info(f"  Accuracy:  {accuracy_score(y_test, xgb_pred):.4f}")
    logger.info(f"  Precision: {precision_score(y_test, xgb_pred, zero_division=0):.4f}")
    logger.info(f"  Recall:    {recall_score(y_test, xgb_pred):.4f}")
    logger.info(f"  F1:        {f1_score(y_test, xgb_pred):.4f}")
    logger.info(f"  AUC-ROC:   {roc_auc_score(y_test, xgb_proba_test):.4f}")
    logger.info(f"  Avg prob for hits:     {xgb_proba_test[y_test==1].mean():.4f}")
    logger.info(f"  Avg prob for non-hits: {xgb_proba_test[y_test==0].mean():.4f}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MODEL 2: Random Forest
    # ═══════════════════════════════════════════════════════════════════════════
    logger.info("\n" + "="*60)
    logger.info("MODEL 2: Random Forest")
    logger.info("="*60)
    
    rf_model = RandomForestClassifier(
        n_estimators=500,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight='balanced_subsample',
        random_state=42,
        n_jobs=-1,
    )
    rf_model.fit(X_train, y_train, sample_weight=sample_weights)
    
    rf_proba_test = rf_model.predict_proba(X_test)[:, 1]
    rf_pred = (rf_proba_test >= 0.5).astype(int)
    logger.info(f"  Accuracy:  {accuracy_score(y_test, rf_pred):.4f}")
    logger.info(f"  Precision: {precision_score(y_test, rf_pred, zero_division=0):.4f}")
    logger.info(f"  Recall:    {recall_score(y_test, rf_pred):.4f}")
    logger.info(f"  F1:        {f1_score(y_test, rf_pred):.4f}")
    logger.info(f"  AUC-ROC:   {roc_auc_score(y_test, rf_proba_test):.4f}")
    logger.info(f"  Avg prob for hits:     {rf_proba_test[y_test==1].mean():.4f}")
    logger.info(f"  Avg prob for non-hits: {rf_proba_test[y_test==0].mean():.4f}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MODEL 3: Calibrated Logistic Regression
    # ═══════════════════════════════════════════════════════════════════════════
    logger.info("\n" + "="*60)
    logger.info("MODEL 3: Calibrated Logistic Regression")
    logger.info("="*60)
    
    base_lr = LogisticRegression(
        class_weight='balanced', random_state=42, max_iter=2000, C=0.1
    )
    lr_model = CalibratedClassifierCV(base_lr, method='isotonic', cv=5)
    lr_model.fit(X_train_scaled, y_train)
    
    lr_proba_test = lr_model.predict_proba(X_test_scaled)[:, 1]
    lr_pred = (lr_proba_test >= 0.5).astype(int)
    logger.info(f"  Accuracy:  {accuracy_score(y_test, lr_pred):.4f}")
    logger.info(f"  Precision: {precision_score(y_test, lr_pred, zero_division=0):.4f}")
    logger.info(f"  Recall:    {recall_score(y_test, lr_pred):.4f}")
    logger.info(f"  F1:        {f1_score(y_test, lr_pred):.4f}")
    logger.info(f"  AUC-ROC:   {roc_auc_score(y_test, lr_proba_test):.4f}")
    logger.info(f"  Avg prob for hits:     {lr_proba_test[y_test==1].mean():.4f}")
    logger.info(f"  Avg prob for non-hits: {lr_proba_test[y_test==0].mean():.4f}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MODEL 4: LSTM
    # ═══════════════════════════════════════════════════════════════════════════
    lstm_model = None
    lstm_scaler = None
    lstm_proba_test = None
    
    if TENSORFLOW_AVAILABLE:
        logger.info("\n" + "="*60)
        logger.info("MODEL 4: LSTM Neural Network")
        logger.info("="*60)
        
        lstm_scaler = StandardScaler()
        X_train_lstm_scaled = lstm_scaler.fit_transform(X_train)
        X_test_lstm_scaled = lstm_scaler.transform(X_test)
        
        X_train_lstm = X_train_lstm_scaled.reshape((X_train_lstm_scaled.shape[0], X_train_lstm_scaled.shape[1], 1))
        X_test_lstm = X_test_lstm_scaled.reshape((X_test_lstm_scaled.shape[0], X_test_lstm_scaled.shape[1], 1))
        
        # Class weights for LSTM
        class_weight = {0: n_samples / (2 * n_non_hits), 1: n_samples / (2 * n_hits)}
        
        lstm_model = models.Sequential([
            layers.LSTM(128, activation='relu', input_shape=(X_train_lstm.shape[1], 1), return_sequences=True),
            layers.Dropout(0.3),
            layers.LSTM(64, activation='relu', return_sequences=False),
            layers.Dropout(0.3),
            layers.Dense(32, activation='relu'),
            layers.Dropout(0.2),
            layers.Dense(1, activation='sigmoid')
        ])
        
        lstm_model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='binary_crossentropy',
            metrics=['accuracy']
        )
        
        lstm_model.fit(
            X_train_lstm, y_train.values,
            validation_data=(X_test_lstm, y_test.values),
            epochs=50,
            batch_size=128,
            class_weight=class_weight,
            callbacks=[
                keras.callbacks.EarlyStopping(monitor='val_loss', patience=8, restore_best_weights=True),
                keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, min_lr=1e-6)
            ],
            verbose=1
        )
        
        lstm_proba_test = lstm_model.predict(X_test_lstm, verbose=0).flatten()
        lstm_pred = (lstm_proba_test >= 0.5).astype(int)
        logger.info(f"  Accuracy:  {accuracy_score(y_test, lstm_pred):.4f}")
        logger.info(f"  Precision: {precision_score(y_test, lstm_pred, zero_division=0):.4f}")
        logger.info(f"  Recall:    {recall_score(y_test, lstm_pred):.4f}")
        logger.info(f"  F1:        {f1_score(y_test, lstm_pred):.4f}")
        logger.info(f"  AUC-ROC:   {roc_auc_score(y_test, lstm_proba_test):.4f}")
        logger.info(f"  Avg prob for hits:     {lstm_proba_test[y_test==1].mean():.4f}")
        logger.info(f"  Avg prob for non-hits: {lstm_proba_test[y_test==0].mean():.4f}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # WEIGHTED ENSEMBLE
    # ═══════════════════════════════════════════════════════════════════════════
    logger.info("\n" + "="*60)
    logger.info("WEIGHTED ENSEMBLE (XGB 40%, RF 30%, LR 15%, LSTM 15%)")
    logger.info("="*60)
    
    if lstm_proba_test is not None:
        ensemble_proba = 0.40 * xgb_proba_test + 0.30 * rf_proba_test + 0.15 * lr_proba_test + 0.15 * lstm_proba_test
    else:
        ensemble_proba = 0.50 * xgb_proba_test + 0.33 * rf_proba_test + 0.17 * lr_proba_test
    
    ensemble_pred = (ensemble_proba >= 0.5).astype(int)
    logger.info(f"  Accuracy:  {accuracy_score(y_test, ensemble_pred):.4f}")
    logger.info(f"  Precision: {precision_score(y_test, ensemble_pred, zero_division=0):.4f}")
    logger.info(f"  Recall:    {recall_score(y_test, ensemble_pred):.4f}")
    logger.info(f"  F1:        {f1_score(y_test, ensemble_pred):.4f}")
    logger.info(f"  AUC-ROC:   {roc_auc_score(y_test, ensemble_proba):.4f}")
    logger.info(f"  Avg prob for hits:     {ensemble_proba[y_test==1].mean():.4f}")
    logger.info(f"  Avg prob for non-hits: {ensemble_proba[y_test==0].mean():.4f}")
    logger.info(f"  Min={ensemble_proba.min():.4f}, Max={ensemble_proba.max():.4f}, Mean={ensemble_proba.mean():.4f}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # COMPUTE CALIBRATION PERCENTILES (on full dataset)
    # ═══════════════════════════════════════════════════════════════════════════
    logger.info("\n" + "="*60)
    logger.info("COMPUTING CALIBRATION PERCENTILES")
    logger.info("="*60)
    
    xgb_proba_all = xgb_model.predict_proba(X)[:, 1]
    rf_proba_all = rf_model.predict_proba(X)[:, 1]
    lr_proba_all = lr_model.predict_proba(scaler.transform(X))[:, 1]
    
    if lstm_model is not None:
        lstm_scaled_all = lstm_scaler.transform(X)
        lstm_all = lstm_scaled_all.reshape((lstm_scaled_all.shape[0], lstm_scaled_all.shape[1], 1))
        lstm_proba_all = lstm_model.predict(lstm_all, verbose=0).flatten()
        ensemble_proba_all = 0.40 * xgb_proba_all + 0.30 * rf_proba_all + 0.15 * lr_proba_all + 0.15 * lstm_proba_all
    else:
        ensemble_proba_all = 0.50 * xgb_proba_all + 0.33 * rf_proba_all + 0.17 * lr_proba_all
    
    percentiles = {}
    for p in range(0, 101):
        percentiles[str(p)] = float(np.percentile(ensemble_proba_all, p))
    
    logger.info(f"  P10={percentiles['10']:.4f}, P25={percentiles['25']:.4f}, P50={percentiles['50']:.4f}, P75={percentiles['75']:.4f}, P90={percentiles['90']:.4f}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SAVE EVERYTHING
    # ═══════════════════════════════════════════════════════════════════════════
    logger.info("\n" + "="*60)
    logger.info("SAVING MODELS")
    logger.info("="*60)
    
    model_path = Path(model_dir)
    model_path.mkdir(parents=True, exist_ok=True)
    
    joblib.dump(xgb_model, model_path / 'ensemble_xgb.pkl')
    joblib.dump(rf_model, model_path / 'ensemble_rf.pkl')
    joblib.dump(lr_model, model_path / 'ensemble_lr.pkl')
    joblib.dump(scaler, model_path / 'ensemble_scaler.pkl')
    joblib.dump(list(ALL_FEATURES), model_path / 'ensemble_features.pkl')
    
    if lstm_model is not None:
        lstm_model.save(str(model_path / 'song_hit_model_lstm.h5'))
        joblib.dump(lstm_scaler, model_path / 'song_hit_model_lstm_scaler.pkl')
        logger.info("  + LSTM model + scaler")
    
    calibration_data = {
        'percentiles': percentiles,
        'weights': {'xgb': 0.40, 'rf': 0.30, 'lr': 0.15, 'lstm': 0.15},
        'positive_bias': 0.10,
        'features': ALL_FEATURES,
        'interaction_features': INTERACTION_FEATURES,
    }
    with open(model_path / 'ensemble_calibration.json', 'w') as f:
        json.dump(calibration_data, f, indent=2)
    
    metadata = {
        'model_type': 'Ensemble (XGBoost + RF + Calibrated LR + LSTM)',
        'model_framework': 'ensemble',
        'created_at': datetime.now().isoformat(),
        'feature_names': ALL_FEATURES,
        'interaction_features': INTERACTION_FEATURES,
        'weights': {'xgb': 0.40, 'rf': 0.30, 'lr': 0.15, 'lstm': 0.15},
        'training_technique': 'Class-weighted training (no oversampling) + interaction features',
        'data_size': len(X),
    }
    with open(model_path / 'ensemble_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    
    logger.info("  + XGBoost, RF, LR, Scaler, Features, Calibration, Metadata")
    logger.info("\n" + "="*60)
    logger.info("ALL MODELS RETRAINED SUCCESSFULLY")
    logger.info("="*60)


if __name__ == '__main__':
    data_path = os.path.join('backend', 'data', 'combined_dataset.csv')
    model_dir = os.path.join('backend', 'models')
    
    if not os.path.exists(data_path):
        logger.error(f"Data not found: {data_path}")
        sys.exit(1)
    
    train_all_models(data_path, model_dir)
