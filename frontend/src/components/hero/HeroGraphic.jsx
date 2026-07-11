import React from 'react';
import { motion } from 'framer-motion';
import AnimatedHeadphone from './AnimatedHeadphone';
import ViralScoreRing from './ViralScoreRing';
import RotatingRings from './RotatingRings';
import MusicNotes from './MusicNotes';
import Equalizer from './Equalizer';

export default function HeroGraphic({ mousePosition }) {
  // Parallax calculations based on mouse position from -1 to 1
  const x = mousePosition.x;
  const y = mousePosition.y;

  return (
    <div className="hero-graphic-container">
      {/* 5% parallax for background elements */}
      <motion.div 
        style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        animate={{ x: x * 20, y: y * 20 }}
        transition={{ type: "spring", stiffness: 50, damping: 20 }}
      >
        <RotatingRings />
      </motion.div>

      {/* 2% parallax for main headphone */}
      <motion.div 
        style={{ position: 'absolute', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        animate={{ x: x * 8, y: y * 8 }}
        transition={{ type: "spring", stiffness: 50, damping: 20 }}
      >
        <AnimatedHeadphone />
        <ViralScoreRing />
      </motion.div>

      {/* 4% parallax for music notes and eq */}
      <motion.div 
        style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}
        animate={{ x: x * 15, y: y * 15 }}
        transition={{ type: "spring", stiffness: 50, damping: 20 }}
      >
        <MusicNotes />
        <Equalizer />
      </motion.div>


    </div>
  );
}
