// api/eventbrite.ts — Serverless proxy for Eventbrite
// Pulls real Food & Drink events in LA exactly like the URLs:
// eventbrite.com/b/ca--los-angeles/food-and-drink/
// Runtime: Node.js

import type { VercelRequest, VercelResponse } from '@vercel/node'

const TOKEN = process.env.VITE_EVENTBRITE_TOKEN
const BASE = 'https://www.eventbriteapi.com/v3'

// Eventbrite category IDs
const FOOD_DRINK_CATEGORY = '110'    // Food & Drink
const MUSIC_CATEGORY = '103'         // Music
const ARTS_CATEGORY = '105'          // Arts

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (!TOKEN) {
    console.error('VITE_EVENTBRITE_TOKEN not set')
    return res.status(200).json({ events: [], error: 'Token not configured' })
  }

  const { type, q, start, end, page = '1' } = req.query
  const startDate = (start as string) ?? new Date().toISOString()
  const endDate = (end as string) ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  const makeRequest = async (url: string) => {
    console.log('Eventbrite request:', url.replace(TOKEN, 'TOKEN'))
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
    })
    const text = await response.text()
    if (!response.ok) {
      console.error('Eventbrite error:', response.status, text.slice(0, 200))
      return { events: [], error: `${response.status}: ${text.slice(0, 100)}` }
    }
    try {
      const data = JSON.parse(text)
      return { events: data.events ?? [], pagination: data.pagination, error: null }
    } catch {
      return { events: [], error: 'Parse error' }
    }
  }

  try {
    let results: any[] = []

    if (type === 'food-drink') {
      // Pull Food & Drink events in LA — matches eventbrite.com/b/ca--los-angeles/food-and-drink/
      const url = `${BASE}/events/search/?location.address=Los+Angeles%2C+CA&location.within=30mi` +
        `&categories=${FOOD_DRINK_CATEGORY}` +
        `&start_date.range_start=${encodeURIComponent(startDate)}` +
        `&start_date.range_end=${encodeURIComponent(endDate)}` +
        `&sort_by=date&expand=venue,logo&page_size=50&page=${page}`
      const data = await makeRequest(url)
      results = data.events

    } else if (type === 'music') {
      // Music events in LA
      const url = `${BASE}/events/search/?location.address=Los+Angeles%2C+CA&location.within=30mi` +
        `&categories=${MUSIC_CATEGORY}` +
        `&start_date.range_start=${encodeURIComponent(startDate)}` +
        `&start_date.range_end=${encodeURIComponent(endDate)}` +
        `&sort_by=date&expand=venue,logo&page_size=50&page=${page}`
      const data = await makeRequest(url)
      results = data.events

    } else if (type === 'festivals') {
      // Food festivals
      const url = `${BASE}/events/search/?q=food+festival+dinner+tasting` +
        `&location.address=Los+Angeles%2C+CA&location.within=30mi` +
        `&start_date.range_start=${encodeURIComponent(startDate)}` +
        `&start_date.range_end=${encodeURIComponent(endDate)}` +
        `&sort_by=date&expand=venue,logo&page_size=30`
      const data = await makeRequest(url)
      results = data.events

    } else if (type === 'parties') {
      // Food & drink parties
      const url = `${BASE}/events/search/?q=dinner+party+popup+restaurant` +
        `&location.address=Los+Angeles%2C+CA&location.within=30mi` +
        `&start_date.range_start=${encodeURIComponent(startDate)}` +
        `&start_date.range_end=${encodeURIComponent(endDate)}` +
        `&sort_by=date&expand=venue,logo&page_size=30`
      const data = await makeRequest(url)
      results = data.events

    } else if (type === 'keyword') {
      // Keyword search
      const url = `${BASE}/events/search/?q=${encodeURIComponent(q as string || 'food')}` +
        `&location.address=Los+Angeles%2C+CA&location.within=30mi` +
        `&start_date.range_start=${encodeURIComponent(startDate)}` +
        `&start_date.range_end=${encodeURIComponent(endDate)}` +
        `&sort_by=date&expand=venue,logo&page_size=20`
      const data = await makeRequest(url)
      results = data.events

    } else if (type === 'venue') {
      // Search by venue name
      const url = `${BASE}/events/search/?q=${encodeURIComponent(q as string || '')}` +
        `&location.address=Los+Angeles%2C+CA&location.within=50mi` +
        `&start_date.range_start=${encodeURIComponent(startDate)}` +
        `&sort_by=date&expand=venue,logo&page_size=10`
      const data = await makeRequest(url)
      results = data.events

    } else {
      // Default: all food & music events
      const [foodData, musicData] = await Promise.all([
        makeRequest(`${BASE}/events/search/?location.address=Los+Angeles%2C+CA&location.within=30mi&categories=${FOOD_DRINK_CATEGORY}&start_date.range_start=${encodeURIComponent(startDate)}&start_date.range_end=${encodeURIComponent(endDate)}&sort_by=date&expand=venue,logo&page_size=30`),
        makeRequest(`${BASE}/events/search/?location.address=Los+Angeles%2C+CA&location.within=30mi&categories=${MUSIC_CATEGORY}&start_date.range_start=${encodeURIComponent(startDate)}&start_date.range_end=${encodeURIComponent(endDate)}&sort_by=date&expand=venue,logo&page_size=20`),
      ])
      results = [...foodData.events, ...musicData.events]
    }

    return res.status(200).json({ events: results, count: results.length })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Eventbrite proxy error:', message)
    return res.status(200).json({ events: [], error: message })
  }
}
