import { useState, useEffect, useRef } from 'react'
import { PlatePostLogo, PlatePostOrbMark } from '../components/PlatePostLogo'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

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

function Top10Card({ restaurant, onClick }: { restaurant: Restaurant; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        flexShrink: 0, width: 140, borderRadius: 16, overflow: 'hidden',
        background: '#fff', border: '1px solid #f0f0f0',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)', cursor: 'pointer', textAlign: 'left', padding: 0,
      }}
    >
      <div style={{ position: 'relative', height: 100 }}>
        <img src={restaurant.image_url} alt={restaurant.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 12, color: '#071126', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {restaurant.name}
        </p>
        <p style={{ fontFamily: 'Open Sans', fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>
          {restaurant.cuisine} · {restaurant.city}
        </p>
        {restaurant.rating && (
          <p style={{ fontFamily: 'Open Sans', fontSize: 10, color: '#f59e0b', margin: '2px 0 0', fontWeight: 600 }}>
            ★ {restaurant.rating.toFixed(1)}
          </p>
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

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('restaurants').select('*')
      const list = data ?? []
      setAllRestaurants(list)
      const scored = [...list]
        .filter(r => r.rating && r.review_count)
        .sort((a, b) => {
          const scoreA = (a.rating ?? 0) * Math.log10((a.review_count ?? 1) + 1)
          const scoreB = (b.rating ?? 0) * Math.log10((b.review_count ?? 1) + 1)
          return scoreB - scoreA
        })
        .slice(0, 10)
      setTop10(scored)
      const images = scored.slice(0, 6).map(r => r.image_url).filter(Boolean)
      setHeroImages(images)
    }
    load()
  }, [])

  useEffect(() => {
    if (heroImages.length < 2) return
    const interval = setInterval(() => setImageIndex(i => (i + 1) % heroImages.length), 5000)
    return () => clearInterval(interval)
  }, [heroImages.length])

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

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#fff' }}>

      {/* Hero background */}
      <div className="absolute inset-0">
        {heroImages.map((img, i) => (
          <img key={img} src={img} alt="" className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: i === imageIndex ? 1 : 0, transition: 'opacity 1.5s ease', zIndex: i === imageIndex ? 1 : 0 }} />
        ))}
        {heroImages.length === 0 && (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0a1628, #1a2f5e)' }} />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.96) 100%)' }}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-40 pt-14 px-5 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto">
          <PlatePostLogo size="md" white={true} />
        </div>
        <button onClick={() => navigate('/map')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full pointer-events-auto"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.25)' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" />
          </svg>
          <span style={{ fontFamily: 'Open Sans, sans-serif', color: '#fff', fontSize: 11, fontWeight: 600 }}>Los Angeles</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="absolute inset-0 z-20 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div style={{ height: '45vh' }} />

        {/* Hero text + chips */}
        <div className="px-5 pb-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-4">
            <p style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
              Discover
            </p>
            <h1 style={{ fontFamily: 'Open Sans', fontWeight: 800, color: '#fff', fontSize: 'clamp(2rem, 9vw, 3.2rem)', lineHeight: 1.05, textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
              LA's Best<br />Restaurants
            </h1>
          </motion.div>

          {/* Chips */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }} className="flex gap-2 mb-4">
            <motion.button whileTap={{ scale: 0.93 }}
              onClick={() => navigate('/list', { state: { filter: 'All', openNow: true, listView: true } })}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(16,185,129,0.85)', border: '1px solid rgba(16,185,129,0.4)', color: '#fff', fontFamily: 'Open Sans', backdropFilter: 'blur(12px)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#fff' }} />
              Open Now
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }}
              onClick={() => navigate('/events')}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(245,158,11,0.85)', border: '1px solid rgba(245,158,11,0.4)', color: '#fff', fontFamily: 'Open Sans', backdropFilter: 'blur(12px)' }}>
              <span style={{ fontSize: 12 }}>🎟️</span>
              Events
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }}
              onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 100) }}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', fontFamily: 'Open Sans', backdropFilter: 'blur(12px)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2.5" />
                <path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Search
            </motion.button>
          </motion.div>

          {/* CTA buttons */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }} className="flex gap-3">
            <button onClick={() => navigate('/map')}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
              style={{ fontFamily: 'Open Sans', background: '#0048f9', color: '#fff' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" />
              </svg>
              View Map
            </button>
            <button onClick={() => navigate('/list')}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
              style={{ fontFamily: 'Open Sans', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <polygon points="5,3 19,12 5,21" fill="white" />
              </svg>
              Explore Feed
            </button>
          </motion.div>
        </div>

        {/* White content area below hero */}
        <div style={{ background: '#f8f9fa', borderRadius: '24px 24px 0 0', minHeight: '55vh', paddingTop: 20 }}>

          {/* Search bar in white area */}
          <div className="px-5 mb-4">
            <button
              onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 100) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12,
                padding: '11px 14px', cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" stroke="#071126" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span style={{ fontFamily: 'Open Sans', fontSize: 14, color: '#9ca3af' }}>Search restaurants, cuisines...</span>
            </button>
          </div>

          {/* Popular in LA carousel */}
          {top10.length > 0 && (
            <div className="pb-6">
              <div className="px-5 mb-3 flex items-center justify-between">
                <div>
                  <p style={{ fontFamily: 'Open Sans', color: '#9ca3af', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Top Rated</p>
                  <h2 style={{ fontFamily: 'Open Sans', fontWeight: 800, color: '#071126', fontSize: 20 }}>Popular in LA</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { const el = document.getElementById('top10-carousel'); if (el) el.scrollBy({ left: -160, behavior: 'smooth' }) }}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" /></svg>
                  </button>
                  <button onClick={() => { const el = document.getElementById('top10-carousel'); if (el) el.scrollBy({ left: 160, behavior: 'smooth' }) }}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" /></svg>
                  </button>
                </div>
              </div>
              <div id="top10-carousel" className="flex gap-3 overflow-x-auto pl-5 pr-5 pb-1"
                style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
                onWheel={e => { const el = document.getElementById('top10-carousel'); if (el) { e.preventDefault(); el.scrollBy({ left: e.deltaY * 2, behavior: 'smooth' }) } }}>
                {top10.map((r) => (
                  <div key={r.id} style={{ scrollSnapAlign: 'start' }}>
                    <Top10Card restaurant={r} onClick={() => setSelectedRestaurant(r)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick navigation tiles */}
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

          <div style={{ height: 100 }} />
        </div>
      </div>

      {/* Fixed stationary orbs — always visible, high z-index */}
      <div style={{ position: 'fixed', bottom: 90, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {/* Surprise orb */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <motion.button
            onClick={() => navigate('/surprise')}
            animate={{ boxShadow: ['0 0 16px rgba(245,158,11,0.5)', '0 0 28px rgba(239,68,68,0.6)', '0 0 16px rgba(245,158,11,0.5)'] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
            <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 3, repeat: Infinity }} style={{ fontSize: 22 }}>🎲</motion.span>
          </motion.button>
          <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, fontFamily: 'Open Sans', letterSpacing: '0.1em', textTransform: 'uppercase', textShadow: '0 1px 6px rgba(0,0,0,0.8)', background: 'rgba(0,0,0,0.4)', padding: '1px 5px', borderRadius: 4 }}>Surprise</span>
        </div>

        {/* Crave orb */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <motion.button
            onClick={() => navigate('/concierge')}
            animate={{ boxShadow: ['0 0 16px rgba(0,72,249,0.6)', '0 0 32px rgba(0,72,249,0.8)', '0 0 16px rgba(0,72,249,0.6)'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #0048f9, #3b82f6)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
            <PlatePostOrbMark size={20} />
          </motion.button>
          <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, fontFamily: 'Open Sans', letterSpacing: '0.1em', textTransform: 'uppercase', textShadow: '0 1px 6px rgba(0,0,0,0.8)', background: 'rgba(0,0,0,0.4)', padding: '1px 5px', borderRadius: 4 }}>Crave</span>
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

              {/* Results */}
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

      {/* Restaurant detail */}
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
    </div>
  )
}
