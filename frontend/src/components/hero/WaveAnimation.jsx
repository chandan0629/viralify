import React from 'react';
import { motion } from 'framer-motion';

export default function WaveAnimation() {
  return (
    <div style={{ position: 'absolute', width: '100%', height: '100%', top: '0', zIndex: 1, pointerEvents: 'none', opacity: 0.6, overflow: 'hidden' }}>
      <svg viewBox="0 0 1000 600" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wavePink" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(236,72,153,0)" />
            <stop offset="50%" stopColor="rgba(236,72,153,0.8)" />
            <stop offset="100%" stopColor="rgba(236,72,153,0)" />
          </linearGradient>
          <linearGradient id="wavePurple" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(139,92,246,0)" />
            <stop offset="50%" stopColor="rgba(139,92,246,0.8)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0)" />
          </linearGradient>
          <filter id="wave-glow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Dense background mesh lines */}
        {[...Array(15)].map((_, i) => (
           <motion.path
             key={`purple-${i}`}
             d={`M -100 ${300 + (i * 10 - 75)} Q 250 ${150 + i * 15} 500 ${300 + (i * 5 - 35)} T 1100 ${300 - i * 10}`}
             fill="none"
             stroke="url(#wavePurple)"
             strokeWidth="1"
             opacity={0.3 - (i * 0.015)}
             animate={{
               d: [
                 `M -100 ${300 + (i * 10 - 75)} Q 250 ${150 + i * 15} 500 ${300 + (i * 5 - 35)} T 1100 ${300 - i * 10}`,
                 `M -100 ${300 + (i * 10 - 75)} Q 250 ${250 + i * 15} 500 ${300 + (i * 5 - 35)} T 1100 ${300 - i * 10}`,
                 `M -100 ${300 + (i * 10 - 75)} Q 250 ${150 + i * 15} 500 ${300 + (i * 5 - 35)} T 1100 ${300 - i * 10}`
               ]
             }}
             transition={{ duration: 8 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
           />
        ))}

        {[...Array(10)].map((_, i) => (
           <motion.path
             key={`pink-${i}`}
             d={`M -100 ${250 + i * 15} Q 300 ${400 - i * 20} 600 ${250 + i * 10} T 1100 ${250 + i * 20}`}
             fill="none"
             stroke="url(#wavePink)"
             strokeWidth="1.5"
             opacity={0.4 - (i * 0.02)}
             filter="url(#wave-glow)"
             animate={{
               d: [
                 `M -100 ${250 + i * 15} Q 300 ${400 - i * 20} 600 ${250 + i * 10} T 1100 ${250 + i * 20}`,
                 `M -100 ${250 + i * 15} Q 300 ${300 - i * 20} 600 ${250 + i * 10} T 1100 ${250 + i * 20}`,
                 `M -100 ${250 + i * 15} Q 300 ${400 - i * 20} 600 ${250 + i * 10} T 1100 ${250 + i * 20}`
               ]
             }}
             transition={{ duration: 7 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
           />
        ))}
      </svg>
    </div>
  );
}
