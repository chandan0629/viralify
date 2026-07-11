import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles, Zap, TrendingUp, Headphones } from 'lucide-react';
import './Hero.css';

export default function HeroText({ onStartPrediction }) {
  return (
    <div className="hero-content">


      <motion.h1 
        className="hero-title"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      >
        Predict Your<br />
        Song's<br />
        <span className="text-gradient">Viral Potential</span><br />
        with AI
      </motion.h1>

      <motion.p 
        className="hero-desc"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      >
        Analyze your music with AI to predict viral potential, identify key hooks and discover powerful insights.
      </motion.p>

      <motion.div 
        className="hero-actions"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
      >
        <button className="hero-btn-primary large" onClick={onStartPrediction}>
          Start Predicting <ChevronRight size={18} />
        </button>
      </motion.div>


    </div>
  );
}
