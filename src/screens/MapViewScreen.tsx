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

// Clean circular pin icon
function makeIcon(color: string, emoji: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        cursor: pointer;
      ">${emoji}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

function getIcon(cuisine: string) {
  const emojiMap: Record<string, string> = {
    Coffee: '☕',
    Cafe: '☕',
    Japanese: '🍣',
    Italian: '🍕',
    American: '🍔',
    Music: '🎵',
    Jazz: '🎷',
    Mexican: '🌮',
  }
  const emoji = emojiMap[cuisine] ?? '🍽️'
  return makeIcon('#071126', emoji)
}

const LOCATIONS = {
  'Los Angeles, CA': { lat: 34.0522, lng: -118.2437, zoom: 11 },
  'Orange County, CA': { lat: 33.7175, lng: -117.8311, zoom: 11 },
  'Minneapolis, MN': { lat: 44.9778, lng: -93.265, zoom: 12 },
}
type LocationKey = keyof typeof LOCATIONS

const FILTERS = ['All', 'Coffee', 'Japanese', 'Italian', 'American', 'Music', 'Jazz']

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 })
  }, [center, zoom, map])
  return null
}

export default function MapViewScreen() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeLocation, setActiveLocation] = useState<LocationKey>('Los Angeles, CA')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const mapRef = useRef<L.Map | null>(null)

  const loc = LOCATIONS[activeLocation]

  useEffect(() => {
    fetchRestaurants()
  }, [])

  async function fetchRestaurants() {
    const { data, error } = await supabase.from('restaurants').select('*')
    if (error) console.error(error)
    else setRestaurants(data ?? [])
  }

  const filtered = restaurants.filter((r) => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'DJs') return r.cuisine === 'Music'
    return r.cuisine.toLowerCase() === activeFilter.toLowerCase()
  })

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#f5f5f5' }}>

      {/* ── Top bar ── */}
      <div
        className="absolute top-0 left-0 right-0 z-20 pt-12 px-4 pb-3 flex flex-col gap-3"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex items-center justify-between">
          {/* Back to home */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <polygon points="5,3 19,12 5,21" fill="#071126" />
            </svg>
            <span style={{ fontFamily: 'Bungee, cursive', color: '#071126', fontSize: 16, letterSpacing: '0.05em' }}>
              PlatePost
            </span>
          </button>

          {/* Location switcher */}
          <div className="relative">
            <button
              onClick={() => setShowLocationPicker((p) => !p)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: '#EEF2FF',
                border: '1px solid #c7d2fe',
                color: '#071126',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
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
                  className="absolute right-0 top-10 rounded-xl overflow-hidden z-50"
                  style={{
                    background: '#fff',
                    border: '1px solid #e0e7ff',
                    minWidth: 200,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                  }}
                >
                  {(Object.keys(LOCATIONS) as LocationKey[]).map((locKey) => (
                    <button
                      key={locKey}
                      onClick={() => { setActiveLocation(locKey); setShowLocationPicker(false) }}
                      className="w-full text-left px-4 py-3 text-sm transition-colors"
                      style={{
                        fontFamily: 'Manrope, sans-serif',
                        color: activeLocation === locKey ? '#4576EF' : '#071126',
                        background: activeLocation === locKey ? '#EEF2FF' : 'transparent',
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
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                fontFamily: 'Manrope, sans-serif',
                background: activeFilter === f ? '#071126' : '#fff',
                color: activeFilter === f ? '#fff' : '#444',
                border: activeFilter === f ? '1px solid #071126' : '1px solid #ddd',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 w-full">
        <MapContainer
          center={[loc.lat, loc.lng]}
          zoom={loc.zoom}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          ref={mapRef}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          <MapController center={[loc.lat, loc.lng]} zoom={loc.zoom} />

          {filtered.map((r) => (
            <Marker
              key={r.id}
              position={[r.latitude, r.longitude]}
              icon={getIcon(r.cuisine)}
              eventHandlers={{
                click: () => setSelectedRestaurant(r),
              }}
            />
          ))}
        </MapContainer>
      </div>

      {/* ── Bottom tab bar ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center pb-8 pt-4"
        style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.97) 55%, transparent)' }}
      >
        <div
          className="flex items-center rounded-full overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          }}
        >
          {/* Map tab — active */}
          <div
            className="flex items-center gap-2 px-5 py-2.5 rounded-full"
            style={{
              background: '#071126',
              fontFamily: 'Manrope, sans-serif',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" />
            </svg>
            Map
          </div>

          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />

          {/* Feed tab */}
          <button
            onClick={() => navigate('/list')}
            className="flex items-center gap-2 px-5 py-2.5"
            style={{
              fontFamily: 'Manrope, sans-serif',
              color: 'rgba(0,0,0,0.45)',
              fontSize: 13,
              fontWeight: 600,
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
          <RestaurantDetail
            restaurant={selectedRestaurant}
            onClose={() => setSelectedRestaurant(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
