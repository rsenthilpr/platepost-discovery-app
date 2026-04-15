import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { fetchPexelsPortraitVideo } from '../lib/pexels'
import { fetchPlaceDetails } from '../lib/googlePlaces'
import { searchEventbriteEvents } from '../lib/eventbrite'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'
import BottomNav from '../components/BottomNav'
import { useCityStore } from '../lib/cityStore'
import SurpriseOrb from '../components/SurpriseOrb'
import VideoBackground from '../components/VideoBackground'

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
  searchQuery?: string
}

const VIDEO_QUERY_POOLS: Record<string, string[]> = {
  Japanese: ['sushi chef knife skills', 'ramen noodles cooking', 'japanese food plating', 'sashimi fresh fish', 'tempura frying'],
  Italian: ['pasta dough kneading', 'pizza wood fired oven', 'italian cooking sauce', 'risotto stirring', 'tiramisu dessert'],
  American: ['burger grilling flames', 'bbq smoke grill meat', 'fried chicken crispy', 'cocktail bartender mixing', 'smash burger cooking'],
  Coffee: ['latte art pouring', 'coffee espresso machine', 'barista pour over', 'coffee roasting beans', 'cappuccino foam milk'],
  Cafe: ['brunch avocado toast', 'pastry bakery morning', 'cafe interior cozy', 'eggs benedict breakfast', 'french press coffee'],
  Mexican: ['tacos street food', 'guacamole fresh made', 'mexican grill cooking', 'tortilla making', 'margarita cocktail'],
}

const PLATEPOST_MENU_URLS: Record<number, string> = {
  4: 'https://platepost.io/kch',
  5: 'https://platepost.io/wywhcoffee',
  17: 'https://platepost.io/apecoffeeorange',
  18: 'https://platepost.io/apecoffeeplacentia',
}

