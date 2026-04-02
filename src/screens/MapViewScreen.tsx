import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? import.meta.env.VITE_GOOGLE_PLACES_KEY
const PLATEPOST_IDS = new Set([4, 5, 17, 18])
// Must be defined outside component to prevent re-render reloads
const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places']

function loadFavorites(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem('pp_favorites') ?? '[]')) } catch { return new Set() }
}
function saveFavorites(f: Set<number>) {
  localStorage.setItem('pp_favorites', JSON.stringify([...f]))
}

const MAP_STYLES = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8f8f8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e9f6' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
]

const CUISINE_EMOJI: Record<string, string> = {
  Coffee: '☕', Cafe: '☕', Japanese: '🍣', Italian: '🍕',
  American: '🍔', Music: '🎵', Jazz: '🎷', Mexican: '🌮',
  Korean: '🥩', Thai: '🍜', Vietnamese: '🍜', Chinese: '🥢',
  Indian: '🍛', Mediterranean: '🫒',
}

function clusterRestaurants(restaurants: Restaurant[], zoom: number) {
  if (zoom >= 13) return restaurants.map(r => ({ restaurant: r, count: 1, lat: r.latitude, lng: r.longitude }))
  const threshold = zoom >= 11 ? 0.025 : zoom >= 9 ? 0.07 : 0.18
  const used = new Set<number>()
  const clusters: Array<{ restaurant: Restaurant; count: number; lat: number; lng: number }> = []
  restaurants.forEach((r, i) => {
    if (used.has(i)) return
    used.add(i)
    let count = 1, latSum = r.latitude, lngSum = r.longitude
    restaurants.forEach((r2, j) => {
      if (i === j || used.has(j)) return
      if (Math.abs(r.latitude - r2.latitude) < threshold && Math.abs(r.longitude - r2.longitude) < threshold) {
        used.add(j); count++; latSum += r2.latitude; lngSum += r2.longitude
      }
    })
    clusters.push({ restaurant: r, count, lat: latSum / count, lng: lngSum / count })
  })
  return clusters
}

const FILTERS = ['All', 'Saved', 'Coffee', 'Music', 'Jazz', 'American', 'Italian', 'Japanese', 'Cafe', 'Korean', 'Mexican']

