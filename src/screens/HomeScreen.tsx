import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const ROTATING_WORDS = ['Restaurants', 'Jazz Clubs', 'Live Music', 'Coffee Shops', 'Food Events']

const FOOD_EMOJIS = [
  { emoji: '🍔', label: 'burger' },
  { emoji: '🍕', label: 'pizza' },
  { emoji: '🍣', label: 'sushi' },
  { emoji: '🌮', label: 'taco' },
  { emoji: '☕', label: 'coffee' },
]

export default function HomeScreen() {
  const navigate = useNavigate()
  const [wordIndex, setWordIndex] = useState(0)
  const [globeRotation, setGlobeRotation] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let frame: number
    const animate = () => {
      setGlobeRotation((prev) => prev + 0.3)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between overflow-hidden"
      style={{ background: '#071126' }}
    >
      {/* Top spacer */}
      <div className="flex-1" />

      {/* Main content */}
      <div className="flex flex-col items-center w-full px-6">
        {/* DISCOVER label */}
        <p
          className="text-xs tracking-[0.4em] uppercase mb-6 opacity-70"
          style={{ fontFamily: 'Manrope, sans-serif', color: '#FAFBFF' }}
        >
          DISCOVER
        </p>

        {/* Globe with orbiting food emojis */}
        <div className="relative flex items-center justify-center mb-8" style={{ width: 220, height: 220 }}>
          {/* Orbiting emojis */}
          {FOOD_EMOJIS.map((item, i) => {
            const angle = ((i / FOOD_EMOJIS.length) * 360 + globeRotation) * (Math.PI / 180)
            const radius = 95
            const x = Math.cos(angle) * radius
            const y = Math.sin(angle) * radius * 0.45 // flatten orbit
            const scale = 0.7 + 0.3 * ((Math.sin(angle) + 1) / 2) // depth effect
            return (
              <div
                key={item.label}
                className="absolute flex items-center justify-center"
                style={{
                  transform: `translate(${x}px, ${y}px) scale(${scale})`,
                  zIndex: Math.round(scale * 10),
                  fontSize: 26,
                  filter: `brightness(${0.6 + scale * 0.4})`,
                  transition: 'none',
                }}
              >
                {item.emoji}
              </div>
            )
          })}

          {/* Globe */}
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 120,
              height: 120,
              background: 'radial-gradient(circle at 35% 35%, #4576EF 0%, #1a3a8f 50%, #071126 100%)',
              boxShadow: '0 0 40px rgba(69, 118, 239, 0.4), inset 0 0 30px rgba(0,0,0,0.3)',
            }}
          >
            <span style={{ fontSize: 52 }}>🌍</span>
          </div>
        </div>

        {/* Rotating word */}
        <div className="h-16 flex items-center justify-center overflow-hidden mb-2">
          <AnimatePresence mode="wait">
            <motion.h1
              key={wordIndex}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -40, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              style={{
                fontFamily: 'Bungee, cursive',
                color: '#FAFBFF',
                fontSize: 'clamp(2rem, 9vw, 3rem)',
                lineHeight: 1,
                textAlign: 'center',
              }}
            >
              {ROTATING_WORDS[wordIndex]}
            </motion.h1>
          </AnimatePresence>
        </div>

        {/* Subtitle */}
        <p
          className="mb-10 opacity-60"
          style={{ fontFamily: 'Manrope, sans-serif', color: '#FAFBFF', fontSize: 16 }}
        >
          through video
        </p>

        {/* Suggestion chips */}
        <div className="flex gap-3 flex-wrap justify-center mb-10">
          {['best sushi near me', 'dinner for two'].map((chip) => (
            <button
              key={chip}
              onClick={() => navigate('/map')}
              className="px-5 py-2 rounded-full border text-sm font-medium transition-all active:scale-95"
              style={{
                fontFamily: 'Manrope, sans-serif',
                borderColor: 'rgba(69, 118, 239, 0.5)',
                color: '#FAFBFF',
                background: 'rgba(69, 118, 239, 0.12)',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom: microphone button */}
      <div className="flex flex-col items-center pb-14">
        <p
          className="mb-4 text-xs opacity-50 tracking-wider"
          style={{ fontFamily: 'Manrope, sans-serif', color: '#FAFBFF' }}
        >
          Tap to search by voice
        </p>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => navigate('/voice')}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 72,
            height: 72,
            background: 'linear-gradient(135deg, #4576EF 0%, #2a56d4 100%)',
            boxShadow: '0 0 30px rgba(69, 118, 239, 0.5)',
          }}
        >
          {/* Mic SVG */}
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="2" width="6" height="11" rx="3" fill="white" />
            <path
              d="M5 10a7 7 0 0014 0"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line x1="12" y1="17" x2="12" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="21" x2="16" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </motion.button>
      </div>
    </div>
  )
}
