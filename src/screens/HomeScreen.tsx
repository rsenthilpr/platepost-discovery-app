// src/screens/HomeScreen.tsx
//
// v2 changes (Fix #1.5):
// - Added "Near Me" chip in place of "Events" (Events is now in tab bar).
//   Tapping it triggers geolocation flow via detectUserCity().
// - Auto-detect city on first load if user has no stored city AND has
//   already granted geolocation permission (silent — no prompt).
// - Resilient to Supabase failures: if Supabase returns nothing, the
//   carousel falls back to Google Places. No more blank screens.
// - Hero video has a static-image fallback when Pexels is unavailable.

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'
import BottomNav from '../components/BottomNav'
import CityPicker from '../components/CityPicker'
import { useCityStore, setSelectedCity, hasStoredCity } from '../lib/cityStore'
import VideoBackground from '../components/VideoBackground'
import AskPlatePostPill from '../components/AskPlatePostPill'
import { detectUserCity, hasGeolocationPermission } from '../lib/geolocation'

function getSearchHistory(): string[] {
  try { return JSON.parse(localStorage.getItem('pp_search_history') ?? '[]') } catch { return [] }
}
function addToSearchHistory(term: string) {
  try {
    const existing = getSearchHistory().filter(s => s !== term)
    localStorage.setItem('pp_search_history', JSON.stringify([term, ...existing].slice(0, 10)))
  } catch {}
}
function removeFromSearchHistory(term: string) {
  try { localStorage.setItem('pp_search_history', JSON.stringify(getSearchHistory().filter(s => s !== term))) } catch {}
}

interface PlaceRestaurant {
  id: string
  name: string
  cuisine: string
  city: string
  rating: number | null
  image_url: string | null
  address: string
  place_id: string
}

