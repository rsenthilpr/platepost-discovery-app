import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? import.meta.env.VITE_GOOGLE_PLACES_KEY
const PLATEPOST_IDS = new Set([4, 5, 17, 18])
const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places']
const LA_CENTER = { lat: 34.0522, lng: -118.2437 }

function loadFavorites(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem('pp_favorites') ?? '[]')) } catch { return new Set() }
}
function saveFavorites(f: Set<number>) {
  localStorage.setItem('pp_favorites', JSON.stringify([...f]))
}

// Distance in km between two lat/lng points
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const MAP_STYLES = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8f8f8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e9f6' }] },
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

// Tray height constants
const TRAY_COLLAPSED = 52   // just the pull tab
const TRAY_OPEN = 210       // tab + cards visible

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
  const [currentZoom, setCurrentZoom] = useState(13)
  const zoomRef = useRef(13)
  const [mapCenter, setMapCenter] = useState(LA_CENTER)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [trayOpen, setTrayOpen] = useState(true)   // open by default like Google Maps
  const [noNearbyResults, setNoNearbyResults] = useState(false)
  const topBarRef = useRef<HTMLDivElement>(null)
  const [topBarHeight, setTopBarHeight] = useState(160)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  useEffect(() => {
    supabase.from('restaurants').select('*').then(({ data }) => setRestaurants(data ?? []))
    requestUserLocation()
  }, [])

  useEffect(() => {
    if (topBarRef.current) setTopBarHeight(topBarRef.current.offsetHeight)
  }, [])

  function requestUserLocation() {
    if (!navigator.geolocation) return
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setMapCenter(loc)
        // Zoom to level 12 — wide enough to see nearby restaurants in ~10mi radius
        if (map) { map.setCenter(loc); map.setZoom(12) }
        setLocationLoading(false)
      },
      () => setLocationLoading(false),
      { timeout: 8000 }
    )
  }

  // Filtered restaurants
  const filtered = restaurants.filter(r => {
    if (activeFilter === 'Saved') return favorites.has(r.id)
    if (activeFilter !== 'All' && r.cuisine.toLowerCase() !== activeFilter.toLowerCase()) return false
    if (mapSearch.trim()) {
      const q = mapSearch.toLowerCase()
      return r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.city.toLowerCase().includes(q)
    }
    return true
  })

  // Nearby tray logic:
  // If user has a real location, check if any restaurants are within 80km.
  // If none nearby, fall back to LA restaurants with a banner message.
  const nearbyRestaurants = (() => {
    const center = userLocation ?? mapCenter

    if (userLocation) {
      // Sort by distance from user
      const withDist = filtered.map(r => ({
        r,
        dist: distanceKm(userLocation.lat, userLocation.lng, r.latitude, r.longitude)
      })).sort((a, b) => a.dist - b.dist)

      // Check if any are within 80km
      const within80 = withDist.filter(x => x.dist <= 80)

      if (within80.length === 0) {
        // No restaurants near user — fall back to LA
        setNoNearbyResults(true)
        const laRestaurants = [...filtered].sort((a, b) => {
          const da = Math.pow(a.latitude - LA_CENTER.lat, 2) + Math.pow(a.longitude - LA_CENTER.lng, 2)
          const db = Math.pow(b.latitude - LA_CENTER.lat, 2) + Math.pow(b.longitude - LA_CENTER.lng, 2)
          return da - db
        })
        const pro = laRestaurants.filter(r => PLATEPOST_IDS.has(r.id))
        const rest = laRestaurants.filter(r => !PLATEPOST_IDS.has(r.id))
        return [...pro, ...rest].slice(0, 20)
      } else {
        setNoNearbyResults(false)
        const sorted = withDist.map(x => x.r)
        const pro = sorted.filter(r => PLATEPOST_IDS.has(r.id))
        const rest = sorted.filter(r => !PLATEPOST_IDS.has(r.id))
        return [...pro, ...rest].slice(0, 20)
      }
    }

    // No user location — sort by distance from map center (LA by default)
    const sorted = [...filtered].sort((a, b) => {
      const da = Math.pow(a.latitude - center.lat, 2) + Math.pow(a.longitude - center.lng, 2)
      const db = Math.pow(b.latitude - center.lat, 2) + Math.pow(b.longitude - center.lng, 2)
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
    if (userLocation) {
      map.setCenter(userLocation); map.setZoom(12); return
    }
    const ca = filtered.filter(r => r.latitude >= 32 && r.latitude <= 35.5 && r.longitude >= -119.5 && r.longitude <= -116)
    const toFit = ca.length > 0 ? ca : filtered
    if (toFit.length === 1) {
      map.setCenter({ lat: toFit[0].latitude, lng: toFit[0].longitude }); map.setZoom(14)
    } else if (toFit.length > 1) {
      const bounds = new window.google.maps.LatLngBounds()
      toFit.forEach(r => bounds.extend({ lat: r.latitude, lng: r.longitude }))
      map.fitBounds(bounds, { top: 60, bottom: 200, left: 20, right: 20 })
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
    mapInstance.addListener('zoom_changed', () => {
      const z = mapInstance.getZoom() ?? 13
      zoomRef.current = z
      setCurrentZoom(z)
    })
    let centerTimer: ReturnType<typeof setTimeout> | null = null
    mapInstance.addListener('center_changed', () => {
      if (centerTimer) clearTimeout(centerTimer)
      centerTimer = setTimeout(() => {
        const c = mapInstance.getCenter()
        if (c) setMapCenter({ lat: c.lat(), lng: c.lng() })
      }, 400)
    })
  }, [])

  if (loadError) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ background: '#f5f5f5' }}>
      <p style={{ fontFamily: 'Open Sans', color: '#666', fontSize: 14 }}>Map failed to load.</p>
      <p style={{ fontFamily: 'Open Sans', color: '#999', fontSize: 12 }}>Check that VITE_GOOGLE_MAPS_KEY is set in Vercel.</p>
    </div>
  )

  const trayHeight = trayOpen ? TRAY_OPEN : TRAY_COLLAPSED

  return (
    <div className="fixed inset-0" style={{ background: '#f0f0f0', fontFamily: 'Open Sans, sans-serif' }}>

      {/* Top bar */}
      <div ref={topBarRef} style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(12px)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
        paddingTop: 48, paddingBottom: 10, paddingLeft: 16, paddingRight: 16,
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={() => navigate('/')} style={{
            width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #e5e7eb',
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="#071126" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <img src="/pp-logo.png" alt="PlatePost" style={{ height: 'clamp(18px, 4.5vw, 22px)', width: 'auto', objectFit: 'contain', display: 'block' }} />
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'Open Sans', fontSize: 12, fontWeight: 600, color: '#888' }}>
            {filtered.length} places
          </span>
        </div>

        {/* Search */}
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
              placeholder="Search restaurants, cuisines, neighborhoods..."
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
                    <p style={{ fontWeight: 600, color: '#071126', margin: 0, fontSize: 13 }}>{r.name}</p>
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
              flexShrink: 0, padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Open Sans', transition: 'all 0.15s',
              background: activeFilter === f ? '#0048f9' : '#fff',
              color: activeFilter === f ? '#fff' : '#444',
              border: activeFilter === f ? '1px solid #0048f9' : '1px solid #ddd',
            }}>
              {f === 'Saved' ? '❤️ Saved' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Map — bottom adjusts with tray */}
      <div style={{
        position: 'absolute', inset: 0,
        top: topBarHeight,
        bottom: trayHeight,
        transition: 'bottom 0.3s ease',
      }}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={userLocation ?? LA_CENTER}
            zoom={13}
            onLoad={onMapLoad}
            options={{
              styles: MAP_STYLES,
              disableDefaultUI: true,
              // Show only zoom control, positioned bottom-right (above our tray)
              zoomControl: true,
              zoomControlOptions: {
                position: typeof google !== 'undefined' ? google.maps.ControlPosition.RIGHT_BOTTOM : undefined,
              },
              scrollwheel: true,
              gestureHandling: 'greedy',
              clickableIcons: false,
            }}
          >
            {/* Restaurant markers */}
            {clusterRestaurants(filtered, currentZoom).map((cluster) => {
              const r = cluster.restaurant
              const isPro = PLATEPOST_IDS.has(r.id)
              const isFav = favorites.has(r.id)
              const isSelected = selectedRestaurant?.id === r.id
              const isCluster = cluster.count > 1
              return (
                <OverlayView
                  key={`${r.id}-${cluster.lat}-${cluster.lng}`}
                  position={{ lat: cluster.lat, lng: cluster.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    onClick={() => {
                      if (isCluster && map) {
                        map.setZoom((map.getZoom() ?? 11) + 2)
                        map.panTo({ lat: cluster.lat, lng: cluster.lng })
                      } else {
                        setSelectedRestaurant(r)
                      }
                    }}
                    style={{
                      width: isCluster ? 46 : isPro ? 46 : isSelected ? 48 : 38,
                      height: isCluster ? 46 : isPro ? 46 : isSelected ? 48 : 38,
                      borderRadius: '50%',
                      background: isCluster ? '#0048f9' : isPro ? '#0048f9' : isFav ? '#E11D48' : isSelected ? '#0048f9' : '#fff',
                      border: `3px solid ${isPro || isCluster ? '#fff' : isSelected ? '#0048f9' : isFav ? '#fff' : '#e5e7eb'}`,
                      boxShadow: isPro || isSelected || isCluster ? '0 4px 16px rgba(0,72,249,0.4)' : '0 2px 8px rgba(0,0,0,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transform: 'translate(-50%, -50%)',
                      zIndex: isPro ? 10 : isSelected ? 9 : isCluster ? 5 : 1, transition: 'all 0.2s',
                    }}
                  >
                    {isCluster ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'Open Sans' }}>{cluster.count}</span>
                    ) : isPro ? (
                      <img src="/pp-mark.png" alt="" width={18} height={18} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                    ) : (
                      <span style={{ fontSize: isSelected ? 20 : 16 }}>{CUISINE_EMOJI[r.cuisine] ?? '🍽️'}</span>
                    )}
                  </motion.div>
                </OverlayView>
              )
            })}

            {/* User location blue dot */}
            {userLocation && (
              <OverlayView position={userLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#0048f9', border: '3px solid #fff',
                  boxShadow: '0 0 0 4px rgba(0,72,249,0.25)',
                  transform: 'translate(-50%, -50%)',
                }} />
              </OverlayView>
            )}
          </GoogleMap>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: '#0048f9', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </div>

      {/* Near Me button — right side, above zoom controls */}
      <div style={{
        position: 'absolute',
        bottom: trayHeight + 64,  // sits above the Google zoom buttons
        right: 10,
        zIndex: 50,
        transition: 'bottom 0.3s ease',
      }}>
        <button
          onClick={requestUserLocation}
          title="Show my location"
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: userLocation ? '#0048f9' : '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {locationLoading ? (
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.1)', borderTopColor: '#0048f9', animation: 'spin 1s linear infinite' }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" fill={userLocation ? '#fff' : '#0048f9'} />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke={userLocation ? '#fff' : '#0048f9'} strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="8" stroke={userLocation ? '#fff' : '#0048f9'} strokeWidth="1.5" opacity="0.4" />
            </svg>
          )}
        </button>
      </div>

      {/* Restaurant Tray — starts open, collapsible */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: '#fff',
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        boxShadow: '0 -2px 16px rgba(0,0,0,0.10)',
        overflow: 'hidden',
        height: trayHeight,
        transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Pull tab row — always visible */}
        <button
          onClick={() => setTrayOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px', background: 'transparent', border: 'none', cursor: 'pointer',
            height: TRAY_COLLAPSED, flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Drag pill — centered at top */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d1d5db' }} />
            <div>
              <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 13, color: '#071126', margin: 0, lineHeight: 1.2 }}>
                Nearby · {nearbyRestaurants.length} places
              </p>
              {/* Fallback banner when no local results */}
              {noNearbyResults && userLocation && (
                <p style={{ fontFamily: 'Open Sans', fontSize: 10, color: '#f59e0b', margin: 0, fontWeight: 600 }}>
                  No restaurants near you · Showing Los Angeles
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={e => { e.stopPropagation(); navigate('/list') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                borderRadius: 999, background: '#071126', border: 'none', cursor: 'pointer',
                fontFamily: 'Open Sans', fontSize: 11, fontWeight: 600, color: '#fff',
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
              Feed
            </button>
            {/* Chevron rotates with tray state */}
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              style={{ transform: trayOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', flexShrink: 0 }}
            >
              <path d="M6 9l6 6 6-6" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {/* Cards row — visible when open */}
        {trayOpen && (
          <div style={{ position: 'relative', height: TRAY_OPEN - TRAY_COLLAPSED }}>
            <div
              style={{
                display: 'flex', gap: 10,
                overflowX: 'auto', overflowY: 'hidden',
                paddingLeft: 16, paddingRight: 40,  // extra right pad to show scroll hint
                paddingBottom: 16,
                height: '100%',
                scrollbarWidth: 'none' as const,
                WebkitOverflowScrolling: 'touch' as any,
                alignItems: 'flex-start',
              }}
            >
              {nearbyRestaurants.map(r => {
                const isPro = PLATEPOST_IDS.has(r.id)
                const isSelected = selectedRestaurant?.id === r.id
                return (
                  <motion.button
                    key={r.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedRestaurant(r)
                      if (map) map.panTo({ lat: r.latitude, lng: r.longitude })
                    }}
                    style={{
                      flexShrink: 0, width: 130, borderRadius: 14, overflow: 'hidden',
                      background: isPro ? '#0a1628' : '#fff',
                      border: `2px solid ${isSelected ? '#0048f9' : '#f0f0f0'}`,
                      cursor: 'pointer', textAlign: 'left', padding: 0,
                      boxShadow: isSelected
                        ? '0 4px 16px rgba(0,72,249,0.25)'
                        : isPro
                        ? '0 2px 12px rgba(0,72,249,0.15)'
                        : '0 2px 8px rgba(0,0,0,0.07)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ position: 'relative', height: 80, background: '#111' }}>
                      <img
                        src={r.image_url} alt={r.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {isPro && (
                        <div style={{ position: 'absolute', top: 5, left: 5, background: '#0048f9', borderRadius: 6, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <img src="/pp-mark.png" alt="" width={8} height={8} style={{ filter: 'brightness(0) invert(1)', objectFit: 'contain' }} />
                          <span style={{ fontFamily: 'Open Sans', color: '#fff', fontSize: 8, fontWeight: 700 }}>PRO</span>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '7px 8px 9px' }}>
                      <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 11, color: isPro ? '#fff' : '#071126', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name}
                      </p>
                      <p style={{ fontFamily: 'Open Sans', fontSize: 10, color: isPro ? 'rgba(255,255,255,0.55)' : '#9ca3af', margin: '2px 0 0' }}>
                        {CUISINE_EMOJI[r.cuisine] ?? '🍽️'} {r.cuisine}
                      </p>
                      {r.rating && (
                        <p style={{ fontFamily: 'Open Sans', fontSize: 10, color: '#FBBF24', margin: '2px 0 0', fontWeight: 600 }}>
                          ★ {r.rating.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {/* Scroll gradient hint — right edge fade showing more cards exist */}
            <div style={{
              position: 'absolute', top: 0, right: 0, bottom: 0, width: 40,
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.95))',
              pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
            }}>
              {/* Animated right arrow hint */}
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* Restaurant Detail sheet */}
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
