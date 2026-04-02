// Eventbrite API — all calls go through /api/eventbrite proxy to avoid CORS

export interface LiveEvent {
  id: string
  name: string
  date: string
  time: string
  rawDate: Date
  url: string
  venueName?: string
  imageUrl?: string
  venueCity?: string
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

function parseEvent(ev: any): LiveEvent {
  return {
    id: ev.id,
    name: ev.name?.text ?? 'Upcoming Event',
    date: formatDate(ev.start?.local ?? ev.start?.utc),
    time: formatTime(ev.start?.local ?? ev.start?.utc),
    rawDate: new Date(ev.start?.local ?? ev.start?.utc),
    url: ev.url,
    venueName: ev.venue?.name,
    venueCity: ev.venue?.address?.city,
    imageUrl: ev.logo?.url ?? ev.logo?.original?.url,
  }
}

// Search real Eventbrite events by LA location + date range
export async function searchEventbriteByLocation(
  startDate?: Date,
  endDate?: Date,
): Promise<LiveEvent[]> {
  try {
    const start = (startDate ?? new Date()).toISOString()
    const end = endDate
      ? endDate.toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Run 3 searches in parallel via our proxy
    const [locationRes, jazzRes, diningRes] = await Promise.all([
      fetch(`/api/eventbrite?type=location&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
      fetch(`/api/eventbrite?type=keyword&q=jazz+live+music+Los+Angeles&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
      fetch(`/api/eventbrite?type=keyword&q=restaurant+dinner+tasting+Los+Angeles&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
    ])

    const [locData, jazzData, diningData] = await Promise.all([
      locationRes.json(),
      jazzRes.json(),
      diningRes.json(),
    ])

    const allRaw = [
      ...(locData.events ?? []),
      ...(jazzData.events ?? []),
      ...(diningData.events ?? []),
    ]

    // Deduplicate by id
    const seen = new Set<string>()
    return allRaw
      .filter(ev => { if (seen.has(ev.id)) return false; seen.add(ev.id); return true })
      .map(parseEvent)
      .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())

  } catch (err) {
    console.error('Eventbrite location search failed:', err)
    return []
  }
}

// Search by specific venue name — for restaurant matching
export async function searchEventbriteEvents(
  venueName: string,
  _city: string,
  _state: string,
): Promise<LiveEvent[]> {
  try {
    const res = await fetch(`/api/eventbrite?type=venue&q=${encodeURIComponent(venueName)}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.events ?? []).map(parseEvent)
  } catch {
    return []
  }
}
