// src/lib/cityStore.ts
// Shared city state — persists across all screens via localStorage.
// All screens subscribe to city changes via custom 'citychange' event.
//
// v2 changes (Fix #1.5):
// - Added `country` and `countryCode` fields — supports international
//   cities from reverse geocoding, defaults to US for backwards compat.
// - Added `isUserLocation` flag — distinguishes geolocation from picker.
// - Added helper utilities `isUSCity` and `isLAArea` so the rest of the
//   app stops hardcoding city-name lists.

import React from 'react'

const STORAGE_KEY = 'pp_selected_city'
const DEFAULT_CITY = 'Los Angeles'

export interface CityInfo {
  name: string         // Display name e.g. "Los Angeles" or "Madurai"
  state: string        // State/region — may be empty for non-US
  lat: number
  lng: number
  country?: string     // Full country name e.g. "United States" or "India"
  countryCode?: string // ISO 3166-1 alpha-2 e.g. "US", "IN"
  isUserLocation?: boolean // true if set via geolocation, not picker
}

const DEFAULT_CITY_INFO: CityInfo = {
  name: 'Los Angeles',
  state: 'CA',
  lat: 34.0522,
  lng: -118.2437,
  country: 'United States',
  countryCode: 'US',
}

export function getSelectedCity(): CityInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CITY_INFO
    const parsed = JSON.parse(raw) as CityInfo
    // Migrate old-format entries that lack country fields
    if (!parsed.countryCode) {
      parsed.countryCode = 'US'
      parsed.country = 'United States'
    }
    return parsed
  } catch {
    return DEFAULT_CITY_INFO
  }
}

export function setSelectedCity(city: CityInfo) {
  try {
    const normalized: CityInfo = {
      ...city,
      country: city.country ?? 'United States',
      countryCode: city.countryCode ?? 'US',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    window.dispatchEvent(new CustomEvent('citychange', { detail: normalized }))
  } catch {}
}

/** Has the user ever picked a city or had one set via geolocation? */
export function hasStoredCity(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

/** Check if a city is in the US — drives whether we show US-specific features. */
export function isUSCity(city: CityInfo): boolean {
  return (city.countryCode ?? 'US') === 'US'
}

/** Check if a city is in the LA/OC area — drives PRO restaurant visibility. */
export function isLAArea(city: CityInfo): boolean {
  if (!isUSCity(city)) return false
  const LA_CITIES = new Set([
    'Los Angeles', 'Anaheim', 'Orange', 'Placentia',
    'Westminster', 'Irvine', 'Santa Ana', 'Costa Mesa',
    'Long Beach', 'Pasadena', 'Glendale', 'Burbank',
    'Culver City', 'Santa Monica', 'West Hollywood', 'Beverly Hills',
  ])
  return LA_CITIES.has(city.name)
}

export function useCityStore() {
  const [city, setCity] = React.useState<CityInfo>(getSelectedCity)

  React.useEffect(() => {
    function onCityChange(e: Event) {
      setCity((e as CustomEvent<CityInfo>).detail)
    }
    window.addEventListener('citychange', onCityChange)
    return () => window.removeEventListener('citychange', onCityChange)
  }, [])

  return { city, setCity: setSelectedCity }
}

export { DEFAULT_CITY }