export default function MapViewScreen() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [activeFilter, setActiveFilter] = useState('All')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const [mapSearch, setMapSearch] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState<Restaurant[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [currentZoom, setCurrentZoom] = useState(11)
  const [mapCenter, setMapCenter] = useState({ lat: 34.0522, lng: -118.2437 })
  const topBarRef = useRef<HTMLDivElement>(null)
  const [topBarHeight, setTopBarHeight] = useState(140)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Load restaurants
  useEffect(() => {
    supabase.from('restaurants').select('*').then(({ data }) => {
      setRestaurants(data ?? [])
    })
  }, [])

  // Track top bar height
  useEffect(() => {
    if (topBarRef.current) setTopBarHeight(topBarRef.current.offsetHeight)
  }, [])

  // Filter restaurants
  const filtered = restaurants.filter(r => {
    if (activeFilter === 'Saved') return favorites.has(r.id)
    if (activeFilter !== 'All' && r.cuisine.toLowerCase() !== activeFilter.toLowerCase()) return false
    if (mapSearch.trim()) {
      const q = mapSearch.toLowerCase()
      return r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.city.toLowerCase().includes(q)
    }
    return true
  })

  // Nearby restaurants sorted by distance from map center
  const nearbyRestaurants = (() => {
    const sorted = [...filtered].sort((a, b) => {
      const da = Math.pow(a.latitude - mapCenter.lat, 2) + Math.pow(a.longitude - mapCenter.lng, 2)
      const db = Math.pow(b.latitude - mapCenter.lat, 2) + Math.pow(b.longitude - mapCenter.lng, 2)
      return da - db
    })
    const pro = sorted.filter(r => PLATEPOST_IDS.has(r.id))
    const rest = sorted.filter(r => !PLATEPOST_IDS.has(r.id))
    return [...pro, ...rest].slice(0, 20)
  })()

  // Search suggestions
  useEffect(() => {
    if (!mapSearch.trim() || mapSearch.length < 2) {
      setSearchSuggestions([]); setShowSuggestions(false); return
    }
    const q = mapSearch.toLowerCase()
    const matches = restaurants.filter(r =>
      r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.city.toLowerCase().includes(q)
    ).slice(0, 5)
    setSearchSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }, [mapSearch, restaurants])

  // Auto-fit when filter changes
  useEffect(() => {
    if (!map || !isLoaded || filtered.length === 0) return
    const ca = filtered.filter(r => r.latitude >= 32 && r.latitude <= 35.5 && r.longitude >= -119.5 && r.longitude <= -116)
    const toFit = ca.length > 0 ? ca : filtered
    if (toFit.length === 1) {
      map.setCenter({ lat: toFit[0].latitude, lng: toFit[0].longitude })
      map.setZoom(14)
    } else if (toFit.length > 1) {
      const bounds = new window.google.maps.LatLngBounds()
      toFit.forEach(r => bounds.extend({ lat: r.latitude, lng: r.longitude }))
      map.fitBounds(bounds, { top: 60, bottom: 180, left: 20, right: 20 })
    }
  }, [activeFilter, restaurants.length, isLoaded])

  function toggleFavorite(id: number) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      saveFavorites(next)
      return next
    })
  }

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)
    mapInstance.addListener('zoom_changed', () => {
      setCurrentZoom(mapInstance.getZoom() ?? 11)
    })
    // Throttle center updates to avoid flooding React state
    let centerTimer: ReturnType<typeof setTimeout> | null = null
    mapInstance.addListener('center_changed', () => {
      if (centerTimer) clearTimeout(centerTimer)
      centerTimer = setTimeout(() => {
        const c = mapInstance.getCenter()
        if (c) setMapCenter({ lat: c.lat(), lng: c.lng() })
      }, 300)
    })
  }, [])

  if (loadError) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#f5f5f5' }}>
      <p style={{ fontFamily: 'Open Sans', color: '#666' }}>Failed to load map. Check API key.</p>
    </div>
  )

  return (
    <div className="fixed inset-0" style={{ background: '#f0f0f0' }}>

      {/* Top bar */}
      <div ref={topBarRef} style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(12px)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        paddingTop: 48, paddingBottom: 10, paddingLeft: 16, paddingRight: 16,
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={() => navigate('/')} style={{
            width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #e5e7eb',
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="#071126" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <img src="/pp-logo.png" alt="PlatePost" height={22} style={{ objectFit: 'contain' }} />
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'Open Sans', fontSize: 12, fontWeight: 600, color: '#444' }}>
            {filtered.length} places
          </span>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f5f5f5', borderRadius: 10, padding: '8px 12px', marginBottom: 8,
            border: '1px solid #ebebeb',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" stroke="#071126" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input value={mapSearch} onChange={e => setMapSearch(e.target.value)}
              placeholder="Search restaurants, cuisines..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Open Sans', fontSize: 13, color: '#071126' }} />
            {mapSearch && (
              <button onClick={() => { setMapSearch(''); setShowSuggestions(false) }}
                style={{ opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
              borderRadius: 12, zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              border: '1px solid #ebebeb', overflow: 'hidden', marginTop: -4,
            }}>
              {searchSuggestions.map((r, i) => (
                <button key={r.id} onClick={() => {
                  setMapSearch(r.name); setShowSuggestions(false)
                  if (map) { map.setCenter({ lat: r.latitude, lng: r.longitude }); map.setZoom(15) }
                  setSelectedRestaurant(r)
                }} style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 13, fontFamily: 'Open Sans', cursor: 'pointer',
                  background: 'transparent', border: 'none',
                  borderBottom: i < searchSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}>
                  <img src={r.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontWeight: 600, color: '#071126', margin: 0 }}>{r.name}</p>
                    <p style={{ color: '#9ca3af', fontSize: 11, margin: 0 }}>{r.cuisine} · {r.city}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', scrollbarWidth: 'none' as const }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 999,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Open Sans', transition: 'all 0.15s',
              background: activeFilter === f ? '#0048f9' : '#fff',
              color: activeFilter === f ? '#fff' : '#444',
              border: activeFilter === f ? '1px solid #0048f9' : '1px solid #ddd',
            }}>
              {f === 'Saved' ? '❤️ Saved' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ position: 'absolute', inset: 0, top: topBarHeight, bottom: 180 }}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={{ lat: 34.0522, lng: -118.2437 }}
            zoom={11}
            onLoad={onMapLoad}
            options={{
              styles: MAP_STYLES, disableDefaultUI: false, zoomControl: true,
              streetViewControl: false, mapTypeControl: false, fullscreenControl: false, clickableIcons: false,
            }}
          >
            {clusterRestaurants(filtered, currentZoom).map((cluster) => {
              const r = cluster.restaurant
              const isPro = PLATEPOST_IDS.has(r.id)
              const isFav = favorites.has(r.id)
              const isSelected = selectedRestaurant?.id === r.id
              const isCluster = cluster.count > 1
              return (
                <OverlayView key={`${r.id}-${cluster.lat}-${cluster.lng}`}
                  position={{ lat: cluster.lat, lng: cluster.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    onClick={() => {
                      if (isCluster && map) {
                        map.setZoom((map.getZoom() ?? 11) + 2)
                        map.panTo({ lat: cluster.lat, lng: cluster.lng })
                      } else { setSelectedRestaurant(r) }
                    }}
                    style={{
                      width: isCluster ? 48 : isPro ? 48 : isSelected ? 50 : 40,
                      height: isCluster ? 48 : isPro ? 48 : isSelected ? 50 : 40,
                      borderRadius: '50%',
                      background: isCluster ? '#0048f9' : isPro ? '#0048f9' : isFav ? '#E11D48' : isSelected ? '#0048f9' : '#fff',
                      border: `3px solid ${isPro || isCluster ? '#fff' : isSelected ? '#0048f9' : isFav ? '#fff' : '#e5e7eb'}`,
                      boxShadow: isPro || isSelected || isCluster ? '0 4px 16px rgba(0,72,249,0.4)' : '0 2px 8px rgba(0,0,0,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transform: 'translate(-50%, -50%)',
                      zIndex: isPro ? 10 : isSelected ? 9 : isCluster ? 5 : 1, transition: 'all 0.2s',
                    }}>
                    {isCluster ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'Open Sans' }}>{cluster.count}</span>
                    ) : isPro ? (
                      <img src="/pp-mark.png" alt="" width={20} height={20} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                    ) : (
                      <span style={{ fontSize: isSelected ? 20 : 16 }}>{CUISINE_EMOJI[r.cuisine] ?? '🍽️'}</span>
                    )}
                  </motion.div>
                </OverlayView>
              )
            })}
          </GoogleMap>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: '#0048f9' }} />
          </div>
        )}
      </div>

      {/* Restaurant Tray */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12, paddingBottom: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 16, marginBottom: 10 }}>
          <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 13, color: '#071126', margin: 0 }}>
            Nearby · {nearbyRestaurants.length} places
          </p>
          <button onClick={() => navigate('/list')} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
            borderRadius: 999, background: '#071126', border: 'none', cursor: 'pointer',
            fontFamily: 'Open Sans', fontSize: 11, fontWeight: 600, color: '#fff',
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
            Feed
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingLeft: 16, paddingRight: 16, scrollbarWidth: 'none' as const }}>
          {nearbyRestaurants.map(r => {
            const isPro = PLATEPOST_IDS.has(r.id)
            const isSelected = selectedRestaurant?.id === r.id
            return (
              <motion.button key={r.id} whileTap={{ scale: 0.96 }}
                onClick={() => { setSelectedRestaurant(r); if (map) map.panTo({ lat: r.latitude, lng: r.longitude }) }}
                style={{
                  flexShrink: 0, width: 130, borderRadius: 14, overflow: 'hidden',
                  background: '#fff', border: `2px solid ${isSelected ? '#0048f9' : isPro ? '#0048f9' : '#f3f4f6'}`,
                  cursor: 'pointer', textAlign: 'left',
                  boxShadow: isSelected ? '0 4px 16px rgba(0,72,249,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s', padding: 0,
                }}>
                <div style={{ position: 'relative', height: 80 }}>
                  <img src={r.image_url} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {isPro && (
                    <div style={{
                      position: 'absolute', top: 5, left: 5, background: '#0048f9',
                      borderRadius: 6, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      <img src="/pp-mark.png" alt="" width={8} height={8} style={{ filter: 'brightness(0) invert(1)', objectFit: 'contain' }} />
                      <span style={{ fontFamily: 'Open Sans', color: '#fff', fontSize: 8, fontWeight: 700 }}>PRO</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: '7px 8px' }}>
                  <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 11, color: '#071126', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </p>
                  <p style={{ fontFamily: 'Open Sans', fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>
                    {CUISINE_EMOJI[r.cuisine] ?? '🍽️'} {r.cuisine}
                  </p>
                  {r.rating && (
                    <p style={{ fontFamily: 'Open Sans', fontSize: 10, color: '#FBBF24', margin: '1px 0 0', fontWeight: 600 }}>
                      ★ {r.rating.toFixed(1)}
                    </p>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Restaurant Detail */}
      <AnimatePresence>
        {selectedRestaurant && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 200 }}>
            <RestaurantDetail
              restaurant={selectedRestaurant}
              onClose={() => setSelectedRestaurant(null)}
              isFavorite={favorites.has(selectedRestaurant.id)}
              onToggleFavorite={() => toggleFavorite(selectedRestaurant.id)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
