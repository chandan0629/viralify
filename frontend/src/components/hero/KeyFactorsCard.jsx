import React from 'react';
import { motion } from 'framer-motion';
import { Activity, User, Zap, Mic } from 'lucide-react';

export default function KeyFactorsCard() {
  const factors = [
    { label: "Catchiness", score: "92%", width: "92%", color: "#EC4899", icon: <Activity size={14} color="#EC4899" /> },
    { label: "Danceability", score: "88%", width: "88%", color: "#8B5CF6", icon: <User size={14} color="#8B5CF6" /> },
    { label: "Energy", score: "85%", width: "85%", color: "#6366F1", icon: <Zap size={14} color="#6366F1" /> },
    { label: "Lyrics Impact", score: "79%", width: "79%", color: "#EC4899", icon: <Mic size={14} color="#EC4899" /> }
  ];

  return (
    <motion.div
      style={{
        position: 'absolute',
        bottom: '-15%',
        right: '-5%',
        width: '380px',
        background: 'rgba(20, 20, 40, 0.4)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        zIndex: 20,
        transform: 'perspective(1000px) rotateX(15deg) rotateY(-15deg)',
      }}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.8 }}
      whileHover={{ scale: 1.05, transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' }}
    >
      <h4 style={{ color: '#b0b0d0', fontSize: '0.85rem', marginBottom: '20px', fontWeight: '500' }}>Key Factors</h4>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {factors.map((factor, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {factor.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: '500' }}>{factor.label}</span>
                <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: '600' }}>{factor.score}</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <motion.div 
                  style={{ height: '100%', background: factor.color, borderRadius: '2px', boxShadow: `0 0 10px ${factor.color}` }}
                  initial={{ width: 0 }}
                  animate={{ width: factor.width }}
                  transition={{ duration: 1.5, delay: 1 + (i * 0.2), ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
