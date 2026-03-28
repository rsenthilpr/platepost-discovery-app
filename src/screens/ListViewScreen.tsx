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
  openNow?: boolean
  tonight?: boolean
  neighborhood?: string
  recentIds?: number[]
}

const VIDEO_QUERY_POOLS: Record<string, string[]> = {
  Japanese: ['sushi chef knife skills', 'ramen noodles cooking', 'japanese food plating', 'sashimi fresh fish', 'tempura frying'],
  Italian: ['pasta dough kneading', 'pizza wood fired oven', 'italian cooking sauce', 'risotto stirring', 'tiramisu dessert'],
  American: ['burger grilling flames', 'bbq smoke grill meat', 'fried chicken crispy', 'cocktail bartender mixing', 'smash burger cooking'],
  Coffee: ['latte art pouring', 'coffee espresso machine', 'barista pour over', 'coffee roasting beans', 'cappuccino foam milk'],
  Cafe: ['brunch avocado toast', 'pastry bakery morning', 'cafe interior cozy', 'eggs benedict breakfast', 'french press coffee'],
  Music: ['concert crowd lights', 'dj turntable nightclub', 'live band performance', 'music venue stage', 'nightclub dancing'],
  Jazz: ['jazz band performance', 'saxophone jazz music', 'piano jazz bar', 'trumpet musician', 'jazz club atmosphere'],
  Mexican: ['tacos street food', 'guacamole fresh made', 'mexican grill cooking', 'tortilla making', 'margarita cocktail'],
}

// PlatePost customers with real video menus
const PLATEPOST_MENU_URLS: Record<number, string> = {
  4: 'https://platepost.io/kch',                    // Kei Coffee House
  5: 'https://platepost.io/wywhcoffee',             // Wish You Were Here
  17: 'https://platepost.io/apecoffeeorange',       // Ape Coffee - Orange
  18: 'https://platepost.io/apecoffeeplacentia',    // Ape Coffee - Placentia
}

function getVideoQuery(cuisine: string, restaurantName: string): string {
  const pool = VIDEO_QUERY_POOLS[cuisine]
  if (pool) {
    // Use restaurant name hash to pick consistently but differently per restaurant
    const hash = restaurantName.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return pool[hash % pool.length]
  }
  return `${cuisine} restaurant food cooking`
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  function restoreScroll() {
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current
      if (el) el.scrollTo({ top: currentIndex * window.innerHeight, behavior: 'instant' })
    })
  }
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

    const PLATEPOST_CUSTOMER_IDS = new Set([4, 5, 17, 18]) // Kei, Wish You Were Here, Ape Coffee
    const baseFiltered = applyFilter(list, state.filter ?? 'All')
    // PlatePost customers always appear first
    const filtered = [
      ...baseFiltered.filter(r => PLATEPOST_CUSTOMER_IDS.has(r.id)),
      ...baseFiltered.filter(r => !PLATEPOST_CUSTOMER_IDS.has(r.id)),
    ]
    initSlides(filtered)
    setLoading(false)
  }

  function applyFilter(list: Restaurant[], filter: string): Restaurant[] {
    let result = list
    // Cuisine filter
    if (filter && filter !== 'All') {
      result = result.filter((r) =>
        filter === 'DJs'
          ? r.cuisine === 'Music'
          : r.cuisine.toLowerCase() === filter.toLowerCase()
      )
    }
    // Neighborhood filter
    if (state.neighborhood) {
      result = result.filter((r) =>
        r.city?.toLowerCase().includes(state.neighborhood!.toLowerCase()) ||
        r.description?.toLowerCase().includes(state.neighborhood!.toLowerCase()) ||
        r.name?.toLowerCase().includes(state.neighborhood!.toLowerCase())
      )
      // If neighborhood filter returns nothing, show all (neighborhood data may not match)
      if (result.length === 0) result = list
    }
    // Recently viewed filter
    if (state.recentIds && state.recentIds.length > 0) {
      const recentSet = new Set(state.recentIds)
      result = result.filter((r) => recentSet.has(r.id))
      if (result.length === 0) result = list
    }
    return result
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
      fetchPexelsPortraitVideo(getVideoQuery(r.cuisine, r.name)),
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
              onClose={() => { setSelectedRestaurant(null); restoreScroll() }}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── REELS VIEW (default feed) ─────────────────────────────────────────────────
  return (
    <div className="fixed inset-0" style={{ background: '#000' }}>

      {/* Back button — top left, goes to home */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-12 left-5 z-50 flex items-center gap-2 px-3 py-2 rounded-full"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: 'Manrope, sans-serif', color: 'white', fontSize: 12, fontWeight: 600 }}>Home</span>
      </button>

      {/* Scrollable reel container */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-y-scroll"
        style={{
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
        onScroll={(e) => {
          const el = e.currentTarget
          const idx = Math.round(el.scrollTop / window.innerHeight)
          if (idx !== currentIndex) setCurrentIndex(idx)
        }}
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
            onClose={() => { setSelectedRestaurant(null); restoreScroll() }}
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

      {/* Top bar — heart only (back button is rendered at container level) */}
      <div className="absolute top-0 left-0 right-0 z-10 pt-12 px-5 flex items-center justify-end">
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
        {/* Cuisine tag + PlatePost badge */}
        <div className="mb-2.5 flex items-center gap-2">
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
          {PLATEPOST_MENU_URLS[r.id] && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: 'rgba(69,118,239,0.8)', color: '#fff', fontFamily: 'Manrope', fontSize: 9 }}>
              🔷 PlatePost
            </span>
          )}
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
        <div className="flex gap-2.5 mb-3" style={{ alignItems: 'stretch' }}>
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
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></span>
            <span style={{ fontFamily: 'Manrope', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>
              Directions
            </span>
          </motion.button>

          {PLATEPOST_MENU_URLS[r.id] ? (
            <a
              href={PLATEPOST_MENU_URLS[r.id]}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl"
              style={{
                background: 'rgba(69,118,239,0.25)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(69,118,239,0.5)',
                textDecoration: 'none',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 3.5L20 12L5 20.5V3.5Z" fill="white" />
                <ellipse cx="11" cy="9.5" rx="2.2" ry="2.8" fill="#4576EF" />
                <rect x="10.1" y="12" width="1.8" height="3.5" rx="0.9" fill="#4576EF" />
              </svg>
              <span style={{ fontFamily: 'Manrope', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                Video Menu
              </span>
            </a>
          ) : (
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
          )}
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
