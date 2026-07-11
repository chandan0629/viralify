import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import HeroText from './HeroText';
import HeroGraphic from './HeroGraphic';
import GradientBackground from './GradientBackground';
import BackgroundParticles from './BackgroundParticles';
import WaveAnimation from './WaveAnimation';
import { Mouse } from 'lucide-react';
import './Hero.css';

export default function Hero({ onLogin, onSignup }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Normalize mouse coordinates from -1 to 1 based on window width/height
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePosition({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="hero-wrapper">
      <GradientBackground />
      <BackgroundParticles />
      <WaveAnimation />
      
      <div className="hero-grid">
        <HeroText onStartPrediction={onLogin} onWatchDemo={onSignup} />
        <HeroGraphic mousePosition={mousePosition} />
      </div>

      <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', opacity: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <Mouse size={24} color="white" />
        <motion.div 
          style={{ width: '2px', height: '12px', background: 'white', borderRadius: '2px' }}
          animate={{ y: [0, 8, 0], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
    </section>
  );
}
