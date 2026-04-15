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
    console.error('VITE_TICKETMASTER_KEY not set in environment')
    return res.status(200).json({ events: [], error: 'API key not configured' })
  }

  const { category, size = '50', city = 'Los Angeles', stateCode = 'CA' } = req.query as Record<string, string>

  const params = new URLSearchParams({
    apikey: TM_KEY,
    size,
    sort: 'date,asc',
    city,
    stateCode,
    countryCode: 'US',
  })

  try {
    let urls: string[] = []

    if (category === 'food') {
      // Ticketmaster doesn't have a food segment — use keyword searches
      urls = [
        `${BASE}?${params}&keyword=food+festival`,
        `${BASE}?${params}&keyword=restaurant+popup+dinner`,
        `${BASE}?${params}&keyword=wine+tasting+dining`,
      ]
    } else if (category === 'music') {
      urls = [`${BASE}?${params}&classificationName=music`]
    } else if (category === 'arts') {
      urls = [`${BASE}?${params}&classificationName=arts%26theatre`]
    } else if (category === 'comedy') {
      urls = [`${BASE}?${params}&keyword=comedy+show`]
    } else if (category === 'sports') {
      urls = [`${BASE}?${params}&classificationName=sports`]
    } else {
      urls = [
        `${BASE}?${params}&classificationName=music`,
        `${BASE}?${params}&classificationName=arts%26theatre`,
        `${BASE}?${params}&keyword=food+festival`,
      ]
    }

    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const r = await fetch(url, { headers: { Accept: 'application/json' } })
          if (!r.ok) {
            console.error(`TM API error ${r.status} for ${url}`)
            return []
          }
          const data: any = await r.json()
          return (data?._embedded?.events as any[]) ?? []
        } catch (e) {
          console.error('TM fetch error:', e)
          return []
        }
      })
    )

    const seen = new Set<string>()
    const allEvents: any[] = []

    for (const batch of results) {
      for (const ev of batch) {
        if (ev?.id && !seen.has(ev.id)) {
          seen.add(ev.id)
          allEvents.push(ev)
        }
      }
    }

    // Sort by date ascending
    allEvents.sort((a: any, b: any) => {
      const da = new Date(a.dates?.start?.localDate ?? '9999-01-01').getTime()
      const db = new Date(b.dates?.start?.localDate ?? '9999-01-01').getTime()
      return da - db
    })

    console.log(`Ticketmaster [${category}]: returned ${allEvents.length} events`)
    return res.status(200).json({ events: allEvents, count: allEvents.length })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Ticketmaster proxy error:', message)
    return res.status(200).json({ events: [], error: message })
  }
}
