// src/lib/cityStore.ts
// Shared city state — persists across all screens via localStorage
// All screens subscribe to city changes via custom 'citychange' event

const STORAGE_KEY = 'pp_selected_city'
const DEFAULT_CITY = 'Los Angeles'

export interface CityInfo {
  name: string        // Display name e.g. "Los Angeles"
  state: string       // State code e.g. "CA"
  lat: number
  lng: number
}

const DEFAULT_CITY_INFO: CityInfo = {
  name: 'Los Angeles',
  state: 'CA',
  lat: 34.0522,
  lng: -118.2437,
}

export function getSelectedCity(): CityInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CITY_INFO
    return JSON.parse(raw) as CityInfo
  } catch {
    return DEFAULT_CITY_INFO
  }
}

export function setSelectedCity(city: CityInfo) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(city))
    // Dispatch custom event so all screens update
    window.dispatchEvent(new CustomEvent('citychange', { detail: city }))
  } catch {}
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

// Need React for the hook
import React from 'react'

export { DEFAULT_CITY }
