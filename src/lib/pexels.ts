// src/lib/pexels.ts
// Fetches HD portrait videos from Pexels API
// Uses page offset to ensure different restaurants get different videos

const PEXELS_KEY = import.meta.env.VITE_PEXELS_KEY as string

interface PexelsVideoResult {
  url: string
  width: number
  height: number
  quality: string
}

// Module-level cache: query:page → video URL
const videoCache: Record<string, string | null> = {}

export async function fetchPexelsPortraitVideo(
  query: string,
  page = 1
): Promise<PexelsVideoResult | null> {
  if (!PEXELS_KEY) return null

  const cacheKey = `${query}:${page}`
  if (cacheKey in videoCache) {
    const url = videoCache[cacheKey]
    return url ? { url, width: 1080, height: 1920, quality: 'hd' } : null
  }

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=large&per_page=15&page=${page}`,
      { headers: { Authorization: PEXELS_KEY } }
    )

    if (!res.ok) {
      console.warn(`Pexels ${res.status} for "${query}" page ${page}`)
      videoCache[cacheKey] = null
      return null
    }

    const data = await res.json()
    const videos: any[] = data.videos ?? []

    if (videos.length === 0) {
      videoCache[cacheKey] = null
      return null
    }

    // Use restaurant name hash to pick a consistent but varied result
    const hash = query.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const pick = videos[hash % videos.length]
    const files: any[] = pick.video_files ?? []

    // Sort: prefer portrait HD files first
    const sorted = files
      .filter((f: any) => f.link && (f.quality === 'hd' || f.quality === 'sd'))
      .sort((a: any, b: any) => {
        // Portrait first
        const aPortrait = a.height > a.width ? 1 : 0
        const bPortrait = b.height > b.width ? 1 : 0
        if (bPortrait !== aPortrait) return bPortrait - aPortrait
        // Then highest resolution
        return (b.width * b.height) - (a.width * a.height)
      })

    const best = sorted[0]
    if (!best?.link) {
      videoCache[cacheKey] = null
      return null
    }

    videoCache[cacheKey] = best.link
    return { url: best.link, width: best.width, height: best.height, quality: best.quality }

  } catch (err) {
    console.error('Pexels fetch error:', err)
    videoCache[cacheKey] = null
    return null
  }
}

// Photo fetching (used by RestaurantDetail)
export async function fetchPexelsPhoto(query: string): Promise<string | null> {
  if (!PEXELS_KEY) return null

  if (query in videoCache) return videoCache[query]

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&size=large&per_page=5`,
      { headers: { Authorization: PEXELS_KEY } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const photo = data.photos?.[0]?.src?.large2x ?? null
    videoCache[query] = photo
    return photo
  } catch {
    return null
  }
}
