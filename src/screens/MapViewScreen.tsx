import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'
import BottomNav from '../components/BottomNav'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? import.meta.env.VITE_GOOGLE_PLACES_KEY
const PLATEPOST_IDS = new Set([4, 5, 17, 18])
const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places']

function loadFavorites(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem('pp_favorites') ?? '[]')) } catch { return new Set() }
}
function saveFavorites(f: Set<number>) {
  localStorage.setItem('pp_favorites', JSON.stringify([...f]))
}

// Dark map style like chubbygroup
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
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
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

const FILTERS = ['All', 'Saved', 'Coffee', 'American', 'Italian', 'Japanese', 'Cafe', 'Korean', 'Mexican']

export default function MapViewScreen() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [activeFilter, setActiveFilter] = useState('All')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [popupRestaurant, setPopupRestaurant] = useState<Restaurant | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const [mapSearch, setMapSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<Restaurant[]>([])
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [currentZoom, setCurrentZoom] = useState(11)
  const [mapCenter, setMapCenter] = useState({ lat: 34.0522, lng: -118.2437 })
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [trayOpen, setTrayOpen] = useState(true)
  const topBarRef = useRef<HTMLDivElement>(null)
  const [topBarHeight, setTopBarHeight] = useState(160)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  useEffect(() => {
    supabase.from('restaurants').select('*').then(({ data }) => setRestaurants(data ?? []))
  }, [])

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

  // Nearby tray sorted by distance from current map center
  const nearbyRestaurants = [...filtered].sort((a, b) => {
    const center = userLocation ?? mapCenter
    const da = Math.pow(a.latitude - center.lat, 2) + Math.pow(a.longitude - center.lng, 2)
    const db = Math.pow(b.latitude - center.lat, 2) + Math.pow(b.longitude - center.lng, 2)
    return da - db
  }).slice(0, 20)

  // Search suggestions
  useEffect(() => {
    if (!mapSearch.trim() || mapSearch.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    const q = mapSearch.toLowerCase()
    const matches = restaurants.filter(r =>
      r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.city.toLowerCase().includes(q)
    ).slice(0, 5)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }, [mapSearch, restaurants])

  function requestUserLocation() {
    if (!navigator.geolocation) return
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setMapCenter(loc)
        if (map) { map.setCenter(loc); map.setZoom(14) }
        setLocationLoading(false)
      },
      () => setLocationLoading(false),
      { timeout: 8000 }
    )
  }

  // Auto-fit on filter change
  useEffect(() => {
    if (!map || !isLoaded || filtered.length === 0) return
    if (userLocation) { map.setCenter(userLocation); map.setZoom(13); return }
    const ca = filtered.filter(r => r.latitude >= 32 && r.latitude <= 35.5 && r.longitude >= -119.5 && r.longitude <= -116)
    const toFit = ca.length > 0 ? ca : filtered
    if (toFit.length > 1) {
      const bounds = new window.google.maps.LatLngBounds()
      toFit.forEach(r => bounds.extend({ lat: r.latitude, lng: r.longitude }))
      map.fitBounds(bounds, { top: 60, bottom: trayOpen ? 220 : 80, left: 20, right: 20 })
    }
  }, [activeFilter, restaurants.length, isLoaded])

  function toggleFavorite(id: number) {
    setFavorites(prev => {
      const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id)
      saveFavorites(next); return next
    })
  }

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)
    mapInstance.addListener('zoom_changed', () => setCurrentZoom(mapInstance.getZoom() ?? 11))
    let centerTimer: ReturnType<typeof setTimeout> | null = null
    mapInstance.addListener('center_changed', () => {
      if (centerTimer) clearTimeout(centerTimer)
      centerTimer = setTimeout(() => {
        const c = mapInstance.getCenter()
        if (c) setMapCenter({ lat: c.lat(), lng: c.lng() })
      }, 400)
    })
    // Close popup when clicking map background
    mapInstance.addListener('click', () => setPopupRestaurant(null))
  }, [])

  if (loadError) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#1a1a2e' }}>
      <p style={{ fontFamily: 'Open Sans', color: '#9ca3af', fontSize: 14 }}>Map failed to load. Check API key.</p>
    </div>
  )

  const trayHeight = trayOpen ? 260 : 60

  return (
    <div className="fixed inset-0" style={{ background: '#1a1a2e', fontFamily: 'Open Sans, sans-serif' }}>

      {/* Top bar */}
      <div ref={topBarRef} style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(17,24,39,0.97)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingTop: 48, paddingBottom: 10, paddingLeft: 16, paddingRight: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={() => navigate('/')} style={{
            width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <img src="/pp-logo.png" alt="PlatePost" style={{ height: 'clamp(22px, 5.5vw, 30px)', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'Open Sans', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
            {filtered.length} places
          </span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px',
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input value={mapSearch} onChange={e => setMapSearch(e.target.value)}
              placeholder="Search restaurants, cuisines..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Open Sans', fontSize: 13, color: '#fff' }} />
            {mapSearch && (
              <button onClick={() => { setMapSearch(''); setShowSuggestions(false) }}
                style={{ opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          {showSuggestions && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, background: '#1f2937',
              borderRadius: 12, zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 4,
            }}>
              {suggestions.map((r, i) => (
                <button key={r.id} onClick={() => {
                  setMapSearch(r.name); setShowSuggestions(false)
                  if (map) { map.setCenter({ lat: r.latitude, lng: r.longitude }); map.setZoom(15) }
                  setPopupRestaurant(r)
                }} style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 13, fontFamily: 'Open Sans', cursor: 'pointer',
                  background: 'transparent', border: 'none', color: '#fff',
                  borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <img src={r.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontWeight: 600, color: '#fff', margin: 0 }}>{r.name}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: 0 }}>{r.cuisine} · {r.city}</p>
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
              flexShrink: 0, padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Open Sans', transition: 'all 0.15s',
              background: activeFilter === f ? '#0048f9' : 'rgba(255,255,255,0.08)',
              color: activeFilter === f ? '#fff' : 'rgba(255,255,255,0.6)',
              border: `1px solid ${activeFilter === f ? '#0048f9' : 'rgba(255,255,255,0.12)'}`,
            }}>
              {f === 'Saved' ? '❤️ Saved' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ position: 'absolute', inset: 0, top: topBarHeight, bottom: trayHeight + 60 }}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={{ lat: 34.0522, lng: -118.2437 }}
            zoom={11}
            onLoad={onMapLoad}
            options={{
              styles: MAP_STYLES, disableDefaultUI: true,
              zoomControl: false, scrollwheel: true, gestureHandling: 'greedy', clickableIcons: false,
            }}
          >
            {/* Restaurant markers */}
            {clusterRestaurants(filtered, currentZoom).map((cluster) => {
              const r = cluster.restaurant
              const isPro = PLATEPOST_IDS.has(r.id)
              const isSelected = popupRestaurant?.id === r.id
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
                      } else {
                        setPopupRestaurant(isSelected ? null : r)
                        if (map) map.panTo({ lat: r.latitude, lng: r.longitude })
                      }
                    }}
                    style={{
                      width: isCluster ? 44 : isPro ? 44 : isSelected ? 46 : 38,
                      height: isCluster ? 44 : isPro ? 44 : isSelected ? 46 : 38,
                      borderRadius: '50%',
                      background: isCluster ? '#0048f9' : isPro ? '#0048f9' : isSelected ? '#0048f9' : '#fff',
                      border: `3px solid ${isSelected ? '#60a5fa' : isPro ? '#fff' : 'rgba(255,255,255,0.9)'}`,
                      boxShadow: isSelected ? '0 0 0 3px rgba(0,72,249,0.4), 0 6px 20px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transform: 'translate(-50%, -50%)',
                      zIndex: isSelected ? 20 : isPro ? 10 : isCluster ? 5 : 1, transition: 'all 0.2s',
                    }}>
                    {isCluster ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'Open Sans' }}>{cluster.count}</span>
                    ) : isPro ? (
                      <img src="/pp-mark.png" alt="" width={18} height={18} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                    ) : (
                      <span style={{ fontSize: isSelected ? 18 : 15 }}>{CUISINE_EMOJI[r.cuisine] ?? '🍽️'}</span>
                    )}
                  </motion.div>
                </OverlayView>
              )
            })}

            {/* Chubbygroup-style popup — appears on map when marker tapped */}
            {popupRestaurant && (
              <OverlayView
                position={{ lat: popupRestaurant.latitude, lng: popupRestaurant.longitude }}
                mapPaneName={OverlayView.FLOAT_PANE}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{
                    position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)',
                    width: 260, background: '#1f2937', borderRadius: 16,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)',
                    overflow: 'hidden', zIndex: 50,
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Image */}
                  <div style={{ position: 'relative', height: 120 }}>
                    <img src={popupRestaurant.image_url} alt={popupRestaurant.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(31,41,55,0.9), transparent)' }} />
                    <button onClick={() => setPopupRestaurant(null)}
                      style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </button>
                    {PLATEPOST_IDS.has(popupRestaurant.id) && (
                      <div style={{ position: 'absolute', top: 8, left: 8, background: '#0048f9', borderRadius: 6, padding: '2px 8px' }}>
                        <span style={{ fontFamily: 'Open Sans', color: '#fff', fontSize: 9, fontWeight: 700 }}>VIDEOMENU</span>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ padding: '10px 14px 12px' }}>
                    <p style={{ fontFamily: 'Open Sans', fontWeight: 800, fontSize: 14, color: '#fff', margin: '0 0 2px' }}>
                      {popupRestaurant.name}
                    </p>
                    <p style={{ fontFamily: 'Open Sans', fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>
                      {popupRestaurant.cuisine} · {popupRestaurant.city}
                    </p>
                    {popupRestaurant.address && (
                      <p style={{ fontFamily: 'Open Sans', fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>
                        📍 {popupRestaurant.address}
                      </p>
                    )}
                    {popupRestaurant.rating && (
                      <p style={{ fontFamily: 'Open Sans', fontSize: 11, color: '#fbbf24', margin: '0 0 10px', fontWeight: 600 }}>
                        ★ {popupRestaurant.rating.toFixed(1)} · {popupRestaurant.review_count ? `${popupRestaurant.review_count} reviews` : ''}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => {
                          const addr = encodeURIComponent(popupRestaurant.address ?? popupRestaurant.name)
                          window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, '_blank')
                        }}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontFamily: 'Open Sans', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" />
                        </svg>
                        Directions
                      </button>
                      <button
                        onClick={() => { setShowDetail(true); setSelectedRestaurant(popupRestaurant) }}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: '#0048f9', border: 'none', color: '#fff', fontFamily: 'Open Sans', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        View Details →
                      </button>
                    </div>
                  </div>
                  {/* Triangle pointer */}
                  <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid #1f2937' }} />
                </motion.div>
              </OverlayView>
            )}

            {/* User location dot */}
            {userLocation && (
              <OverlayView position={userLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#0048f9', border: '3px solid #fff', boxShadow: '0 0 0 4px rgba(0,72,249,0.3)', transform: 'translate(-50%, -50%)' }} />
              </OverlayView>
            )}
          </GoogleMap>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#0048f9', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </div>

      {/* Zoom controls + Near Me — always visible right side */}
      <div style={{ position: 'absolute', right: 16, bottom: trayHeight + 16, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Zoom in */}
        <button onClick={() => { if (map) map.setZoom((map.getZoom() ?? 11) + 1) }}
          style={{ width: 40, height: 40, borderRadius: 10, background: '#1f2937', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          +
        </button>
        {/* Zoom out */}
        <button onClick={() => { if (map) map.setZoom((map.getZoom() ?? 11) - 1) }}
          style={{ width: 40, height: 40, borderRadius: 10, background: '#1f2937', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 24, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          −
        </button>
        {/* Near Me */}
        <button onClick={requestUserLocation}
          style={{ width: 40, height: 40, borderRadius: 10, background: userLocation ? '#0048f9' : '#1f2937', border: `1px solid ${userLocation ? '#0048f9' : 'rgba(255,255,255,0.15)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          {locationLoading ? (
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" fill="white" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="1.5" opacity="0.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Collapsible restaurant tray — sits above BottomNav */}
      <div style={{
        position: 'absolute', bottom: 60, left: 0, right: 0, zIndex: 100,
        background: 'rgba(17,24,39,0.97)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        height: trayHeight, transition: 'height 0.3s ease', overflow: 'hidden',
      }}>
        {/* Tray header — always visible, tap to toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer' }}
          onClick={() => setTrayOpen(o => !o)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto' }} />
            <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 13, color: '#fff', margin: 0 }}>
              Nearby · {nearbyRestaurants.length} places
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={(e) => { e.stopPropagation(); navigate('/list') }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', fontFamily: 'Open Sans', fontSize: 11, fontWeight: 600, color: '#fff' }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
              Feed
            </button>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: trayOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
              <path d="M6 9l6 6 6-6" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Tray cards — only visible when open */}
        {trayOpen && (
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingLeft: 16, paddingRight: 16, paddingBottom: 16, scrollbarWidth: 'none' as const, height: 140 }}>
            {nearbyRestaurants.map(r => (
              <motion.button key={r.id} whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setPopupRestaurant(r)
                  if (map) map.panTo({ lat: r.latitude, lng: r.longitude })
                  setTrayOpen(false)
                }}
                style={{
                  flexShrink: 0, width: 120, borderRadius: 12, overflow: 'hidden', background: '#1f2937',
                  border: `1.5px solid ${popupRestaurant?.id === r.id ? '#0048f9' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer', textAlign: 'left', padding: 0,
                  boxShadow: popupRestaurant?.id === r.id ? '0 4px 16px rgba(0,72,249,0.3)' : 'none',
                }}>
                <div style={{ height: 72 }}>
                  <img src={r.image_url} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '6px 8px 8px' }}>
                  <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 10, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </p>
                  <p style={{ fontFamily: 'Open Sans', fontSize: 9, color: 'rgba(255,255,255,0.4)', margin: '1px 0 0' }}>
                    {CUISINE_EMOJI[r.cuisine] ?? '🍽️'} {r.cuisine}
                  </p>
                  {r.rating && <p style={{ fontFamily: 'Open Sans', fontSize: 9, color: '#fbbf24', margin: '1px 0 0', fontWeight: 600 }}>★ {r.rating.toFixed(1)}</p>}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Full detail sheet */}
      <AnimatePresence>
        {showDetail && selectedRestaurant && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 300 }}>
            <RestaurantDetail
              restaurant={selectedRestaurant}
              onClose={() => { setShowDetail(false); setSelectedRestaurant(null) }}
              isFavorite={favorites.has(selectedRestaurant.id)}
              onToggleFavorite={() => toggleFavorite(selectedRestaurant.id)}
            />
          </div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
