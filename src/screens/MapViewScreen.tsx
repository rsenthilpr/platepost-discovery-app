import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
// useRef kept for future mapRef usage
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

// Fix Leaflet default icon paths broken by bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom pin icon factory — emoji varies by cuisine
function makeIcon(color: string, emoji: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:40px; height:50px; position:relative; display:flex;
        flex-direction:column; align-items:center;
      ">
        <div style="
          width:40px; height:40px; border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          background:${color};
          box-shadow:0 4px 16px rgba(0,0,0,0.3);
          display:flex; align-items:center; justify-content:center;
          border:2px solid white;
        ">
          <div style="transform:rotate(45deg); font-size:18px; line-height:1;">${emoji}</div>
        </div>
        <div style="
          width:0; height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:8px solid ${color};
          margin-top:-2px;
        "></div>
      </div>`,
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -50],
  })
}

function getIcon(cuisine: string, tier: string) {
  const isPro = tier === 'pro'
  const color = isPro ? '#4576EF' : '#FF6B35'
  const emojiMap: Record<string, string> = {
    Coffee: '☕',
    Cafe: '☕',
    Japanese: '🍣',
    Italian: '🍕',
    American: '🍔',
    Music: '🎵',
    Jazz: '🎷',
  }
  const emoji = emojiMap[cuisine] ?? '🍽️'
  return makeIcon(color, emoji)
}

// Location presets
const LOCATIONS = {
  'Orange County, CA': { lat: 33.7175, lng: -117.8311, zoom: 11 },
  'Minneapolis, MN': { lat: 44.9778, lng: -93.265, zoom: 12 },
}
type LocationKey = keyof typeof LOCATIONS

const FILTERS = ['All', 'Coffee', 'DJs', 'Jazz', 'Music']

// Animates map to a new center/zoom
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
  const [activeLocation, setActiveLocation] = useState<LocationKey>('Orange County, CA')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const mapRef = useRef<L.Map | null>(null)

  const loc = LOCATIONS[activeLocation]

  useEffect(() => {
    fetchRestaurants()
  }, [])

  async function fetchRestaurants() {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
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
          boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h1
            className="text-lg"
            style={{ fontFamily: 'Bungee, cursive', color: '#071126', letterSpacing: '0.05em' }}
          >
            PlatePost
          </h1>

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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4576EF" />
                <circle cx="12" cy="9" r="2.5" fill="white" />
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
                    minWidth: 180,
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
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
              style={{
                fontFamily: 'Manrope, sans-serif',
                background: activeFilter === f ? '#4576EF' : '#fff',
                color: activeFilter === f ? '#fff' : '#444',
                border: activeFilter === f ? '1px solid #4576EF' : '1px solid #ddd',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <MapController center={[loc.lat, loc.lng]} zoom={loc.zoom} />

          {filtered.map((r) => (
            <Marker
              key={r.id}
              position={[r.latitude, r.longitude]}
              icon={getIcon(r.cuisine, r.tier)}
              eventHandlers={{
                click: () => setSelectedRestaurant(r),
              }}
            >
              <Popup className="platepost-popup">
                <div
                  className="p-2"
                  style={{ fontFamily: 'Manrope, sans-serif', minWidth: 160 }}
                >
                  <p className="font-bold text-sm">{r.name}</p>
                  <p className="text-xs opacity-70">{r.cuisine} · {r.city}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>


      {/* ── Bottom bar ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center pb-10 pt-4"
        style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.97) 55%, transparent)' }}
      >
        <button
          onClick={() => navigate('/list')}
          className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold"
          style={{
            background: '#071126',
            color: '#FAFBFF',
            fontFamily: 'Manrope, sans-serif',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="2" rx="1" fill="#FAFBFF" />
            <rect x="3" y="11" width="18" height="2" rx="1" fill="#FAFBFF" />
            <rect x="3" y="17" width="18" height="2" rx="1" fill="#FAFBFF" />
          </svg>
          List View
        </button>
      </div>

      {/* ── Full Restaurant Detail Popup ── */}
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
