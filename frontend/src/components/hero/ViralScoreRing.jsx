import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

export default function ViralScoreRing() {
  const [score, setScore] = useState(0);
  const controls = useAnimation();
  const radius = 140;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    controls.start({
      strokeDashoffset: circumference - (circumference * 0.91),
      transition: { duration: 2, ease: "easeOut", delay: 0.5 }
    });

    let startTime;
    const duration = 2000;
    const target = 91;

    const animateScore = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      // ease out cubic
      const easeProgress = 1 - Math.pow(1 - percentage, 3);
      setScore(Math.floor(easeProgress * target));

      if (progress < duration) {
        requestAnimationFrame(animateScore);
      }
    };

    setTimeout(() => {
      requestAnimationFrame(animateScore);
    }, 500);
  }, [circumference, controls]);

  return (
    <div style={{ position: 'absolute', zIndex: 10, pointerEvents: 'none', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', marginTop: '55px' }}>
      <svg width="340" height="340" viewBox="0 0 320 320">
        <defs>
          <linearGradient id="scoreGradRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id="glow-ring-intense">
            <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background track */}
        <circle 
          cx="160" cy="160" r={radius} 
          fill="none" 
          stroke="rgba(255,255,255,0.03)" 
          strokeWidth="12" 
        />
        
        {/* Animated progress ring */}
        <motion.circle 
          cx="160" cy="160" r={radius} 
          fill="none" 
          stroke="url(#scoreGradRing)" 
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={controls}
          filter="url(#glow-ring-intense)"
          style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
        />
      </svg>
      
      {/* Score Text */}
      <div style={{
        position: 'absolute',
        top: '0', left: '0', width: '100%', height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ fontSize: '5.5rem', fontWeight: '800', lineHeight: 1, letterSpacing: '-2px' }}>
          {score}<span style={{ fontSize: '2.5rem', fontWeight: '600' }}>%</span>
        </div>
        <div style={{ fontSize: '1.4rem', color: '#EC4899', fontWeight: '500', marginTop: '4px' }}>
          Viral Score
        </div>
        {/* Tiny soundwave graphic under text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginTop: '12px', opacity: 0.6 }}>
          {[3, 8, 12, 18, 10, 5, 14, 8, 4].map((h, i) => (
            <motion.div 
              key={i} 
              style={{ width: '2px', backgroundColor: '#8B5CF6', borderRadius: '1px' }}
              animate={{ height: [h, Math.random() * 20 + 5, h] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
