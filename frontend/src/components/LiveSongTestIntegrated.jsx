import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import html2pdf from 'html2pdf.js'
import HookInfoPopover from './HookInfoPopover'
import ReportTemplate from './ReportTemplate'
import './LiveSongTest.css'

export default function LiveSongTestIntegrated() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  
  const [analyzingHooks, setAnalyzingHooks] = useState(false)
  const [hookLoadingText, setHookLoadingText] = useState('Initializing AI Hook Detector...')
  const [pinnedHookIndex, setPinnedHookIndex] = useState(null)
  const [hoveredHookIndex, setHoveredHookIndex] = useState(null)
  const [playgroundFeatures, setPlaygroundFeatures] = useState(null)
  const [simulatedProb, setSimulatedProb] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState(null)

  const [mutating, setMutating] = useState(false)
  const [mutatedAudioUrl, setMutatedAudioUrl] = useState(null)
  const [mutationError, setMutationError] = useState(null)
  const [activePlayer, setActivePlayer] = useState('after')
  const originalAudioRef = useRef(null)
  const mutatedAudioRef = useRef(null)
  const reportRef = useRef(null)
  const [audioUrl, setAudioUrl] = useState(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError(null)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type.startsWith('audio/')) {
        setFile(droppedFile)
        setFileName(droppedFile.name)
        setAudioUrl(URL.createObjectURL(droppedFile))
      } else {
        setError('Please select an audio file')
      }
    }
  }

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setFileName(selectedFile.name)
      setAudioUrl(URL.createObjectURL(selectedFile))
      setError(null)
    }
  }

  const BACKEND_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:5005')

  const handleUploadAndAnalyze = async () => {
    if (!file) {
      setError('No file selected')
      return
    }

    setError(null)
    setUploading(true)
    setAnalyzing(false)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${BACKEND_URL}/api/analyze-audio`, {
        method: 'POST',
        body: formData,
      })

      setProgress(50)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      setProgress(100)

      setUploading(false)
      setAnalyzing(true)

      setTimeout(() => {
        setAnalyzing(false)
        setResult(data)
        setPlaygroundFeatures(data.features)
        setSimulatedProb(data.probability || data.hit_probability || 0)
      }, 2000)

    } catch (err) {
      setError(err.message)
      setUploading(false)
      setAnalyzing(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setFileName('')
    setAudioUrl(null)
    setResult(null)
    setAnalyzing(false)
    setUploading(false)
    setError(null)
    setProgress(0)
    setMutatedAudioUrl(null)
    setMutationError(null)
    setActivePlayer('after')
    setPlaygroundFeatures(null)
    setSimulatedProb(null)
  }

  const analyzeHooks = async () => {
    if (!result || !result.analysisId) return;
    setAnalyzingHooks(true);
    setError(null);
    
    const texts = [
      'Mapping beat boundaries...',
      'Extracting local energy deviations...',
      'Calculating composite hook scores...',
      'Isolating top candidates...'
    ];
    let textIdx = 0;
    const interval = setInterval(() => {
      textIdx = (textIdx + 1) % texts.length;
      setHookLoadingText(texts[textIdx]);
    }, 2500);

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-hooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ analysisId: result.analysisId })
      });
      
      clearInterval(interval);
      setAnalyzingHooks(false);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Hook analysis failed');
      }
      
      const hookData = await response.json();
      
      setResult(prev => ({
        ...prev,
        temporalSegments: hookData.temporal_segments || [],
        topHooks: hookData.top_hooks || []
      }));
      
    } catch (err) {
      clearInterval(interval);
      setAnalyzingHooks(false);
      setError(err.message || 'Failed to analyze hooks.');
      console.error('Hook analysis error:', err);
    }
  }

  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const jumpToHook = (time) => {
    if (originalAudioRef.current) {
      originalAudioRef.current.currentTime = time;
      originalAudioRef.current.play();
    }
  };

  const downloadMutatedAudio = () => {
    if (!mutatedAudioUrl) return;
    const link = document.createElement('a');
    link.href = mutatedAudioUrl;
    link.download = `mutated_${fileName}`;
    link.click();
  };

  const handleSliderChange = (feature, value) => {
    if (!playgroundFeatures) return;
    const newFeatures = { ...playgroundFeatures, [feature]: value };
    setPlaygroundFeatures(newFeatures);

    if (debounceTimer) clearTimeout(debounceTimer);
    
    const timer = setTimeout(async () => {
      setIsSimulating(true);
      try {
        const resp = await fetch(`${BACKEND_URL}/api/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...newFeatures,
            duration_ms: result?.features?.duration_ms || 180000 
          })
        });
        if (resp.ok) {
          const simData = await resp.json();
          setSimulatedProb(simData.hit_probability);
        }
      } catch (err) {
        console.error('Simulation error', err);
      } finally {
        setIsSimulating(false);
      }
    }, 500);
    setDebounceTimer(timer);
  }

  const applyConsultantTweaks = () => {
    if (!result || !result.suggestions || !playgroundFeatures) return;
    const newFeatures = { ...playgroundFeatures };
    result.suggestions.forEach(s => {
      newFeatures[s.feature] = s.suggested;
    });
    setPlaygroundFeatures(newFeatures);
    
    if (debounceTimer) clearTimeout(debounceTimer);
    setIsSimulating(true);
    fetch(`${BACKEND_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newFeatures,
        duration_ms: result?.features?.duration_ms || 180000 
      })
    })
    .then(r => r.json())
    .then(d => {
       setSimulatedProb(d.hit_probability);
       setIsSimulating(false);
    })
    .catch(e => {
       console.error(e);
       setIsSimulating(false);
    });
  }

  const handleMutate = async () => {
    if (!result || !result.analysisId) return
    setMutating(true)
    setMutationError(null)
    setMutatedAudioUrl(null)
    // By default, start with the original features
    let target_tempo = result.features.tempo;
    let target_loudness = result.features.loudness;
    let target_key = result.features.key;
    let target_energy = result.features.energy;
    let target_liveness = result.features.liveness;
    let target_acousticness = result.features.acousticness;

    // Apply the AI consultant's optimal suggestions automatically
    if (result.suggestions && result.suggestions.length > 0) {
      result.suggestions.forEach(s => {
        if (s.feature === 'tempo') target_tempo = s.suggested;
        if (s.feature === 'loudness') target_loudness = s.suggested;
        if (s.feature === 'key') target_key = s.suggested;
        if (s.feature === 'energy') target_energy = s.suggested;
        if (s.feature === 'liveness') target_liveness = s.suggested;
        if (s.feature === 'acousticness') target_acousticness = s.suggested;
      });
    }

    // If the user has manually changed the playground sliders, override the AI suggestions
    if (playgroundFeatures) {
      if (playgroundFeatures.tempo !== result.features.tempo) target_tempo = playgroundFeatures.tempo;
      if (playgroundFeatures.loudness !== result.features.loudness) target_loudness = playgroundFeatures.loudness;
      if (playgroundFeatures.key !== result.features.key) target_key = playgroundFeatures.key;
      if (playgroundFeatures.energy !== result.features.energy) target_energy = playgroundFeatures.energy;
      if (playgroundFeatures.liveness !== result.features.liveness) target_liveness = playgroundFeatures.liveness;
      if (playgroundFeatures.acousticness !== result.features.acousticness) target_acousticness = playgroundFeatures.acousticness;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/mutate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: result.analysisId,
          target_tempo: target_tempo,
          target_loudness: target_loudness,
          target_key: target_key,
          target_energy: target_energy,
          target_liveness: target_liveness,
          target_acousticness: target_acousticness,
          original_tempo: result.features.tempo,
          original_loudness: result.features.loudness,
          original_key: result.features.key,
          original_energy: result.features.energy,
          original_liveness: result.features.liveness,
          original_acousticness: result.features.acousticness
        })
      })

      if (!response.ok) {
        let errStr = 'Mutation failed'
        try {
          const errData = await response.json()
          errStr = errData.error || errStr
        } catch(e) {}
        throw new Error(errStr)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setMutatedAudioUrl(url)
      setActivePlayer('after')
    } catch (err) {
      setMutationError(err.message)
    } finally {
      setMutating(false)
    }
  }

  const handleDownloadReport = () => {
    if (!result || !reportRef.current) return;
    
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    
    const opt = {
      margin:       [15, 0, 15, 0],
      filename:     `virality_report_${timestamp}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'], avoid: '.avoid-break' }
    };
    
    html2pdf().set(opt).from(reportRef.current).save();
  };

  const togglePlayback = (mode) => {
    if (mode === 'before' && originalAudioRef.current) {
      if (mutatedAudioRef.current) mutatedAudioRef.current.pause()
      originalAudioRef.current.play()
      setActivePlayer('before')
    } else if (mode === 'after' && mutatedAudioRef.current) {
      if (originalAudioRef.current) originalAudioRef.current.pause()
      mutatedAudioRef.current.play()
      setActivePlayer('after')
    }
  }

  return (
    <div className="live-song-test">
      <div className="page-header">
        <h2>Song Analysis</h2>
        <p>Test your track and see how it performs</p>
      </div>

      <div className="test-container">
        {!result ? (
          <div className="upload-section">
            {/* Error Display */}
            {error && (
              <div className="error-message">
                <span>{error}</span>
                <button onClick={() => setError(null)}>×</button>
              </div>
            )}

            {/* Upload Area */}
            <div 
              className={`upload-area ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="upload-content">
                <div className="upload-icon">↓</div>
                <h3>Drop your file here</h3>
                <p>or browse to select</p>
                <label className="file-input-label">
                  <input 
                    type="file" 
                    accept="audio/*" 
                    onChange={handleFileSelect}
                    disabled={analyzing || uploading}
                  />
                  <span className="file-input-button">Choose File</span>
                </label>
                <p className="file-info">MP3, WAV, OGG, M4A, FLAC (max 50MB)</p>
              </div>
            </div>

            {/* Selected File Display */}
            {file && (
              <div className="file-selected">
                <div className="file-details">
                  <div className="file-info-box">
                    <p className="file-name">{fileName}</p>
                    <p className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                {!uploading && !analyzing && (
                  <button 
                    className="btn primary large"
                    onClick={handleUploadAndAnalyze}
                  >
                    Analyze Song
                  </button>
                )}
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="progress-section">
                <div className="progress-text">Processing...</div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill upload-progress"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Analysis Animation */}
            {analyzing && (
              <div className="analysis-section">
                <div className="analysis-visual">
                  <div className="waveform">
                    {[...Array(50)].map((_, i) => (
                      <div 
                        key={i} 
                        className="wave-bar"
                        style={{
                          '--height': `${30 + Math.random() * 70}%`,
                          '--delay': `${i * 0.05}s`
                        }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Results Display */
          <div className="results-section">
            <div className={`result-card ${result.isViral ? 'viral' : 'not-viral'}`}>
              <div className="result-header">
                <h3>{result.isViral ? 'Good Match' : 'Needs Work'}</h3>
                <p className="song-title">{result.fileName}</p>
              </div>

              <div className="viral-score-section">
                <div className="viral-meter">
                  <div className="viral-bar">
                    <div 
                      className="viral-fill"
                      style={{ width: `${result.probability * 100}%` }}
                    ></div>
                  </div>
                  <div className="score-display">
                    <span className="score-value">{(result.probability * 100).toFixed(1)}%</span>
                    <span className="score-label">Hit Probability</span>
                  </div>
                </div>

                <div className="confidence-badge">
                  <span className="confidence-text">{(result.confidence * 100).toFixed(0)}% confidence</span>
                </div>
              </div>

              <div className="result-features">
                <h4>Track Analysis</h4>
                <div className="features-grid">
                  <div className="feature">
                    <span className="feature-label">Danceability</span>
                    <div className="feature-bar">
                      <div 
                        className="feature-fill"
                        style={{ width: `${result.features.danceability * 100}%` }}
                      ></div>
                    </div>
                    <span className="feature-value">{(result.features.danceability * 100).toFixed(0)}%</span>
                  </div>
                  <div className="feature">
                    <span className="feature-label">Energy</span>
                    <div className="feature-bar">
                      <div 
                        className="feature-fill"
                        style={{ width: `${result.features.energy * 100}%` }}
                      ></div>
                    </div>
                    <span className="feature-value">{(result.features.energy * 100).toFixed(0)}%</span>
                  </div>
                  <div className="feature">
                    <span className="feature-label">Valence</span>
                    <div className="feature-bar">
                      <div 
                        className="feature-fill"
                        style={{ width: `${result.features.valence * 100}%` }}
                      ></div>
                    </div>
                    <span className="feature-value">{(result.features.valence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="feature">
                    <span className="feature-label">Acousticness</span>
                    <div className="feature-bar">
                      <div 
                        className="feature-fill"
                        style={{ width: `${result.features.acousticness * 100}%` }}
                      ></div>
                    </div>
                    <span className="feature-value">{(result.features.acousticness * 100).toFixed(0)}%</span>
                  </div>
                  <div className="feature">
                    <span className="feature-label">Tempo</span>
                    <div className="feature-bar">
                      <div 
                        className="feature-fill"
                        style={{ width: `${Math.min(100, (result.features.tempo / 200) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="feature-value">{result.features.tempo.toFixed(0)} BPM</span>
                  </div>
                  <div className="feature">
                    <span className="feature-label">Duration</span>
                    <div className="feature-bar">
                      <div 
                        className="feature-fill"
                        style={{ width: `${Math.min(100, (result.features.duration_ms / 600000) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="feature-value">{(result.features.duration_ms / 1000).toFixed(0)}s</span>
                  </div>
                </div>
                {/* MFCC Visualization */}
                <div className="mfcc-section">
                  <h5>🎤 MFCC Coefficients (Timbral Texture)</h5>
                  <div className="mfcc-bars">
                    {[...Array(20)].map((_, i) => {
                      const mfccVal = result.features._all_features[`mfcc_${i+1}`] || 0
                      const normalized = Math.min(100, Math.max(0, (mfccVal + 50) * 1.5))
                      return (
                        <div key={i} className="mfcc-bar-container">
                          <div 
                            className="mfcc-bar" 
                            style={{ height: `${normalized}%`, background: `hsl(${280 - i * 12}, 70%, 50%)` }}
                          ></div>
                          <span className="mfcc-label">{i+1}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <p className="feature-note">
                  ⚠️ Note: Librosa extracts raw audio features. Spotify uses proprietary ML algorithms trained on millions of songs, 
                  so values may differ from Spotify's API. Our calibration attempts to approximate Spotify's definitions.
                </p>
              </div>

              {/* AI Hook Detector Section */}
              <div className="hook-detector-section" style={{
                marginTop: '40px',
                padding: '30px',
                background: 'rgba(20, 20, 35, 0.6)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                backdropFilter: 'blur(20px)',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '2.2rem' }}>🎣</span>
                  <h4 style={{
                    fontSize: '1.6rem', 
                    margin: 0, 
                    fontWeight: '800',
                    background: 'linear-gradient(135deg, #fff, #ff6b6b)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>AI Hook Detector</h4>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '25px', marginLeft: '60px' }}>
                  Locate the catchiest temporal segments (choruses, drops) to maximize short-form video virality.
                </p>

                {(!result.topHooks || result.topHooks.length === 0) ? (
                  <div style={{ marginLeft: '60px' }}>
                    <button 
                      onClick={analyzeHooks}
                      disabled={analyzingHooks}
                      className="generate-btn"
                      style={{ 
                        background: 'linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%)',
                        border: 'none',
                        boxShadow: '0 8px 20px rgba(255,107,107,0.3)',
                        width: 'auto',
                        padding: '12px 30px'
                      }}
                    >
                      {analyzingHooks ? hookLoadingText : '🔍 Isolate Catchy Hooks'}
                    </button>
                  </div>
                ) : (
                  <div style={{ marginLeft: '60px' }}>
                    {result.topHooks.map((hook, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => jumpToHook(hook.start_time)}
                        style={{ 
                          background: idx === 0 ? 'linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(255,107,107,0.05) 100%)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${idx === 0 ? 'rgba(255,107,107,0.4)' : 'rgba(255,255,255,0.1)'}`,
                          padding: '15px',
                          borderRadius: '12px',
                          marginBottom: '12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <div>
                          <strong style={{ color: idx === 0 ? '#ff6b6b' : 'inherit', display: 'block', marginBottom: '6px', fontSize: '1.1rem' }}>
                            {idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : '🥉 '} {hook.type}
                          </strong>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                            {formatTime(hook.start_time)} - {formatTime(hook.end_time)} | {hook.description}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'block', fontWeight: 'bold', fontSize: '1.3rem', color: '#ff6b6b' }}>
                              {(hook.hook_score * 100).toFixed(1)}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                              Hook Score
                            </span>
                          </div>
                          <HookInfoPopover 
                            hook={hook} 
                            isOpen={hoveredHookIndex === idx || pinnedHookIndex === idx}
                            isPinned={pinnedHookIndex === idx} 
                            onMouseEnter={() => setHoveredHookIndex(idx)}
                            onMouseLeave={() => setHoveredHookIndex(null)}
                            onTogglePin={(val) => {
                              if (val === false) setPinnedHookIndex(null);
                              else setPinnedHookIndex(pinnedHookIndex === idx ? null : idx);
                            }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {result.suggestions && result.suggestions.length > 0 && (
                <div className="prescriptive-consultant-section" style={{
                  marginTop: '40px', 
                  padding: '30px', 
                  background: 'rgba(20, 20, 35, 0.6)',
                  borderRadius: '24px',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(20px)',
                  textAlign: 'left',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Decorative glow */}
                  <div style={{
                    position: 'absolute',
                    top: '-50px',
                    left: '-50px',
                    width: '150px',
                    height: '150px',
                    background: 'rgba(139, 92, 246, 0.4)',
                    filter: 'blur(80px)',
                    zIndex: 0,
                    pointerEvents: 'none'
                  }}></div>

                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '2.2rem' }}>🤖</span>
                      <h4 style={{
                        fontSize: '1.6rem', 
                        margin: 0, 
                        fontWeight: '800',
                        background: 'linear-gradient(135deg, #fff, #a78bfa)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}>Prescriptive Hit Consultant</h4>
                    </div>
                    <p style={{
                      color: 'rgba(255,255,255,0.6)', 
                      fontSize: '1rem',
                      marginBottom: '25px',
                      marginLeft: '60px',
                      fontWeight: '500'
                    }}>Mathematical production tweaks to maximize viral probability.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
                      {result.suggestions.slice(0, 5).map((sug, idx) => (
                        <div 
                          key={idx} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                            padding: '16px 20px',
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.05)',
                            transition: 'all 0.3s ease',
                            cursor: 'default'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span style={{ fontSize: '1.4rem' }}>{sug.feature.toLowerCase() === 'loudness' || sug.feature.toLowerCase() === 'energy' ? '⚡' : '🎛️'}</span>
                            <div>
                              <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', textTransform: 'capitalize', letterSpacing: '0.5px' }}>
                                {sug.direction === 'INCREASE' ? 'Increase' : sug.direction === 'DECREASE' ? 'Decrease' : 'Tweak'} {sug.feature}
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginTop: '4px' }}>
                                From <span style={{ color: 'rgba(255,255,255,0.9)' }}>{sug.current.toFixed(2)}</span> to <span style={{ color: '#10B981', fontWeight: 'bold' }}>{sug.suggested.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10B981',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            boxShadow: '0 0 15px rgba(16, 185, 129, 0.1)'
                          }}>
                            +{(sug.improvement_percent || Math.max(0.1, (sug.new_probability - result.probability)*100)).toFixed(1)}% Hit Prob
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {playgroundFeatures && (
                      <div className="interactive-playground" style={{ marginTop: '50px', paddingTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '2rem' }}>🎛️</span>
                          <h4 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>Interactive Hit Playground</h4>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '15px' }}>Tweak the song's DNA and see the predicted hit probability update live.</p>
                        
                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '12px', borderRadius: '8px', color: '#FCD34D', fontSize: '0.9rem', marginBottom: '30px' }}>
                          ⚠️ <strong>Simulated features include structural parameters.</strong> Not all simulated parameters are physically mutable by the Audio Mutator.
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px', padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '16px' }}>
                          <div>
                            <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>Live Hit Probability</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: isSimulating ? 'rgba(255,255,255,0.5)' : '#10B981', transition: 'color 0.3s' }}>
                              {(simulatedProb * 100).toFixed(1)}%
                            </div>
                          </div>
                          <button 
                            onClick={applyConsultantTweaks}
                            style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}
                          >
                            ✨ Apply Consultant Tweaks
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                          {[
                            { key: 'acousticness', label: 'Acousticness', min: 0, max: 1, step: 0.01 },
                            { key: 'danceability', label: 'Danceability', min: 0, max: 1, step: 0.01 },
                            { key: 'energy', label: 'Energy', min: 0, max: 1, step: 0.01 },
                            { key: 'instrumentalness', label: 'Instrumentalness', min: 0, max: 1, step: 0.01 },
                            { key: 'key', label: 'Key', min: 0, max: 11, step: 1 },
                            { key: 'liveness', label: 'Liveness', min: 0, max: 1, step: 0.01 },
                            { key: 'loudness', label: 'Loudness', min: -60, max: 0, step: 0.1 },
                            { key: 'mode', label: 'Mode', min: 0, max: 1, step: 1 },
                            { key: 'speechiness', label: 'Speechiness', min: 0, max: 1, step: 0.01 },
                            { key: 'tempo', label: 'Tempo', min: 30, max: 250, step: 1 },
                            { key: 'valence', label: 'Valence', min: 0, max: 1, step: 0.01 }
                          ].map(f => (
                            <div key={f.key} style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>{f.label}</span>
                                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{Number(playgroundFeatures[f.key]).toFixed(f.step < 1 ? 2 : 0)}</span>
                              </div>
                              <input 
                                type="range" 
                                min={f.min} 
                                max={f.max} 
                                step={f.step} 
                                value={playgroundFeatures[f.key]} 
                                onChange={(e) => updatePlaygroundFeature(f.key, Number(e.target.value))}
                                style={{ width: '100%', accentColor: '#8B5CF6' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mutate-action" style={{background: 'rgba(20,20,35,0.8)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(236,72,153,0.3)', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.3)'}}>
                    {!mutatedAudioUrl ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                        <h5 style={{margin: 0, fontSize: '1.4rem', color: '#fff', textAlign: 'center'}}>Hear the Viral Version</h5>
                        <p style={{margin: 0, fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: '400px'}}>Apply the AI's exact tempo and loudness suggestions to your audio track with studio-quality DSP processing.</p>
                        
                        {mutationError && <div style={{color: '#ef4444', fontSize: '0.9rem', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '8px'}}>{mutationError}</div>}
                        
                        <button 
                          onClick={handleMutate} 
                          style={{background: 'linear-gradient(90deg, #EC4899, #8B5CF6, #3B82F6)', color: 'white', border: 'none', padding: '15px 30px', borderRadius: '30px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(236,72,153,0.4)'}}
                        >
                          {mutating ? 'Generating...' : '✨ Generate Viral Mix'}
                        </button>
                      </div>
                    ) : (
                      <div style={{width: '100%'}}>
                        <h5 style={{margin: '0 0 20px 0', fontSize: '1.3rem', color: '#fff', textAlign: 'center'}}>Your Viral Mix is Ready 🎧</h5>
                        
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '25px' }}>
                          <button 
                            onClick={() => togglePlayback('before')}
                            style={{ padding: '10px 25px', borderRadius: '20px', border: activePlayer === 'before' ? '2px solid #3B82F6' : '1px solid rgba(255,255,255,0.2)', background: activePlayer === 'before' ? 'rgba(59,130,246,0.2)' : 'transparent', color: '#fff', fontWeight: activePlayer === 'before' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s' }}
                          >
                            Before
                          </button>
                          <button 
                            onClick={() => togglePlayback('after')}
                            style={{ padding: '10px 25px', borderRadius: '20px', border: activePlayer === 'after' ? '2px solid #EC4899' : '1px solid rgba(255,255,255,0.2)', background: activePlayer === 'after' ? 'rgba(236,72,153,0.2)' : 'transparent', color: '#fff', fontWeight: activePlayer === 'after' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s' }}
                          >
                            Viral Mix
                          </button>
                        </div>
                        
                        {/* Hidden Audio Elements */}
                        <audio ref={originalAudioRef} src={audioUrl} onPlay={() => setActivePlayer('before')} />
                        <audio ref={mutatedAudioRef} src={mutatedAudioUrl} onPlay={() => setActivePlayer('after')} />
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                          {activePlayer === 'before' ? (
                            <div style={{ width: '100%', padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', textAlign: 'center' }}>
                              <div style={{ color: '#aaa', marginBottom: '10px' }}>Original Audio Playing</div>
                              <button onClick={() => originalAudioRef.current.paused ? originalAudioRef.current.play() : originalAudioRef.current.pause()} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer' }}>
                                ▶ / ⏸
                              </button>
                            </div>
                          ) : (
                            <div style={{ width: '100%', padding: '20px', background: 'rgba(236,72,153,0.1)', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(236,72,153,0.3)' }}>
                              <div style={{ color: '#EC4899', marginBottom: '10px', fontWeight: 'bold' }}>Viral Mix Playing 🔥</div>
                              <button onClick={() => mutatedAudioRef.current.paused ? mutatedAudioRef.current.play() : mutatedAudioRef.current.pause()} style={{ background: '#EC4899', color: '#fff', border: 'none', borderRadius: '50%', width: '50px', height: '50px', cursor: 'pointer', boxShadow: '0 0 15px rgba(236,72,153,0.5)' }}>
                                ▶ / ⏸
                              </button>
                            </div>
                          )}

                          <a href={mutatedAudioUrl} download={`viral_${fileName}`} style={{ display: 'inline-block', background: 'rgba(16,185,129,0.2)', color: '#10B981', border: '1px solid rgba(16,185,129,0.5)', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '1rem', fontWeight: 'bold', transition: 'all 0.2s' }}>
                            ↓ Download Final Mix
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="result-actions" style={{display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px'}}>
                <button className="btn secondary" onClick={handleDownloadReport}>Download PDF Report</button>
                <button className="btn primary" onClick={resetForm}>Test Another Song</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden PDF Template */}
      <div className="pdf-hidden-wrapper">
        <ReportTemplate result={result} ref={reportRef} />
      </div>
    </div>
  )
}
