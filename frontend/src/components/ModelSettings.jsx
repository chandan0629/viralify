import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Cpu, CheckCircle, Database, AlertCircle, Zap, ShieldCheck } from 'lucide-react'
import './ModelSettings.css'

const BACKEND_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:7860')

export default function ModelSettings() {
  const [modelInfo, setModelInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    fetchModelData()
  }, [])

  const fetchModelData = async () => {
    try {
      setLoading(true)
      const infoRes = await fetch(`${BACKEND_URL}/api/model-info`)
      const info = await infoRes.json()
      setModelInfo(info)
    } catch (err) {
      setError('Failed to fetch model info: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchModel = async (modelType) => {
    try {
      setSwitching(true)
      setError(null)
      setSuccessMsg('')
      const res = await fetch(`${BACKEND_URL}/api/switch-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_type: modelType })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to switch model')
      
      setSuccessMsg(`Successfully routed audio processing to ${modelType.toUpperCase()} cluster.`)
      setTimeout(() => setSuccessMsg(''), 5000)
      fetchModelData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSwitching(false)
    }
  }

  if (loading) {
    return (
      <div className="settings-container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh'}}>
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="settings-container"
    >
      <div className="section-header text-center" style={{marginBottom: '40px'}}>
        <h2>Engine <span className="text-gradient">Command Center</span></h2>
        <p className="subtitle-glow">Configure your AI prediction backend architecture</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="error-message" style={{marginBottom: '20px'}}>
            <AlertCircle size={18} /> {error}
          </motion.div>
        )}
        {successMsg && (
          <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="success-message" style={{marginBottom: '20px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(16, 185, 129, 0.2)'}}>
            <CheckCircle size={18} /> {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="settings-grid">
        <div className="settings-card glass-panel highlight-panel">
          <div className="card-header">
            <Zap size={24} color="#F59E0B" />
            <h3>Active Neural Cluster</h3>
          </div>
          <div className="active-model-display">
            <motion.div 
              key={modelInfo?.active_model}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="model-badge-large"
            >
              {modelInfo?.active_model ? modelInfo.active_model.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
            </motion.div>
            <p style={{marginTop: '15px', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: '1.5'}}>
              This engine is currently powering all live prediction logic, feature weights, and DSP mutation suggestions.
            </p>
          </div>
        </div>

        <div className="settings-card glass-panel">
          <div className="card-header">
            <Cpu size={24} color="#3B82F6" />
            <h3>Switch Architecture</h3>
          </div>
          <p style={{marginBottom: '20px', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem'}}>Hot-swap your machine learning backend. 'Ensemble' leverages multiple models for highest accuracy.</p>
          <div className="model-options">
            {['ensemble', 'xgboost', 'random_forest', 'logistic_regression'].map((m, idx) => (
              <motion.button 
                key={m} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={modelInfo?.active_model !== m && !switching ? { scale: 1.02, x: 5 } : {}}
                whileTap={modelInfo?.active_model !== m && !switching ? { scale: 0.98 } : {}}
                className={`model-btn ${modelInfo?.active_model === m ? 'active' : ''}`}
                onClick={() => handleSwitchModel(m)}
                disabled={switching || modelInfo?.active_model === m}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{switching && modelInfo?.active_model !== m ? 'ROUTING...' : m.replace('_', ' ').toUpperCase()}</span>
                  {modelInfo?.active_model === m && <motion.div layoutId="active-indicator" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60A5FA', boxShadow: '0 0 10px #60A5FA' }} />}
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {modelInfo?.metadata && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="settings-card glass-panel full-width" 
            style={{gridColumn: '1 / -1'}}
          >
            <div className="card-header">
              <ShieldCheck size={24} color="#10B981" />
              <h3>Engine Telemetry & Diagnostics</h3>
            </div>
            <div className="metadata-grid">
              <div className="meta-item">
                <span className="meta-label">Training Timestamp</span>
                <span className="meta-value">{new Date(modelInfo.metadata.training_timestamp).toLocaleString()}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Dataset Size (Tracks)</span>
                <span className="meta-value glow-text-blue">{(modelInfo.metadata.training_samples || 0).toLocaleString()}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Features Evaluated</span>
                <span className="meta-value glow-text-pink">{modelInfo.metadata.features_count}</span>
              </div>
              {modelInfo.improvements && (
                <div className="meta-item">
                  <span className="meta-label">Bias Correction Engine</span>
                  <span className="meta-value glow-text-green">{modelInfo.improvements.bias_correction.toUpperCase()}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
