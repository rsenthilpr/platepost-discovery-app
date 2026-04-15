import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'
import BottomNav from '../components/BottomNav'
import SurpriseOrb from '../components/SurpriseOrb'
import { useCityStore } from '../lib/cityStore'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? import.meta.env.VITE_GOOGLE_PLACES_KEY
const PLATEPOST_IDS = new Set([4, 5, 17, 18])
const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places']

function loadFavorites(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem('pp_favorites') ?? '[]')) } catch { return new Set() }
}
function saveFavorites(f: Set<number>) { localStorage.setItem('pp_favorites', JSON.stringify([...f])) }

const MAP_STYLES = [
  { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4b5563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#374151' }] },
]

const CUISINE_EMOJI: Record<string, string> = {
  Coffee: '☕', Cafe: '☕', Japanese: '🍣', Italian: '🍕',
  American: '🍔', Mexican: '🌮', Korean: '🥩', Thai: '🍜',
  Vietnamese: '🍜', Chinese: '🥢', Indian: '🍛', Mediterranean: '🫒', Restaurant: '🍽️',
}

const FILTERS = ['All', 'Saved', 'Coffee', 'American', 'Italian', 'Japanese', 'Cafe', 'Korean', 'Mexican']

export default function MapViewScreen() {
  const navigate = useNavigate()
  const { city } = useCityStore()
  const [supabaseRestaurants, setSupabaseRestaurants] = useState<Restaurant[]>([])
  const [googleRestaurants, setGoogleRestaurants] = useState<Restaurant[]>([])
  const [activeFilter, setActiveFilter] = useState('All')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const [mapSearch, setMapSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<Restaurant[]>([])
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [currentZoom, setCurrentZoom] = useState(11)
  const [userLocation, _setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [trayOpen, setTrayOpen] = useState(true)
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const topBarRef = useRef<HTMLDivElement>(null)
  const [topBarHeight, setTopBarHeight] = useState(170)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  useEffect(() => {
    supabase.from('restaurants').select('*').then(({ data }) => setSupabaseRestaurants(data ?? []))
  }, [])

  useEffect(() => { fetchGooglePlaces() }, [city.name])

  useEffect(() => {
    if (topBarRef.current) setTopBarHeight(topBarRef.current.offsetHeight)
  }, [])

  async function fetchGooglePlaces() {
    setLoadingPlaces(true)
    try {
      const res = await fetch(`/api/places-search?city=${encodeURIComponent(city.name)}&lat=${city.lat}&lng=${city.lng}`)
      if (res.ok) {
        const data = await res.json()
        const normalized = (data.places ?? []).map((p: any, i: number) => ({
          id: -(i + 1000),
          name: p.name,
          cuisine: p.cuisine ?? 'Restaurant',
          city: city.name,
          state: city.state,
          latitude: p.latitude,
          longitude: p.longitude,
          rating: p.rating,
          review_count: p.review_count,
          image_url: p.image_url ?? '',
          description: p.description ?? '',
          address: p.address ?? '',
          phone: p.phone ?? '',
          website_url: p.website_url ?? '',
          platepost_menu_url: null,
          tier: 'standard',
          neighborhood: null,
          price_level: p.price_level,
          hours: null,
          place_id: p.place_id,
        } as any))
        setGoogleRestaurants(normalized)
      }
    } catch (e) { console.error('Places fetch error:', e) }
    finally { setLoadingPlaces(false) }
  }

  const allRestaurants = [
    ...supabaseRestaurants,
    ...googleRestaurants.filter(g =>
      !supabaseRestaurants.some(s => s.name.toLowerCase().slice(0, 8) === g.name.toLowerCase().slice(0, 8))
    ),
  ]

  const filtered = allRestaurants.filter(r => {
    if (activeFilter === 'Saved') return favorites.has(r.id)
    if (activeFilter !== 'All' && r.cuisine.toLowerCase() !== activeFilter.toLowerCase()) return false
    if (mapSearch.trim()) {
      const q = mapSearch.toLowerCase()
      return r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q)
    }
    return true
  })

  const mapCenter = userLocation ?? { lat: city.lat, lng: city.lng }
  const nearbyRestaurants = [...filtered]
    .sort((a, b) => {
      const da = Math.pow(a.latitude - mapCenter.lat, 2) + Math.pow(a.longitude - mapCenter.lng, 2)
      const db = Math.pow(b.latitude - mapCenter.lat, 2) + Math.pow(b.longitude - mapCenter.lng, 2)
      return da - db
    }).slice(0, 20)

  // Strict density control — fewer pins at city level
  const pinsToShow = currentZoom >= 14 ? filtered
    : currentZoom >= 12 ? [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 12)
    : [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8)

  useEffect(() => {
    if (!mapSearch.trim() || mapSearch.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    const q = mapSearch.toLowerCase()
    const matches = allRestaurants.filter(r => r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q)).slice(0, 5)
    setSuggestions(matches); setShowSuggestions(matches.length > 0)
  }, [mapSearch, allRestaurants.length])


  function toggleFavorite(id: number) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      saveFavorites(next); return next
    })
  }

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)
    mapInstance.addListener('zoom_changed', () => setCurrentZoom(mapInstance.getZoom() ?? 12))
    mapInstance.addListener('click', () => setSelectedRestaurant(null))
  }, [])

  useEffect(() => {
    if (map && !userLocation) { map.setCenter({ lat: city.lat, lng: city.lng }); map.setZoom(12) }
  }, [city, map])

  if (loadError) return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
      <p style={{ fontFamily: 'Open Sans', color: '#9ca3af' }}>Map failed to load.</p>
    </div>
  )

  const trayHeight = trayOpen ? 210 : 56

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1a1a2e', fontFamily: 'Open Sans, sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Top bar */}
      <div ref={topBarRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(17,24,39,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingTop: 48, paddingBottom: 10, paddingLeft: 16, paddingRight: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={() => navigate('/')} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
          <img src="/pp-logo.png" alt="PlatePost" style={{ height: 'clamp(22px, 5.5vw, 30px)', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {loadingPlaces && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#0048f9', animation: 'spin 1s linear infinite' }} />}
            <span style={{ fontFamily: 'Open Sans', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{city.name} · {filtered.length}</span>
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.12)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}><circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
            <input value={mapSearch} onChange={e => setMapSearch(e.target.value)} placeholder={`Search in ${city.name}...`} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Open Sans', fontSize: 13, color: '#fff' }} />
            {mapSearch && <button onClick={() => { setMapSearch(''); setShowSuggestions(false) }} style={{ opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg></button>}
          </div>
          {showSuggestions && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1f2937', borderRadius: 12, zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 4 }}>
              {suggestions.map((r, i) => (
                <button key={r.id} onClick={() => { setMapSearch(r.name); setShowSuggestions(false); if (map) { map.setCenter({ lat: r.latitude, lng: r.longitude }); map.setZoom(15) } setSelectedRestaurant(r) }}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontFamily: 'Open Sans', cursor: 'pointer', background: 'transparent', border: 'none', color: '#fff', borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <img src={r.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  <div><p style={{ fontWeight: 600, color: '#fff', margin: 0 }}>{r.name}</p><p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: 0 }}>{r.cuisine} · {r.city}</p></div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Open Sans', background: activeFilter === f ? '#0048f9' : 'rgba(255,255,255,0.08)', color: activeFilter === f ? '#fff' : 'rgba(255,255,255,0.6)', border: `1px solid ${activeFilter === f ? '#0048f9' : 'rgba(255,255,255,0.12)'}` }}>
              {f === 'Saved' ? '❤️ Saved' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ position: 'absolute', inset: 0, top: topBarHeight, bottom: trayHeight + 64 }}>
        {isLoaded ? (
          <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={{ lat: city.lat, lng: city.lng }} zoom={11} onLoad={onMapLoad}
            options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: false, scrollwheel: true, gestureHandling: 'greedy', clickableIcons: false }}>
            {pinsToShow.map((r) => {
              const isPro = PLATEPOST_IDS.has(r.id)
              const isSelected = selectedRestaurant?.id === r.id
              const emoji = CUISINE_EMOJI[r.cuisine] ?? '🍽️'
              return (
                <OverlayView key={r.id} position={{ lat: r.latitude, lng: r.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                  {/* Single unified pointer handler — works on both mouse and touch */}
                  <div
                    style={{ position: 'absolute', transform: 'translate(-50%, -50%)', cursor: 'pointer' }}
                    onPointerUp={(e) => {
                      e.stopPropagation()
                      setSelectedRestaurant(isSelected ? null : r)
                      if (map) map.panTo({ lat: r.latitude, lng: r.longitude })
                    }}
                  >
                    <div style={{
                      width: isSelected ? 42 : isPro ? 38 : 32,
                      height: isSelected ? 42 : isPro ? 38 : 32,
                      borderRadius: '50%',
                      background: isSelected ? '#0048f9' : isPro ? '#0048f9' : '#fff',
                      border: `2px solid ${isSelected ? '#93c5fd' : isPro ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.2)'}`,
                      boxShadow: isSelected
                        ? '0 0 0 4px rgba(0,72,249,0.35), 0 4px 16px rgba(0,0,0,0.5)'
                        : '0 2px 6px rgba(0,0,0,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      zIndex: isSelected ? 20 : isPro ? 10 : 1,
                    }}>
                      {isPro
                        ? <img src="/pp-mark.png" alt="" width={14} height={14}
                            style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                        : <span style={{ fontSize: isSelected ? 16 : 14, lineHeight: 1 }}>{emoji}</span>
                      }
                    </div>
                    {/* Name tooltip only when selected */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute', bottom: '110%', left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#0048f9', color: '#fff',
                        fontFamily: 'Open Sans', fontWeight: 700, fontSize: 11,
                        padding: '4px 10px', borderRadius: 8,
                        whiteSpace: 'nowrap', pointerEvents: 'none',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }}>
                        {r.name.length > 20 ? r.name.slice(0, 19) + '…' : r.name}
                      </div>
                    )}
                  </div>
                </OverlayView>
              )
            })}
            {userLocation && (
              <OverlayView position={userLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#0048f9', border: '3px solid #fff', boxShadow: '0 0 0 4px rgba(0,72,249,0.3)', transform: 'translate(-50%, -50%)' }} />
              </OverlayView>
            )}
          </GoogleMap>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#0048f9', animation: 'spin 1s linear infinite' }} />
          </div>
        )}
      </div>

      {/* Zoom + Recenter */}
      <div style={{ position: 'absolute', right: 16, bottom: trayHeight + 80, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={() => { if (map) map.setZoom((map.getZoom() ?? 12) + 1) }}
          style={{ width: 40, height: 40, borderRadius: 10, background: '#1f2937', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          +
        </button>
        {/* Recenter button — returns to city default view */}
        <button
          onClick={() => {
            if (map) {
              map.setCenter({ lat: city.lat, lng: city.lng })
              map.setZoom(11)
            }
          }}
          title="Recenter map"
          style={{ width: 40, height: 40, borderRadius: 10, background: '#1f2937', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" fill="white" opacity="0.9"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={() => { if (map) map.setZoom((map.getZoom() ?? 12) - 1) }}
          style={{ width: 40, height: 40, borderRadius: 10, background: '#1f2937', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 24, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          −
        </button>
      </div>

      {/* Tray */}
      <div style={{ position: 'absolute', bottom: 64, left: 0, right: 0, zIndex: 100, background: 'rgba(17,24,39,0.97)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.08)', height: trayHeight, transition: 'height 0.3s ease', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => setTrayOpen(o => !o)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div animate={{ y: trayOpen ? [0, -3, 0] : 0 }} transition={{ delay: 0.8, duration: 0.6, repeat: trayOpen ? 2 : 0 }} style={{ width: 28, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
            <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 13, color: '#fff', margin: 0 }}>Nearby · {nearbyRestaurants.length} places</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'Open Sans', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{trayOpen ? 'Hide' : 'Show'}</span>
            <motion.svg width="16" height="16" viewBox="0 0 24 24" fill="none" animate={{ rotate: trayOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
              <path d="M6 9l6 6 6-6" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
            </motion.svg>
          </div>
        </div>
        {trayOpen && (
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto',
            paddingLeft: 16, paddingRight: 16, paddingBottom: 12,
            scrollbarWidth: 'none', msOverflowStyle: 'none', height: 150,
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}>
            {nearbyRestaurants.map(r => (
              <button key={r.id}
                onClick={() => { setSelectedRestaurant(r); if (map) map.panTo({ lat: r.latitude, lng: r.longitude }) }}
                style={{
                  flexShrink: 0, width: 120, borderRadius: 12, overflow: 'hidden', background: '#1f2937',
                  border: `1.5px solid ${selectedRestaurant?.id === r.id ? '#0048f9' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer', textAlign: 'left', padding: 0,
                  boxShadow: selectedRestaurant?.id === r.id ? '0 4px 16px rgba(0,72,249,0.3)' : 'none',
                }}>
                <div style={{ height: 72, background: '#374151' }}>
                  {r.image_url && <img src={r.image_url} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ padding: '6px 8px 8px' }}>
                  <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 10, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</p>
                  <p style={{ fontFamily: 'Open Sans', fontSize: 9, color: 'rgba(255,255,255,0.4)', margin: '1px 0 0' }}>{CUISINE_EMOJI[r.cuisine] ?? '🍽️'} {r.cuisine}</p>
                  {r.rating && <p style={{ fontFamily: 'Open Sans', fontSize: 9, color: '#fbbf24', margin: '1px 0 0', fontWeight: 600 }}>★ {r.rating.toFixed(1)}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedRestaurant && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 300 }}>
            <RestaurantDetail restaurant={selectedRestaurant} onClose={() => setSelectedRestaurant(null)}
              isFavorite={favorites.has(selectedRestaurant.id)} onToggleFavorite={() => toggleFavorite(selectedRestaurant.id)} />
          </div>
        )}
      </AnimatePresence>

      <SurpriseOrb />
      <BottomNav />
    </div>
  )
}
