import { useState, useEffect, useRef, useCallback } from 'react'
import { PlatePostLogo, PlatePostOrbMark } from '../components/PlatePostLogo'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

// Search history helpers
function getSearchHistory(): string[] {
  try { return JSON.parse(localStorage.getItem('pp_search_history') ?? '[]') } catch { return [] }
}
function addToSearchHistory(term: string) {
  try {
    const existing = getSearchHistory().filter(s => s !== term)
    const updated = [term, ...existing].slice(0, 10)
    localStorage.setItem('pp_search_history', JSON.stringify(updated))
  } catch {}
}
function removeFromSearchHistory(term: string) {
  try {
    const updated = getSearchHistory().filter(s => s !== term)
    localStorage.setItem('pp_search_history', JSON.stringify(updated))
  } catch {}
}

// Draggable orb — fixed position, draggable anywhere
function DraggableOrb({ id, defaultBottom, defaultRight, onClick, children }: {
  id: string
  defaultBottom: number
  defaultRight: number
  onClick: () => void
  children: React.ReactNode
}) {
  const getSavedPos = () => {
    try {
      const saved = localStorage.getItem(`orb_pos_${id}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  }

  const [pos, setPos] = useState<{ x: number; y: number } | null>(getSavedPos)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const moved = useRef(false)

  const getDefaultXY = () => ({
    x: window.innerWidth - defaultRight - 56,
    y: window.innerHeight - defaultBottom - 56,
  })

  const currentPos = pos ?? getDefaultXY()

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { x: e.clientX, y: e.clientY, px: currentPos.x, py: currentPos.y }
    moved.current = false
    setDragging(true)
  }, [currentPos])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true
    const newX = Math.max(8, Math.min(window.innerWidth - 64, dragStart.current.px + dx))
    const newY = Math.max(60, Math.min(window.innerHeight - 100, dragStart.current.py + dy))
    setPos({ x: newX, y: newY })
  }, [])

  const onPointerUp = useCallback(() => {
    setDragging(false)
    dragStart.current = null
    if (pos) localStorage.setItem(`orb_pos_${id}`, JSON.stringify(pos))
    if (!moved.current) onClick()
  }, [id, pos, onClick])

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="fixed z-30 flex flex-col items-center gap-1 select-none"
      style={{
        left: currentPos.x, top: currentPos.y,
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        opacity: dragging ? 0.85 : 1,
        transition: dragging ? 'none' : 'opacity 0.2s',
      }}
    >
      {children}
    </div>
  )
}

// Top 10 carousel restaurant card
function Top10Card({ restaurant, rank, onClick }: { restaurant: Restaurant; rank: number; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex-shrink-0 relative rounded-2xl overflow-hidden"
      style={{ width: 160, height: 220 }}
    >
      <img
        src={restaurant.image_url}
        alt={restaurant.name}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.1) 60%)' }} />
      {/* Rank number */}
      <div className="absolute top-2 left-2">
        <span style={{
          fontFamily: 'Open Sans, sans-serif',
          fontWeight: 800,
          fontSize: 36,
          color: 'rgba(255,255,255,0.25)',
          lineHeight: 1,
          WebkitTextStroke: '1px rgba(255,255,255,0.4)',
        }}>
          {rank}
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 700, color: '#fff', fontSize: 13, lineHeight: 1.2, marginBottom: 2 }}>
          {restaurant.name}
        </p>
        <p style={{ fontFamily: 'Open Sans, sans-serif', color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
          {restaurant.city}
        </p>
        {restaurant.rating && (
          <div className="flex items-center gap-1 mt-1">
            <span style={{ color: '#FBBF24', fontSize: 10 }}>★</span>
            <span style={{ fontFamily: 'Open Sans', color: '#FBBF24', fontSize: 11, fontWeight: 700 }}>
              {restaurant.rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </motion.button>
  )
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const [heroImages, setHeroImages] = useState<string[]>([])
  const [imageIndex, setImageIndex] = useState(0)
  const [top10, setTop10] = useState<Restaurant[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Restaurant[]>([])
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>(getSearchHistory)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Reset orb positions to bottom-right default (v5)
  useEffect(() => {
    const orbVersion = localStorage.getItem('orb_layout_version')
    if (orbVersion !== 'v7') {
      localStorage.removeItem('orb_pos_surprise-orb')
      localStorage.removeItem('orb_pos_crave-orb')
      localStorage.setItem('orb_layout_version', 'v7')
    }
  }, [])

  // Shake to Surprise Me
  useEffect(() => {
    let lastShake = 0
    let lastX = 0, lastY = 0, lastZ = 0
    function handleMotion(e: DeviceMotionEvent) {
      const acc = e.accelerationIncludingGravity
      if (!acc) return
      const dx = Math.abs((acc.x ?? 0) - lastX)
      const dy = Math.abs((acc.y ?? 0) - lastY)
      const dz = Math.abs((acc.z ?? 0) - lastZ)
      if (dx + dy + dz > 25 && Date.now() - lastShake > 2000) {
        lastShake = Date.now()
        navigate('/surprise')
      }
      lastX = acc.x ?? 0; lastY = acc.y ?? 0; lastZ = acc.z ?? 0
    }
    window.addEventListener('devicemotion', handleMotion)
    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [navigate])

  // Load restaurants
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('restaurants').select('*')
      const list = data ?? []
      setAllRestaurants(list)

      // Top 10 by rating + review count
      const scored = [...list]
        .filter(r => r.rating && r.review_count)
        .sort((a, b) => {
          const scoreA = (a.rating ?? 0) * Math.log10((a.review_count ?? 1) + 1)
          const scoreB = (b.rating ?? 0) * Math.log10((b.review_count ?? 1) + 1)
          return scoreB - scoreA
        })
        .slice(0, 10)
      setTop10(scored)

      // Hero images from top restaurants
      const images = scored.slice(0, 6).map(r => r.image_url).filter(Boolean)
      setHeroImages(images)
    }
    load()
  }, [])

  // Crossfade hero images
  useEffect(() => {
    if (heroImages.length < 2) return
    const interval = setInterval(() => {
      setImageIndex(i => (i + 1) % heroImages.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [heroImages.length])

  // Search
  function handleSearch(query: string) {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    const q = query.toLowerCase()
    const results = allRestaurants.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.cuisine.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      (r.neighborhood ?? '').toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q)
    ).slice(0, 20)
    setSearchResults(results)
  }

  function submitSearch(query: string) {
    if (!query.trim()) return
    addToSearchHistory(query.trim())
    setSearchHistory(getSearchHistory())
    navigate('/list', { state: { searchQuery: query, listView: true } })
  }

  function deleteHistory(term: string) {
    removeFromSearchHistory(term)
    setSearchHistory(getSearchHistory())
  }

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#000' }}>

      {/* ── Hero background — crossfading real photos ── */}
      <div className="absolute inset-0">
        {heroImages.map((img, i) => (
          <img
            key={img}
            src={img}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: i === imageIndex ? 1 : 0,
              transition: 'opacity 1.5s ease',
              zIndex: i === imageIndex ? 1 : 0,
            }}
          />
        ))}
        {heroImages.length === 0 && (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0a1628, #1a2f5e)' }} />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.97) 100%)' }}
      />

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-40 pt-14 px-5 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto">
          <PlatePostLogo size="md" white={true} />
        </div>
        <button
          onClick={() => navigate('/map')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full pointer-events-auto"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.25)' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" />
          </svg>
          <span style={{ fontFamily: 'Open Sans, sans-serif', color: '#fff', fontSize: 11, fontWeight: 600 }}>Los Angeles</span>
        </button>
      </div>

      {/* ── Scrollable main content ── */}
      <div className="absolute inset-0 z-20 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        {/* Spacer for hero area */}
        <div style={{ height: '45vh' }} />

        {/* ── Hero text + chips ── */}
        <div className="px-5 pb-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-4">
            <p style={{ fontFamily: 'Open Sans, sans-serif', color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
              Discover
            </p>
            <h1 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 800, color: '#fff', fontSize: 'clamp(2rem, 9vw, 3.2rem)', lineHeight: 1.05, textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
              LA's Best<br />Restaurants
            </h1>
          </motion.div>

          {/* ── Chip nav: Open Now / Events / Search ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex gap-2 mb-4"
          >
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => navigate('/list', { state: { filter: 'All', openNow: true, listView: true } })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#fff', fontFamily: 'Open Sans', backdropFilter: 'blur(12px)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
              Open Now
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => navigate('/tonight')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#fff', fontFamily: 'Open Sans', backdropFilter: 'blur(12px)' }}
            >
              <span style={{ fontSize: 12 }}>🎟️</span>
              Events
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 100) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontFamily: 'Open Sans', backdropFilter: 'blur(12px)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2.2" />
                <path d="M16.5 16.5L21 21" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              Search
            </motion.button>
          </motion.div>

          {/* ── Bottom buttons ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex gap-3 mb-8"
          >
            <button
              onClick={() => navigate('/map')}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
              style={{ fontFamily: 'Open Sans, sans-serif', background: '#0048f9', color: '#fff' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#fff" />
                <circle cx="12" cy="9" r="2.5" fill="#0048f9" />
              </svg>
              View Map
            </button>
            <button
              onClick={() => navigate('/list')}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
              style={{ fontFamily: 'Open Sans, sans-serif', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polygon points="5,3 19,12 5,21" fill="white" />
              </svg>
              Explore Feed
            </button>
          </motion.div>
        </div>

        {/* ── Top 10 Carousel ── */}
        {top10.length > 0 && (
          <div className="pb-8">
            <div className="px-5 mb-3 flex items-center justify-between">
              <div>
                <p style={{ fontFamily: 'Open Sans, sans-serif', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Top Rated
                </p>
                <h2 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 800, color: '#fff', fontSize: 20 }}>
                  Popular in LA
                </h2>
              </div>
              <motion.div
                className="flex items-center gap-1"
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Open Sans', fontWeight: 600 }}
              >
                <span>swipe</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </motion.div>
            </div>
            <div
              className="flex gap-3 overflow-x-auto pl-5 pr-5 pb-2"
              style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
            >
              {top10.map((r, i) => (
                <div key={r.id} style={{ scrollSnapAlign: 'start' }}>
                  <Top10Card
                    restaurant={r}
                    rank={i + 1}
                    onClick={() => setSelectedRestaurant(r)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom spacer */}
        <div style={{ height: 120 }} />
      </div>

      {/* ── Draggable Floating Orbs ── */}
      <DraggableOrb id="surprise-orb" defaultBottom={420} defaultRight={20} onClick={() => navigate('/surprise')}>
        <motion.div className="absolute rounded-full"
          style={{ width: 68, height: 68, background: 'rgba(245,158,11,0.2)', top: -6, left: -6 }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          animate={{ boxShadow: ['0 0 20px rgba(245,158,11,0.4)', '0 0 36px rgba(239,68,68,0.5)', '0 0 20px rgba(245,158,11,0.4)'] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: '2.5px solid rgba(255,255,255,0.35)' }}
        >
          <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontSize: 26, lineHeight: 1 }}>🎲</motion.span>
        </motion.div>
        <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: 'Open Sans', letterSpacing: '0.1em', textTransform: 'uppercase' as const, opacity: 0.8, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Surprise</span>
      </DraggableOrb>

      <DraggableOrb id="crave-orb" defaultBottom={320} defaultRight={20} onClick={() => navigate('/concierge')}>
        <motion.div className="absolute rounded-full"
          style={{ width: 68, height: 68, background: 'rgba(0,72,249,0.25)', top: -6, left: -6 }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div className="absolute rounded-full"
          style={{ width: 80, height: 80, background: 'rgba(0,72,249,0.15)', top: -12, left: -12 }}
          animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        />
        <motion.div
          animate={{ boxShadow: ['0 0 20px rgba(0,72,249,0.5)', '0 0 40px rgba(0,72,249,0.7)', '0 0 20px rgba(0,72,249,0.5)'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #0048f9, #3b82f6)', border: '2.5px solid rgba(255,255,255,0.35)' }}
        >
          <PlatePostOrbMark size={24} />
        </motion.div>
        <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: 'Open Sans', letterSpacing: '0.1em', textTransform: 'uppercase' as const, opacity: 0.8, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Crave</span>
      </DraggableOrb>

      {/* ── Search overlay ── */}
      <AnimatePresence>
        {showSearch && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowSearch(false)}
            />
            <motion.div
              initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed top-0 left-0 right-0 z-50 px-4 pt-14 pb-4"
              style={{ background: '#0d1b35' }}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(0,72,249,0.4)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
                    <path d="M16.5 16.5L21 21" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitSearch(searchQuery)}
                    placeholder="Restaurants, cuisines, neighborhoods..."
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: '#fff', fontFamily: 'Open Sans, sans-serif' }}
                  />
                  {searchQuery && (
                    <button onClick={() => handleSearch('')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
                <button onClick={() => setShowSearch(false)}
                  style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Open Sans', fontSize: 14 }}>
                  Cancel
                </button>
              </div>

              {/* Search results */}
              {searchQuery && searchResults.length > 0 && (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  {searchResults.map(r => (
                    <button key={r.id}
                      onClick={() => {
                        addToSearchHistory(r.name)
                        setSearchHistory(getSearchHistory())
                        setShowSearch(false)
                        setSelectedRestaurant(r)
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <img src={r.image_url} alt={r.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      <div>
                        <p style={{ fontFamily: 'Open Sans', fontWeight: 600, color: '#fff', fontSize: 13 }}>{r.name}</p>
                        <p style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{r.cuisine} · {r.city}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Search history */}
              {!searchQuery && searchHistory.length > 0 && (
                <div>
                  <p style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Recent
                  </p>
                  <div className="flex flex-col gap-1">
                    {searchHistory.map(term => (
                      <div key={term} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <button onClick={() => { handleSearch(term); submitSearch(term); setShowSearch(false) }}
                          className="flex items-center gap-2 flex-1 text-left">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                            <path d="M12 7v5l3 3" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                          <span style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{term}</span>
                        </button>
                        <button onClick={() => deleteHistory(term)} className="p-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Restaurant detail sheet */}
      <AnimatePresence>
        {selectedRestaurant && (
          <RestaurantDetail
            restaurant={selectedRestaurant}
            onClose={() => setSelectedRestaurant(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
