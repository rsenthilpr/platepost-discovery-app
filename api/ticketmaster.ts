// api/ticketmaster.ts — Serverless proxy for Ticketmaster Discovery API
export const config = { runtime: 'nodejs' }

const TM_KEY = process.env.VITE_TICKETMASTER_KEY
const BASE = 'https://app.ticketmaster.com/discovery/v2/events.json'

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (!TM_KEY) {
    console.error('VITE_TICKETMASTER_KEY not set')
    return res.status(200).json({ events: [], error: 'API key not configured' })
  }

  const { category, size = '50', page = '0' } = req.query

  // Build params — broad search, not limited to LA
  // Use keyword search for food/restaurant related events when category=food
  const commonParams = new URLSearchParams({
    apikey: TM_KEY,
    size: String(size),
    page: String(page),
    sort: 'date,asc',
    countryCode: 'US',
  })

  try {
    let urls: string[] = []

    if (category === 'food') {
      // Food/restaurant events — use keyword search since TM doesn't have a food segment
      urls = [
        `${BASE}?${commonParams}&keyword=food+festival`,
        `${BASE}?${commonParams}&keyword=restaurant+popup`,
        `${BASE}?${commonParams}&keyword=food+drink`,
        `${BASE}?${commonParams}&keyword=wine+tasting`,
        `${BASE}?${commonParams}&keyword=dining`,
      ]
    } else if (category === 'music') {
      urls = [`${BASE}?${commonParams}&classificationName=music`]
    } else if (category === 'arts') {
      urls = [`${BASE}?${commonParams}&classificationName=arts%26theatre`]
    } else if (category === 'comedy') {
      urls = [`${BASE}?${commonParams}&keyword=comedy`]
    } else if (category === 'sports') {
      urls = [`${BASE}?${commonParams}&classificationName=sports`]
    } else {
      // Default: fetch music + food-related in parallel
      urls = [
        `${BASE}?${commonParams}&classificationName=music`,
        `${BASE}?${commonParams}&keyword=food+festival`,
        `${BASE}?${commonParams}&keyword=dining+experience`,
        `${BASE}?${commonParams}&classificationName=arts%26theatre&size=30`,
      ]
    }

    const responses = await Promise.all(
      urls.map(url =>
        fetch(url, { headers: { Accept: 'application/json' } })
          .then(r => r.json())
          .catch(() => ({ _embedded: { events: [] } }))
      )
    )

    const seen = new Set<string>()
    const allEvents: any[] = []

    for (const data of responses) {
      const events = data?._embedded?.events ?? []
      for (const ev of events) {
        if (ev?.id && !seen.has(ev.id)) {
          seen.add(ev.id)
          allEvents.push(ev)
        }
      }
    }

    // Sort by date
    allEvents.sort((a, b) => {
      const da = new Date(a.dates?.start?.localDate ?? '').getTime()
      const db = new Date(b.dates?.start?.localDate ?? '').getTime()
      return da - db
    })

    return res.status(200).json({ events: allEvents, count: allEvents.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Ticketmaster proxy error:', message)
    return res.status(200).json({ events: [], error: message })
  }
}
