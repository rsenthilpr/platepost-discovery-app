import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'
import LazyRestaurantImage from '../components/LazyRestaurantImage'

const FILTERS = ['All', 'Coffee', 'Jazz', 'Music', 'DJs', 'Japanese', 'Italian', 'American', 'Cafe']

interface LocationState {
  voiceQuery?: string
  filter?: string
  selectedId?: number
}

export default function ListViewScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as LocationState

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [search, setSearch] = useState(state.voiceQuery ?? '')
  const [activeFilter, setActiveFilter] = useState(state.filter ?? 'All')
  const [loading, setLoading] = useState(true)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const filterRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchRestaurants()
  }, [])

  // Auto-open restaurant if navigated from map pin
  useEffect(() => {
    if (state.selectedId && restaurants.length > 0) {
      const found = restaurants.find((r) => r.id === state.selectedId)
      if (found) setSelectedRestaurant(found)
    }
  }, [state.selectedId, restaurants])

  // Scroll active filter chip into view
  useEffect(() => {
    const row = filterRowRef.current
    if (!row) return
    const active = row.querySelector<HTMLButtonElement>('[data-active="true"]')
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeFilter])

  async function fetchRestaurants() {
    setLoading(true)
    const { data, error } = await supabase.from('restaurants').select('*').order('tier').order('name')
    if (error) console.error(error)
    setRestaurants(data ?? [])
    setLoading(false)
  }

  const filtered = restaurants.filter((r) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.cuisine.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.state.toLowerCase().includes(q)

    const matchesFilter =
      activeFilter === 'All' ||
      (activeFilter === 'DJs' ? r.cuisine === 'Music' : r.cuisine.toLowerCase() === activeFilter.toLowerCase())

    return matchesSearch && matchesFilter
  })

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#071126' }}>

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 pt-12 px-4 pb-3"
        style={{ background: '#071126' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/')} className="opacity-50 hover:opacity-100 transition-opacity">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="#FAFBFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 style={{ fontFamily: 'Bungee, cursive', color: '#FAFBFF', fontSize: 20, letterSpacing: '0.04em' }}>
            Discover
          </h1>
        </div>

        {/* Search bar */}
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-3"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 opacity-40">
            <circle cx="11" cy="11" r="8" stroke="#FAFBFF" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="#FAFBFF" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search restaurants, cuisines, cities…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#FAFBFF', fontFamily: 'Manrope, sans-serif' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="opacity-40 hover:opacity-80">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#FAFBFF" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div
          ref={filterRowRef}
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              data-active={activeFilter === f ? 'true' : 'false'}
              onClick={() => setActiveFilter(f)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                fontFamily: 'Manrope, sans-serif',
                background: activeFilter === f ? '#4576EF' : 'rgba(255,255,255,0.07)',
                color: activeFilter === f ? '#fff' : 'rgba(250,251,255,0.55)',
                border: activeFilter === f ? '1px solid #4576EF' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results count ── */}
      <div className="px-4 py-2 flex-shrink-0">
        <p className="text-xs opacity-40" style={{ fontFamily: 'Manrope, sans-serif', color: '#FAFBFF' }}>
          {loading ? 'Loading…' : `${filtered.length} place${filtered.length !== 1 ? 's' : ''}`}
          {search ? ` for "${search}"` : ''}
        </p>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-28" style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          <div className="flex flex-col gap-3 mt-2">
            {[...Array(5)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-40">
            <span style={{ fontSize: 40 }}>🍽️</span>
            <p style={{ fontFamily: 'Manrope, sans-serif', color: '#FAFBFF', fontSize: 14 }}>
              No places found
            </p>
          </div>
        ) : (
          <motion.div
            className="flex flex-col gap-3 mt-2"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {filtered.map((r) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                onClick={() => setSelectedRestaurant(r)}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-10 pt-4"
        style={{ background: 'linear-gradient(to top, rgba(7,17,38,1) 60%, transparent)' }}
      >
        <button
          onClick={() => navigate('/map')}
          className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold"
          style={{
            background: '#FAFBFF',
            color: '#071126',
            fontFamily: 'Manrope, sans-serif',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#071126" />
            <circle cx="12" cy="9" r="2.5" fill="white" />
          </svg>
          Map View
        </button>
      </div>

      {/* ── Restaurant Detail Popup ── */}
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

// ── Restaurant card ──────────────────────────────────────────────────────────
function RestaurantCard({
  restaurant: r,
  onClick,
}: {
  restaurant: Restaurant
  onClick: () => void
}) {
  return (
    <motion.button
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0 },
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl p-3 text-left"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Photo — lazy upgrades from Unsplash → Pexels when scrolled into view */}
      <div className="relative flex-shrink-0">
        <LazyRestaurantImage
          fallbackUrl={r.image_url}
          query={`${r.name} ${r.cuisine} restaurant food`}
          alt={r.name}
          className="w-20 h-20 rounded-xl flex-shrink-0"
          style={{ width: 80, height: 80, borderRadius: 12 }}
        />
        {r.tier === 'pro' && (
          <div
            className="absolute top-1.5 left-1.5 text-xs font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: '#4576EF', color: '#fff', fontSize: 9, fontFamily: 'Manrope' }}
          >
            PRO
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="font-bold text-sm leading-snug mb-0.5 truncate"
          style={{ color: '#FAFBFF', fontFamily: 'Manrope, sans-serif' }}
        >
          {r.name}
        </p>
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(69,118,239,0.15)',
              color: '#6B9EFF',
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            {r.cuisine}
          </span>
        </div>
        <p
          className="text-xs opacity-50 flex items-center gap-1"
          style={{ color: '#FAFBFF', fontFamily: 'Manrope, sans-serif' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor" />
          </svg>
          {r.city}, {r.state}
        </p>
      </div>

      {/* Arrow */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full w-8 h-8"
        style={{ background: 'rgba(69,118,239,0.15)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M9 18l6-6-6-6" stroke="#4576EF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </motion.button>
  )
}

// ── Skeleton loader ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-3"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="w-20 h-20 rounded-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-4 rounded-lg w-3/4" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="h-3 rounded-lg w-1/3" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-3 rounded-lg w-1/2" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>
    </div>
  )
}
