import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const TM_KEY = (import.meta.env as any).VITE_TICKETMASTER_KEY as string | undefined

interface TMEvent {
  id: string
  name: string
  dates: { start: { localDate: string; localTime?: string } }
  _embedded?: {
    venues?: Array<{
      name: string
      city?: { name: string }
      address?: { line1: string }
      location?: { latitude: string; longitude: string }
    }>
  }
  images?: Array<{ url: string; width: number; height: number }>
  url: string
  priceRanges?: Array<{ min: number; max: number; currency: string }>
  classifications?: Array<{ segment?: { name: string }; genre?: { name: string } }>
  pleaseNote?: string
}

interface EventItem {
  id: string
  name: string
  date: string          // formatted display string
  rawDate: Date
  time: string
  venueName: string
  venueCity: string
  venueAddress: string
  imageUrl: string
  category: string
  genre: string
  url: string
  price: string
  isFree: boolean
  lat: number | null
  lng: number | null
}

function parseTMEvent(ev: TMEvent): EventItem {
  const venue = ev._embedded?.venues?.[0]
  const date = ev.dates.start.localDate
  const time = ev.dates.start.localTime ?? ''
  const rawDate = new Date(`${date}T${time || '00:00:00'}`)

  const displayDate = rawDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const displayTime = time
    ? new Date(`1970-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : 'TBA'

  // Best image — prefer wider images for better landscape crops
  const sortedImages = [...(ev.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
  const imageUrl = sortedImages[0]?.url ?? ''

  const segment = ev.classifications?.[0]?.segment?.name ?? 'Event'
  const genre = ev.classifications?.[0]?.genre?.name ?? ''

  const priceRange = ev.priceRanges?.[0]
  const price = priceRange
    ? priceRange.min === 0
      ? 'Free'
      : `From $${Math.round(priceRange.min)}`
    : ''
  const isFree = price === 'Free'

  return {
    id: ev.id,
    name: ev.name,
    date: displayDate,
    rawDate,
    time: displayTime,
    venueName: venue?.name ?? 'Los Angeles',
    venueCity: venue?.city?.name ?? 'LA',
    venueAddress: venue?.address?.line1 ?? '',
    imageUrl,
    category: segment,
    genre,
    url: ev.url,
    price,
    isFree,
    lat: venue?.location?.latitude ? parseFloat(venue.location.latitude) : null,
    lng: venue?.location?.longitude ? parseFloat(venue.location.longitude) : null,
  }
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0 = Sunday
}

const CATEGORY_FILTERS = ['All', 'Music', 'Food', 'Arts', 'Comedy', 'Sports', 'Free']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

export default function EventsScreen() {
  const navigate = useNavigate()
  const today = new Date()

  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [openEvent, setOpenEvent] = useState<EventItem | null>(null)
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().split('T')[0])
  const [_userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [nearMeActive, setNearMeActive] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadEvents('Los Angeles', 'CA')
  }, [])

  async function loadEvents(city: string, stateCode: string) {
    setLoading(true)
    setError(null)

    if (!TM_KEY) {
      setError('Ticketmaster API key not configured.')
      setLoading(false)
      return
    }

    try {
      // Fetch food/drink, music, arts + theatre in parallel
      const [r1, r2, r3, r4] = await Promise.all([
        fetch(`https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(city)}&stateCode=${stateCode}&classificationName=music&size=50&sort=date,asc&apikey=${TM_KEY}`),
        fetch(`https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(city)}&stateCode=${stateCode}&classificationName=arts&size=30&sort=date,asc&apikey=${TM_KEY}`),
        fetch(`https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(city)}&stateCode=${stateCode}&classificationName=food&size=20&sort=date,asc&apikey=${TM_KEY}`),
        fetch(`https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(city)}&stateCode=${stateCode}&classificationName=comedy&size=20&sort=date,asc&apikey=${TM_KEY}`),
      ])

      const [d1, d2, d3, d4] = await Promise.all([r1.json(), r2.json(), r3.json(), r4.json()])

      const rawAll = [
        ...(d1._embedded?.events ?? []),
        ...(d2._embedded?.events ?? []),
        ...(d3._embedded?.events ?? []),
        ...(d4._embedded?.events ?? []),
      ]

      const seen = new Set<string>()
      const unique = rawAll
        .filter(ev => { if (!ev?.id || seen.has(ev.id)) return false; seen.add(ev.id); return true })
        .map(parseTMEvent)
        .filter(ev => !isNaN(ev.rawDate.getTime()))
        .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())

      setEvents(unique)

      // Auto-select first day that has events
      if (unique.length > 0) {
        setSelectedDate(unique[0].date === today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          ? today.toISOString().split('T')[0]
          : unique[0].rawDate.toISOString().split('T')[0]
        )
      }
    } catch (err) {
      console.error('Events error:', err)
      setError('Could not load events. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function loadNearMe() {
    if (!navigator.geolocation) return
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserLocation({ lat, lng })
        setNearMeActive(true)
        setLocationLoading(false)

        if (!TM_KEY) return
        setLoading(true)
        try {
          const res = await fetch(
            `https://app.ticketmaster.com/discovery/v2/events.json?latlong=${lat},${lng}&radius=25&unit=miles&size=50&sort=date,asc&apikey=${TM_KEY}`
          )
          const data = await res.json()
          const raw = data._embedded?.events ?? []
          const seen = new Set<string>()
          const unique = raw
            .filter((ev: any) => { if (!(ev as any)?.id || seen.has((ev as any).id)) return false; seen.add((ev as any).id); return true })
            .map(parseTMEvent)
            .filter((ev: EventItem) => !isNaN(ev.rawDate.getTime()))
            .sort((a: EventItem, b: EventItem) => a.rawDate.getTime() - b.rawDate.getTime())
          setEvents(unique)
        } catch {
          // silently fall through
        } finally {
          setLoading(false)
        }
      },
      () => setLocationLoading(false),
      { timeout: 8000 }
    )
  }

  function resetToLA() {
    setNearMeActive(false)
    setUserLocation(null)
    loadEvents('Los Angeles', 'CA')
  }

  // Events for selected date + category filter
  const eventsForDate = events.filter(ev => {
    const evDate = ev.rawDate.toISOString().split('T')[0]
    return evDate === selectedDate
  })
  const filtered = eventsForDate.filter(ev => {
    if (activeCategory === 'Free') return ev.isFree
    if (activeCategory === 'All') return true
    return ev.category.toLowerCase().includes(activeCategory.toLowerCase()) ||
           ev.genre.toLowerCase().includes(activeCategory.toLowerCase())
  })

  // Dates that have events (for calendar dots)
  const eventDates = new Set(events.map(ev => ev.rawDate.toISOString().split('T')[0]))

  // Calendar grid data
  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfMonth(calYear, calMonth)
  const calCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y: number) => y - 1) }
    else setCalMonth((m: number) => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y: number) => y + 1) }
    else setCalMonth((m: number) => m + 1)
  }

  function selectDay(day: number) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDate(dateStr)
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  function formatSelectedDate() {
    const d = new Date(selectedDate + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  const selectedMonthNum = parseInt(selectedDate.split('-')[1]) - 1
  const selectedYearNum = parseInt(selectedDate.split('-')[0])

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#070d1f', fontFamily: 'Open Sans, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{
        flexShrink: 0, paddingTop: 52, paddingBottom: 0,
        background: 'linear-gradient(180deg, #070d1f 80%, transparent)',
        zIndex: 10,
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 12px' }}>
          <button onClick={() => navigate('/')} style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div style={{ flex: 1 }}>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
              {nearMeActive ? '📍 Near You' : '📍 Los Angeles'}
            </p>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
              Events 🎟️
            </h1>
          </div>

          {/* Near Me / Reset button */}
          {nearMeActive ? (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={resetToLA}
              style={{
                padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: 'rgba(245,158,11,0.2)', color: '#fbbf24',
                fontFamily: 'Open Sans', fontWeight: 700, fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Back to LA
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={loadNearMe}
              disabled={locationLoading}
              style={{
                padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(0,72,249,0.4)', cursor: 'pointer',
                background: 'rgba(0,72,249,0.15)', color: '#60a5fa',
                fontFamily: 'Open Sans', fontWeight: 700, fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 5,
                opacity: locationLoading ? 0.6 : 1,
              }}
            >
              {locationLoading ? (
                <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(96,165,250,0.3)', borderTopColor: '#60a5fa', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" fill="#60a5fa" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
              Near Me
            </motion.button>
          )}
        </div>

        {/* Category filter chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 12px', scrollbarWidth: 'none' as const }}>
          {CATEGORY_FILTERS.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Open Sans',
              background: activeCategory === cat ? '#0048f9' : 'rgba(255,255,255,0.07)',
              color: activeCategory === cat ? '#fff' : 'rgba(255,255,255,0.5)',
              border: `1px solid ${activeCategory === cat ? '#0048f9' : 'rgba(255,255,255,0.1)'}`,
              transition: 'all 0.15s',
            }}>
              {cat === 'Free' ? '🎉 Free' : cat}
            </button>
          ))}
        </div>

        {/* ── Month Calendar Grid ── */}
        <div style={{ padding: '0 16px 8px' }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: 'rgba(255,255,255,0.5)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'Open Sans' }}>
              {MONTHS[calMonth]} {calYear}
            </span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: 'rgba(255,255,255,0.5)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {WEEKDAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'Open Sans', padding: '2px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {calCells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const hasEvents = eventDates.has(dateStr)
              const isSelected = dateStr === selectedDate && calMonth === selectedMonthNum && calYear === selectedYearNum
              const isToday = dateStr === today.toISOString().split('T')[0]
              const isPast = new Date(dateStr) < new Date(today.toISOString().split('T')[0])
              return (
                <motion.button
                  key={dateStr}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => selectDay(day)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '5px 0', borderRadius: 8, border: 'none', cursor: hasEvents ? 'pointer' : 'default',
                    background: isSelected
                      ? '#0048f9'
                      : isToday
                      ? 'rgba(0,72,249,0.2)'
                      : 'transparent',
                    position: 'relative',
                    opacity: isPast && !isToday ? 0.35 : 1,
                  }}
                >
                  <span style={{
                    fontFamily: 'Open Sans', fontSize: 12, fontWeight: isSelected || isToday ? 700 : 400,
                    color: isSelected ? '#fff' : isToday ? '#60a5fa' : 'rgba(255,255,255,0.85)',
                    lineHeight: 1,
                  }}>
                    {day}
                  </span>
                  {/* Event dot */}
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%', marginTop: 2,
                    background: hasEvents
                      ? isSelected ? '#fff' : '#0048f9'
                      : 'transparent',
                  }} />
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Event list ── */}
      <div ref={listRef} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#0048f9', animation: 'spin 0.9s linear infinite' }} />
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'Open Sans' }}>
              {nearMeActive ? 'Finding events near you…' : 'Loading events in Los Angeles…'}
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 12, padding: '0 24px' }}>
            <span style={{ fontSize: 40 }}>😕</span>
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center', fontFamily: 'Open Sans' }}>{error}</p>
            <button onClick={() => loadEvents('Los Angeles', 'CA')} style={{
              background: '#0048f9', color: '#fff', border: 'none', borderRadius: 12,
              padding: '10px 24px', fontFamily: 'Open Sans', fontWeight: 700, cursor: 'pointer',
            }}>
              Try Again
            </button>
          </div>
        ) : (
          <div style={{ padding: '8px 16px 100px' }}>
            {/* Selected date label */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, fontFamily: 'Open Sans', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                {formatSelectedDate()}
              </p>
              {filtered.length > 0 && (
                <span style={{ background: 'rgba(0,72,249,0.2)', color: '#60a5fa', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(0,72,249,0.3)', fontFamily: 'Open Sans' }}>
                  {filtered.length} event{filtered.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 10 }}>
                <span style={{ fontSize: 44 }}>{events.length === 0 ? '🎭' : '🔍'}</span>
                <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center', fontFamily: 'Open Sans', margin: 0 }}>
                  {events.length === 0 ? 'No events found' : 'No events on this day'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', fontFamily: 'Open Sans', margin: 0 }}>
                  {events.length === 0 ? 'Check back soon' : 'Blue dots on the calendar show days with events'}
                </p>
              </div>
            ) : (
              <>
                {/* Featured first event — big card */}
                {filtered[0] && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setOpenEvent(filtered[0])}
                    style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 12, cursor: 'pointer' }}
                  >
                    <div style={{ position: 'relative', height: 200, background: '#111' }}>
                      {filtered[0].imageUrl ? (
                        <img src={filtered[0].imageUrl} alt={filtered[0].name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #0048f9, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
                          🎟️
                        </div>
                      )}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.15) 55%, transparent)' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <span style={{ background: '#0048f9', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, fontFamily: 'Open Sans' }}>
                            {filtered[0].category.toUpperCase()}
                          </span>
                          {filtered[0].genre && filtered[0].genre !== filtered[0].category && (
                            <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, fontFamily: 'Open Sans' }}>
                              {filtered[0].genre}
                            </span>
                          )}
                          {filtered[0].price && (
                            <span style={{ background: filtered[0].isFree ? '#059669' : 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, fontFamily: 'Open Sans' }}>
                              {filtered[0].price}
                            </span>
                          )}
                        </div>
                        <p style={{ color: '#fff', fontSize: 18, fontWeight: 800, fontFamily: 'Open Sans', lineHeight: 1.2, marginBottom: 4 }}>
                          {filtered[0].name}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontFamily: 'Open Sans', margin: 0 }}>
                          📍 {filtered[0].venueName} · ⏰ {filtered[0].time}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Rest — list rows like the inspo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filtered.slice(1).map((ev: EventItem, i: number) => (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setOpenEvent(ev)}
                      style={{
                        display: 'flex', gap: 12, padding: 12, borderRadius: 16, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                        alignItems: 'center',
                      }}
                    >
                      {/* Thumbnail */}
                      <div style={{ width: 70, height: 70, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#111' }}>
                        {ev.imageUrl ? (
                          <img src={ev.imageUrl} alt={ev.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(0,72,249,0.3), rgba(124,58,237,0.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                            {ev.category === 'Music' ? '🎵' : ev.category === 'Food' ? '🍽️' : ev.category === 'Comedy' ? '😄' : '🎟️'}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Category badge */}
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' as const }}>
                          <span style={{ background: 'rgba(0,72,249,0.2)', color: '#60a5fa', fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 999, fontFamily: 'Open Sans' }}>
                            {ev.category}
                          </span>
                          {ev.isFree && (
                            <span style={{ background: 'rgba(5,150,105,0.2)', color: '#34d399', fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 999, fontFamily: 'Open Sans' }}>
                              FREE
                            </span>
                          )}
                        </div>
                        <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'Open Sans', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.name}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'Open Sans', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📍 {ev.venueName}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'Open Sans', margin: '1px 0 0' }}>
                          ⏰ {ev.time}  {ev.price && !ev.isFree && <span style={{ color: '#fbbf24' }}> · {ev.price}</span>}
                        </p>
                      </div>

                      {/* Arrow */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
                        <path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Event detail bottom sheet ── */}
      <AnimatePresence>
        {openEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end' }}
            onClick={() => setOpenEvent(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              style={{
                width: '100%', background: '#0e1628',
                borderRadius: '22px 22px 0 0',
                padding: '20px 20px 48px',
                maxHeight: '88vh', overflowY: 'auto',
                scrollbarWidth: 'none' as const,
              }}
            >
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 18px' }} />

              {openEvent.imageUrl && (
                <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16, height: 200, background: '#111' }}>
                  <img src={openEvent.imageUrl} alt={openEvent.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' as const }}>
                <span style={{ background: '#0048f9', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, fontFamily: 'Open Sans' }}>
                  {openEvent.category}
                </span>
                {openEvent.genre && openEvent.genre !== openEvent.category && (
                  <span style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, fontFamily: 'Open Sans' }}>
                    {openEvent.genre}
                  </span>
                )}
                {openEvent.price && (
                  <span style={{ background: openEvent.isFree ? '#059669' : 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, fontFamily: 'Open Sans' }}>
                    {openEvent.price}
                  </span>
                )}
              </div>

              <p style={{ color: '#fff', fontSize: 22, fontWeight: 800, fontFamily: 'Open Sans', lineHeight: 1.2, marginBottom: 10 }}>
                {openEvent.name}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Open Sans', marginBottom: 5 }}>
                📍 {openEvent.venueName}{openEvent.venueAddress ? ` · ${openEvent.venueAddress}` : ''}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Open Sans', marginBottom: 20 }}>
                🗓 {openEvent.date} · ⏰ {openEvent.time}
              </p>

              <button
                onClick={() => window.open(openEvent.url, '_blank')}
                style={{
                  width: '100%', background: '#0048f9', color: '#fff', border: 'none',
                  borderRadius: 16, padding: '16px', fontFamily: 'Open Sans',
                  fontWeight: 700, fontSize: 16, cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(0,72,249,0.4)',
                }}
              >
                Get Tickets →
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
