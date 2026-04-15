// api/pexels-video.ts
export const config = { runtime: 'nodejs' }

const PEXELS_KEY = process.env.VITE_PEXELS_KEY
const BASE = 'https://api.pexels.com/videos/search'

const CUISINE_QUERIES: Record<string, string> = {
  Coffee:        'latte art coffee barista pouring',
  Cafe:          'coffee shop morning cafe',
  Japanese:      'sushi chef japanese food plating',
  Italian:       'pasta italian kitchen chef cooking',
  American:      'burger grill smash burger fries',
  Mexican:       'tacos mexican street food',
  Korean:        'korean bbq grill meat',
  Thai:          'thai food noodles wok cooking',
  Vietnamese:    'pho vietnamese noodle soup broth',
  Chinese:       'chinese dim sum wok stir fry',
  Indian:        'indian curry spices cooking',
  Mediterranean: 'mediterranean food grilling fresh herbs',
  Restaurant:    'restaurant dining food plating chef kitchen',
}
const FALLBACK = 'restaurant food cooking chef plating'

// In-memory cache (per serverless instance lifetime)
const cache: Record<string, string> = {}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!PEXELS_KEY) {
    return res.status(200).json({ url: null, error: 'Pexels key not configured' })
  }

  const { cuisine = 'Restaurant', orientation = 'portrait' } = req.query as Record<string, string>
  const cacheKey = `${cuisine}:${orientation}`

  if (cache[cacheKey]) {
    return res.status(200).json({ url: cache[cacheKey] })
  }

  const query = CUISINE_QUERIES[cuisine] ?? FALLBACK

  try {
    const url = `${BASE}?query=${encodeURIComponent(query)}&per_page=15&orientation=${orientation}&size=large`
    const response = await fetch(url, {
      headers: { Authorization: PEXELS_KEY },
    })

    if (!response.ok) {
      console.error(`Pexels ${response.status} for ${cuisine}`)
      return res.status(200).json({ url: null, error: `Pexels error ${response.status}` })
    }

    const data: any = await response.json()
    const videos: any[] = data.videos ?? []

    if (videos.length === 0) {
      return res.status(200).json({ url: null })
    }

    // Pick random from top 5 results for variety
    const pick = videos[Math.floor(Math.random() * Math.min(videos.length, 5))]
    const files: any[] = pick.video_files ?? []

    // For landscape (hero): prefer wide HD files
    // For portrait (cards/feed): prefer vertical HD files
    const isPortrait = orientation === 'portrait'

    const sorted = files
      .filter((f: any) => f.link && (f.quality === 'hd' || f.quality === 'sd'))
      .sort((a: any, b: any) => {
        const aMatch = isPortrait ? (a.height > a.width ? 1 : 0) : (a.width > a.height ? 1 : 0)
        const bMatch = isPortrait ? (b.height > b.width ? 1 : 0) : (b.width > b.height ? 1 : 0)
        if (bMatch !== aMatch) return bMatch - aMatch
        // Higher resolution wins
        return (b.width * b.height) - (a.width * a.height)
      })

    const best = sorted[0]?.link ?? files[0]?.link ?? null

    if (best) cache[cacheKey] = best

    console.log(`Pexels [${cuisine}:${orientation}]: ${best ? 'got video' : 'no video'}`)
    return res.status(200).json({ url: best })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown'
    console.error('Pexels error:', msg)
    return res.status(200).json({ url: null, error: msg })
  }
}
