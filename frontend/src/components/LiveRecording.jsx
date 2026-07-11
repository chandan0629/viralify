import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2pdf from 'html2pdf.js';
import ReportTemplate from './ReportTemplate';
import HookInfoPopover from './HookInfoPopover';
import './LiveRecording.css';

export default function LiveRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingHooks, setAnalyzingHooks] = useState(false);
  const [hookLoadingText, setHookLoadingText] = useState('Mapping beat boundaries...');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [pinnedHookIndex, setPinnedHookIndex] = useState(null);
  const [hoveredHookIndex, setHoveredHookIndex] = useState(null);

  const [mutating, setMutating] = useState(false);
  const [mutatedAudioUrl, setMutatedAudioUrl] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  
  const [playgroundFeatures, setPlaygroundFeatures] = useState(null);
  const [simulatedProb, setSimulatedProb] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState(null);

  const [activePlayer, setActivePlayer] = useState('after');
  const originalAudioRef = useRef(null);
  const mutatedAudioRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const reportRef = useRef(null);
  const audioRef = useRef(null);

  const activeHookIndex = hoveredHookIndex !== null ? hoveredHookIndex : pinnedHookIndex;

  const jumpToHook = (startTime) => {
    if (audioRef.current) {
      audioRef.current.currentTime = startTime;
      audioRef.current.play().catch(e => console.log('Playback prevented:', e));
    }
  };

  const BACKEND_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:5005');

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
      setPinnedHookIndex(null);
      setHoveredHookIndex(null);
      setPlaygroundFeatures(null);
      setSimulatedProb(null);

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
        let errorMsg = 'Analysis failed';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          errorMsg = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      if (!data || !data.features) {
        throw new Error('Analysis failed: Server returned incomplete data. Please try again.');
      }
      
      setProgress(100);

      setUploading(false);
      setAnalyzing(true);

      setTimeout(() => {
        setAnalyzing(false);
        setResult({
          fileName: 'Live Recording',
          viralScore: (data.hit_probability * 100).toFixed(1),
          isViral: data.hit_probability > 0.6,
          confidence: (data.confidence * 100).toFixed(0),
          prediction: data.prediction,
          features: data.features,
          suggestions: data.suggestions || [],
          temporalSegments: [], // To be fetched in Phase 2
          topHooks: [], // To be fetched in Phase 2
          totalDurationSec: data.total_duration_sec || 180,
          analysisId: data.analysisId
        });
        setPlaygroundFeatures(data.features);
        setSimulatedProb(data.probability || data.hit_probability || 0);
      }, 2000);

    } catch (err) {
      setError(err.message);
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handleAnalyzeHooks = async () => {
    if (!result || !result.analysisId) return;
    
    setAnalyzingHooks(true);
    setError(null);
    
    // Start text rotation
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

  const updatePlaygroundFeature = (feature, value) => {
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
    if (!result || !result.analysisId) return;
    setMutating(true);
    setMutationError(null);
    setMutatedAudioUrl(null);
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
      });

      if (!response.ok) {
        let errStr = 'Mutation failed';
        try {
          const errData = await response.json();
          errStr = errData.error || errStr;
        } catch(e) {}
        throw new Error(errStr);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setMutatedAudioUrl(url);
      setActivePlayer('after');
    } catch (err) {
      setMutationError(err.message);
    } finally {
      setMutating(false);
    }
  };

  const togglePlayback = (mode) => {
    if (mode === 'before' && originalAudioRef.current) {
      if (mutatedAudioRef.current) mutatedAudioRef.current.pause();
      originalAudioRef.current.play();
      setActivePlayer('before');
    } else if (mode === 'after' && mutatedAudioRef.current) {
      if (originalAudioRef.current) originalAudioRef.current.pause();
      mutatedAudioRef.current.play();
      setActivePlayer('after');
    }
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
    setPinnedHookIndex(null);
    setHoveredHookIndex(null);
    setMutatedAudioUrl(null);
    setMutationError(null);
  };

  return (
    <div className="live-recording">
      <div className="page-header">
        <h2>Live Song Recording</h2>
        <p>Record your track using your microphone and predict its viral potential.</p>
      </div>

      <div className="test-container">
        {(!result || !result.features) ? (
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

              {/* VIRAL HOOK DETECTION TRIGGER */}
              {result.temporalSegments && result.temporalSegments.length === 0 && !analyzingHooks && (
                <div style={{ margin: '30px 0 40px', textAlign: 'center' }}>
                  <button 
                    onClick={handleAnalyzeHooks}
                    className="primary-button hook-button"
                    style={{
                      background: 'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)',
                      fontSize: '1.1rem',
                      padding: '15px 30px',
                      boxShadow: '0 8px 20px rgba(29, 185, 84, 0.4)'
                    }}
                  >
                    🎯 Analyze Viral Hooks
                  </button>
                  <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Deep DSP analysis to find the best 15s TikTok segments (~10 seconds)
                  </p>
                </div>
              )}
              
              {/* HOOK LOADING STATE */}
              {analyzingHooks && (
                <div className="hook-loading" style={{ margin: '40px 0', textAlign: 'center', padding: '30px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  <div className="hook-scanner-container" style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden', borderRadius: '2px', marginBottom: '20px' }}>
                    <div className="hook-scanner" style={{
                      position: 'absolute',
                      top: 0, left: 0, height: '100%', width: '30%',
                      background: 'var(--accent)',
                      boxShadow: '0 0 10px var(--accent)',
                      animation: 'scan 2s infinite ease-in-out alternate'
                    }}></div>
                  </div>
                  <style>{`
                    @keyframes scan {
                      0% { left: -10%; }
                      100% { left: 80%; }
                    }
                  `}</style>
                  <h4 style={{ color: 'var(--accent)', marginBottom: '10px' }}>Analyzing Acoustic Structure</h4>
                  <p style={{ color: 'var(--text-secondary)', animation: 'pulse 1.5s infinite' }}>{hookLoadingText}</p>
                </div>
              )}

              {/* VIRAL HOOK DETECTION (HEATMAP) */}
              {result.temporalSegments && result.temporalSegments.length > 0 && (
                <div className="viral-hook-section" style={{ margin: '30px 0 40px', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  <h4 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🔥</span> Viral Hook Detection (15s Segments)
                  </h4>
                  
                  {(() => {
                    const bestSegment = [...result.temporalSegments].sort((a, b) => b.hit_probability - a.hit_probability)[0];
                    const formatTime = (secs) => {
                      const m = Math.floor(secs / 60);
                      const s = Math.floor(secs % 60);
                      return `${m}:${s.toString().padStart(2, '0')}`;
                    };
                    
                    return (
                      <>
                        <div className="top-hooks-list" style={{ marginBottom: '20px' }}>
                          
                          {/* Embedded Audio Player */}
                          {audioUrl && (
                            <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                              <h5 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>Playback</h5>
                              <audio 
                                ref={audioRef} 
                                src={audioUrl} 
                                controls 
                                style={{ width: '100%', height: '40px', outline: 'none' }}
                              />
                            </div>
                          )}

                          {result.topHooks && result.topHooks.map((hook, idx) => (
                            <div 
                              key={idx} 
                              className="hook-callout" 
                              onClick={() => jumpToHook(hook.start_time)}
                              style={{ 
                                background: idx === 0 ? 'linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(255,107,107,0.05) 100%)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${idx === 0 ? 'rgba(255,107,107,0.4)' : 'rgba(255,255,255,0.1)'}`,
                                padding: '12px 15px',
                                borderRadius: '8px',
                                marginBottom: '10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                              <div>
                                <strong style={{ color: idx === 0 ? 'var(--accent)' : 'inherit', display: 'block', marginBottom: '4px' }}>
                                  {idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : '🥉 '} {hook.type}
                                </strong>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  {formatTime(hook.start_time)} - {formatTime(hook.end_time)} | {hook.description}
                                </p>
                              </div>
                              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div>
                                  <span style={{ display: 'block', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--accent)' }}>
                                    {(hook.hook_score * 100).toFixed(1)}
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Hook Score
                                  </span>
                                </div>
                                <HookInfoPopover 
                                  hook={hook} 
                                  isOpen={activeHookIndex === idx}
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
                          
                          {/* Fallback for older API versions */}
                          {(!result.topHooks || result.topHooks.length === 0) && bestSegment && (
                            <div className="golden-hook-callout" style={{ 
                              background: 'linear-gradient(135deg, rgba(255,107,107,0.1) 0%, rgba(255,107,107,0.05) 100%)',
                              border: '1px solid rgba(255,107,107,0.3)',
                              padding: '15px',
                              borderRadius: '8px',
                              marginBottom: '20px'
                            }}>
                              <strong style={{ color: 'var(--accent)', display: 'block', marginBottom: '5px' }}>Golden Hook Identified!</strong>
                              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                                The most viral snippet is from <strong>{formatTime(bestSegment.start_time)} - {formatTime(bestSegment.end_time)}</strong> 
                                &nbsp;({(bestSegment.hit_probability * 100).toFixed(1)}% Viral Potential). 
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="heatmap-container" style={{ position: 'relative', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          {result.temporalSegments.map((seg, i) => {
                            const widthPct = ((seg.end_time - seg.start_time) / result.totalDurationSec) * 100;
                            const leftPct = (seg.start_time / result.totalDurationSec) * 100;
                            // Map hook score to a smooth color gradient
                            const segmentScore = seg.hook_score || seg.golden_candidate_score || seg.hit_probability || 0;
                            const hue = Math.max(0, Math.min(120, segmentScore * 120));
                            const color = `hsl(${hue}, 85%, 50%)`;
                            
                            return (
                              <div 
                                key={i}
                                className="heatmap-segment"
                                title={`Time: ${formatTime(seg.start_time)}-${formatTime(seg.end_time)} | Hook Score: ${((seg.hook_score || seg.golden_candidate_score || seg.hit_probability || 0)*100).toFixed(1)}`}
                                style={{
                                  position: 'absolute',
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  height: '100%',
                                  background: color,
                                  opacity: 0.8,
                                  borderRight: '1px solid rgba(255,255,255,0.1)'
                                }}
                              />
                            );
                          })}
                        </div>
                        <div className="heatmap-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '5px' }}>
                          <span>0:00</span>
                          <span>{formatTime(result.totalDurationSec)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

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
                        <motion.div 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
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
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(90deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.05))';
                            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
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
                        </motion.div>
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
                      <AnimatePresence mode="wait">
                        {!mutating ? (
                          <motion.div 
                            key="prompt"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}
                          >
                            <h5 style={{margin: 0, fontSize: '1.4rem', color: '#fff', textAlign: 'center'}}>Hear the Viral Version</h5>
                            <p style={{margin: 0, fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: '400px'}}>Apply the AI's exact tempo and loudness suggestions to your live recording with studio-quality DSP processing.</p>
                            
                            {mutationError && <div style={{color: '#ef4444', fontSize: '0.9rem', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '8px'}}>{mutationError}</div>}
                            
                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleMutate} 
                              style={{background: 'linear-gradient(90deg, #EC4899, #8B5CF6, #3B82F6)', color: 'white', border: 'none', padding: '15px 30px', borderRadius: '30px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(236,72,153,0.4)'}}
                            >
                              ✨ Generate Viral Mix
                            </motion.button>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="loading"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px' }}
                          >
                            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                              <motion.div 
                                animate={{ rotate: 360 }} 
                                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid rgba(236,72,153,0.2)', borderTopColor: '#EC4899' }}
                              />
                              <motion.div 
                                animate={{ rotate: -360 }} 
                                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                                style={{ position: 'absolute', inset: '10px', borderRadius: '50%', border: '4px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6' }}
                              />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <h5 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.2rem' }}>Re-engineering Audio...</h5>
                              <motion.p 
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                style={{ margin: 0, color: '#EC4899', fontSize: '0.9rem' }}
                              >
                                Time stretching & applying intelligent EQ
                              </motion.p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{width: '100%'}}
                      >
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

                          <a href={mutatedAudioUrl} download={`viral_recording.wav`} style={{ display: 'inline-block', background: 'rgba(16,185,129,0.2)', color: '#10B981', border: '1px solid rgba(16,185,129,0.5)', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '1rem', fontWeight: 'bold', transition: 'all 0.2s' }}>
                            ↓ Download Final Mix
                          </a>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

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

              <div className="result-actions">
                <button className="btn secondary" onClick={handleDownloadReport}>Download PDF Report</button>
                <button className="btn secondary" onClick={handleDownloadAudio}>Download Audio</button>
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