function getVideoQuery(cuisine: string, restaurantName: string): string {
  const pool = VIDEO_QUERY_POOLS[cuisine]
  if (pool) {
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

const FILTERS = ['All', 'Coffee', 'Japanese', 'Italian', 'American', 'Cafe', 'Korean', 'Mexican', 'Thai', 'Vietnamese', 'Chinese', 'Indian', 'Mediterranean']

export default function ListViewScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { city } = useCityStore()
  const state = (location.state ?? {}) as LocationState
  const isListView = !!state.listView
  const [slides, setSlides] = useState<ReelSlide[]>([])
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState(state.filter ?? 'All')
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const [menuIframeUrl, setMenuIframeUrl] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState(state.searchQuery ?? '')
  const [showSearchBar, setShowSearchBar] = useState(false)
  const listSearchRef = useRef<HTMLInputElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const scrollPositionRef = useRef<number>(0)
  const loadedIndices = useRef<Set<number>>(new Set())

  function restoreScroll() {
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current
      if (el) el.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' })
    })
  }

  function toggleFavorite(id: number) {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveFavorites(next)
      return next
    })
  }

  useEffect(() => {
    fetchRestaurants()
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase()
      const matchingFilter = FILTERS.find(f => f.toLowerCase() === q)
      if (matchingFilter && matchingFilter !== 'All') setActiveFilter(matchingFilter)
    }
  }, [])

  async function fetchRestaurants() {
    setLoading(true)
    const { data, error } = await supabase.from('restaurants').select('*').order('tier').order('name')
    if (error) console.error(error)
    const list = data ?? []
    setAllRestaurants(list)

    const baseFiltered = applyFilter(list, state.filter ?? 'All')
    const filtered = baseFiltered.sort((a, b) => {
      const scoreA = (a.rating ?? 0) * Math.log10((a.review_count ?? 1) + 1)
      const scoreB = (b.rating ?? 0) * Math.log10((b.review_count ?? 1) + 1)
      return scoreB - scoreA
    })
    initSlides(filtered)
    setLoading(false)
  }

  function applyFilter(list: Restaurant[], filter: string): Restaurant[] {
    let result = list
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase()
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) || (r.neighborhood ?? '').toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      )
      return result.length > 0 ? result : []
    }
    if (state.searchQuery && !listSearch) {
      const q = state.searchQuery.toLowerCase()
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) || (r.neighborhood ?? '').toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      )
      return result.length > 0 ? result : list
    }
    if (filter && filter !== 'All') {
      result = result.filter(r => r.cuisine.toLowerCase() === filter.toLowerCase())
    }
    if (state.neighborhood) {
      result = result.filter(r =>
        r.city?.toLowerCase().includes(state.neighborhood!.toLowerCase()) ||
        r.description?.toLowerCase().includes(state.neighborhood!.toLowerCase())
      )
      if (result.length === 0) result = list
    }
    if (state.recentIds && state.recentIds.length > 0) {
      const recentSet = new Set(state.recentIds)
      result = result.filter(r => recentSet.has(r.id))
      if (result.length === 0) result = list
    }
    return result
  }

  function initSlides(filtered: Restaurant[]) {
    const initial: ReelSlide[] = filtered.map(r => ({
      restaurant: r, videoUrl: null, rating: null, reviewCount: null,
      heroImage: r.image_url, hasEvents: false, loaded: false,
    }))
    setSlides(initial)
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
    let yelpPhotos: string[] = []
    try {
      const yelpRes = await fetch(`/api/yelp?name=${encodeURIComponent(r.name)}&city=${encodeURIComponent(r.city)}`)
      if (yelpRes.ok) { const d = await yelpRes.json(); yelpPhotos = d.photos || [] }
    } catch {}
    const bestImage = placeResult?.photoUrl || yelpPhotos[0] || r.image_url
    setSlides(prev => {
      const next = [...prev]
      if (next[index]) {
        next[index] = {
          ...next[index],
          videoUrl: videoResult?.url ?? null,
          rating: (r.rating ?? placeResult?.rating) ?? null,
          reviewCount: (r.review_count ?? placeResult?.userRatingsTotal) ?? null,
          heroImage: bestImage,
          hasEvents: events.length > 0,
          loaded: true,
        }
      }
      return next
    })
  }

  useEffect(() => {
    if (slides.length === 0 || isListView) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.getAttribute('data-index') ?? '0')
            setCurrentIndex(idx)
            ;[idx, idx + 1, idx + 2].forEach(i => {
              if (slides[i] && !loadedIndices.current.has(i)) loadSlideData(slides[i].restaurant, i)
            })
          }
        })
      },
      { threshold: 0.6 }
    )
    slideRefs.current.forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [slides.length, isListView])

  // Live search — refilter as user types
  const filteredList = applyFilter(allRestaurants, activeFilter)

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#f8f9fa' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#0048f9', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#9ca3af', fontFamily: 'Open Sans, sans-serif', fontSize: 13 }}>Loading…</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  if (isListView) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: '#f8f9fa' }}>
        {/* Header — light bg, Open Sans (Emilia fix: no Bungee/cursive) */}
        <div style={{
          flexShrink: 0,
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          paddingTop: 'env(safe-area-inset-top, 44px)',
        }}>
          <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate(-1)}
              style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="#071126" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 style={{
              fontFamily: 'Open Sans, sans-serif', fontWeight: 800, fontSize: 20,
              color: '#071126', margin: 0, flex: 1,
            }}>
              {activeFilter === 'All'
                ? (state.searchQuery ? `"${state.searchQuery}"` : 'Discover')
                : activeFilter}
            </h1>
            {/* Search toggle button */}
            <button
              onClick={() => { setShowSearchBar(s => !s); setTimeout(() => listSearchRef.current?.focus(), 100) }}
              style={{ width: 36, height: 36, borderRadius: '50%', background: showSearchBar ? '#0048f9' : '#f3f4f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke={showSearchBar ? '#fff' : '#071126'} strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke={showSearchBar ? '#fff' : '#071126'} strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Inline search bar — shown when search icon tapped */}
          <AnimatePresence>
            {showSearchBar && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden', padding: '8px 16px 0' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f5f5', borderRadius: 12, padding: '9px 12px', border: '1.5px solid #e5e7eb' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="8" stroke="#071126" strokeWidth="2" />
                    <path d="M21 21l-4.35-4.35" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={listSearchRef}
                    value={listSearch}
                    onChange={e => setListSearch(e.target.value)}
                    placeholder={`Search ${activeFilter === 'All' ? 'restaurants' : activeFilter + ' restaurants'}...`}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Open Sans', fontSize: 14, color: '#071126' }}
                  />
                  {listSearch && (
                    <button onClick={() => setListSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, padding: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 16px 12px', scrollbarWidth: 'none' }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => { setActiveFilter(f); setListSearch('') }}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 999,
                  fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  background: activeFilter === f ? '#0048f9' : '#fff',
                  color: activeFilter === f ? '#fff' : '#6b7280',
                  border: activeFilter === f ? '1.5px solid #0048f9' : '1.5px solid #e5e7eb',
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Result count */}
        <div style={{ padding: '8px 20px 4px', flexShrink: 0 }}>
          <p style={{ fontFamily: 'Open Sans', fontSize: 12, color: '#9ca3af', margin: 0 }}>
            {filteredList.length} place{filteredList.length !== 1 ? 's' : ''}
            {listSearch ? ` for "${listSearch}"` : activeFilter !== 'All' ? ` in ${activeFilter}` : ` in ${city.name}`}
          </p>
        </div>

        {/* List */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pb-24" style={{ scrollbarWidth: 'none' }}>
          {filteredList.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <span style={{ fontSize: 40 }}>🔍</span>
              <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 16, color: '#071126', margin: '12px 0 6px' }}>No results</p>
              <p style={{ fontFamily: 'Open Sans', fontSize: 13, color: '#9ca3af', margin: 0 }}>Try a different search or filter</p>
            </div>
          ) : (
            <motion.div
              style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}
              initial="hidden" animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            >
              {filteredList.map(r => (
                <motion.button
                  key={r.id}
                  variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { scrollPositionRef.current = scrollContainerRef.current?.scrollTop ?? 0; setSelectedRestaurant(r) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: '#fff', borderRadius: 16, padding: 12,
                    border: '1px solid #f0f0f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <img src={r.image_url} alt={r.name}
                    style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 14, color: '#071126', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'Open Sans', fontSize: 11, fontWeight: 600, color: '#0048f9', background: 'rgba(0,72,249,0.08)', padding: '2px 8px', borderRadius: 999 }}>
                        {r.cuisine}
                      </span>
                      {PLATEPOST_MENU_URLS[r.id] && (
                        <span style={{ fontFamily: 'Open Sans', fontSize: 10, fontWeight: 700, color: '#0048f9', background: 'rgba(0,72,249,0.08)', padding: '2px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <img src="/pp-mark.png" alt="" width={9} height={9} style={{ objectFit: 'contain' }} />
                          PlatePost
                        </span>
                      )}
                    </div>
                    <p style={{ fontFamily: 'Open Sans', fontSize: 11, color: '#9ca3af', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📍 {r.city}, {r.state}
                      {r.rating ? ` · ★ ${r.rating.toFixed(1)}` : ''}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.25 }}>
                    <path d="M9 18l6-6-6-6" stroke="#071126" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </motion.button>
              ))}
            </motion.div>
          )}
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

        <SurpriseOrb />
        <BottomNav />
      </div>
    )
  }

  // ── REELS VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0" style={{ background: '#000' }}>
      {/* Back button — always visible top left */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'fixed', top: 52, left: 16, zIndex: 60,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Swipe hint — shows briefly on first load */}
      {currentIndex === 0 && slides.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: 'fixed', bottom: 160, left: '50%', transform: 'translateX(-50%)',
            zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 1.2, repeat: 3, ease: 'easeInOut' }}
            style={{ fontSize: 24 }}>
            ↑
          </motion.div>
          <span style={{ fontFamily: 'Open Sans', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: 999 }}>
            Swipe up to explore
          </span>
        </motion.div>
      )}

      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        onScroll={(e) => {
          const el = e.currentTarget
          const idx = Math.round(el.scrollTop / window.innerHeight)
          if (idx !== currentIndex) setCurrentIndex(idx)
          scrollPositionRef.current = el.scrollTop
        }}
      >
        {slides.map((slide, index) => (
          <ReelSlideCard
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
            onVideoMenu={(url) => setMenuIframeUrl(url)}
            onEvents={() => setSelectedRestaurant(slide.restaurant)}
          />
        ))}
      </div>

      {menuIframeUrl && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#0e1f42', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
            <button onClick={() => setMenuIframeUrl(null)}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
            <img src="/pp-mark.png" alt="" width={16} height={16} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            <span style={{ color: '#fff', fontFamily: 'Open Sans', fontSize: 14, fontWeight: 600 }}>VideoMenu</span>
          </div>
          <iframe src={menuIframeUrl} className="flex-1 w-full border-0" title="VideoMenu" />
        </div>
      )}

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

      <SurpriseOrb />
      <BottomNav />

      <style>{`
        @keyframes kenBurns {
          from { transform: scale(1) translate(0, 0); }
          to { transform: scale(1.08) translate(-1%, -1%); }
        }
      `}</style>
    </div>
  )
}

