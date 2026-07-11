import React from 'react';
import { motion } from 'framer-motion';

export default function Equalizer() {
  const bars = Array.from({ length: 12 });

  return (
    <div style={{
      position: 'absolute',
      bottom: '50px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'flex-end',
      gap: '4px',
      height: '40px',
      zIndex: 15
    }}>
      {bars.map((_, i) => (
        <motion.div
          key={i}
          style={{
            width: '6px',
            backgroundColor: '#8B5CF6',
            borderRadius: '3px',
            boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)'
          }}
          animate={{
            height: [10, Math.random() * 30 + 10, 10, Math.random() * 30 + 10, 10]
          }}
          transition={{
            duration: 1.5 + Math.random(),
            repeat: Infinity,
            ease: "easeInOut",
            delay: Math.random()
          }}
        />
      ))}
    </div>
  );
}
