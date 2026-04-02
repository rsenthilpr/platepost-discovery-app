// api/eventbrite.ts
// Serverless proxy for Eventbrite API — fixes CORS browser blocking
// Runtime: Node.js (NOT edge)

import type { VercelRequest, VercelResponse } from '@vercel/node'

const TOKEN = process.env.VITE_EVENTBRITE_TOKEN
const BASE = 'https://www.eventbriteapi.com/v3'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (!TOKEN) {
    return res.status(500).json({ error: 'Eventbrite token not configured', events: [] })
  }

  const { type, q, start, end } = req.query

  try {
    let url: string

    if (type === 'location') {
      // Search by LA location — food & music events
      const startDate = (start as string) ?? new Date().toISOString()
      const endDate = (end as string) ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      url = `${BASE}/events/search/?location.address=Los+Angeles,CA&location.within=30mi&start_date.range_start=${startDate}&start_date.range_end=${endDate}&categories=103,110&sort_by=date&expand=venue,logo&page_size=50`
    } else if (type === 'venue') {
      // Search by venue name
      const startDate = new Date().toISOString()
      url = `${BASE}/events/search/?q=${encodeURIComponent(q as string)}&location.address=Los+Angeles,CA&location.within=50mi&start_date.range_start=${startDate}&sort_by=date&expand=venue,logo&page_size=10`
    } else if (type === 'keyword') {
      // Search by keyword (jazz, live music, dinner, etc.)
      const startDate = (start as string) ?? new Date().toISOString()
      const endDate = (end as string) ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      url = `${BASE}/events/search/?q=${encodeURIComponent(q as string)}&location.address=Los+Angeles,CA&location.within=30mi&start_date.range_start=${startDate}&start_date.range_end=${endDate}&sort_by=date&expand=venue,logo&page_size=20`
    } else {
      return res.status(400).json({ error: 'Invalid type parameter', events: [] })
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Eventbrite error:', response.status, errText)
      return res.status(200).json({ events: [], error: `Eventbrite returned ${response.status}` })
    }

    const data = await response.json()
    return res.status(200).json({ events: data.events ?? [], pagination: data.pagination })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Eventbrite proxy error:', message)
    return res.status(200).json({ events: [], error: message })
  }
}
