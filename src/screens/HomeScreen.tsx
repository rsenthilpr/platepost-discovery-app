import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchPexelsVideo } from '../lib/pexels'

const VIDEO_QUERIES = [
  'pasta cooking italian food',
  'sushi japanese food preparation',
  'coffee barista espresso',
  'burger grill american food',
]

const LA_NEIGHBORHOODS = [
  'DTLA', 'Silver Lake', 'Los Feliz', 'Echo Park', 'Koreatown',
  'West Hollywood', 'Culver City', 'Venice', 'Santa Monica', 'Arts District',
  'Highland Park', 'Fairfax', 'Mid-City', 'Brentwood', 'Larchmont',
]



// Recently viewed — stored in localStorage
function getRecentlyViewed(): number[] {
  try {
    return JSON.parse(localStorage.getItem('pp_recently_viewed') ?? '[]')
  } catch { return [] }
}

export function addToRecentlyViewed(id: number) {
  try {
    const existing = getRecentlyViewed().filter(i => i !== id)
    const updated = [id, ...existing].slice(0, 10)
    localStorage.setItem('pp_recently_viewed', JSON.stringify(updated))
  } catch {}
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const [heroVideos, setHeroVideos] = useState<string[]>([])
  const [videoIndex, setVideoIndex] = useState(0)
  const [nextVideoIndex, setNextVideoIndex] = useState(1)
  const [transitioning, setTransitioning] = useState(false)
  const [currentOpacity, setCurrentOpacity] = useState(1)

  // Vibe Match

  // Feature panels
  const [showNeighborhoods, setShowNeighborhoods] = useState(false)
  const [recentlyViewed] = useState<number[]>(getRecentlyViewed)

  useEffect(() => {
    async function loadVideos() {
      const results = await Promise.all(VIDEO_QUERIES.map(q => fetchPexelsVideo(q)))
      const urls = results.map(r => r?.url).filter((url): url is string => !!url)
      if (urls.length > 0) setHeroVideos(urls)
    }
    loadVideos()
  }, [])



  // Crossfade videos
  useEffect(() => {
    if (heroVideos.length < 2) return
    const interval = setInterval(() => {
      if (transitioning) return
      setTransitioning(true)
      let opacity = 1
      const fadeOut = setInterval(() => {
        opacity -= 0.04
        setCurrentOpacity(Math.max(0, opacity))
        if (opacity <= 0) {
          clearInterval(fadeOut)
          setVideoIndex(v => (v + 1) % heroVideos.length)
          setNextVideoIndex(v => (v + 1) % heroVideos.length)
          setCurrentOpacity(1)
          setTransitioning(false)
        }
      }, 50)
    }, 6000)
    return () => clearInterval(interval)
  }, [heroVideos.length, transitioning])



  function handleNeighborhoodTap(neighborhood: string) {
    setShowNeighborhoods(false)
    navigate('/list', { state: { filter: 'All', neighborhood, listView: true } })
  }

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#000' }}>

      {/* ── Video Layer ── */}
      <div className="absolute inset-0">
        {heroVideos.length > 0 ? (
          <>
            <video
              key={`cur-${videoIndex}`}
              src={heroVideos[videoIndex]}
              autoPlay muted loop playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: currentOpacity, transition: 'opacity 1.2s ease' }}
            />
            {heroVideos[nextVideoIndex] && (
              <video
                key={`next-${nextVideoIndex}`}
                src={heroVideos[nextVideoIndex]}
                autoPlay muted loop playsInline
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: transitioning ? 1 - currentOpacity : 0, transition: 'opacity 1.2s ease' }}
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, #0a1628 0%, #1a2f5e 50%, #071126 100%)' }} />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.95) 100%)' }}
      />

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-14 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <polygon points="5,3 19,12 5,21" fill="white" />
          </svg>
          <span style={{ fontFamily: 'Bungee, cursive', color: '#fff', fontSize: 17, letterSpacing: '0.04em' }}>
            PlatePost
          </span>
        </div>
        <button
          onClick={() => navigate('/map')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.25)' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" />
          </svg>
          <span style={{ fontFamily: 'Manrope, sans-serif', color: '#fff', fontSize: 11, fontWeight: 600 }}>Los Angeles</span>
        </button>
      </div>

      {/* ── Main content ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-10">

        {/* Headline */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-5">
          <p style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
            Discover
          </p>
          <h1 style={{ fontFamily: 'Bungee, cursive', color: '#fff', fontSize: 'clamp(2rem, 9vw, 3.2rem)', lineHeight: 1.05, letterSpacing: '0.02em', textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
            LA's best<br />restaurants
          </h1>
        </motion.div>



        {/* ── Quick action chips ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex gap-2 mb-4 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Open Now */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate('/list', { state: { filter: 'All', openNow: true, listView: true } })}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#fff', fontFamily: 'Manrope', backdropFilter: 'blur(12px)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
            Open Now
          </motion.button>

          {/* Tonight */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate('/tonight')}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#fff', fontFamily: 'Manrope', backdropFilter: 'blur(12px)' }}
          >
            <span style={{ fontSize: 12 }}>🎟️</span>
            Tonight
          </motion.button>

          {/* Neighborhoods */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setShowNeighborhoods(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(69,118,239,0.2)', border: '1px solid rgba(69,118,239,0.4)', color: '#fff', fontFamily: 'Manrope', backdropFilter: 'blur(12px)' }}
          >
            <span style={{ fontSize: 12 }}>📍</span>
            Neighborhoods
          </motion.button>

          {/* Recently Viewed */}
          {recentlyViewed.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => navigate('/list', { state: { recentIds: recentlyViewed, listView: true } })}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontFamily: 'Manrope', backdropFilter: 'blur(12px)' }}
            >
              <span style={{ fontSize: 12 }}>🕐</span>
              Recent
            </motion.button>
          )}
        </motion.div>

        {/* ── Bottom buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex gap-3"
        >
          <button
            onClick={() => navigate('/map')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
            style={{ fontFamily: 'Manrope, sans-serif', background: '#fff', color: '#071126' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#071126" />
              <circle cx="12" cy="9" r="2.5" fill="white" />
            </svg>
            Explore Map
          </button>
          <button
            onClick={() => navigate('/list')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
            style={{ fontFamily: 'Manrope, sans-serif', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <polygon points="5,3 19,12 5,21" fill="white" />
            </svg>
            Watch Feed
          </button>
        </motion.div>
      </div>

      {/* ── Floating Concierge Orb ── */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8, type: 'spring', stiffness: 200 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => navigate('/concierge')}
        className="absolute z-30"
        style={{ bottom: 120, right: 20 }}
      >
        <motion.div
          animate={{ boxShadow: ['0 0 20px rgba(69,118,239,0.4)', '0 0 40px rgba(139,92,246,0.6)', '0 0 20px rgba(69,118,239,0.4)'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5"
          style={{ background: 'linear-gradient(135deg, #4576EF, #8b5cf6)', border: '2px solid rgba(255,255,255,0.2)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <polygon points="5,3 19,12 5,21" fill="white" />
          </svg>
        </motion.div>
      </motion.button>

      {/* ── Neighborhoods Sheet ── */}
      <AnimatePresence>
        {showNeighborhoods && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-30"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
              onClick={() => setShowNeighborhoods(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 z-40 rounded-t-3xl px-5 pt-4 pb-14"
              style={{ background: '#0d1b35', maxHeight: '70vh', overflowY: 'auto', scrollbarWidth: 'none' }}
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
              </div>
              <p style={{ fontFamily: 'Bungee, cursive', color: '#fff', fontSize: 18, letterSpacing: '0.04em', marginBottom: 16 }}>
                Browse by Neighborhood
              </p>
              <div className="flex flex-wrap gap-2">
                {LA_NEIGHBORHOODS.map(n => (
                  <motion.button
                    key={n}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => handleNeighborhoodTap(n)}
                    className="px-4 py-2 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontFamily: 'Manrope' }}
                  >
                    📍 {n}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
