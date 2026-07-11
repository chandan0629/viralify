import React, { useState, useRef, useEffect } from 'react';
import './HookInfoPopover.css';

const HookInfoPopover = ({ hook, isOpen, isPinned, onTogglePin, onMouseEnter, onMouseLeave }) => {
  const [panelPos, setPanelPos] = useState({ top: -15, leftOffset: 40 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  // Calculate dynamic insight
  const score = hook.hook_score * 100;

  let insight = "";
  let purposeImpact = [];

  if (hook.type === "Golden Hook" || hook.type === "Golden") {
    insight = "This segment represents the most memorable and recognizable part of the song. Its strong chorus characteristics make it a suitable choice for Instagram Reels, TikTok trends, and promotional content. This portion has strong audience engagement potential and may perform well in short-form content.";
    purposeImpact = [
      "Golden hook is intended to identify the most recognizable section of the song.",
      "It first identifies the most repetitive candidates using similarity analysis.",
      "Energy and Loudness are prioritized because the most impactful musical segment is often the one with the strongest intensity."
    ];
  } else if (hook.type === "Rhythm Hook") {
    insight = "This segment contains the strongest rhythmic consistency and danceability patterns in the track. It is well suited for dance challenges, choreography videos, fitness content, and trend-based social media posts. Its steady beat structure gives it strong engagement potential for short-form platforms.";
    purposeImpact = [
      "Rhythm hook aims to identify the most danceable section of the song.",
      "Beat Density and Beat Regularity are the primary indicators of rhythmic engagement, so they receive higher weights.",
      "Energy is included as a supporting factor, as energetic segments can enhance listener engagement."
    ];
  } else if (hook.type === "High-Energy Drop") {
    insight = "This segment contains the highest energy build-up and impact within the song. It is ideal for transitions, cinematic edits, gaming clips, transformation videos, and action-focused content. Its strong intensity and attention-grabbing characteristics make it a valuable candidate for short-form content creation.";
    purposeImpact = [
      "High-Energy Drop is designed to detect the climactic moments such as drops and explosive transitions.",
      "Energy is the dominant factor, Loudness indicates impact, and Novelty captures sudden musical changes.",
      "Therefore, Energy receives the highest weight, followed by Loudness and Novelty."
    ];
  } else {
    insight = "This segment has characteristics commonly found in engaging short-form content and may perform well across various platforms like Instagram Reels, TikTok, and YouTube Shorts.";
    purposeImpact = [
      "Represents a key engaging moment detected in the track's structure.",
      "Combines multiple audio features to find sections with high listener retention potential."
    ];
  }

  // Hook specific data
  let algorithm = [];
  let features = [];
  let calculation = [];
  let usage = [];
  let educational = "";
  let detectionProcess = [];
  let scoringFormula = "";

  if (hook.type === "Golden Hook" || hook.type === "Golden") {
    algorithm = [
      "Chorus Similarity Analysis",
      "Energy Analysis",
      "Loudness Analysis"
    ];
    features = ["Chorus Similarity", "Energy", "Loudness"];
    calculation = [
      "Step 1: Find Top 5 Chorus Candidates using Chorus Similarity.",
      "Step 2: Golden Score = 60% Energy + 40% Loudness"
    ];
    detectionProcess = [
      "The song is divided into overlapping segments.",
      "Similarity analysis identifies the most repetitive segments.",
      "The Top 5 candidates are selected.",
      "Energy and Loudness scores are calculated.",
      "The highest-scoring candidate is selected as the Golden Hook."
    ];
    scoringFormula = "Golden Score = (0.60 × Energy) + (0.40 × Loudness)";
    usage = [
      "Best for Instagram Reels",
      "Best for TikTok Trends",
      "Best promotional snippet",
      "Most memorable chorus section"
    ];
    educational = "This segment was selected because it contains a highly repetitive chorus pattern combined with strong energy and loudness characteristics.";
  } else if (hook.type === "Rhythm Hook") {
    algorithm = [
      "Beat Density Analysis",
      "Beat Regularity Analysis",
      "Energy Analysis"
    ];
    features = ["Beat Density", "Beat Regularity", "Energy"];
    calculation = [
      "Rhythm Score = 50% Beat Density + 30% Beat Regularity + 20% Energy"
    ];
    detectionProcess = [
      "The song is divided into segments.",
      "Beat Density is calculated for each segment.",
      "Beat Regularity is measured.",
      "Energy is added as a supporting factor.",
      "The segment with the highest Rhythm Score is selected."
    ];
    scoringFormula = "Rhythm Score = (0.50 × Beat Density) + (0.30 × Beat Regularity) + (0.20 × Energy)";
    usage = [
      "Dance content",
      "Choreography videos",
      "Short-form performance content"
    ];
    educational = "This segment was selected because it exhibits the most consistent rhythmic patterns and highest beat density outside of the main chorus.";
  } else if (hook.type === "High-Energy Drop") {
    algorithm = [
      "Energy Analysis",
      "Loudness Analysis",
      "Novelty Analysis"
    ];
    features = ["Energy", "Loudness", "Novelty"];
    calculation = [
      "High-Energy Score = 60% Energy + 25% Loudness + 15% Novelty"
    ];
    detectionProcess = [
      "Energy is calculated for every segment.",
      "Loudness is measured.",
      "Novelty detects sudden musical changes.",
      "A weighted High-Energy Score is calculated.",
      "The highest-scoring segment is selected."
    ];
    scoringFormula = "High-Energy Score = (0.60 × Energy) + (0.25 × Loudness) + (0.15 × Novelty)";
    usage = [
      "Transitions",
      "Cinematic edits",
      "Action reels",
      "Gaming edits"
    ];
    educational = "This segment was selected because it represents the most significant spike in dynamic intensity and acoustic novelty across the track.";
  } else {
    // fallback for older API versions or unknown hooks
    algorithm = ["General DSP Feature Extraction"];
    features = ["Energy", "Loudness"];
    calculation = ["Score is based on overall intensity."];
    detectionProcess = [
      "Segment the song.",
      "Calculate overall acoustic intensity.",
      "Select the segment with the highest score."
    ];
    scoringFormula = "Score = (Weighted combination of acoustic features)";
    usage = ["General short-form content"];
    educational = "This segment was identified as the peak acoustic moment of the song.";
  }

  useEffect(() => {
    const updatePosition = () => {
      if (isOpen && buttonRef.current) {
        const btnRect = buttonRef.current.getBoundingClientRect();
        const resultCard = buttonRef.current.closest('.result-card');

        // Calculate the main container's right boundary
        // If we can't find it, fallback to the 800px center logic
        const containerRightEdge = resultCard
          ? resultCard.getBoundingClientRect().right
          : (window.innerWidth / 2) + 400;

        // Calculate how far the button is from the container's right edge
        const distanceToEdge = containerRightEdge - btnRect.right;

        // Ensure the popover is rendered fully outside the main container's right boundary
        const desiredLeftOffset = distanceToEdge + 40;

        // Calculate vertical offset to center the panel relative to the button
        const panelHeight = panelRef.current ? panelRef.current.offsetHeight : 400;
        let desiredTop = -(panelHeight / 2) + (btnRect.height / 2);

        // Clamp to ensure the panel does not overflow the top of the viewport
        if (btnRect.top + desiredTop < 20) {
          desiredTop = -(btnRect.top) + 20;
        }

        // Clamp to ensure the panel does not overflow the bottom of the viewport
        if (btnRect.top + desiredTop + panelHeight > window.innerHeight - 20) {
          desiredTop = window.innerHeight - 20 - panelHeight - btnRect.top;
        }

        setPanelPos({
          top: desiredTop,
          leftOffset: desiredLeftOffset
        });
      }
    };

    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      return () => window.removeEventListener('resize', updatePosition);
    }
  }, [isOpen]);

  return (
    <div
      className="hook-info-wrapper"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        ref={buttonRef}
        className={`info-btn ${isPinned ? 'pinned' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
        }}
        title="More Information"
      >
        ⓘ
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="info-panel"
          style={{ top: `${panelPos.top}px`, left: `calc(100% + ${panelPos.leftOffset}px)` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="info-panel-header">
            <h4>{hook.type} Analysis</h4>
            <button
              className="close-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (isPinned) onTogglePin(); // unpin to close
                if (!isPinned) onMouseLeave(); // manually close if it was just hovered
              }}
            >
              ×
            </button>
          </div>

          <div className="info-panel-content">
            <div className="info-section insight-section">
              <h5>Purpose & Impact</h5>
              <ul className="insight-text" style={{ paddingLeft: '20px', margin: 0, color: '#fff' }}>
                {purposeImpact.map((point, i) => (
                  <li key={i} style={{ marginBottom: '6px', color: '#fff' }}>{point}</li>
                ))}
              </ul>
            </div>

            <div className="info-section">
              <h5>Algorithm Used</h5>
              <ul>
                {algorithm.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>

            <div className="info-section">
              <h5>Detection Process</h5>
              <ol style={{ paddingLeft: '20px', margin: 0, fontSize: '0.85rem' }}>
                {detectionProcess.map((step, i) => <li key={i} style={{ marginBottom: '4px' }}>{step}</li>)}
              </ol>
            </div>

            <div className="info-section">
              <h5>Features Used</h5>
              <div className="feature-tags">
                {features.map((f, i) => <span key={i} className="feature-tag">{f}</span>)}
              </div>
            </div>

            <div className="info-section">
              <h5>How It Was Calculated</h5>
              <div className="calc-box">
                {calculation.map((c, i) => <p key={i}>{c}</p>)}
              </div>
            </div>

            <div className="info-section insight-section">
              <h5>Scoring Formula</h5>
              <p className="insight-text" style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#ffd700' }}>{scoringFormula}</p>
            </div>

            <div className="info-section insight-section">
              <h5>Weight Selection</h5>
              <p className="insight-text">The hook weights were initially chosen with balanced values and then refined through testing on multiple songs. They were adjusted based on observed detection performance to improve accuracy and can be further optimized through future evaluation on larger datasets.</p>
            </div>

            <div className="info-section">
              <h5>Practical Usage</h5>
              <ul>
                {usage.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </div>

            <div className="info-section insight-section">
              <h5>Viral Potential Insight</h5>
              <p className="insight-text">{insight}</p>
            </div>

            <div className="info-section edu-section">
              <h5>Why did the system choose this segment?</h5>
              <p>{educational}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HookInfoPopover;
