const TOKEN = import.meta.env.VITE_EVENTBRITE_TOKEN
const BASE = 'https://www.eventbriteapi.com/v3'

export interface LiveEvent {
  id: string
  name: string
  date: string      // formatted e.g. "Sat, Apr 5"
  time: string      // formatted e.g. "9:00 PM"
  url: string
  venueName?: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch {
    return iso
  }
}

/**
 * Search Eventbrite for upcoming events at a venue by name + city.
 * Returns up to 5 upcoming events, sorted by date.
 * Returns [] on any error (CORS, auth, no results).
 */
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
      `${BASE}/events/search/?q=${q}&location.address=${loc}` +
      `&start_date.range_start=${now}&sort_by=date&expand=venue&page_size=5`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/json',
        },
      },
    )

    if (!res.ok) return []

    const data = await res.json()
    const events: LiveEvent[] = (data?.events ?? []).map(
      (ev: {
        id: string
        name: { text: string }
        start: { utc: string; local: string }
        url: string
        venue?: { name: string }
      }) => ({
        id: ev.id,
        name: ev.name?.text ?? 'Upcoming Event',
        date: formatDate(ev.start?.local ?? ev.start?.utc),
        time: formatTime(ev.start?.local ?? ev.start?.utc),
        url: ev.url,
        venueName: ev.venue?.name,
      }),
    )

    return events
  } catch {
    return []
  }
}
