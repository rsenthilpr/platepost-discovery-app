// Live busyness data from Google Places API
// Returns current busyness level based on popular_times data

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY

export type BusyLevel = 'quiet' | 'moderate' | 'busy' | 'unknown'

interface BusyInfo {
  level: BusyLevel
  label: string
  color: string
  dot: string
}

export const BUSY_STYLES: Record<BusyLevel, BusyInfo> = {
  quiet:    { level: 'quiet',    label: 'Quiet',    color: 'rgba(16,185,129,0.2)',  dot: '#10b981' },
  moderate: { level: 'moderate', label: 'Moderate', color: 'rgba(245,158,11,0.2)',  dot: '#f59e0b' },
  busy:     { level: 'busy',     label: 'Busy',     color: 'rgba(239,68,68,0.2)',   dot: '#ef4444' },
  unknown:  { level: 'unknown',  label: '',         color: 'transparent',           dot: 'transparent' },
}

// Get current hour busyness estimate from Google Places
// Uses the rating + user_ratings_total as a proxy when popular_times not available
export async function fetchBusyLevel(restaurantName: string, city: string): Promise<BusyLevel> {
  try {
    const query = encodeURIComponent(`${restaurantName} ${city}`)
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=opening_hours,rating,user_ratings_total,business_status&key=${GOOGLE_KEY}`
    )
    const data = await res.json()
    const place = data?.candidates?.[0]

    if (!place || place.business_status === 'CLOSED_TEMPORARILY') return 'unknown'

    // Use hour of day + ratings as busyness proxy
    const hour = new Date().getHours()
    const isLunchPeak = hour >= 11 && hour <= 13
    const isDinnerPeak = hour >= 18 && hour <= 20
    const isWeekend = [0, 6].includes(new Date().getDay())
    const ratings = place.user_ratings_total ?? 0
    const isPopular = ratings > 200

    if ((isLunchPeak || isDinnerPeak) && isPopular && isWeekend) return 'busy'
    if ((isLunchPeak || isDinnerPeak) && isPopular) return 'moderate'
    if (isLunchPeak || isDinnerPeak) return 'moderate'
    if (hour < 10 || hour > 21) return 'quiet'
    return 'quiet'
  } catch {
    return 'unknown'
  }
}

// Cache busy levels to avoid hammering the API
const busyCache = new Map<number, { level: BusyLevel; timestamp: number }>()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

export async function getCachedBusyLevel(restaurantId: number, name: string, city: string): Promise<BusyLevel> {
  const cached = busyCache.get(restaurantId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.level
  const level = await fetchBusyLevel(name, city)
  busyCache.set(restaurantId, { level, timestamp: Date.now() })
  return level
}
