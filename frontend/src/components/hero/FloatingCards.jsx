import React from 'react';
import { motion } from 'framer-motion';

export default function FloatingCards() {
  const cards = [
    { title: "🔥 Catchiness", score: "92%", top: "-10%", left: "-10%", delay: 0 },
    { title: "🎵 Danceability", score: "88%", top: "70%", left: "-25%", delay: 1.5 },
    { title: "❤️ Emotional Impact", score: "85%", top: "30%", right: "-20%", delay: 3 }
  ];

  return (
    <>
      {cards.map((card, i) => (
        <motion.div
          key={i}
          className="hero-glass-card glow-border"
          style={{
            top: card.top,
            left: card.left,
            right: card.right
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: 1, 
            scale: 1,
            y: [0, -15, 0],
            rotate: [0, 2, -1, 0]
          }}
          transition={{
            opacity: { duration: 0.8, delay: 0.5 + (i * 0.2) },
            scale: { duration: 0.8, delay: 0.5 + (i * 0.2) },
            y: { duration: 5, repeat: Infinity, delay: card.delay, ease: "easeInOut" },
            rotate: { duration: 7, repeat: Infinity, delay: card.delay, ease: "easeInOut" }
          }}
          whileHover={{ scale: 1.05, zIndex: 30 }}
        >
          <h4>{card.title}</h4>
          <div className="score">{card.score}</div>
        </motion.div>
      ))}
    </>
  );
}
