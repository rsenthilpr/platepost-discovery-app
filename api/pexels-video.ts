// api/pexels-video.ts — Serverless proxy for Pexels video API
export const config = { runtime: 'nodejs' }

const PEXELS_KEY = process.env.VITE_PEXELS_KEY

// Search terms per cuisine — optimized for food/restaurant content
const CUISINE_QUERIES: Record<string, string> = {
  Coffee: 'latte art coffee barista pouring',
  Cafe: 'coffee cafe morning breakfast',
  Japanese: 'sushi japanese food ramen',
  Italian: 'pasta italian food pizza',
  American: 'burger grill american food',
  Mexican: 'tacos mexican food street food',
  Korean: 'korean bbq grill meat',
  Thai: 'thai food noodles cooking',
  Vietnamese: 'pho vietnamese noodle soup',
  Chinese: 'chinese food dim sum wok',
  Indian: 'indian food curry spices',
  Mediterranean: 'mediterranean food grilling fresh',
  Restaurant: 'restaurant food dining cooking',
}

const FALLBACK_QUERY = 'restaurant food cooking chef'

// Cache results in memory to avoid hitting API repeatedly
const cache: Record<string, string> = {}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!PEXELS_KEY) {
    return res.status(200).json({ url: null, error: 'Pexels key not configured' })
  }

  const { cuisine = 'Restaurant' } = req.query as Record<string, string>

  // Return cached result if available
  if (cache[cuisine]) {
    return res.status(200).json({ url: cache[cuisine] })
  }

  const query = CUISINE_QUERIES[cuisine] ?? FALLBACK_QUERY

  try {
    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=10&orientation=portrait&size=medium`,
      {
        headers: {
          Authorization: PEXELS_KEY,
        },
      }
    )

    if (!response.ok) {
      console.error('Pexels API error:', response.status)
      return res.status(200).json({ url: null, error: `Pexels error ${response.status}` })
    }

    const data: any = await response.json()
    const videos = data.videos ?? []

    if (videos.length === 0) {
      return res.status(200).json({ url: null })
    }

    // Pick a random video from results for variety
    const randomVideo = videos[Math.floor(Math.random() * Math.min(videos.length, 5))]

    // Get the HD or SD file — prefer portrait/vertical for mobile
    const files: any[] = randomVideo.video_files ?? []

    // Sort by quality — prefer HD portrait
    const sorted = files
      .filter((f: any) => f.link && (f.quality === 'hd' || f.quality === 'sd'))
      .sort((a: any, b: any) => {
        // Prefer portrait (height > width)
        const aPortrait = a.height > a.width ? 1 : 0
        const bPortrait = b.height > b.width ? 1 : 0
        if (bPortrait !== aPortrait) return bPortrait - aPortrait
        // Then prefer higher resolution
        return (b.width * b.height) - (a.width * a.height)
      })

    const best = sorted[0]?.link ?? files[0]?.link ?? null

    if (best) {
      cache[cuisine] = best
    }

    return res.status(200).json({ url: best })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Pexels video error:', message)
    return res.status(200).json({ url: null, error: message })
  }
}
