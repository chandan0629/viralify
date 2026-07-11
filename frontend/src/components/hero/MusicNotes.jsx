import React from 'react';
import { motion } from 'framer-motion';
import { Music } from 'lucide-react';

export default function MusicNotes() {
  const notes = Array.from({ length: 8 });

  return (
    <div style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 6, pointerEvents: 'none' }}>
      {notes.map((_, i) => {
        const randomLeft = Math.random() * 60 + 20; // 20% to 80%
        const delay = Math.random() * 5;
        const duration = Math.random() * 3 + 4;
        const size = Math.random() * 12 + 12; // 12px to 24px
        
        return (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              bottom: '20%',
              left: `${randomLeft}%`,
              color: i % 2 === 0 ? '#8B5CF6' : '#EC4899',
              opacity: 0
            }}
            animate={{
              y: [0, -200],
              x: [0, (Math.random() - 0.5) * 100],
              opacity: [0, 0.8, 0],
              rotate: [0, (Math.random() - 0.5) * 180]
            }}
            transition={{
              duration: duration,
              delay: delay,
              repeat: Infinity,
              ease: "easeOut"
            }}
          >
            <Music size={size} />
          </motion.div>
        );
      })}
    </div>
  );
}