function RestaurantCard({ restaurant, onClick }: { restaurant: Restaurant | PlaceRestaurant; onClick: () => void }) {
  const r = restaurant as any
  const [hovered, setHovered] = useState(false)

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setTimeout(() => setHovered(false), 1500)}
      style={{
        flexShrink: 0, width: 155, borderRadius: 18, overflow: 'hidden',
        background: '#fff', border: '1px solid #f0f0f0',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)', cursor: 'pointer', textAlign: 'left', padding: 0,
      }}
    >
      <div style={{ position: 'relative', height: 110, background: '#e5e7eb', overflow: 'hidden' }}>
        {/* Always render the static image as the base — VideoBackground sits on top
            and the image shows through when the video fails or hasn't loaded. */}
        {r.image_url && (
          <img
            src={r.image_url}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <VideoBackground
          cuisine={r.cuisine ?? 'Restaurant'}
          fallbackImage={r.image_url ?? ''}
          isActive={hovered}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 60%)', zIndex: 1 }} />
        {!hovered && (
          <div style={{
            position: 'absolute', bottom: 6, right: 6, zIndex: 2,
            width: 20, height: 20, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ padding: '8px 10px 12px' }}>
        <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 13, color: '#071126', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.name}
        </p>
        <p style={{ fontFamily: 'Open Sans', fontSize: 11, color: '#9ca3af', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.cuisine} · {r.city}
        </p>
        {r.rating && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + r.city)}`}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ display: 'block', textDecoration: 'none', marginTop: 3 }}
          >
            <p style={{ fontFamily: 'Open Sans', fontSize: 11, color: '#f59e0b', margin: 0, fontWeight: 700 }}>
              ★ {typeof r.rating === 'number' ? r.rating.toFixed(1) : r.rating}
              <span style={{ color: '#93c5fd', fontSize: 10, fontWeight: 600 }}> reviews ↗</span>
            </p>
          </a>
        )}
      </div>
    </motion.button>
  )
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { city } = useCityStore()
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [heroImages, setHeroImages] = useState<string[]>([])
  const [featuredPlaces, setFeaturedPlaces] = useState<PlaceRestaurant[]>([])
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const [detectingNearMe, setDetectingNearMe] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Restaurant[]>([])
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>(getSearchHistory)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [selectedGooglePlace, setSelectedGooglePlace] = useState<PlaceRestaurant | null>(null)
  const HERO_CUISINES = ['Restaurant', 'Italian', 'Japanese', 'American', 'Coffee']
  const [heroCuisineIndex, setHeroCuisineIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Cycle hero video
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroCuisineIndex(i => (i + 1) % HERO_CUISINES.length)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Auto-detect city on first load — silent, only if permission already granted.
  // If user has never visited or denied permission, we just use the default LA.
  // This makes the first-run experience feel magical for users who've already
  // opted in (e.g. coming back to the app), without prompting cold users.
  useEffect(() => {
    if (hasStoredCity()) return
    let cancelled = false
    ;(async () => {
      const granted = await hasGeolocationPermission()
      if (!granted) return
      const detected = await detectUserCity()
      if (detected && !cancelled) setSelectedCity(detected)
    })()
    return () => { cancelled = true }
  }, [])

  // Load restaurants for search + hero images.
  // Don't block on Supabase — if it fails, we'll get data from Google Places.
  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase.from('restaurants').select('*')
        if (error) {
          console.warn('Supabase unavailable, continuing with Google Places only:', error.message)
          return
        }
        const list = data ?? []
        setAllRestaurants(list)
        const images = list
          .filter(r => r.image_url)
          .sort(() => Math.random() - 0.5)
          .slice(0, 6)
          .map(r => r.image_url)
        setHeroImages(images)
      } catch (err) {
        console.warn('Supabase fetch threw, continuing:', err)
      }
    }
    load()
  }, [])

  // Load Google Places for the selected city carousel.
  // Also serves as a backup hero-image source when Supabase is down.
  useEffect(() => {
    loadCityPlaces()
  }, [city.name, city.countryCode])

  async function loadCityPlaces() {
    setLoadingPlaces(true)
    try {
      const res = await fetch(
        `/api/places-search?city=${encodeURIComponent(city.name)}&lat=${city.lat}&lng=${city.lng}`
      )
      if (res.ok) {
        const data = await res.json()
        const places: PlaceRestaurant[] = (data.places ?? [])
          .filter((p: any) => p.rating && p.image_url)
          .sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0))
          .slice(0, 12)
          .map((p: any) => ({
            id: p.place_id,
            name: p.name,
            cuisine: p.cuisine ?? 'Restaurant',
            city: city.name,
            rating: p.rating,
            image_url: p.image_url,
            address: p.address,
            place_id: p.place_id,
          }))
        setFeaturedPlaces(places)

        // Backfill hero images from Google Places if Supabase is empty
        if (heroImages.length === 0 && places.length > 0) {
          setHeroImages(places.slice(0, 6).map(p => p.image_url ?? '').filter(Boolean))
        }
      }
    } catch (e) {
      console.error('Places load error:', e)
    } finally {
      setLoadingPlaces(false)
    }
  }

  /** Near Me handler — used by the home-screen chip. */
  async function handleNearMe() {
    setDetectingNearMe(true)
    const detected = await detectUserCity(true)
    setDetectingNearMe(false)
    if (detected) {
      setSelectedCity(detected)
    } else {
      // Permission denied or unavailable — open the picker so they can pick manually
      setShowCityPicker(true)
    }
  }

  function handleSearch(query: string) {
    setSearchQuery(query)
    if (!query.trim()) { setSearchResults([]); return }
    const q = query.toLowerCase()
    const results = allRestaurants.filter(r =>
      r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) || (r.neighborhood ?? '').toLowerCase().includes(q)
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

  const [scrolled, setScrolled] = useState(false)

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const scrollTop = e.currentTarget.scrollTop
    const heroHeight = window.innerHeight * 0.48
    setScrolled(scrollTop > heroHeight - 80)
  }

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#fff' }}>

      {/* Hero — cycling video over a base image gradient.
          Even if every video API fails, we have heroImages from Google Places
          or Supabase. Even if those fail, the gradient is the final fallback. */}
      <div className="absolute inset-0">
        {/* Base gradient — always visible, never black */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0a1628, #1a2f5e)' }} />

        {/* Static image fallback for first paint, fills underneath the video */}
        {heroImages[heroCuisineIndex] && (
          <img
            src={heroImages[heroCuisineIndex]}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              animation: 'kenBurns 12s ease-in-out infinite alternate',
            }}
          />
        )}

        {/* Cycling videos layered on top */}
        {HERO_CUISINES.map((cuisine, i) => (
          <div key={cuisine} style={{
            position: 'absolute', inset: 0,
            opacity: i === heroCuisineIndex ? 1 : 0,
            transition: 'opacity 1.5s ease',
            zIndex: i === heroCuisineIndex ? 1 : 0,
          }}>
            <VideoBackground
              cuisine={cuisine}
              fallbackImage={heroImages[i] ?? heroImages[0] ?? ''}
              isActive={i === heroCuisineIndex}
              orientation="landscape"
              style={{ position: 'absolute', inset: 0 }}
            />
          </div>
        ))}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.6) 68%, rgba(0,0,0,0.97) 100%)' }}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-50 pt-14 px-5 flex items-center justify-between pointer-events-none"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : 'none',
          transition: 'background 0.3s ease, border-bottom 0.3s ease',
          paddingBottom: scrolled ? 12 : 0,
        }}>
        <a href="https://platepost.io" target="_blank" rel="noreferrer" className="pointer-events-auto" style={{ textDecoration: 'none' }}>
          <img
            src="/pp-logo.png"
            alt="PlatePost"
            style={{
              height: 'clamp(24px, 6.5vw, 32px)',
              maxHeight: 32,
              width: 'auto',
              maxWidth: 160,
              objectFit: 'contain',
              objectPosition: 'left center',
              display: 'block',
              filter: scrolled
                ? 'brightness(0) saturate(100%) invert(13%) sepia(84%) saturate(1800%) hue-rotate(214deg) brightness(90%)'
                : 'brightness(0) invert(1)',
              transition: 'filter 0.3s ease',
            }}
          />
        </a>
        <button onClick={() => setShowCityPicker(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full pointer-events-auto"
          style={{
            background: scrolled ? 'rgba(0,72,249,0.08)' : 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(12px)',
            border: scrolled ? '1px solid rgba(0,72,249,0.25)' : '1px solid rgba(255,255,255,0.25)',
            whiteSpace: 'nowrap',
            transition: 'all 0.3s ease',
          }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              fill={scrolled ? '#0048f9' : 'white'} />
          </svg>
          <span style={{
            fontFamily: 'Open Sans, sans-serif',
            color: scrolled ? '#0048f9' : '#fff',
            fontSize: 12, fontWeight: 600,
            transition: 'color 0.3s ease',
          }}>{city.name}</span>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6"
              stroke={scrolled ? '#0048f9' : 'white'}
              strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="absolute inset-0 z-20 overflow-y-auto" style={{ scrollbarWidth: 'none' }} onScroll={handleScroll}>
        <div style={{ height: '48vh' }} />

        {/* Hero text + Ask PlatePost pill + action chips */}
        <div className="px-5 pb-5">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-4">
            <p style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
              {city.isUserLocation ? 'Near you in' : 'Discover'}
            </p>
            <h1 style={{ fontFamily: 'Open Sans', fontWeight: 800, color: '#fff', fontSize: 'clamp(2rem, 9vw, 3.2rem)', lineHeight: 1.05, textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
              {city.name}<br />Restaurants
            </h1>
          </motion.div>

          {/* Ask PlatePost pill */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-4"
          >
            <AskPlatePostPill variant="on-hero" />
          </motion.div>

          {/* Action chips — Open Now, Near Me, Search.
              Events removed (it's in the bottom tab bar now). */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex gap-2">
            <motion.button whileTap={{ scale: 0.93 }}
              onClick={() => navigate('/list', { state: { filter: 'All', openNow: true, listView: true } })}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: 'rgba(16,185,129,0.9)', border: 'none', color: '#fff', fontFamily: 'Open Sans', fontWeight: 600, fontSize: 12, cursor: 'pointer', backdropFilter: 'blur(12px)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
              Open Now
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }}
              onClick={handleNearMe}
              disabled={detectingNearMe}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 999,
                background: 'rgba(0,72,249,0.9)', border: 'none', color: '#fff',
                fontFamily: 'Open Sans', fontWeight: 600, fontSize: 12,
                cursor: detectingNearMe ? 'wait' : 'pointer',
                backdropFilter: 'blur(12px)',
                opacity: detectingNearMe ? 0.7 : 1,
              }}>
              {detectingNearMe ? (
                <div style={{
                  width: 11, height: 11, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  animation: 'kenBurns-spin 0.8s linear infinite',
                }} />
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" fill="white" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="1.5" opacity="0.6" />
                </svg>
              )}
              {detectingNearMe ? 'Locating…' : 'Near Me'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }}
              onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 100) }}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontFamily: 'Open Sans', fontWeight: 600, fontSize: 12, cursor: 'pointer', backdropFilter: 'blur(12px)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2.5" />
                <path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Search
            </motion.button>
          </motion.div>
        </div>

        {/* White content area */}
        <div style={{ background: '#f8f9fa', borderRadius: '24px 24px 0 0', minHeight: '55vh', paddingTop: 20 }}>

          {/* Search bar */}
          <div className="px-5 mb-5">
            <button
              onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 100) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14,
                padding: '13px 16px', cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" stroke="#071126" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span style={{ fontFamily: 'Open Sans', fontSize: 14, color: '#9ca3af' }}>Search restaurants, cuisines...</span>
            </button>
          </div>

          {/* City restaurants carousel */}
          <div className="pb-6">
            <div className="px-5 mb-3 flex items-center justify-between">
              <div>
                <p style={{ fontFamily: 'Open Sans', color: '#9ca3af', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
                  {loadingPlaces ? 'Loading...' : 'Top Rated'}
                </p>
                <h2 style={{ fontFamily: 'Open Sans', fontWeight: 800, color: '#071126', fontSize: 20, margin: '2px 0 0' }}>
                  Popular in {city.name}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { const el = document.getElementById('city-carousel'); if (el) el.scrollBy({ left: -170, behavior: 'smooth' }) }}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" /></svg>
                </button>
                <button onClick={() => { const el = document.getElementById('city-carousel'); if (el) el.scrollBy({ left: 170, behavior: 'smooth' }) }}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>

            {loadingPlaces ? (
              <div className="flex gap-3 pl-5 pr-5 overflow-hidden">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ flexShrink: 0, width: 155, borderRadius: 18, overflow: 'hidden', background: '#fff', border: '1px solid #f0f0f0' }}>
                    <div style={{ height: 110, background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    <div style={{ padding: '8px 10px 12px' }}>
                      <div style={{ height: 12, borderRadius: 6, background: '#f0f0f0', marginBottom: 6, width: '75%' }} />
                      <div style={{ height: 10, borderRadius: 6, background: '#f0f0f0', width: '50%' }} />
                    </div>
                  </div>
                ))}
                <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
              </div>
            ) : featuredPlaces.length > 0 ? (
              <div id="city-carousel" className="flex gap-3 overflow-x-auto pl-5 pr-5 pb-1"
                style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                {featuredPlaces.map((r) => (
                  <div key={r.id} style={{ scrollSnapAlign: 'start' }}>
                    <RestaurantCard restaurant={r as any} onClick={() => setSelectedGooglePlace(r)} />
                  </div>
                ))}
              </div>
            ) : allRestaurants.length > 0 ? (
              <div id="city-carousel" className="flex gap-3 overflow-x-auto pl-5 pr-5 pb-1"
                style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                {allRestaurants
                  .filter(r => r.rating && r.image_url)
                  .sort((a, b) => ((b.rating ?? 0) * Math.log10((b.review_count ?? 1) + 1)) - ((a.rating ?? 0) * Math.log10((a.review_count ?? 1) + 1)))
                  .slice(0, 10)
                  .map((r) => (
                    <div key={r.id} style={{ scrollSnapAlign: 'start' }}>
                      <RestaurantCard restaurant={r} onClick={() => setSelectedRestaurant(r)} />
                    </div>
                  ))}
              </div>
            ) : (
              /* Both data sources empty — show a friendly empty state */
              <div className="px-5 py-8 text-center">
                <span style={{ fontSize: 32 }}>🍽️</span>
                <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 14, color: '#071126', margin: '8px 0 4px' }}>
                  No restaurants loaded yet
                </p>
                <p style={{ fontFamily: 'Open Sans', fontSize: 12, color: '#9ca3af', margin: 0 }}>
                  Try changing your city or pulling to refresh
                </p>
              </div>
            )}
          </div>

          {/* Explore grid */}
          <div className="px-5 pb-8">
            <h2 style={{ fontFamily: 'Open Sans', fontWeight: 800, color: '#071126', fontSize: 20, marginBottom: 12 }}>Explore</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Coffee', emoji: '☕', filter: 'Coffee' },
                { label: 'Japanese', emoji: '🍣', filter: 'Japanese' },
                { label: 'American', emoji: '🍔', filter: 'American' },
                { label: 'Italian', emoji: '🍕', filter: 'Italian' },
                { label: 'Korean', emoji: '🥩', filter: 'Korean' },
                { label: 'Mexican', emoji: '🌮', filter: 'Mexican' },
              ].map(item => (
                <motion.button key={item.label} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/list', { state: { filter: item.filter, listView: true } })}
                  style={{
                    background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14,
                    padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer', textAlign: 'left', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}>
                  <span style={{ fontSize: 22 }}>{item.emoji}</span>
                  <span style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 13, color: '#071126' }}>{item.label}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', opacity: 0.3 }}>
                    <path d="M9 18l6-6-6-6" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </motion.button>
              ))}
            </div>
          </div>

          <div style={{ height: 80 }} />
        </div>
      </div>

      {/* Search overlay */}
      <AnimatePresence>
        {showSearch && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowSearch(false)} />
            <motion.div
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="fixed top-0 left-0 right-0 z-50"
              style={{ background: '#fff', borderRadius: '0 0 20px 20px', padding: '56px 20px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: '#f5f5f5', border: '1.5px solid #e5e7eb' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4 }}>
                    <circle cx="11" cy="11" r="8" stroke="#071126" strokeWidth="2" />
                    <path d="M21 21l-4.35-4.35" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input ref={searchInputRef} value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitSearch(searchQuery)}
                    placeholder="Search restaurants, cuisines..."
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Open Sans', fontSize: 15, color: '#071126' }}
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                      style={{ opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
                <button onClick={() => setShowSearch(false)}
                  style={{ color: '#0048f9', fontFamily: 'Open Sans', fontWeight: 600, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>

              {searchResults.length > 0 ? (
                <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
                  {searchResults.map(r => (
                    <button key={r.id} onClick={() => { setShowSearch(false); setSelectedRestaurant(r) }}
                      className="w-full flex items-center gap-3 py-2.5"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                      <img src={r.image_url} alt={r.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                      <div className="text-left">
                        <p style={{ fontFamily: 'Open Sans', fontWeight: 600, fontSize: 14, color: '#071126', margin: 0 }}>{r.name}</p>
                        <p style={{ fontFamily: 'Open Sans', fontSize: 12, color: '#9ca3af', margin: 0 }}>{r.cuisine} · {r.city}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery ? (
                <p style={{ fontFamily: 'Open Sans', color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No results for "{searchQuery}"</p>
              ) : searchHistory.length > 0 ? (
                <div>
                  <p style={{ fontFamily: 'Open Sans', color: '#9ca3af', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Recent</p>
                  {searchHistory.map(term => (
                    <div key={term} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <button onClick={() => { handleSearch(term); searchInputRef.current?.focus() }}
                        className="flex items-center gap-3 flex-1 text-left"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3, flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="9" stroke="#071126" strokeWidth="2" />
                          <path d="M12 7v5l3 3" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span style={{ fontFamily: 'Open Sans', fontSize: 14, color: '#071126' }}>{term}</span>
                      </button>
                      <button onClick={() => deleteHistory(term)}
                        style={{ opacity: 0.3, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M18 6L6 18M6 6l12 12" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedRestaurant && (
          <RestaurantDetail
            restaurant={selectedRestaurant}
            onClose={() => setSelectedRestaurant(null)}
            isFavorite={false}
            onToggleFavorite={() => {}}
          />
        )}
      </AnimatePresence>

      {/* Google Places result detail sheet */}
      <AnimatePresence>
        {selectedGooglePlace && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 30 }}
              onClick={() => setSelectedGooglePlace(null)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, background: '#0e1f42', borderRadius: '24px 24px 0 0', maxHeight: '85vh', overflowY: 'auto', scrollbarWidth: 'none' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
              </div>
              {selectedGooglePlace.image_url && (
                <div style={{ height: 200, margin: '0 16px 16px', borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
                  <img src={selectedGooglePlace.image_url} alt={selectedGooglePlace.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(14,31,66,0.85), transparent 50%)' }} />
                  <button onClick={() => setSelectedGooglePlace(null)}
                    style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}
              <div style={{ padding: '0 20px 32px' }}>
                <h2 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 800, fontSize: 20, color: '#FAFBFF', margin: '0 0 6px' }}>
                  {selectedGooglePlace.name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontFamily: 'Open Sans', fontSize: 11, fontWeight: 600, color: '#6B9EFF', background: 'rgba(69,118,239,0.18)', padding: '3px 10px', borderRadius: 999 }}>
                    {selectedGooglePlace.cuisine}
                  </span>
                  {selectedGooglePlace.rating && (
                    <span style={{ fontFamily: 'Open Sans', fontSize: 13, color: '#FBBF24', fontWeight: 700 }}>
                      ★ {selectedGooglePlace.rating}
                    </span>
                  )}
                </div>
                {selectedGooglePlace.address && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20 }}>
                    <span style={{ fontSize: 14 }}>📍</span>
                    <p style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: 0 }}>
                      {selectedGooglePlace.address}
                    </p>
                  </div>
                )}

                {selectedGooglePlace.rating && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedGooglePlace.name + ' ' + selectedGooglePlace.city)}`}
                    target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20, textDecoration: 'none' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#FBBF24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span style={{ fontFamily: 'Open Sans', color: '#FBBF24', fontWeight: 700, fontSize: 13 }}>
                      {selectedGooglePlace.rating}
                    </span>
                    <span style={{ fontFamily: 'Open Sans', color: 'rgba(147,197,253,0.9)', fontSize: 12, textDecoration: 'underline' }}>
                      reviews ↗
                    </span>
                  </a>
                )}

                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedGooglePlace.name + ' ' + selectedGooglePlace.city)}`}
                    target="_blank" rel="noreferrer"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 14, textDecoration: 'none', background: '#0048f9', color: '#fff', fontFamily: 'Open Sans, sans-serif', fontWeight: 700, fontSize: 14 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11l19-9-9 19-2-8-8-2z" />
                    </svg>
                    Directions
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedGooglePlace.name + ' ' + selectedGooglePlace.city)}`}
                    target="_blank" rel="noreferrer"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 14, textDecoration: 'none', background: 'rgba(255,255,255,0.07)', color: '#FAFBFF', border: '1px solid rgba(255,255,255,0.15)', fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: 14 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" opacity={0.8} />
                      <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" strokeWidth="1.5" opacity={0.8} />
                    </svg>
                    Reviews
                  </a>
                </div>
                <div style={{ height: 80 }} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />

      <CityPicker
        isOpen={showCityPicker}
        onClose={() => setShowCityPicker(false)}
        currentCity={city}
      />

      <style>{`
        @keyframes kenBurns {
          from { transform: scale(1) translate(0, 0); }
          to { transform: scale(1.08) translate(-1%, -1%); }
        }
        @keyframes kenBurns-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
