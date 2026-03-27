import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { fetchPexelsPortraitVideo } from '../lib/pexels'
import { fetchPlaceDetails } from '../lib/googlePlaces'
import { searchEventbriteEvents } from '../lib/eventbrite'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

// ── Favorites helpers (shared with MapViewScreen via localStorage) ────────────
function loadFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem('pp_favorites')
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as number[])
  } catch { return new Set() }
}
function saveFavorites(favs: Set<number>) {
  localStorage.setItem('pp_favorites', JSON.stringify([...favs]))
}

interface LocationState {
  filter?: string
  selectedId?: number
  listView?: boolean
}

function getVideoQuery(cuisine: string): string {
  const map: Record<string, string> = {
    Japanese: 'sushi japanese food preparation',
    Italian: 'italian pasta cooking',
    American: 'burger american food grill',
    Coffee: 'coffee barista espresso',
    Cafe: 'cafe brunch food',
    Music: 'nightclub dj music concert',
    Jazz: 'jazz live music performance',
    Mexican: 'tacos mexican food street',
  }
  return map[cuisine] ?? `${cuisine} restaurant food cooking`
}

interface ReelSlide {
  restaurant: Restaurant
  videoUrl: string | null
  rating: number | null
  reviewCount: number | null
  heroImage: string | null
  hasEvents: boolean
  loaded: boolean
}

