import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

function loadFavorites(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem('pp_favorites') ?? '[]')) } catch { return new Set() }
}
function saveFavorites(f: Set<number>) {
  localStorage.setItem('pp_favorites', JSON.stringify([...f]))
}

// Confetti particle
function Confetti({ active }: { active: boolean }) {
  const colors = ['#4576EF', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#fff']
  const particles = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 1,
    size: 4 + Math.random() * 6,
  }))

  if (!active) return null
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: [1, 1, 0], rotate: 720 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute', width: p.size, height: p.size,
            background: p.color, borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  )
}

export default function SurpriseMeScreen() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [picked, setPicked] = useState<Restaurant | null>(null)
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'reveal' | 'detail'>('idle')
  const [showConfetti, setShowConfetti] = useState(false)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [spinDisplay, setSpinDisplay] = useState<Restaurant | null>(null)

  useEffect(() => {
    supabase.from('restaurants').select('*').then(({ data }) => {
      const caOnly = (data ?? []).filter(r => r.state === 'CA')
      setRestaurants(caOnly)
    })
  }, [])

  // Shake detection
  useEffect(() => {
    let lastX = 0, lastY = 0, lastZ = 0
    function handleMotion(e: DeviceMotionEvent) {
      const acc = e.accelerationIncludingGravity
      if (!acc) return
      const dx = Math.abs((acc.x ?? 0) - lastX)
      const dy = Math.abs((acc.y ?? 0) - lastY)
      const dz = Math.abs((acc.z ?? 0) - lastZ)
      if (dx + dy + dz > 25 && phase === 'idle') surprise()
      lastX = acc.x ?? 0; lastY = acc.y ?? 0; lastZ = acc.z ?? 0
    }
    window.addEventListener('devicemotion', handleMotion)
    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [phase, restaurants])

  function surprise() {
    if (restaurants.length === 0 || phase !== 'idle') return
    setPhase('spinning')
    let count = 0
    const max = 20
    spinRef.current = setInterval(() => {
      const r = restaurants[Math.floor(Math.random() * restaurants.length)]
      setSpinDisplay(r)
      count++
      if (count >= max) {
        clearInterval(spinRef.current!)
        const final = restaurants[Math.floor(Math.random() * restaurants.length)]
        setPicked(final)
        setSpinDisplay(final)
        setTimeout(() => {
          setPhase('reveal')
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 3000)
        }, 200)
      }
    }, 80 + Math.floor(count * 3))
  }

  function toggleFavorite(id: number) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      saveFavorites(next)
      return next
    })
  }

  function reset() {
    setPhase('idle')
    setPicked(null)
    setSpinDisplay(null)
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: '#070d1f', fontFamily: 'Open Sans, sans-serif' }}>

      <Confetti active={showConfetti} />

      {/* Back button */}
      <button onClick={() => navigate('/')}
        className="absolute top-14 left-5 w-10 h-10 flex items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
      </button>

      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center gap-8 px-8 text-center">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              style={{ fontSize: 72 }}>🎲</motion.div>
            <div>
              <h1 style={{ fontFamily: 'Bungee, cursive', color: '#fff', fontSize: 32, letterSpacing: '0.04em', marginBottom: 8 }}>
                Surprise Me
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.6 }}>
                Can't decide where to eat?{'\n'}Let us choose for you.
              </p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={surprise}
              className="px-10 py-4 rounded-2xl font-bold text-lg"
              style={{ background: 'linear-gradient(135deg, #4576EF, #8b5cf6)', color: '#fff',
                boxShadow: '0 8px 32px rgba(69,118,239,0.4)' }}>
              🎲 Pick My Restaurant
            </motion.button>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>or shake your phone</p>
          </motion.div>
        )}

        {phase === 'spinning' && spinDisplay && (
          <motion.div key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-6 px-8 text-center w-full">
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Finding your spot...
            </p>
            <motion.div
              key={spinDisplay.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-sm rounded-3xl overflow-hidden"
              style={{ border: '2px solid rgba(69,118,239,0.5)' }}>
              <img src={spinDisplay.image_url} alt={spinDisplay.name}
                className="w-full object-cover" style={{ height: 200 }} />
              <div className="px-5 py-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <p style={{ fontFamily: 'Bungee, cursive', color: '#fff', fontSize: 20 }}>{spinDisplay.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{spinDisplay.cuisine} · {spinDisplay.city}</p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {phase === 'reveal' && picked && (
          <motion.div key="reveal" initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
            className="flex flex-col items-center gap-5 px-5 text-center w-full max-w-sm">

            <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ fontFamily: 'Bungee, cursive', color: '#FFD700', fontSize: 14, letterSpacing: '0.2em' }}>
              🎉 TONIGHT YOU'RE GOING TO
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, type: 'spring' }}
              className="w-full rounded-3xl overflow-hidden cursor-pointer"
              style={{ boxShadow: '0 0 60px rgba(69,118,239,0.4)', border: '2px solid rgba(69,118,239,0.6)' }}
              onClick={() => setSelectedRestaurant(picked)}>
              <div className="relative" style={{ height: 240 }}>
                <img src={picked.image_url} alt={picked.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(7,13,31,0.9) 0%, transparent 60%)' }} />
                <button
                  onClick={e => { e.stopPropagation(); toggleFavorite(picked.id) }}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24"
                    fill={favorites.has(picked.id) ? '#E11D48' : 'none'}
                    stroke={favorites.has(picked.id) ? '#E11D48' : 'white'} strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                  <p style={{ fontFamily: 'Bungee, cursive', color: '#fff', fontSize: 24, letterSpacing: '0.03em' }}>{picked.name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{picked.cuisine} · {picked.city}, {picked.state}</p>
                </div>
              </div>
              <div className="px-5 py-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.5 }}>{picked.description}</p>
              </div>
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
              style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
              Tap the card for more info
            </motion.p>

            <div className="flex gap-3 w-full">
              <motion.button whileTap={{ scale: 0.95 }} onClick={reset}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.15)' }}>
                🎲 Try Again
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }}
                onClick={() => { const q = encodeURIComponent(`${picked.name}, ${picked.city}`); window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank') }}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #4576EF, #8b5cf6)', color: '#fff' }}>
                📍 Get Directions
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedRestaurant && (
          <RestaurantDetail
            restaurant={selectedRestaurant}
            onClose={() => setSelectedRestaurant(null)}
            isFavorite={favorites.has(selectedRestaurant.id)}
            onToggleFavorite={() => toggleFavorite(selectedRestaurant.id)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
