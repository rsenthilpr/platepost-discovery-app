// src/lib/geolocation.ts
// Geolocation + reverse-geocoding utilities.
// One module so every screen uses the same logic and we cache the result.
//
// Strategy:
// 1. Ask browser for coordinates (silent if permission already granted).
// 2. Reverse geocode with Google Geocoding API to get city/country names.
// 3. Cache for 10 minutes so we don't burn quota on every screen.
// 4. Fall back gracefully — never throw, return null on failure.

import type { CityInfo } from './cityStore'

const GOOGLE_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_KEY ??
  import.meta.env.VITE_GOOGLE_PLACES_KEY

const CACHE_KEY = 'pp_geolocation_cache'
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

interface GeoCache {
  city: CityInfo
  timestamp: number
}

interface ReverseGeocodeResult {
  city: string
  state: string
  country: string
  countryCode: string
}

/**
 * Get the browser's current coordinates.
 * Returns null if permission denied, unavailable, or timed out.
 * Never throws — safe to call without try/catch.
 */
export function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      {
        enableHighAccuracy: false, // city-level is fine, faster + less battery
        timeout: 8000,
        maximumAge: 5 * 60 * 1000, // accept positions up to 5 min old
      },
    )
  })
}

/**
 * Reverse geocode lat/lng → city, state, country.
 * Walks the Google address_components to pull the right fields.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  if (!GOOGLE_KEY) return null

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}&result_type=locality|administrative_area_level_2|administrative_area_level_3`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.length) return null

    // Walk components across all results to find the best match for each field.
    // Google's address_components are inconsistent — sometimes locality is on
    // the first result, sometimes on a later one. Check all results.
    let city = ''
    let state = ''
    let country = ''
    let countryCode = ''

    for (const result of data.results) {
      for (const comp of result.address_components ?? []) {
        const types: string[] = comp.types ?? []
        if (!city && (types.includes('locality') || types.includes('postal_town'))) {
          city = comp.long_name
        }
        if (
          !city &&
          (types.includes('administrative_area_level_2') ||
            types.includes('administrative_area_level_3'))
        ) {
          // Some countries (e.g. India) put city info at admin_area_level_2
          city = comp.long_name
        }
        if (!state && types.includes('administrative_area_level_1')) {
          state = comp.short_name
        }
        if (!country && types.includes('country')) {
          country = comp.long_name
          countryCode = comp.short_name
        }
      }
      if (city && country) break
    }

    if (!city) {
      // Last-resort fallback — use formatted_address's first segment
      const formatted = data.results[0]?.formatted_address as string | undefined
      if (formatted) city = formatted.split(',')[0].trim()
    }

    if (!city) return null

    return { city, state, country, countryCode }
  } catch (err) {
    console.error('reverseGeocode error:', err)
    return null
  }
}

/**
 * Full geolocation flow: get coords, reverse geocode, return a CityInfo.
 * Uses sessionStorage cache to avoid repeating the request within 10 min.
 * Returns null if anything along the chain fails.
 */
export async function detectUserCity(force = false): Promise<CityInfo | null> {
  // Check cache first
  if (!force) {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        const cached = JSON.parse(raw) as GeoCache
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          return cached.city
        }
      }
    } catch {}
  }

  const coords = await getCurrentCoords()
  if (!coords) return null

  const geo = await reverseGeocode(coords.lat, coords.lng)
  if (!geo) {
    // We have coords but no city name — still return something usable.
    // Display as "Near you" so user understands what's happening.
    const fallback: CityInfo = {
      name: 'Near you',
      state: '',
      lat: coords.lat,
      lng: coords.lng,
      country: 'Unknown',
      countryCode: '',
      isUserLocation: true,
    }
    return fallback
  }

  const city: CityInfo = {
    name: geo.city,
    state: geo.state,
    lat: coords.lat,
    lng: coords.lng,
    country: geo.country,
    countryCode: geo.countryCode,
    isUserLocation: true,
  }

  // Cache for the session so we don't repeat this on every screen
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ city, timestamp: Date.now() } as GeoCache),
    )
  } catch {}

  return city
}

/**
 * Check whether the browser has geolocation permission already granted.
 * Used to decide whether silent auto-detect is appropriate on app load.
 */
export async function hasGeolocationPermission(): Promise<boolean> {
  try {
    if (!navigator.permissions) return false
    const status = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    })
    return status.state === 'granted'
  } catch {
    return false
  }
}
