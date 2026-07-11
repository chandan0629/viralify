import React from 'react';
import { motion } from 'framer-motion';

export default function AnimatedHeadphone() {
  return (
    <motion.div
      style={{
        position: 'absolute', // ensure it stacks with the ring
        width: '650px',
        height: '650px',
        zIndex: 5,
        filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.8))'
      }}
      animate={{
        y: [-5, 5, -5],
        rotate: [-1, 1, -1],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <svg viewBox="0 0 400 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hp-base" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a1a24" />
            <stop offset="100%" stopColor="#0a0a14" />
          </linearGradient>
          <linearGradient id="hp-highlight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2c2c3e" />
            <stop offset="100%" stopColor="#11111a" />
          </linearGradient>
          <linearGradient id="bandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0f0f15" />
            <stop offset="50%" stopColor="#2a2a35" />
            <stop offset="100%" stopColor="#0f0f15" />
          </linearGradient>
          <linearGradient id="glowPink" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="glowBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Headband Cushion */}
        <path d="M 60 190 C 60 -10, 340 -10, 340 190" fill="none" stroke="url(#bandGrad)" strokeWidth="55" strokeLinecap="round" />
        {/* Inner Headband Structure */}
        <path d="M 60 190 C 60 -10, 340 -10, 340 190" fill="none" stroke="#000000" strokeWidth="40" strokeLinecap="round" opacity="0.8" />
        
        {/* Left Arm Hinge */}
        <rect x="42" y="160" width="36" height="50" rx="8" fill="#11111a" stroke="#222" strokeWidth="2" />
        <rect x="35" y="180" width="50" height="20" rx="4" fill="#000" />
        
        {/* Right Arm Hinge */}
        <rect x="322" y="160" width="36" height="50" rx="8" fill="#11111a" stroke="#222" strokeWidth="2" />
        <rect x="315" y="180" width="50" height="20" rx="4" fill="#000" />

        {/* Left Earcup - Outer Shell */}
        <ellipse cx="60" cy="240" rx="45" ry="75" fill="url(#hp-base)" stroke="#333" strokeWidth="2" />
        {/* Left Earcup - Inner indent */}
        <ellipse cx="65" cy="240" rx="35" ry="65" fill="url(#hp-highlight)" />
        {/* Left Earcup - Cushion */}
        <ellipse cx="85" cy="240" rx="20" ry="70" fill="#050508" stroke="#111" strokeWidth="3" />
        {/* Left Earcup - Pink/Blue rim light */}
        <path d="M 75 175 Q 110 240 75 305" fill="none" stroke="url(#glowPink)" strokeWidth="6" opacity="0.6" filter="url(#soft-glow)" />

        {/* Right Earcup - Outer Shell */}
        <ellipse cx="340" cy="240" rx="45" ry="75" fill="url(#hp-base)" stroke="#333" strokeWidth="2" />
        {/* Right Earcup - Inner indent */}
        <ellipse cx="335" cy="240" rx="35" ry="65" fill="url(#hp-highlight)" />
        {/* Right Earcup - Cushion */}
        <ellipse cx="315" cy="240" rx="20" ry="70" fill="#050508" stroke="#111" strokeWidth="3" />
        {/* Right Earcup - Blue rim light */}
        <path d="M 325 175 Q 290 240 325 305" fill="none" stroke="url(#glowBlue)" strokeWidth="6" opacity="0.6" filter="url(#soft-glow)" />

        {/* Tiny light details */}
        <circle cx="45" cy="220" r="3" fill="#EC4899" filter="url(#soft-glow)" />
        <circle cx="355" cy="260" r="3" fill="#6366F1" filter="url(#soft-glow)" />
      </svg>
    </motion.div>
  );
}
