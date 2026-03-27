import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function makeIcon(color: string, emoji: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:42px;height:42px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 3px 12px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-size:17px;cursor:pointer;">${emoji}</div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  })
}

function getIcon(cuisine: string, isFavorite: boolean) {
  const emojiMap: Record<string, string> = {
    Coffee: '☕', Cafe: '☕', Japanese: '🍣', Italian: '🍕',
    American: '🍔', Music: '🎵', Jazz: '🎷', Mexican: '🌮',
  }
  const emoji = emojiMap[cuisine] ?? '🍽️'
  return makeIcon(isFavorite ? '#E11D48' : '#071126', emoji)
}

const LOCATIONS = {
  'Los Angeles, CA': { lat: 34.0522, lng: -118.2437, zoom: 11 },
  'Orange County, CA': { lat: 33.7175, lng: -117.8311, zoom: 11 },
}
type LocationKey = keyof typeof LOCATIONS

const FILTERS = ['All', 'Favorites', 'Coffee', 'Music', 'Jazz', 'American', 'Italian', 'Japanese', 'Cafe']

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 })
  }, [center, zoom, map])
  return null
}

// Load/save favorites from localStorage
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

export default function MapViewScreen() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeLocation, setActiveLocation] = useState<LocationKey>('Los Angeles, CA')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  // Track top bar height so map can offset correctly
  const [topBarHeight, setTopBarHeight] = useState(120)
  const topBarRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  const loc = LOCATIONS[activeLocation]

  // Auto-fit map to show all filtered pins when filter changes
  function AutoFitMap({ restaurants }: { restaurants: Restaurant[] }) {
    const map = useMap()
    useEffect(() => {
      if (restaurants.length === 0) return
      const bounds = L.latLngBounds(restaurants.map(r => [r.latitude, r.longitude]))
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 })
    }, [restaurants.length])
    return null
  }

  useEffect(() => {
    fetchRestaurants()
  }, [])

  // Measure actual top bar height
  useEffect(() => {
    if (topBarRef.current) {
      setTopBarHeight(topBarRef.current.offsetHeight)
    }
  }, [])

  async function fetchRestaurants() {
    const { data, error } = await supabase.from('restaurants').select('*')
    if (error) console.error(error)
    else setRestaurants(data ?? [])
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

  const filtered = restaurants.filter((r) => {
    if (activeFilter === 'Favorites') return favorites.has(r.id)
    if (activeFilter === 'All') return true
    return r.cuisine.toLowerCase() === activeFilter.toLowerCase()
  })

  return (
    <div className="fixed inset-0" style={{ background: '#f0f0f0' }}>

      {/* ── Top bar — sits above map ── */}
      <div
        ref={topBarRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000, // must beat Leaflet's 400
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          paddingTop: 48,
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Home button */}
          <button
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="#071126" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: 'Bungee, cursive', color: '#071126', fontSize: 15, letterSpacing: '0.05em' }}>
              PlatePost
            </span>
          </button>

          {/* Location switcher */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowLocationPicker((p) => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                borderRadius: 999, padding: '6px 12px',
                background: '#EEF2FF', border: '1px solid #c7d2fe',
                color: '#071126', fontFamily: 'Manrope, sans-serif',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4576EF" />
              </svg>
              {activeLocation}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
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
                    position: 'absolute', right: 0, top: 40,
                    borderRadius: 12, overflow: 'hidden', zIndex: 2000,
                    background: '#fff', border: '1px solid #e0e7ff',
                    minWidth: 200, boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                  }}
                >
                  {(Object.keys(LOCATIONS) as LocationKey[]).map((locKey) => (
                    <button
                      key={locKey}
                      onClick={() => { setActiveLocation(locKey); setShowLocationPicker(false) }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '12px 16px',
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

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' as const, paddingBottom: 2 }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 999,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
                background: activeFilter === f ? '#071126' : '#fff',
                color: activeFilter === f ? '#fff' : '#444',
                border: activeFilter === f ? '1px solid #071126' : '1px solid #ddd',
                transition: 'all 0.15s',
              }}
            >
              {f === 'Favorites' ? '❤️ Saved' : f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Map — full screen, top padding accounts for header ── */}
      <div style={{ position: 'absolute', inset: 0, top: topBarHeight }}>
        <MapContainer
          center={[loc.lat, loc.lng]}
          zoom={loc.zoom}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          ref={mapRef}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapController center={[loc.lat, loc.lng]} zoom={loc.zoom} />
          <AutoFitMap restaurants={filtered} />

          {filtered.map((r) => (
            <Marker
              key={r.id}
              position={[r.latitude, r.longitude]}
              icon={getIcon(r.cuisine, favorites.has(r.id))}
              eventHandlers={{ click: () => setSelectedRestaurant(r) }}
            />
          ))}
        </MapContainer>
      </div>

      {/* ── Bottom tab bar ── */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingBottom: 32, paddingTop: 16,
          background: 'linear-gradient(to top, rgba(255,255,255,0.97) 55%, transparent)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center',
            borderRadius: 999, overflow: 'hidden',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 999,
              background: '#071126', color: '#fff',
              fontSize: 13, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" />
            </svg>
            Map
          </div>

          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />

          <button
            onClick={() => navigate('/list')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', background: 'none', border: 'none',
              cursor: 'pointer', color: 'rgba(0,0,0,0.45)',
              fontSize: 13, fontWeight: 600, fontFamily: 'Manrope, sans-serif',
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
          <div style={{ position: 'absolute', inset: 0, zIndex: 1500 }}>
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
