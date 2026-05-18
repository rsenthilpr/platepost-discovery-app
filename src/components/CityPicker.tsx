// src/components/CityPicker.tsx
// v2 changes (Fix #1.5):
// - "Use my current location" now calls detectUserCity() which reverse-
//   geocodes the user's real coordinates instead of snapping to the
//   nearest US city. Works globally.
// - Added loading state for the geolocation flow.
// - Added an "International" section so the picker isn't US-centric.

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { setSelectedCity, CityInfo } from '../lib/cityStore'
import { detectUserCity } from '../lib/geolocation'

// Cities where PlatePost has curated Supabase restaurants (pro customers)
const PLATEPOST_CITIES: CityInfo[] = [
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437, country: 'United States', countryCode: 'US' },
  { name: 'Anaheim', state: 'CA', lat: 33.8353, lng: -117.9145, country: 'United States', countryCode: 'US' },
  { name: 'Orange', state: 'CA', lat: 33.7879, lng: -117.8531, country: 'United States', countryCode: 'US' },
  { name: 'Placentia', state: 'CA', lat: 33.8722, lng: -117.8703, country: 'United States', countryCode: 'US' },
  { name: 'Westminster', state: 'CA', lat: 33.7514, lng: -118.0040, country: 'United States', countryCode: 'US' },
  { name: 'Irvine', state: 'CA', lat: 33.6846, lng: -117.8265, country: 'United States', countryCode: 'US' },
]

// Major US cities — selectable via Google Places API
const MAJOR_US_CITIES: CityInfo[] = [
  { name: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060, country: 'United States', countryCode: 'US' },
  { name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298, country: 'United States', countryCode: 'US' },
  { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698, country: 'United States', countryCode: 'US' },
  { name: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918, country: 'United States', countryCode: 'US' },
  { name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194, country: 'United States', countryCode: 'US' },
  { name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321, country: 'United States', countryCode: 'US' },
  { name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431, country: 'United States', countryCode: 'US' },
  { name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398, country: 'United States', countryCode: 'US' },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970, country: 'United States', countryCode: 'US' },
  { name: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880, country: 'United States', countryCode: 'US' },
  { name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589, country: 'United States', countryCode: 'US' },
  { name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816, country: 'United States', countryCode: 'US' },
  { name: 'Portland', state: 'OR', lat: 45.5051, lng: -122.6750, country: 'United States', countryCode: 'US' },
  { name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903, country: 'United States', countryCode: 'US' },
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740, country: 'United States', countryCode: 'US' },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611, country: 'United States', countryCode: 'US' },
]

// International cities — shows users globally that the app works for them
const INTL_CITIES: CityInfo[] = [
  { name: 'London', state: 'England', lat: 51.5074, lng: -0.1278, country: 'United Kingdom', countryCode: 'GB' },
  { name: 'Paris', state: 'Île-de-France', lat: 48.8566, lng: 2.3522, country: 'France', countryCode: 'FR' },
  { name: 'Tokyo', state: 'Tokyo', lat: 35.6762, lng: 139.6503, country: 'Japan', countryCode: 'JP' },
  { name: 'Singapore', state: '', lat: 1.3521, lng: 103.8198, country: 'Singapore', countryCode: 'SG' },
  { name: 'Dubai', state: 'Dubai', lat: 25.2048, lng: 55.2708, country: 'United Arab Emirates', countryCode: 'AE' },
  { name: 'Mumbai', state: 'MH', lat: 19.0760, lng: 72.8777, country: 'India', countryCode: 'IN' },
  { name: 'Bangalore', state: 'KA', lat: 12.9716, lng: 77.5946, country: 'India', countryCode: 'IN' },
  { name: 'Chennai', state: 'TN', lat: 13.0827, lng: 80.2707, country: 'India', countryCode: 'IN' },
  { name: 'Madurai', state: 'TN', lat: 9.9252, lng: 78.1198, country: 'India', countryCode: 'IN' },
  { name: 'Toronto', state: 'ON', lat: 43.6532, lng: -79.3832, country: 'Canada', countryCode: 'CA' },
  { name: 'Sydney', state: 'NSW', lat: -33.8688, lng: 151.2093, country: 'Australia', countryCode: 'AU' },
  { name: 'Mexico City', state: 'CDMX', lat: 19.4326, lng: -99.1332, country: 'Mexico', countryCode: 'MX' },
]

const ALL_CITIES: CityInfo[] = [...PLATEPOST_CITIES, ...MAJOR_US_CITIES, ...INTL_CITIES]

function isPlatePostCity(city: CityInfo) {
  return PLATEPOST_CITIES.some(c => c.name === city.name && c.countryCode === c.countryCode)
}

function isUSCity(city: CityInfo) {
  return city.countryCode === 'US'
}

interface Props {
  isOpen: boolean
  onClose: () => void
  currentCity: CityInfo
}