// ── List view card (shown when coming from AI suggestion chips) ───────────────
function ListCard({
  restaurant: r,
  onClick,
}: {
  restaurant: Restaurant
  onClick: () => void
}) {
  return (
    <motion.button
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl p-3 text-left"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <img
        src={r.image_url}
        alt={r.name}
        className="w-20 h-20 rounded-xl flex-shrink-0 object-cover"
      />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-snug mb-0.5 truncate"
          style={{ color: '#FAFBFF', fontFamily: 'Manrope, sans-serif' }}>
          {r.name}
        </p>
        <span className="text-xs px-2 py-0.5 rounded-full inline-block mb-1"
          style={{ background: 'rgba(69,118,239,0.15)', color: '#6B9EFF', fontFamily: 'Manrope' }}>
          {r.cuisine}
        </span>
        <p className="text-xs opacity-50"
          style={{ color: '#FAFBFF', fontFamily: 'Manrope, sans-serif' }}>
          {r.city}, {r.state}
        </p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 opacity-30">
        <path d="M9 18l6-6-6-6" stroke="#FAFBFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  )
}

export default function ListViewScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as LocationState

  // If coming from AI chip → show list view
  const isListView = !!state.listView

  const [slides, setSlides] = useState<ReelSlide[]>([])
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState(state.filter ?? 'All')
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const loadedIndices = useRef<Set<number>>(new Set())

  function toggleFavorite(id: number) {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveFavorites(next)
      return next
    })
  }

  const FILTERS = ['All', 'Coffee', 'Jazz', 'Music', 'DJs', 'Japanese', 'Italian', 'American', 'Cafe']

  useEffect(() => {
    fetchRestaurants()
  }, [])

  async function fetchRestaurants() {
    setLoading(true)
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('tier')
      .order('name')
    if (error) console.error(error)
    const list = data ?? []
    setAllRestaurants(list)

    const filtered = applyFilter(list, state.filter ?? 'All')
    initSlides(filtered)
    setLoading(false)
  }

  function applyFilter(list: Restaurant[], filter: string): Restaurant[] {
    if (!filter || filter === 'All') return list
    return list.filter((r) =>
      filter === 'DJs'
        ? r.cuisine === 'Music'
        : r.cuisine.toLowerCase() === filter.toLowerCase()
    )
  }

  function initSlides(filtered: Restaurant[]) {
    const initial: ReelSlide[] = filtered.map((r) => ({
      restaurant: r,
      videoUrl: null,
      rating: null,
      reviewCount: null,
      heroImage: r.image_url,
      hasEvents: false,
      loaded: false,
    }))
    setSlides(initial)
    // Load first 3 eagerly
    filtered.slice(0, 3).forEach((r, i) => loadSlideData(r, i, initial))
  }

  async function loadSlideData(r: Restaurant, index: number, _currentSlides?: ReelSlide[]) {
    if (loadedIndices.current.has(index)) return
    loadedIndices.current.add(index)

    const [videoResult, placeResult, events] = await Promise.all([
      fetchPexelsPortraitVideo(getVideoQuery(r.cuisine)),
      fetchPlaceDetails(r.name, r.city),
      searchEventbriteEvents(r.name, r.city, r.state),
    ])

    setSlides((prev) => {
      const next = [...prev]
      if (next[index]) {
        next[index] = {
          ...next[index],
          videoUrl: videoResult?.url ?? null,
          rating: placeResult?.rating ?? null,
          reviewCount: placeResult?.userRatingsTotal ?? null,
          heroImage: placeResult?.photoUrl ?? r.image_url,
          hasEvents: events.length > 0,
          loaded: true,
        }
      }
      return next
    })
  }

  // Intersection observer for active tracking + lazy loading
  useEffect(() => {
    if (slides.length === 0 || isListView) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.getAttribute('data-index') ?? '0')
            setCurrentIndex(idx)
            ;[idx, idx + 1, idx + 2].forEach((i) => {
              if (slides[i] && !loadedIndices.current.has(i)) {
                loadSlideData(slides[i].restaurant, i)
              }
            })
          }
        })
      },
      { threshold: 0.6 }
    )

    slideRefs.current.forEach((el) => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [slides.length, isListView])

  // Filter change for list view
  const filteredList = applyFilter(allRestaurants, activeFilter)

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#071126' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Manrope, sans-serif', fontSize: 13 }}>
            Loading…
          </p>
        </div>
      </div>
    )
  }

  // ── LIST VIEW (from AI suggestion chips) ─────────────────────────────────────
  if (isListView) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: '#071126' }}>
        {/* Header */}
        <div className="flex-shrink-0 pt-12 px-4 pb-3" style={{ background: '#071126' }}>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/')} className="opacity-50 hover:opacity-100 transition-opacity">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="#FAFBFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 style={{ fontFamily: 'Bungee, cursive', color: '#FAFBFF', fontSize: 20, letterSpacing: '0.04em' }}>
              {activeFilter === 'All' ? 'Discover' : activeFilter}
            </h1>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {FILTERS.map((f) => (
              <button
                key={f}
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

        <div className="px-4 py-2 flex-shrink-0">
          <p className="text-xs opacity-40" style={{ fontFamily: 'Manrope', color: '#FAFBFF' }}>
            {filteredList.length} place{filteredList.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-28" style={{ scrollbarWidth: 'none' }}>
          <motion.div
            className="flex flex-col gap-3 mt-2"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {filteredList.map((r) => (
              <ListCard
                key={r.id}
                restaurant={r}
                onClick={() => setSelectedRestaurant(r)}
              />
            ))}
          </motion.div>
        </div>

        {/* Bottom bar */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-10 pt-4"
          style={{ background: 'linear-gradient(to top, rgba(7,17,38,1) 60%, transparent)' }}
        >
          <button
            onClick={() => navigate('/map')}
            className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold"
            style={{ background: '#FAFBFF', color: '#071126', fontFamily: 'Manrope', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#071126" />
              <circle cx="12" cy="9" r="2.5" fill="white" />
            </svg>
            Map View
          </button>
        </div>

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

  // ── REELS VIEW (default feed) ─────────────────────────────────────────────────
  return (
    <div className="fixed inset-0" style={{ background: '#000' }}>

      {/* Close button — top right, goes to home */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-12 right-5 z-50 w-9 h-9 flex items-center justify-center rounded-full"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Scrollable reel container */}
      <div
        className="w-full h-full overflow-y-scroll"
        style={{
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {slides.map((slide, index) => (
          <ReelSlide
            key={slide.restaurant.id}
            slide={slide}
            index={index}
            isActive={index === currentIndex}
            isFavorite={favorites.has(slide.restaurant.id)}
            onToggleFavorite={() => toggleFavorite(slide.restaurant.id)}
            slideRef={(el: HTMLDivElement | null) => { slideRefs.current[index] = el }}
            onMoreInfo={() => setSelectedRestaurant(slide.restaurant)}
            onDirections={() => {
              const q = encodeURIComponent(`${slide.restaurant.name}, ${slide.restaurant.city}, ${slide.restaurant.state}`)
              window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank')
            }}
            onMenu={() => navigate(`/menu/${slide.restaurant.id}`)}
            onEvents={() => setSelectedRestaurant(slide.restaurant)}
          />
        ))}
      </div>

      {/* Bottom tab bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-8 pt-4 z-30 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)' }}
      >
        <div
          className="flex items-center rounded-full overflow-hidden pointer-events-auto"
          style={{
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <button
            onClick={() => navigate('/map')}
            className="flex items-center gap-2 px-5 py-2.5"
            style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor" />
            </svg>
            Map
          </button>
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)' }} />
          <div
            className="flex items-center gap-2 px-5 py-2.5 rounded-full"
            style={{ fontFamily: 'Manrope, sans-serif', color: '#fff', fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.18)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            Feed
          </div>
        </div>
      </div>

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

// ── Individual reel slide ─────────────────────────────────────────────────────
interface ReelSlideProps {
  slide: ReelSlide
  index: number
  isActive: boolean
  isFavorite: boolean
  onToggleFavorite: () => void
  slideRef: (el: HTMLDivElement | null) => void
  onMoreInfo: () => void
  onDirections: () => void
  onMenu: () => void
  onEvents: () => void
}

function ReelSlide({ slide, index, isActive, isFavorite, onToggleFavorite, slideRef, onMoreInfo, onDirections, onMenu, onEvents }: ReelSlideProps) {
  const r = slide.restaurant
  const videoRef = useRef<HTMLVideoElement>(null)

  // Play whenever isActive or videoUrl changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isActive) {
      const t = setTimeout(() => {
        video.play().catch(() => {})
      }, 100)
      return () => clearTimeout(t)
    } else {
      video.pause()
      video.currentTime = 0
    }
  }, [isActive, slide.videoUrl])

  return (
    <div
      ref={slideRef}
      data-index={index}
      className="relative w-full flex-shrink-0"
      style={{ height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
    >
      {/* Background */}
      {slide.videoUrl ? (
        <video
          ref={videoRef}
          src={slide.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <img
          src={slide.heroImage ?? r.image_url}
          alt={r.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Gradients */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{ height: 140, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)' }} />
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: '60%', background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)' }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 pt-12 px-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <polygon points="5,3 19,12 5,21" fill="white" />
          </svg>
          <span style={{ fontFamily: 'Bungee, cursive', color: '#fff', fontSize: 14, letterSpacing: '0.04em' }}>
            PlatePost
          </span>
        </div>
        {/* Heart / favorite button */}
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={onToggleFavorite}
          className="w-9 h-9 flex items-center justify-center rounded-full"
          style={{
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isFavorite ? '#E11D48' : 'none'} stroke={isFavorite ? '#E11D48' : 'white'} strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </motion.button>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-28">
        {/* Cuisine tag */}
        <div className="mb-2.5">
          <span className="text-xs font-bold px-3 py-1 rounded-full"
            style={{
              background: 'rgba(69,118,239,0.3)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(69,118,239,0.45)',
              color: '#fff',
              fontFamily: 'Manrope, sans-serif',
            }}>
            {r.cuisine}
          </span>
        </div>

        {/* Name */}
        <h1 className="mb-1.5 leading-tight"
          style={{
            fontFamily: 'Bungee, cursive',
            color: '#fff',
            fontSize: 'clamp(1.7rem, 7vw, 2.5rem)',
            textShadow: '0 2px 16px rgba(0,0,0,0.6)',
          }}>
          {r.name}
        </h1>

        {/* Location + rating */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <span style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
            {r.city}, {r.state}
          </span>
          {slide.rating && (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#FBBF24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span style={{ fontFamily: 'Manrope', color: '#FBBF24', fontSize: 13, fontWeight: 700 }}>
                {slide.rating.toFixed(1)}
              </span>
              {slide.reviewCount && (
                <span style={{ fontFamily: 'Manrope', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                  ({slide.reviewCount.toLocaleString()})
                </span>
              )}
            </div>
          )}
        </div>

        {/* 3 action buttons — Events only shown if hasEvents */}
        <div className="flex gap-2.5 mb-3">
          {slide.hasEvents && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onEvents}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              <span style={{ fontSize: 20 }}>🎟️</span>
              <span style={{ fontFamily: 'Manrope', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>
                Events
              </span>
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onDirections}
            className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            <span style={{ fontSize: 20 }}>🗺️</span>
            <span style={{ fontFamily: 'Manrope', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>
              Directions
            </span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onMenu}
            className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            <span style={{ fontSize: 20 }}>🍽️</span>
            <span style={{ fontFamily: 'Manrope', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>
              Menu
            </span>
          </motion.button>
        </div>

        {/* More Info */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onMoreInfo}
          className="w-full py-3.5 rounded-2xl text-sm font-bold"
          style={{ fontFamily: 'Manrope', background: 'rgba(255,255,255,0.95)', color: '#071126' }}
        >
          More Info
        </motion.button>
      </div>
    </div>
  )
}
