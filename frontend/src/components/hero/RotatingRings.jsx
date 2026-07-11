import React from 'react';
import { motion } from 'framer-motion';

export default function RotatingRings() {
  return (
    <div style={{ position: 'absolute', width: '400px', height: '400px', zIndex: 1, pointerEvents: 'none' }}>
      <motion.div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderTop: '1px solid rgba(139, 92, 246, 0.8)',
          borderBottom: '1px solid rgba(236, 72, 153, 0.8)'
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        style={{
          position: 'absolute',
          width: '80%',
          height: '80%',
          top: '10%',
          left: '10%',
          borderRadius: '50%',
          border: '1px solid rgba(236, 72, 153, 0.2)',
          borderLeft: '1px solid rgba(99, 102, 241, 0.8)',
          borderRight: '1px solid rgba(139, 92, 246, 0.8)'
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
