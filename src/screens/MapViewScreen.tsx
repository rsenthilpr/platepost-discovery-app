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

// Custom pin icon factory
function makeIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:36px; height:44px; position:relative; display:flex;
        flex-direction:column; align-items:center;
      ">
        <div style="
          width:36px; height:36px; border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          background:${color};
          box-shadow:0 4px 14px rgba(0,0,0,0.35);
          display:flex; align-items:center; justify-content:center;
        ">
          <div style="transform:rotate(45deg); font-size:16px; line-height:1;">🍽️</div>
        </div>
      </div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  })
}

const PRO_ICON = makeIcon('#4576EF')
const BASIC_ICON = makeIcon('#6B7EBF')

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
    <div className="fixed inset-0 flex flex-col" style={{ background: '#071126' }}>

      {/* ── Top bar ── */}
      <div
        className="absolute top-0 left-0 right-0 z-20 pt-12 px-4 pb-3 flex flex-col gap-3"
        style={{ background: 'linear-gradient(to bottom, rgba(7,17,38,0.95) 70%, transparent)' }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h1
            className="text-lg"
            style={{ fontFamily: 'Bungee, cursive', color: '#FAFBFF', letterSpacing: '0.05em' }}
          >
            PlatePost
          </h1>

          {/* Location switcher */}
          <div className="relative">
            <button
              onClick={() => setShowLocationPicker((p) => !p)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: 'rgba(69,118,239,0.15)',
                border: '1px solid rgba(69,118,239,0.4)',
                color: '#FAFBFF',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4576EF" />
                <circle cx="12" cy="9" r="2.5" fill="white" />
              </svg>
              {activeLocation}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="#FAFBFF" strokeWidth="2.5" strokeLinecap="round" />
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
                    background: '#0e1f42',
                    border: '1px solid rgba(69,118,239,0.3)',
                    minWidth: 180,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  }}
                >
                  {(Object.keys(LOCATIONS) as LocationKey[]).map((loc) => (
                    <button
                      key={loc}
                      onClick={() => { setActiveLocation(loc); setShowLocationPicker(false) }}
                      className="w-full text-left px-4 py-3 text-sm transition-colors"
                      style={{
                        fontFamily: 'Manrope, sans-serif',
                        color: activeLocation === loc ? '#4576EF' : '#FAFBFF',
                        background: activeLocation === loc ? 'rgba(69,118,239,0.12)' : 'transparent',
                      }}
                    >
                      {loc}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                fontFamily: 'Manrope, sans-serif',
                background: activeFilter === f ? '#4576EF' : 'rgba(255,255,255,0.08)',
                color: activeFilter === f ? '#fff' : 'rgba(250,251,255,0.6)',
                border: activeFilter === f ? '1px solid #4576EF' : '1px solid rgba(255,255,255,0.1)',
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
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          <MapController center={[loc.lat, loc.lng]} zoom={loc.zoom} />

          {filtered.map((r) => (
            <Marker
              key={r.id}
              position={[r.latitude, r.longitude]}
              icon={r.tier === 'pro' ? PRO_ICON : BASIC_ICON}
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
        style={{ background: 'linear-gradient(to top, rgba(7,17,38,0.95) 60%, transparent)' }}
      >
        <button
          onClick={() => navigate('/list')}
          className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold shadow-lg"
          style={{
            background: '#FAFBFF',
            color: '#071126',
            fontFamily: 'Manrope, sans-serif',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="2" rx="1" fill="#071126" />
            <rect x="3" y="11" width="18" height="2" rx="1" fill="#071126" />
            <rect x="3" y="17" width="18" height="2" rx="1" fill="#071126" />
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
