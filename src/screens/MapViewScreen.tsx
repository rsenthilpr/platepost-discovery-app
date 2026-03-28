import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY

// Load favorites from localStorage
function loadFavorites(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem('pp_favorites') ?? '[]')) } catch { return new Set() }
}
function saveFavorites(f: Set<number>) {
  localStorage.setItem('pp_favorites', JSON.stringify([...f]))
}

// Clean Google Maps style — minimal, like the real Google Maps app
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
}

const LOCATIONS = {
  'Los Angeles, CA': { lat: 34.0522, lng: -118.2437, zoom: 11 },
  'Orange County, CA': { lat: 33.7175, lng: -117.8311, zoom: 11 },
}
type LocationKey = keyof typeof LOCATIONS

const FILTERS = ['All', 'Favorites', 'Coffee', 'Music', 'Jazz', 'American', 'Italian', 'Japanese', 'Cafe']

export default function MapViewScreen() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeLocation, setActiveLocation] = useState<LocationKey>('Los Angeles, CA')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const [mapSearch, setMapSearch] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState<Restaurant[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [topBarHeight, setTopBarHeight] = useState(140)
  const topBarRef = useRef<HTMLDivElement>(null)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: ['places'],
  })

  const loc = LOCATIONS[activeLocation]

  useEffect(() => {
    supabase.from('restaurants').select('*').then(({ data }) => {
      setRestaurants(data ?? [])
    })
  }, [])

  // Update suggestions as user types
  useEffect(() => {
    if (!mapSearch.trim() || mapSearch.length < 2) {
      setSearchSuggestions([])
      setShowSuggestions(false)
      return
    }
    const q = mapSearch.toLowerCase()
    const matches = restaurants
      .filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q)
      )
      .slice(0, 5)
    setSearchSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }, [mapSearch, restaurants])

  useEffect(() => {
    if (topBarRef.current) setTopBarHeight(topBarRef.current.offsetHeight)
  }, [])

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
  }, [])

  // Auto-fit to CA restaurants when filter changes
  useEffect(() => {
    if (!map || filtered.length === 0) return
    const caRestaurants = filtered.filter(r =>
      r.latitude >= 32 && r.latitude <= 35.5 &&
      r.longitude >= -119.5 && r.longitude <= -116
    )
    const toFit = caRestaurants.length > 0 ? caRestaurants : filtered
    if (toFit.length === 1) {
      map.setCenter({ lat: toFit[0].latitude, lng: toFit[0].longitude })
      map.setZoom(14)
    } else if (toFit.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      toFit.forEach(r => bounds.extend({ lat: r.latitude, lng: r.longitude }))
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 })
    }
  }, [activeFilter, activeLocation, restaurants.length])

  const filtered = restaurants.filter(r => {
    if (activeFilter === 'Favorites') return favorites.has(r.id)
    if (activeFilter !== 'All' && r.cuisine.toLowerCase() !== activeFilter.toLowerCase()) return false
    if (mapSearch.trim()) {
      const q = mapSearch.toLowerCase()
      return r.name.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q)
    }
    return true
  })

  if (loadError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#f5f5f5' }}>
        <p style={{ fontFamily: 'Manrope', color: '#666' }}>Failed to load Google Maps. Check your API key.</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0" style={{ background: '#f0f0f0' }}>

      {/* ── Top bar ── */}
      <div
        ref={topBarRef}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          zIndex: 100,
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          paddingTop: 48, paddingBottom: 10,
          paddingLeft: 16, paddingRight: 16,
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          {/* PlatePost logo */}
          <button
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {/* PlatePost logo mark with spoon cutout */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 3.5L20 12L5 20.5V3.5Z" fill="#071126" />
              <ellipse cx="11" cy="9.5" rx="2.2" ry="2.8" fill="white" />
              <rect x="10.1" y="12" width="1.8" height="3.5" rx="0.9" fill="white" />
            </svg>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: '#071126', fontSize: 15, letterSpacing: '-0.01em' }}>
              PlatePost
            </span>
          </button>

          {/* Location switcher */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowLocationPicker(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                borderRadius: 999, padding: '5px 10px',
                background: '#EEF2FF', border: '1px solid #c7d2fe',
                color: '#071126', fontFamily: 'Manrope, sans-serif',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4576EF" />
              </svg>
              {activeLocation}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>

            <AnimatePresence>
              {showLocationPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute', right: 0, top: 38,
                    borderRadius: 12, overflow: 'hidden', zIndex: 200,
                    background: '#fff', border: '1px solid #e0e7ff',
                    minWidth: 180, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  }}
                >
                  {(Object.keys(LOCATIONS) as LocationKey[]).map(locKey => (
                    <button
                      key={locKey}
                      onClick={() => { setActiveLocation(locKey); setShowLocationPicker(false) }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px',
                        fontSize: 13, fontFamily: 'Manrope, sans-serif', cursor: 'pointer',
                        color: activeLocation === locKey ? '#4576EF' : '#071126',
                        background: activeLocation === locKey ? '#EEF2FF' : 'transparent',
                        border: 'none',
                      }}
                    >
                      {locKey}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#f5f5f5', borderRadius: 10,
          padding: '8px 12px', marginBottom: 8,
          border: '1px solid #ebebeb',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" stroke="#071126" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={mapSearch}
            onChange={e => setMapSearch(e.target.value)}
            placeholder="Search restaurants, cuisines..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'Manrope, sans-serif', fontSize: 13, color: '#071126',
            }}
          />
          {mapSearch && (
            <button onClick={() => { setMapSearch(''); setShowSuggestions(false) }}
              style={{ opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Search suggestions dropdown */}
        {showSuggestions && (
          <div style={{
            position: 'absolute', top: '100%', left: 16, right: 16,
            background: '#fff', borderRadius: 12, zIndex: 300,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            border: '1px solid #ebebeb', overflow: 'hidden',
            marginTop: 4,
          }}>
            {searchSuggestions.map((r, i) => (
              <button
                key={r.id}
                onClick={() => {
                  setMapSearch(r.name)
                  setShowSuggestions(false)
                  if (map) {
                    map.setCenter({ lat: r.latitude, lng: r.longitude })
                    map.setZoom(15)
                  }
                  setSelectedRestaurant(r)
                }}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid #f5f5f5' : 'none',
                  fontFamily: 'Manrope, sans-serif',
                }}
              >
                <span style={{ fontSize: 16 }}>{
                  {'Coffee': '☕', 'Cafe': '☕', 'Japanese': '🍣', 'Italian': '🍕',
                   'American': '🍔', 'Music': '🎵', 'Jazz': '🎷'}[r.cuisine] ?? '🍽️'
                }</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#071126', margin: 0 }}>{r.name}</p>
                  <p style={{ fontSize: 11, color: '#999', margin: 0 }}>{r.cuisine} · {r.city}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', scrollbarWidth: 'none' as const }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                flexShrink: 0, padding: '5px 12px', borderRadius: 999,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif', transition: 'all 0.15s',
                background: activeFilter === f ? '#071126' : '#fff',
                color: activeFilter === f ? '#fff' : '#444',
                border: activeFilter === f ? '1px solid #071126' : '1px solid #ddd',
              }}
            >
              {f === 'Favorites' ? '❤️ Saved' : f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Google Map ── */}
      <div style={{ position: 'absolute', inset: 0, top: topBarHeight }}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={{ lat: loc.lat, lng: loc.lng }}
            zoom={loc.zoom}
            onLoad={onMapLoad}
            options={{
              styles: MAP_STYLES,
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              clickableIcons: false,
            }}
          >
            {filtered.map(r => (
              <OverlayView
                key={r.id}
                position={{ lat: r.latitude, lng: r.longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  onClick={() => setSelectedRestaurant(r)}
                  style={{
                    width: 44, height: 44,
                    borderRadius: '50%',
                    background: favorites.has(r.id) ? '#E11D48' : '#071126',
                    border: '3px solid white',
                    boxShadow: selectedRestaurant?.id === r.id
                      ? '0 0 0 3px #4576EF, 0 4px 16px rgba(0,0,0,0.3)'
                      : '0 4px 16px rgba(0,0,0,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 18,
                    transform: 'translate(-50%, -50%)',
                    transition: 'box-shadow 0.2s, background 0.2s',
                  }}
                >
                  {CUISINE_EMOJI[r.cuisine] ?? '🍽️'}
                </motion.div>
              </OverlayView>
            ))}
          </GoogleMap>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: '#4576EF' }} />
          </div>
        )}
      </div>

      {/* ── Results count ── */}
      {filtered.length > 0 && (
        <div
          style={{
            position: 'absolute', top: topBarHeight + 12, right: 12,
            zIndex: 50, background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(8px)', borderRadius: 8,
            padding: '4px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            fontFamily: 'Manrope', fontSize: 11, fontWeight: 600, color: '#444',
          }}
        >
          {filtered.length} place{filtered.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* ── Bottom tab bar ── */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingBottom: 32, paddingTop: 16,
          background: 'linear-gradient(to top, rgba(255,255,255,0.97) 55%, transparent)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', borderRadius: 999,
            overflow: 'hidden', pointerEvents: 'auto',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 999,
            background: '#071126', color: '#fff',
            fontSize: 13, fontWeight: 700, fontFamily: 'Manrope',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" />
            </svg>
            Map
          </div>
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.08)' }} />
          <button
            onClick={() => navigate('/list')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', background: 'none', border: 'none',
              cursor: 'pointer', color: 'rgba(0,0,0,0.4)',
              fontSize: 13, fontWeight: 600, fontFamily: 'Manrope',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <polygon points="5,3 19,12 5,21" fill="currentColor" />
            </svg>
            Feed
          </button>
        </div>
      </div>

      {/* ── Restaurant Detail Sheet ── */}
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
