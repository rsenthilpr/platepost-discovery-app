// src/components/AskPlatePostPill.tsx
// Fix #1: AI concierge entry. Replaces the center FAB on BottomNav.
// Lives inside the Home hero. Tapping navigates to /concierge.
//
// Design: rotating example prompts to suggest what Piggy can do.
// Pill matches mockup — left-side circular Piggy avatar, ASK PLATEPOST eyebrow,
// example prompt below, subtle chevron on the right.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const ROTATING_PROMPTS = [
  'Quiet Italian for 4 tonight…',
  'Best coffee to work from in Silver Lake',
  'Late night ramen near me',
  'Romantic spot under $80',
  'Brunch with a view, Saturday morning',
  'Live jazz with dinner',
]

interface Props {
  /** Whether the pill renders on a dark hero (white text) or light surface (dark text). Default: dark hero. */
  variant?: 'on-hero' | 'on-light'
}

export default function AskPlatePostPill({ variant = 'on-hero' }: Props) {
  const navigate = useNavigate()
  const [promptIndex, setPromptIndex] = useState(0)

  // Rotate the example prompt every 4 seconds — gives the pill life
  // and teaches users what they can ask without a tutorial.
  useEffect(() => {
    const interval = setInterval(() => {
      setPromptIndex((i) => (i + 1) % ROTATING_PROMPTS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const isDark = variant === 'on-hero'

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate('/concierge')}
      aria-label="Ask PlatePost AI concierge"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 16,
        background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,72,249,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: isDark
          ? '1px solid rgba(255,255,255,0.18)'
          : '1px solid rgba(0,72,249,0.18)',
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: isDark
          ? '0 4px 24px rgba(0,0,0,0.25)'
          : '0 2px 12px rgba(0,72,249,0.08)',
      }}
    >
      {/* Piggy avatar — gradient ring + image */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #ffb3c6 0%, #ff8fab 60%, #ff6b9d 100%)',
          boxShadow: '0 2px 10px rgba(255,107,157,0.35)',
        }}
      >
        <img
          src="/piggy/hi piggy.png"
          alt=""
          aria-hidden="true"
          width={28}
          height={28}
          style={{ objectFit: 'contain', display: 'block' }}
        />
      </div>

      {/* Text — eyebrow + rotating prompt */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'Open Sans, sans-serif',
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: isDark ? '#ff8fab' : '#ff6b9d',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Ask PlatePost
        </p>
        {/* AnimatePresence gives the prompt a soft fade as it rotates */}
        <div style={{ position: 'relative', height: 18, overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            <motion.p
              key={promptIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{
                fontFamily: 'Open Sans, sans-serif',
                fontWeight: 500,
                fontSize: 13,
                color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(7,17,38,0.75)',
                margin: '2px 0 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
              }}
            >
              "{ROTATING_PROMPTS[promptIndex]}"
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Chevron — subtle, signals tap target */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        style={{ flexShrink: 0, opacity: 0.5 }}
        aria-hidden="true"
      >
        <path
          d="M9 18l6-6-6-6"
          stroke={isDark ? '#fff' : '#071126'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.button>
  )
}