export default function CityPicker({ isOpen, onClose, currentCity }: Props) {
  const [search, setSearch] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setGeoError(null)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  const filtered = search.trim().length > 1
    ? ALL_CITIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.state.toLowerCase().includes(search.toLowerCase()) ||
        (c.country ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : ALL_CITIES

  function selectCity(city: CityInfo) {
    setSelectedCity(city)
    onClose()
  }

  /**
   * Real "Use my current location" — reverse geocodes the browser's coords
   * and sets that as the city, even if it's not in our hardcoded list.
   * Works anywhere in the world.
   */
  async function handleNearMe() {
    setDetecting(true)
    setGeoError(null)

    const detected = await detectUserCity(true /* force fresh */)

    setDetecting(false)

    if (!detected) {
      setGeoError("Couldn't get your location. Check browser permissions.")
      return
    }

    setSelectedCity(detected)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 800 }}
            onClick={() => { onClose() }}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 810, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
            </div>

            {/* Header */}
            <div style={{ padding: '4px 20px 12px' }}>
              <h2 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 800, fontSize: 18, color: '#071126', margin: '0 0 12px' }}>Choose a city</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f5f5', borderRadius: 12, padding: '10px 14px', border: '1.5px solid #e5e7eb' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8" stroke="#071126" strokeWidth="2" />
                  <path d="M21 21l-4.35-4.35" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search city..."
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Open Sans', fontSize: 15, color: '#071126' }} />
                {search && (
                  <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, padding: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" /></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Near Me — now does real reverse geocoding */}
            <div style={{ padding: '0 20px 8px' }}>
              <button
                onClick={handleNearMe}
                disabled={detecting}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 14,
                  cursor: detecting ? 'wait' : 'pointer',
                  background: 'rgba(0,72,249,0.06)',
                  border: '1.5px solid rgba(0,72,249,0.2)',
                  opacity: detecting ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0048f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {detecting ? (
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      animation: 'pp-spin 0.8s linear infinite',
                    }} />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="3" fill="white" />
                      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="1.5" opacity="0.6" />
                    </svg>
                  )}
                </div>
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 14, color: '#0048f9', margin: 0 }}>
                    {detecting ? 'Detecting your location…' : 'Use my current location'}
                  </p>
                  <p style={{ fontFamily: 'Open Sans', fontSize: 11, color: '#9ca3af', margin: 0 }}>
                    {detecting ? 'This takes a few seconds' : 'Detect your city automatically'}
                  </p>
                </div>
              </button>
              {geoError && (
                <p style={{ fontFamily: 'Open Sans', fontSize: 11, color: '#ef4444', margin: '8px 4px 0' }}>
                  {geoError}
                </p>
              )}
              <style>{`@keyframes pp-spin { to { transform: rotate(360deg); } }`}</style>
            </div>

            <div style={{ height: 1, background: '#f0f0f0', margin: '4px 20px 8px' }} />

            {/* City list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 80px', scrollbarWidth: 'none' }}>
              {filtered.map((city, idx) => {
                const isPro = isPlatePostCity(city)
                const isSelected = city.name === currentCity.name && city.countryCode === currentCity.countryCode
                const isUS = isUSCity(city)
                const prev = filtered[idx - 1]
                const firstPro = isPro && (!prev || !isPlatePostCity(prev))
                const firstMajorUS = !isPro && isUS && (!prev || isPlatePostCity(prev))
                const firstIntl = !isUS && (!prev || isUSCity(prev))

                return (
                  <div key={`${city.name}-${city.countryCode}`}>
                    {firstPro && (
                      <p style={{ fontFamily: 'Open Sans', fontSize: 10, fontWeight: 700, color: '#0048f9', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '8px 0 8px' }}>
                        ▶ PlatePost Live
                      </p>
                    )}
                    {firstMajorUS && (
                      <p style={{ fontFamily: 'Open Sans', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 8px' }}>
                        🇺🇸 Major US Cities
                      </p>
                    )}
                    {firstIntl && (
                      <p style={{ fontFamily: 'Open Sans', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 8px' }}>
                        🌍 International
                      </p>
                    )}
                    <button
                      onClick={() => selectCity(city)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: isSelected ? '#0048f9' : isPro ? '#f0f7ff' : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={isSelected ? '#fff' : isPro ? '#0048f9' : '#9ca3af'} />
                        </svg>
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <p style={{ fontFamily: 'Open Sans', fontWeight: isSelected ? 700 : 600, fontSize: 14, color: isSelected ? '#0048f9' : '#071126', margin: 0 }}>
                          {city.name}
                        </p>
                        <p style={{ fontFamily: 'Open Sans', fontSize: 11, color: '#9ca3af', margin: 0 }}>
                          {isUS ? city.state : (city.country ?? city.state)}
                          {isPro ? ' · PlatePost Pro restaurants' : ''}
                        </p>
                      </div>
                      {isSelected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="#0048f9" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
