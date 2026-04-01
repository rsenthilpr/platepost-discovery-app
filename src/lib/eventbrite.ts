const TOKEN = import.meta.env.VITE_EVENTBRITE_TOKEN
const BASE = 'https://www.eventbriteapi.com/v3'

export interface LiveEvent {
  id: string
  name: string
  date: string
  time: string
  rawDate: Date  // for date-based filtering
  url: string
  venueName?: string
  imageUrl?: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
  } catch { return iso }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch { return iso }
}

// Search Eventbrite by LA location — returns real upcoming events
export async function searchEventbriteByLocation(
  startDate?: Date,
  endDate?: Date,
): Promise<LiveEvent[]> {
  try {
    const start = (startDate ?? new Date()).toISOString()
    const end = endDate
      ? endDate.toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Search for food & drink + music events in LA
    const queries = [
      `${BASE}/events/search/?location.address=Los+Angeles,CA&location.within=30mi&start_date.range_start=${start}&start_date.range_end=${end}&categories=103,110&sort_by=date&expand=venue,logo&page_size=20`,
      `${BASE}/events/search/?q=restaurant+dinner+LA&location.address=Los+Angeles,CA&location.within=20mi&start_date.range_start=${start}&start_date.range_end=${end}&sort_by=date&expand=venue,logo&page_size=10`,
      `${BASE}/events/search/?q=jazz+live+music+Los+Angeles&location.address=Los+Angeles,CA&location.within=30mi&start_date.range_start=${start}&start_date.range_end=${end}&sort_by=date&expand=venue,logo&page_size=10`,
    ]

    const results = await Promise.all(queries.map(async url => {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
        })
        if (!res.ok) return []
        const data = await res.json()
        return data?.events ?? []
      } catch { return [] }
    }))

    const allEvents = results.flat()
    const seen = new Set<string>()

    return allEvents
      .filter((ev: any) => {
        if (seen.has(ev.id)) return false
        seen.add(ev.id)
        return true
      })
      .map((ev: any) => ({
        id: ev.id,
        name: ev.name?.text ?? 'Upcoming Event',
        date: formatDate(ev.start?.local ?? ev.start?.utc),
        time: formatTime(ev.start?.local ?? ev.start?.utc),
        rawDate: new Date(ev.start?.local ?? ev.start?.utc),
        url: ev.url,
        venueName: ev.venue?.name,
        imageUrl: ev.logo?.url,
      }))
      .sort((a: LiveEvent, b: LiveEvent) => a.rawDate.getTime() - b.rawDate.getTime())

  } catch { return [] }
}

// Search by venue name (legacy)
export async function searchEventbriteEvents(
  venueName: string,
  city: string,
  state: string,
): Promise<LiveEvent[]> {
  try {
    const now = new Date().toISOString()
    const q = encodeURIComponent(venueName)
    const loc = encodeURIComponent(`${city}, ${state}`)
    const res = await fetch(
      `${BASE}/events/search/?q=${q}&location.address=${loc}&start_date.range_start=${now}&sort_by=date&expand=venue,logo&page_size=5`,
      { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' } },
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data?.events ?? []).map((ev: any) => ({
      id: ev.id,
      name: ev.name?.text ?? 'Upcoming Event',
      date: formatDate(ev.start?.local ?? ev.start?.utc),
      time: formatTime(ev.start?.local ?? ev.start?.utc),
      rawDate: new Date(ev.start?.local ?? ev.start?.utc),
      url: ev.url,
      venueName: ev.venue?.name,
      imageUrl: ev.logo?.url,
    }))
  } catch { return [] }
}