// ── Individual reel slide ──────────────────────────────────────────────────────
interface ReelSlideCardProps {
  slide: ReelSlide
  index: number
  isActive: boolean
  isFavorite: boolean
  onToggleFavorite: () => void
  slideRef: (el: HTMLDivElement | null) => void
  onMoreInfo: () => void
  onDirections: () => void
  onMenu: () => void
  onVideoMenu: (url: string) => void
  onEvents: () => void
}

function ReelSlideCard({ slide, index, isActive, isFavorite, onToggleFavorite, slideRef, onMoreInfo, onDirections, onMenu, onVideoMenu, onEvents }: ReelSlideCardProps) {
  const r = slide.restaurant
  const [showFavPopup, setShowFavPopup] = useState(false)
  const [_kenBurnsKey, setKenBurnsKey] = useState(0)

  useEffect(() => {
    if (isActive) setKenBurnsKey(k => k + 1)
  }, [isActive])

  function handleFavorite() {
    onToggleFavorite()
    if (!isFavorite) {
      setShowFavPopup(true)
      setTimeout(() => setShowFavPopup(false), 2000)
    }
  }

  const bgImage = slide.heroImage ?? r.image_url

  return (
    <div
      ref={slideRef}
      data-index={index}
      style={{ position: 'relative', width: '100%', flexShrink: 0, overflow: 'hidden', height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
    >
      <VideoBackground
        cuisine={r.cuisine}
        fallbackImage={bgImage}
        isActive={isActive}
        directVideoUrl={slide.videoUrl}
      />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: 'linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)', pointerEvents: 'none' }} />

      <AnimatePresence>
        {showFavPopup && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.9 }}
            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 20, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(16px)', border: '1px solid rgba(225,29,72,0.4)' }}>
            <span style={{ fontSize: 18 }}>❤️</span>
            <span style={{ fontFamily: 'Open Sans', color: '#fff', fontSize: 13, fontWeight: 600 }}>Added to Favorites</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingTop: 48, paddingLeft: 20, paddingRight: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <motion.button whileTap={{ scale: 0.8 }} onClick={handleFavorite}
          style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}>
          <motion.svg width="18" height="18" viewBox="0 0 24 24" fill={isFavorite ? '#E11D48' : 'none'} stroke={isFavorite ? '#E11D48' : 'white'} strokeWidth="2"
            animate={isFavorite ? { scale: [1, 1.3, 1] } : { scale: 1 }} transition={{ duration: 0.3 }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </motion.svg>
        </motion.button>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: '0 20px 90px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 12, color: '#fff', background: 'rgba(0,72,249,0.35)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,72,249,0.45)', padding: '3px 12px', borderRadius: 999 }}>
            {r.cuisine}
          </span>
          {PLATEPOST_MENU_URLS[r.id] && (
            <span style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 10, color: '#fff', background: 'rgba(0,72,249,0.85)', padding: '3px 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4 }}>
              <img src="/pp-mark.png" alt="" width={10} height={10} style={{ filter: 'brightness(0) invert(1)', objectFit: 'contain' }} />
              PlatePost
            </span>
          )}
        </div>
        <h1 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 800, color: '#fff', fontSize: 'clamp(1.7rem, 7vw, 2.5rem)', textShadow: '0 2px 16px rgba(0,0,0,0.6)', marginBottom: 6, lineHeight: 1.1 }}>
          {r.name}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>📍 {r.city}, {r.state}</span>
          {slide.rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#FBBF24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span style={{ fontFamily: 'Open Sans', color: '#FBBF24', fontSize: 13, fontWeight: 700 }}>{slide.rating.toFixed(1)}</span>
              {slide.reviewCount && <span style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>({slide.reviewCount.toLocaleString()})</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          {slide.hasEvents && (
            <motion.button whileTap={{ scale: 0.92 }} onClick={onEvents}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 0', borderRadius: 16, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>🎟️</span>
              <span style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>Events</span>
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.92 }} onClick={onDirections}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 0', borderRadius: 16, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            <span style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>Directions</span>
          </motion.button>
          {PLATEPOST_MENU_URLS[r.id] ? (
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => onVideoMenu(PLATEPOST_MENU_URLS[r.id])}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 0', borderRadius: 16, background: 'rgba(0,72,249,0.25)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,72,249,0.5)', cursor: 'pointer' }}>
              <img src="/pp-mark.png" alt="" width={18} height={18} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
              <span style={{ fontFamily: 'Open Sans', color: '#fff', fontSize: 11, fontWeight: 700 }}>VideoMenu</span>
            </motion.button>
          ) : (
            <motion.button whileTap={{ scale: 0.92 }} onClick={onMenu}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 0', borderRadius: 16, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>🍽️</span>
              <span style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>Menu</span>
            </motion.button>
          )}
        </div>
        <motion.button whileTap={{ scale: 0.98 }} onClick={onMoreInfo}
          style={{ width: '100%', padding: '14px 0', borderRadius: 16, fontFamily: 'Open Sans', fontWeight: 700, fontSize: 14, background: 'rgba(255,255,255,0.95)', color: '#071126', border: 'none', cursor: 'pointer' }}>
          Details
        </motion.button>
      </div>
    </div>
  )
}
