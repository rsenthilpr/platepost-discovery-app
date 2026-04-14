// src/components/SurpriseOrb.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

export default function SurpriseOrb() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 84, // sits above the nav bar (64px) + some gap
        right: 16,
        zIndex: 490,
      }}
    >
      <motion.button
        onHoverStart={() => setExpanded(true)}
        onHoverEnd={() => setExpanded(false)}
        onTapStart={() => setExpanded(true)}
        onClick={() => navigate('/surprise')}
        whileTap={{ scale: 0.9 }}
        animate={{
          boxShadow: expanded
            ? ['0 0 20px rgba(245,158,11,0.7)', '0 0 36px rgba(239,68,68,0.8)', '0 0 20px rgba(245,158,11,0.7)']
            : ['0 0 12px rgba(245,158,11,0.4)', '0 0 20px rgba(239,68,68,0.5)', '0 0 12px rgba(245,158,11,0.4)'],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: expanded ? 8 : 0,
          height: 48,
          borderRadius: 999,
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          border: '2px solid rgba(255,255,255,0.4)',
          cursor: 'pointer',
          overflow: 'hidden',
          paddingLeft: 12,
          paddingRight: expanded ? 16 : 12,
          minWidth: 48,
        }}
      >
        <motion.span
          animate={{ rotate: expanded ? [0, 20, -20, 0] : [0, 15, -15, 0] }}
          transition={{ duration: expanded ? 0.5 : 3, repeat: expanded ? 0 : Infinity }}
          style={{ fontSize: 20, flexShrink: 0 }}
        >
          🎲
        </motion.span>
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                fontFamily: 'Open Sans, sans-serif',
                fontWeight: 700,
                fontSize: 13,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              Surprise me
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
