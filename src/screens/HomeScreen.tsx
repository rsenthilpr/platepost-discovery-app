import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchPexelsVideo } from '../lib/pexels'

const VIDEO_QUERIES = [
  'pasta cooking italian food',
  'sushi japanese food preparation',
  'coffee barista espresso',
  'burger grill american food',
]

const PRIMARY_SUGGESTIONS = [
  { label: '🍣 Best sushi near me', query: 'Japanese' },
  { label: '🕯️ Dinner for two', query: 'Italian' },
  { label: '☕ Coffee & vibes', query: 'Coffee' },
  { label: '🎷 Live jazz tonight', query: 'Jazz' },
  { label: '🍔 Late night bites', query: 'American' },
  { label: '🎵 DJ sets', query: 'DJs' },
  { label: '🌮 Street food', query: 'American' },
  { label: '🍕 Pizza spots', query: 'Italian' },
]

const MORE_SUGGESTIONS = [
  { label: '🥂 Special occasion', query: 'Italian' },
  { label: '🍜 Ramen & noodles', query: 'Japanese' },
  { label: '🎉 Events this week', query: 'Music' },
  { label: '🌅 Brunch spots', query: 'Cafe' },
  { label: '🍦 Dessert runs', query: 'Cafe' },
  { label: '🎸 Live music', query: 'Music' },
  { label: '🍱 Bento & poke', query: 'Japanese' },
  { label: '🥩 Steakhouses', query: 'American' },
  { label: '🍷 Wine bars', query: 'Italian' },
  { label: '🌙 Midnight snacks', query: 'American' },
  { label: '👨‍👩‍👧 Family friendly', query: 'American' },
  { label: '🏃 Quick lunch', query: 'Cafe' },
  { label: '📱 Trendy & new', query: 'All' },
  { label: '🎭 Date night', query: 'Italian' },
  { label: '🌿 Healthy options', query: 'Cafe' },
  { label: '🔥 Open now', query: 'All' },
]

export default function HomeScreen() {
  const navigate = useNavigate()
  const [heroVideos, setHeroVideos] = useState<string[]>([])
  const [videoIndex, setVideoIndex] = useState(0)
  const [nextVideoIndex, setNextVideoIndex] = useState(1)
  const [showMore, setShowMore] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [currentOpacity, setCurrentOpacity] = useState(1)
  const currentVideoRef = useRef<HTMLVideoElement>(null)
  const nextVideoRef = useRef<HTMLVideoElement>(null)

  // Fetch videos from Pexels using the app's existing API key
  useEffect(() => {
    async function loadVideos() {
      const results = await Promise.all(VIDEO_QUERIES.map((q) => fetchPexelsVideo(q)))
      const urls = results.map((r) => r?.url).filter((url): url is string => !!url)
      if (urls.length > 0) setHeroVideos(urls)
    }
    loadVideos()
  }, [])

  // Crossfade every 6s — only when we have videos
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
          setVideoIndex((prev) => (prev + 1) % heroVideos.length)
          setNextVideoIndex((prev) => (prev + 1) % heroVideos.length)
          setCurrentOpacity(1)
          setTransitioning(false)
        }
      }, 50)
    }, 6000)
    return () => clearInterval(interval)
  }, [heroVideos.length, transitioning])

  function handleChipTap(query: string) {
    navigate('/list', { state: { filter: query === 'All' ? 'All' : query, listView: true } })
  }

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#000' }}>

      {/* ── Video Layer ── */}
      <div className="absolute inset-0">
        {heroVideos.length > 0 ? (
          <>
            <video
              ref={currentVideoRef}
              key={`cur-${videoIndex}`}
              src={heroVideos[videoIndex]}
              autoPlay muted loop playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: currentOpacity, transition: 'opacity 1.2s ease' }}
            />
            {heroVideos[nextVideoIndex] && (
              <video
                ref={nextVideoRef}
                key={`next-${nextVideoIndex}`}
                src={heroVideos[nextVideoIndex]}
                autoPlay muted loop playsInline
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  opacity: transitioning ? 1 - currentOpacity : 0,
                  transition: 'opacity 1.2s ease',
                }}
              />
            )}
          </>
        ) : (
          // Fallback while videos load — dark gradient
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #0a1628 0%, #1a2f5e 50%, #071126 100%)',
            }}
          />
        )}
      </div>

      {/* ── Gradient overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0.92) 100%)',
        }}
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
          style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.25)',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" />
          </svg>
          <span style={{ fontFamily: 'Manrope, sans-serif', color: '#fff', fontSize: 11, fontWeight: 600 }}>
            Los Angeles
          </span>
        </button>
      </div>

      {/* ── Main content — bottom anchored ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-16">

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="mb-2"
        >
          <p style={{
            fontFamily: 'Manrope, sans-serif',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            Discover
          </p>
          <h1 style={{
            fontFamily: 'Bungee, cursive',
            color: '#fff',
            fontSize: 'clamp(2.2rem, 10vw, 3.4rem)',
            lineHeight: 1.05,
            letterSpacing: '0.02em',
            textShadow: '0 2px 20px rgba(0,0,0,0.4)',
          }}>
            LA's best<br />restaurants
          </h1>
        </motion.div>

        {/* ── AI Suggestion Carousel ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          className="mt-6 mb-5"
        >
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{
              scrollbarWidth: 'none',
              maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 88%, transparent 100%)',
            } as React.CSSProperties}
          >
            {PRIMARY_SUGGESTIONS.map((chip, i) => (
              <motion.button
                key={chip.label}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.04 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => handleChipTap(chip.query)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold"
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  background: 'rgba(255,255,255,0.14)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.28)',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.label}
              </motion.button>
            ))}

            {/* More ideas chip */}
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => setShowMore(true)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1"
              style={{
                fontFamily: 'Manrope, sans-serif',
                background: 'rgba(69,118,239,0.35)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(69,118,239,0.6)',
                color: '#fff',
                whiteSpace: 'nowrap',
              }}
            >
              More ideas
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </motion.button>
          </div>
        </motion.div>

        {/* ── Bottom action buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
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
            style={{
              fontFamily: 'Manrope, sans-serif',
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.22)',
              color: '#fff',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <polygon points="5,3 19,12 5,21" fill="white" />
            </svg>
            Watch Feed
          </button>
        </motion.div>
      </div>

      {/* ── More Ideas Sheet ── */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
              onClick={() => setShowMore(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 z-40 rounded-t-3xl px-5 pt-4 pb-14"
              style={{ background: '#0d1b35', maxHeight: '75vh', overflowY: 'auto', scrollbarWidth: 'none' }}
            >
              <div className="flex justify-center mb-5">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
              </div>
              <p style={{
                fontFamily: 'Bungee, cursive',
                color: '#fff',
                fontSize: 18,
                letterSpacing: '0.04em',
                marginBottom: 16,
              }}>
                What are you looking for?
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {[...PRIMARY_SUGGESTIONS, ...MORE_SUGGESTIONS].map((chip) => (
                  <motion.button
                    key={chip.label}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => { setShowMore(false); handleChipTap(chip.query) }}
                    className="px-4 py-2 rounded-full text-xs font-semibold"
                    style={{
                      fontFamily: 'Manrope, sans-serif',
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                    }}
                  >
                    {chip.label}
                  </motion.button>
                ))}
              </div>
              <button
                onClick={() => { setShowMore(false); navigate('/list') }}
                className="w-full py-3.5 rounded-2xl text-sm font-bold"
                style={{ fontFamily: 'Manrope, sans-serif', background: '#4576EF', color: '#fff' }}
              >
                Browse everything →
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
