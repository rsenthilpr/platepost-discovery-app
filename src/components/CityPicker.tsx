// src/components/CityPicker.tsx
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { setSelectedCity, CityInfo } from '../lib/cityStore'

// Popular US cities as quick picks
const POPULAR_CITIES: CityInfo[] = [
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { name: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
  { name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { name: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
  { name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
  { name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
  { name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
  { name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398 },
  { name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
  { name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
  { name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816 },
  { name: 'Portland', state: 'OR', lat: 45.5051, lng: -122.6750 },
  { name: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  { name: 'Anaheim', state: 'CA', lat: 33.8353, lng: -117.9145 },
  { name: 'Orange', state: 'CA', lat: 33.7879, lng: -117.8531 },
  { name: 'Placentia', state: 'CA', lat: 33.8722, lng: -117.8703 },
]

interface Props {
  isOpen: boolean
  onClose: () => void
  currentCity: CityInfo
}

export default function CityPicker({ isOpen, onClose, currentCity }: Props) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  const filtered = search.trim().length > 1
    ? POPULAR_CITIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.state.toLowerCase().includes(search.toLowerCase())
      )
    : POPULAR_CITIES

  function selectCity(city: CityInfo) {
    setSelectedCity(city)
    onClose()
  }

  function handleNearMe() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      // Reverse geocode using Google Places
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_KEY ?? import.meta.env.VITE_GOOGLE_PLACES_KEY}`
        )
        const data = await res.json()
        const locality = data.results?.[0]?.address_components?.find(
          (c: any) => c.types.includes('locality')
        )
        const stateComp = data.results?.[0]?.address_components?.find(
          (c: any) => c.types.includes('administrative_area_level_1')
        )
        const cityName = locality?.long_name ?? 'My Location'
        const stateName = stateComp?.short_name ?? ''
        selectCity({ name: cityName, state: stateName, lat, lng })
      } catch {
        selectCity({ name: 'My Location', state: '', lat, lng })
      }
    })
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 800 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 810,
              background: '#fff', borderRadius: '24px 24px 0 0',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
            </div>

            {/* Header */}
            <div style={{ padding: '4px 20px 12px' }}>
              <h2 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 800, fontSize: 18, color: '#071126', margin: '0 0 12px' }}>
                Choose a city
              </h2>

              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f5f5', borderRadius: 12, padding: '10px 14px', border: '1.5px solid #e5e7eb' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8" stroke="#071126" strokeWidth="2" />
                  <path d="M21 21l-4.35-4.35" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  ref={inputRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search city..."
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Open Sans', fontSize: 15, color: '#071126' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, padding: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Near Me */}
            <div style={{ padding: '0 20px 8px' }}>
              <button
                onClick={handleNearMe}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                  background: 'rgba(0,72,249,0.06)', border: '1.5px solid rgba(0,72,249,0.2)',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0048f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3" fill="white" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="1.5" opacity="0.6" />
                  </svg>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 14, color: '#0048f9', margin: 0 }}>Use my current location</p>
                  <p style={{ fontFamily: 'Open Sans', fontSize: 11, color: '#9ca3af', margin: 0 }}>Auto-detect your city</p>
                </div>
              </button>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#f0f0f0', margin: '4px 20px 8px' }} />

            {/* City list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', scrollbarWidth: 'none' }}>
              {!search && (
                <p style={{ fontFamily: 'Open Sans', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  Popular cities
                </p>
              )}
              {filtered.length === 0 ? (
                <p style={{ fontFamily: 'Open Sans', fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
                  No cities found. Try a different search.
                </p>
              ) : (
                filtered.map(city => {
                  const isSelected = city.name === currentCity.name && city.state === currentCity.state
                  return (
                    <button
                      key={`${city.name}-${city.state}`}
                      onClick={() => selectCity(city)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: isSelected ? '#0048f9' : '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                            fill={isSelected ? '#fff' : '#9ca3af'} />
                        </svg>
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <p style={{ fontFamily: 'Open Sans', fontWeight: isSelected ? 700 : 600, fontSize: 14, color: isSelected ? '#0048f9' : '#071126', margin: 0 }}>
                          {city.name}
                        </p>
                        <p style={{ fontFamily: 'Open Sans', fontSize: 11, color: '#9ca3af', margin: 0 }}>{city.state}</p>
                      </div>
                      {isSelected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="#0048f9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
