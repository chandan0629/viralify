import React, { useState, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import ReportTemplate from './ReportTemplate';
import './LiveRecording.css';

export default function LiveRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  
  // Playground state
  const [showPlayground, setShowPlayground] = useState(false);
  const [playgroundFeatures, setPlaygroundFeatures] = useState(null);
  const [playgroundScore, setPlaygroundScore] = useState(null);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [mutatingAudio, setMutatingAudio] = useState(false);
  const [mutatedAudioUrl, setMutatedAudioUrl] = useState(null);
  const debounceTimerRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const reportRef = useRef(null);

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://viralify-backend-li673hdf6q-uc.a.run.app';

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const wavBlob = await convertToWav(webmBlob);
          const url = URL.createObjectURL(wavBlob);
          setAudioBlob(wavBlob);
          setAudioUrl(url);
        } catch (err) {
          setError('Failed to process recorded audio.');
          console.error(err);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setAudioUrl(null);
      setAudioBlob(null);
      setResult(null);
      setError(null);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError('Microphone access denied or not available.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const convertToWav = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    // Force 44.1kHz sample rate to match ML model expectations
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // We only need 1 channel (Mono)
    const channelData = audioBuffer.getChannelData(0);
    
    // Encode to 16-bit PCM WAV
    const wavBuffer = encodeWAV(channelData, 44100);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

  const encodeWAV = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // 1 channel (Mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // sampleRate * blockAlign
    view.setUint16(32, 2, true); // blockAlign
    view.setUint16(34, 16, true); // bitsPerSample
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write 16-bit PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return view;
  };

  const handleAnalyze = async () => {
    if (!audioBlob) return;

    setError(null);
    setUploading(true);
    setAnalyzing(false);
    setProgress(0);

    try {
      const formData = new FormData();
      // Send as recording.wav
      formData.append('file', audioBlob, 'live_recording.wav');

      const response = await fetch(`${BACKEND_URL}/api/analyze-audio`, {
        method: 'POST',
        body: formData,
      });

      setProgress(50);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      setProgress(100);

      setUploading(false);
      setAnalyzing(true);
      setTimeout(() => {
        setAnalyzing(false);
          setResult({
          fileName: 'Live Recording',
          hit_probability: data.hit_probability,
          viralScore: (data.hit_probability * 100).toFixed(1),
          isViral: data.isViral,
          confidence: (data.confidence * 100).toFixed(0),
          prediction: data.prediction,
          features: data.features || data.extracted_features,
          analysisId: data.analysisId,
          prescriptions: data.suggestions || data.prescriptions || [],
          warning: data.warning
        });
      }, 2000);
    } catch (err) {
      setError(err.message);
      setUploading(false);
      setAnalyzing(false);
    }
  };

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

  const handleDownloadAudio = () => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const link = document.createElement('a');
    link.href = url;
    
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    
    link.download = `recorded_song_${timestamp}.wav`;
    link.click();
  };

  const resetRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    setAudioUrl(null);
    setAudioBlob(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setShowPlayground(false);
    setMutatedAudioUrl(null);
  };

  const enterPlayground = () => {
    setPlaygroundFeatures({ ...result.features });
    setPlaygroundScore(result.hit_probability);
    setShowPlayground(true);
  };

  const scaleScore = (rawScore, originalScore) => {
    if (rawScore == null || isNaN(rawScore)) return originalScore || 0;
    if (originalScore == null || isNaN(originalScore)) return rawScore;
    if (rawScore <= originalScore) return rawScore;
    const maxGain = 1.0 - originalScore;
    if (maxGain <= 0) return originalScore;
    const uiMaxGain = maxGain * 0.45;
    const actualGain = rawScore - originalScore;
    const scaledGain = uiMaxGain * (1 - Math.exp(-2.5 * actualGain / uiMaxGain));
    return originalScore + scaledGain;
  };

  const handlePlaygroundChange = (feature, value) => {
    const newFeatures = { ...playgroundFeatures, [feature]: parseFloat(value) };
    setPlaygroundFeatures(newFeatures);
    
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setPlaygroundLoading(true);
    
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newFeatures)
        });
        if (response.ok) {
          const data = await response.json();
          setPlaygroundScore(scaleScore(data.hit_probability, result.hit_probability));
        }
      } catch (err) {
        console.error("Playground predict error:", err);
      } finally {
        setPlaygroundLoading(false);
      }
    }, 400);
  };

  const applyConsultantTweaks = () => {
    if (!result || !result.prescriptions) return;
    let newFeatures = { ...playgroundFeatures };
    let totalImprovement = 0;
    result.prescriptions.forEach(rec => {
      newFeatures[rec.feature] = rec.suggested;
      totalImprovement += rec.improvement_percent || 0;
    });
    setPlaygroundFeatures(newFeatures);
    
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setPlaygroundLoading(true);
    fetch(`${BACKEND_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFeatures)
    }).then(res => res.json()).then(data => {
      setPlaygroundScore(scaleScore(data.hit_probability, result.hit_probability));
      setPlaygroundLoading(false);
      generateMutatedAudio(newFeatures);
    }).catch(() => {
      setPlaygroundLoading(false);
      generateMutatedAudio(newFeatures);
    });
  };

  const generateMutatedAudio = async (overrideFeatures = null) => {
    if (!result || !result.analysisId) return;
    const featuresToUse = overrideFeatures || playgroundFeatures;
    
    setMutatingAudio(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/mutate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: result.analysisId,
          target_tempo: featuresToUse.tempo,
          target_key: featuresToUse.key,
          target_loudness: featuresToUse.loudness,
          target_energy: featuresToUse.energy,
          target_liveness: featuresToUse.liveness,
          target_acousticness: featuresToUse.acousticness,
          original_tempo: result.features.tempo,
          original_key: result.features.key,
          original_loudness: result.features.loudness,
          original_energy: result.features.energy,
          original_liveness: result.features.liveness,
          original_acousticness: result.features.acousticness
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to mutate audio');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setMutatedAudioUrl(url);
      
    } catch (err) {
      setError(err.message || 'Error mutating audio');
      console.error(err);
    } finally {
      setMutatingAudio(false);
    }
  };

  return (
    <div className="live-recording">
      <div className="page-header">
        <h2>Live Song Recording</h2>
        <p>Record your track using your microphone and predict its viral potential.</p>
      </div>

      <div className="test-container">
        {!result ? (
          <div className="upload-section">
            {error && (
              <div className="error-message">
                <span>{error}</span>
                <button onClick={() => setError(null)}>×</button>
              </div>
            )}

            <div className={`record-area ${isRecording ? 'recording' : ''}`}>
              <div className="record-content">
                <div className={`record-icon ${isRecording ? 'pulse' : ''}`}>🎤</div>
                <h3 className="timer">{formatTime(recordingTime)}</h3>
                {!audioUrl ? (
                  !isRecording ? (
                    <button className="btn primary large record-btn" onClick={startRecording} disabled={uploading || analyzing}>
                      Start Recording
                    </button>
                  ) : (
                    <button className="btn danger large record-btn" onClick={stopRecording}>
                      Stop Recording
                    </button>
                  )
                ) : (
                  <div className="audio-preview">
                    <p className="file-info">Recording Complete (WAV Format)</p>
                    <audio controls src={audioUrl} />
                    {!uploading && !analyzing && (
                      <div className="action-buttons">
                        <button className="btn secondary" onClick={resetRecording}>Record Again</button>
                        <button className="btn primary" onClick={handleAnalyze}>Analyze Recording</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {uploading && (
              <div className="progress-section">
                <div className="progress-text">Processing...</div>
                <div className="progress-bar">
                  <div className="progress-fill upload-progress" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            {analyzing && (
              <div className="analysis-section">
                <div className="analysis-visual">
                  <div className="waveform">
                    {[...Array(50)].map((_, i) => (
                      <div key={i} className="wave-bar" style={{ '--height': `${30 + Math.random() * 70}%`, '--delay': `${i * 0.05}s` }}></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="results-section">
            <div className={`result-card ${result.isViral ? 'viral' : 'not-viral'}`}>
              <div className="result-header">
                <h3>{result.isViral ? '🚀 Viral Hit!' : '📊 Below Average'}</h3>
                <p className="song-title">{result.fileName}</p>
              </div>

              {result.warning && (
                <div className="speech-warning-banner" style={{
                  padding: '14px 18px',
                  background: 'rgba(255, 184, 77, 0.08)',
                  border: '1px solid rgba(255, 184, 77, 0.3)',
                  borderRadius: '10px',
                  color: '#ffb84d',
                  marginBottom: '24px',
                  fontSize: '0.92rem',
                  lineHeight: '1.5',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '1.2rem', marginTop: '-2px' }}>⚠️</span>
                  <div>{result.warning}</div>
                </div>
              )}

              <div className="viral-score-section">
                <div className="viral-meter">
                  <div className="viral-bar">
                    <div 
                      className="viral-fill"
                      style={{ width: `${result.viralScore}%` }}
                    ></div>
                  </div>
                  <div className="score-display">
                    <span className="score-value">{result.viralScore}%</span>
                    <span className="score-label">Viral Score</span>
                  </div>
                </div>

                <div className="confidence-badge">
                  <span className="confidence-icon">✓</span>
                  <span className="confidence-text">{result.confidence}% confidence</span>
                </div>
              </div>

              <div className="result-features">
                <h4>🎵 Core Audio Features (12)</h4>
                <div className="features-grid">
                  <div className="feature">
                    <span className="feature-label">Danceability</span>
                    <div className="feature-bar">
                      <div className="feature-fill" style={{ width: `${result.features.danceability * 100}%` }}></div>
                    </div>
                    <span className="feature-value">{(result.features.danceability * 100).toFixed(0)}%</span>
                  </div>
                  <div className="feature">
                    <span className="feature-label">Energy</span>
                    <div className="feature-bar">
                      <div className="feature-fill" style={{ width: `${result.features.energy * 100}%` }}></div>
                    </div>
                    <span className="feature-value">{(result.features.energy * 100).toFixed(0)}%</span>
                  </div>
                  <div className="feature">
                    <span className="feature-label">Valence (Positivity)</span>
                    <div className="feature-bar">
                      <div className="feature-fill" style={{ width: `${result.features.valence * 100}%` }}></div>
                    </div>
                    <span className="feature-value">{(result.features.valence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="feature">
                    <span className="feature-label">Acousticness</span>
                    <div className="feature-bar">
                      <div className="feature-fill" style={{ width: `${result.features.acousticness * 100}%` }}></div>
                    </div>
                    <span className="feature-value">{(result.features.acousticness * 100).toFixed(0)}%</span>
                  </div>
                  <div className="feature">
                    <span className="feature-label">Speechiness</span>
                    <div className="feature-bar">
                      <div className="feature-fill" style={{ width: `${result.features.speechiness * 100}%` }}></div>
                    </div>
                    <span className="feature-value">{(result.features.speechiness * 100).toFixed(0)}%</span>
                  </div>
                  <div className="feature">
                    <span className="feature-label">Instrumentalness</span>
                    <div className="feature-bar">
                      <div className="feature-fill" style={{ width: `${result.features.instrumentalness * 100}%` }}></div>
                    </div>
                    <span className="feature-value">{(result.features.instrumentalness * 100).toFixed(0)}%</span>
                  </div>
                  <div className="feature">
                    <span className="feature-label">Liveness</span>
                    <div className="feature-bar">
                      <div className="feature-fill" style={{ width: `${result.features.liveness * 100}%` }}></div>
                    </div>
                    <span className="feature-value">{(result.features.liveness * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="feature-stats">
                  <div className="stat-item">
                    <span className="stat-label">Tempo</span>
                    <span className="stat-value">{result.features.tempo?.toFixed(0) || 'N/A'} BPM</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Loudness</span>
                    <span className="stat-value">{result.features.loudness?.toFixed(1) || 'N/A'} dB</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Key</span>
                    <span className="stat-value">
                      {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][result.features.key] || 'N/A'}
                      {' '}{result.features.mode === 1 ? 'Major' : 'Minor'}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Duration</span>
                    <span className="stat-value">
                      {result.features.duration_ms 
                        ? `${Math.floor(result.features.duration_ms / 60000)}:${String(Math.floor((result.features.duration_ms % 60000) / 1000)).padStart(2, '0')}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Extended Features Display */}
              {result.features._all_features && (
                <div className="extended-features">
                  <h4>🔬 Extended Analysis ({result.features._feature_count} features extracted)</h4>
                  <div className="extended-features-grid">
                    {/* Spectral Features */}
                    <div className="feature-group">
                      <h5>📊 Spectral Analysis</h5>
                      <div className="feature-list">
                        <div className="ext-feature"><span>Centroid</span><span>{result.features._all_features.spectral_centroid_hz?.toFixed(0)} Hz</span></div>
                        <div className="ext-feature"><span>Bandwidth</span><span>{result.features._all_features.spectral_bandwidth_hz?.toFixed(0)} Hz</span></div>
                        <div className="ext-feature"><span>Rolloff</span><span>{result.features._all_features.spectral_rolloff_hz?.toFixed(0)} Hz</span></div>
                        <div className="ext-feature"><span>Flatness</span><span>{(result.features._all_features.spectral_flatness_mean * 100)?.toFixed(2)}%</span></div>
                      </div>
                    </div>

                    {/* Rhythm Analysis */}
                    <div className="feature-group">
                      <h5>🥁 Rhythm Analysis</h5>
                      <div className="feature-list">
                        <div className="ext-feature"><span>Beat Count</span><span>{result.features._all_features.beat_count}</span></div>
                        <div className="ext-feature"><span>Beat Regularity</span><span>{(result.features._all_features.beat_regularity * 100)?.toFixed(1)}%</span></div>
                        <div className="ext-feature"><span>Rhythm Strength</span><span>{(result.features._all_features.rhythm_strength * 100)?.toFixed(1)}%</span></div>
                        <div className="ext-feature"><span>Onset Strength</span><span>{result.features._all_features.onset_strength_mean?.toFixed(2)}</span></div>
                      </div>
                    </div>

                    {/* Harmonic Analysis */}
                    <div className="feature-group">
                      <h5>🎼 Harmonic Analysis</h5>
                      <div className="feature-list">
                        <div className="ext-feature"><span>Key</span><span>{result.features._all_features.key_name} ({result.features._all_features.mode_name})</span></div>
                        <div className="ext-feature"><span>Key Strength</span><span>{(result.features._all_features.key_strength * 100)?.toFixed(1)}%</span></div>
                        <div className="ext-feature"><span>Harmonic Ratio</span><span>{(result.features._all_features.harmonic_ratio * 100)?.toFixed(1)}%</span></div>
                        <div className="ext-feature"><span>Tonnetz Mean</span><span>{result.features._all_features.tonnetz_mean?.toFixed(4)}</span></div>
                      </div>
                    </div>

                    {/* Energy Analysis */}
                    <div className="feature-group">
                      <h5>⚡ Energy Analysis</h5>
                      <div className="feature-list">
                        <div className="ext-feature"><span>RMS Mean</span><span>{result.features._all_features.rms_mean?.toFixed(4)}</span></div>
                        <div className="ext-feature"><span>Dynamic Range</span><span>{result.features._all_features.dynamic_range?.toFixed(2)}</span></div>
                        <div className="ext-feature"><span>Loudness Raw</span><span>{result.features._all_features.loudness_raw_db?.toFixed(1)} dB</span></div>
                        <div className="ext-feature"><span>ZCR</span><span>{result.features._all_features.zero_crossing_rate?.toFixed(4)}</span></div>
                      </div>
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
              )}

              {/* Hit Consultant Panel */}
              {result.prescriptions && result.prescriptions.length > 0 && (
                <div className="hit-consultant-panel">
                  <div className="consultant-header">
                    <h3>🤖 Prescriptive Hit Consultant</h3>
                    <p>Mathematical production tweaks to maximize viral probability.</p>
                  </div>
                  <div className="prescriptions-list">
                    {result.prescriptions.map((rec, index) => (
                      <div key={index} className="prescription-card">
                        <div className="prescription-icon">
                          {rec.feature === 'tempo' || rec.feature === 'danceability' ? '🥁' : 
                           rec.feature === 'energy' || rec.feature === 'loudness' ? '⚡' : 
                           rec.feature === 'valence' ? '😊' : '🎛️'}
                        </div>
                        <div className="prescription-details">
                          <h4>
                            {rec.direction === 'INCREASE' ? 'Increase ' : 'Decrease '}
                            {rec.feature.charAt(0).toUpperCase() + rec.feature.slice(1)}
                          </h4>
                          <p>
                            From <strong>{rec.current?.toFixed(2)}</strong> to <strong>{rec.suggested?.toFixed(2)}</strong>
                          </p>
                        </div>
                        <div className="prescription-gain">
                          <span className="gain-value">+{rec.improvement_percent?.toFixed(1)}%</span>
                          <span className="gain-label">Hit Prob</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Playground Mode Toggle */}
              {!showPlayground ? (
                <div className="playground-toggle" style={{textAlign: 'center', marginTop: '20px'}}>
                  <button className="btn secondary" onClick={enterPlayground}>
                    🎛️ Enter Interactive Playground
                  </button>
                </div>
              ) : (
                <div className="playground-panel">
                  <div className="playground-header">
                    <h3>🎛️ Interactive Hit Playground</h3>
                    <p>Tweak the song's DNA and see the predicted hit probability update live.</p>
                    <p style={{fontSize: '12px', color: '#ffb84d', marginTop: '5px'}}>
                      ⚠️ Simulated features include structural parameters. Not all simulated parameters are physically mutable by the Audio Mutator.
                    </p>
                  </div>
                  
                  <div className="playground-score-container">
                    <div className="live-score">
                      <span className="live-score-label">Live Hit Probability</span>
                      <div className="live-score-value" style={{ color: playgroundScore > result.hit_probability ? '#00ff88' : playgroundScore < result.hit_probability ? '#ff3385' : 'var(--text-primary)' }}>
                        {playgroundLoading ? <span className="loading-dots">...</span> : `${(playgroundScore * 100).toFixed(1)}%`}
                      </div>
                    </div>
                    {result.prescriptions && result.prescriptions.length > 0 && (
                      <button className="btn primary snap-btn" onClick={applyConsultantTweaks} disabled={mutatingAudio}>
                        ✨ Apply Consultant Tweaks (+{result.prescriptions.reduce((sum, rec) => sum + (rec.improvement_percent || 0), 0).toFixed(1)}%)
                      </button>
                    )}
                  </div>

                  <div className="playground-sliders">
                    {playgroundFeatures && Object.keys(playgroundFeatures).filter(k => ['tempo', 'loudness', 'energy', 'liveness', 'acousticness', 'danceability', 'valence', 'speechiness', 'instrumentalness', 'key', 'mode'].includes(k)).map(feature => {
                      let min = 0; let max = 1; let step = 0.01;
                      if (feature === 'tempo') { min = 60; max = 250; step = 1; }
                      if (feature === 'loudness') { min = -60; max = 0; step = 0.1; }
                      if (feature === 'key') { min = 0; max = 11; step = 1; }
                      if (feature === 'mode') { min = 0; max = 1; step = 1; }
                      
                      return (
                        <div key={feature} className="slider-group">
                          <div className="slider-label-row">
                            <span className="slider-name">{feature.charAt(0).toUpperCase() + feature.slice(1)}</span>
                            <span className="slider-value">{playgroundFeatures[feature]?.toFixed(2) || 0}</span>
                          </div>
                          <input 
                            type="range" 
                            min={min} 
                            max={max} 
                            step={step} 
                            value={playgroundFeatures[feature]} 
                            onChange={(e) => handlePlaygroundChange(feature, e.target.value)}
                            className="feature-slider"
                          />
                        </div>
                      )
                    })}
                  </div>
                  
                  <div className="audio-mutator-section" style={{marginTop: '30px', textAlign: 'center'}}>
                    {!mutatedAudioUrl ? (
                      <button 
                        className="btn primary" 
                        onClick={generateMutatedAudio} 
                        disabled={mutatingAudio}
                        style={{width: '100%', maxWidth: '400px'}}
                      >
                        {mutatingAudio ? '⏳ Mutating Audio Physics...' : '🎵 Generate Mutated Audio'}
                      </button>
                    ) : (
                      <div className="mutated-audio-player" style={{background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px'}}>
                        <h4 style={{color: 'var(--primary)', marginBottom: '15px', marginTop: 0}}>🎧 Your Mutated Hit Song</h4>
                        <audio key={mutatedAudioUrl} controls src={mutatedAudioUrl} style={{width: '100%'}} />
                        <button 
                          className="btn secondary" 
                          onClick={generateMutatedAudio} 
                          disabled={mutatingAudio}
                          style={{marginTop: '15px'}}
                        >
                          {mutatingAudio ? '⏳ Re-Mutating...' : '🔄 Re-Generate Audio'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="result-actions" style={{display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px'}}>
                <button className="btn secondary" onClick={handleDownloadReport}>Download PDF Report</button>
                <button className="btn secondary" onClick={handleDownloadAudio}>Download Original Audio</button>
                <button className="btn primary" onClick={resetRecording}>Try Another</button>
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
  );
}
