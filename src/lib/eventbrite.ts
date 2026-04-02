// Eventbrite — all calls via /api/eventbrite proxy

export interface LiveEvent {
  id: string
  name: string
  date: string
  time: string
  rawDate: Date
  url: string
  venueName?: string
  venueCity?: string
  imageUrl?: string
  category?: string
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
  const startLocal = ev.start?.local ?? ev.start?.utc ?? ''
  return {
    id: ev.id,
    name: ev.name?.text ?? ev.name?.html ?? 'Upcoming Event',
    date: formatDate(startLocal),
    time: formatTime(startLocal),
    rawDate: new Date(startLocal),
    url: ev.url,
    venueName: ev.venue?.name,
    venueCity: ev.venue?.address?.city ?? ev.venue?.address?.localized_area_display,
    imageUrl: ev.logo?.url ?? ev.logo?.original?.url,
    category: ev.category_id,
  }
}

// Pull all Food & Drink + Music events in LA (next 90 days)
export async function searchEventbriteByLocation(
  startDate?: Date,
  endDate?: Date,
): Promise<LiveEvent[]> {
  try {
    const start = (startDate ?? new Date()).toISOString()
    const end = endDate
      ? endDate.toISOString()
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

    // Pull from all 4 Eventbrite URL types you shared
    const [foodDrink, music, festivals, parties] = await Promise.all([
      fetch(`/api/eventbrite?type=food-drink&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`).then(r => r.json()),
      fetch(`/api/eventbrite?type=music&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`).then(r => r.json()),
      fetch(`/api/eventbrite?type=festivals&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`).then(r => r.json()),
      fetch(`/api/eventbrite?type=parties&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`).then(r => r.json()),
    ])

    const allRaw = [
      ...(foodDrink.events ?? []),
      ...(music.events ?? []),
      ...(festivals.events ?? []),
      ...(parties.events ?? []),
    ]

    // Deduplicate
    const seen = new Set<string>()
    const unique = allRaw.filter(ev => {
      if (!ev?.id || seen.has(ev.id)) return false
      seen.add(ev.id)
      return true
    })

    console.log(`Eventbrite: loaded ${unique.length} unique events`)

    return unique
      .map(parseEvent)
      .filter(ev => !isNaN(ev.rawDate.getTime()))
      .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())

  } catch (err) {
    console.error('Eventbrite fetch failed:', err)
    return []
  }
}

// Search by venue name
export async function searchEventbriteEvents(
  venueName: string,
  _city: string,
  _state: string,
): Promise<LiveEvent[]> {
  try {
    const res = await fetch(`/api/eventbrite?type=venue&q=${encodeURIComponent(venueName)}`)
    const data = await res.json()
    return (data.events ?? []).map(parseEvent).filter((ev: LiveEvent) => !isNaN(ev.rawDate.getTime()))
  } catch { return [] }
}
