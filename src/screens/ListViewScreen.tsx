import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { fetchPexelsVideo } from '../lib/pexels'
import { fetchPlaceDetails } from '../lib/googlePlaces'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

interface LocationState {
  filter?: string
  selectedId?: number
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
  loaded: boolean
}

export default function ListViewScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as LocationState

  const [slides, setSlides] = useState<ReelSlide[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const loadedIndices = useRef<Set<number>>(new Set())

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

    const filtered =
      state.filter && state.filter !== 'All'
        ? list.filter((r) =>
            state.filter === 'DJs'
              ? r.cuisine === 'Music'
              : r.cuisine.toLowerCase() === state.filter!.toLowerCase()
          )
        : list

    const initialSlides: ReelSlide[] = filtered.map((r) => ({
      restaurant: r,
      videoUrl: null,
      rating: null,
      reviewCount: null,
      heroImage: r.image_url,
      loaded: false,
    }))

    setSlides(initialSlides)
    setLoading(false)

    // Load first 3 eagerly
    filtered.slice(0, 3).forEach((r, i) => loadSlideData(r, i))
  }

  async function loadSlideData(r: Restaurant, index: number) {
    if (loadedIndices.current.has(index)) return
    loadedIndices.current.add(index)

    const [videoResult, placeResult] = await Promise.all([
      fetchPexelsVideo(getVideoQuery(r.cuisine)),
      fetchPlaceDetails(r.name, r.city),
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
          loaded: true,
        }
      }
      return next
    })
  }

  // Intersection observer for lazy loading + active tracking
  useEffect(() => {
    if (slides.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.getAttribute('data-index') ?? '0')
            setCurrentIndex(idx)
            // Preload current + next 2
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
  }, [slides.length])

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#000' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' }}
          />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Manrope, sans-serif', fontSize: 13 }}>
            Loading feed…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0" style={{ background: '#000' }}>

      {/* ── Scrollable reel container ── */}
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
            slideRef={(el: HTMLDivElement | null) => { slideRefs.current[index] = el }}
            onMoreInfo={() => setSelectedRestaurant(slide.restaurant)}
            onDirections={() => {
              const q = encodeURIComponent(
                `${slide.restaurant.name}, ${slide.restaurant.city}, ${slide.restaurant.state}`
              )
              window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank')
            }}
            onMenu={() => navigate(`/menu/${slide.restaurant.id}`)}
            onEvents={() => setSelectedRestaurant(slide.restaurant)}
          />
        ))}
      </div>

      {/* ── Bottom tab bar ── */}
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
            style={{
              fontFamily: 'Manrope, sans-serif',
              color: 'rgba(255,255,255,0.55)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                fill="currentColor"
              />
            </svg>
            Map
          </button>

          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)' }} />

          <div
            className="flex items-center gap-2 px-5 py-2.5 rounded-full"
            style={{
              fontFamily: 'Manrope, sans-serif',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.18)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            Feed
          </div>
        </div>
      </div>

      {/* ── Restaurant Detail Sheet ── */}
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

// ── Individual reel slide ─────────────────────────────────────────────────────
interface ReelSlideProps {
  slide: ReelSlide
  index: number
  isActive: boolean
  slideRef: (el: HTMLDivElement | null) => void
  onMoreInfo: () => void
  onDirections: () => void
  onMenu: () => void
  onEvents: () => void
}

function ReelSlide({
  slide, index, isActive, slideRef,
  onMoreInfo, onDirections, onMenu, onEvents,
}: ReelSlideProps) {
  const r = slide.restaurant
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isActive) {
      video.play().catch(() => {})
    } else {
      video.pause()
      video.currentTime = 0
    }
  }, [isActive])

  return (
    <div
      ref={slideRef}
      data-index={index}
      className="relative w-full flex-shrink-0"
      style={{
        height: '100dvh',
        scrollSnapAlign: 'start',
        scrollSnapStop: 'always',
      }}
    >
      {/* Background video or fallback image */}
      {slide.videoUrl ? (
        <video
          ref={videoRef}
          src={slide.videoUrl}
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

      {/* Top gradient */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: 140,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)',
        }}
      />

      {/* Bottom gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '60%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)',
        }}
      />

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
        <span style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          {index + 1}
        </span>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-28">

        {/* Cuisine tag */}
        <div className="mb-2.5">
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{
              background: 'rgba(69,118,239,0.3)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(69,118,239,0.45)',
              color: '#fff',
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            {r.cuisine}
          </span>
        </div>

        {/* Restaurant name */}
        <h1
          className="mb-1.5 leading-tight"
          style={{
            fontFamily: 'Bungee, cursive',
            color: '#fff',
            fontSize: 'clamp(1.7rem, 7vw, 2.5rem)',
            textShadow: '0 2px 16px rgba(0,0,0,0.6)',
          }}
        >
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
              <span style={{ fontFamily: 'Manrope, sans-serif', color: '#FBBF24', fontSize: 13, fontWeight: 700 }}>
                {slide.rating.toFixed(1)}
              </span>
              {slide.reviewCount && (
                <span style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                  ({slide.reviewCount.toLocaleString()})
                </span>
              )}
            </div>
          )}
        </div>

        {/* 3 action buttons */}
        <div className="flex gap-2.5 mb-3">
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
            <span style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>
              Events
            </span>
          </motion.button>

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
            <span style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>
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
            <span style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>
              Menu
            </span>
          </motion.button>
        </div>

        {/* More Info button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onMoreInfo}
          className="w-full py-3.5 rounded-2xl text-sm font-bold"
          style={{
            fontFamily: 'Manrope, sans-serif',
            background: 'rgba(255,255,255,0.95)',
            color: '#071126',
          }}
        >
          More Info
        </motion.button>
      </div>
    </div>
  )
}
