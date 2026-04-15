import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import BottomNav from '../components/BottomNav'

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
}

interface EventItem {
  id: string
  name: string
  date: string
  rawDate: Date
  isoDate: string // YYYY-MM-DD
  time: string
  venueName: string
  venueCity: string
  imageUrl: string
  category: string
  genre: string
  url: string
  price: string
  isFree: boolean
}

function parseTMEvent(ev: TMEvent): EventItem | null {
  try {
    const venue = ev._embedded?.venues?.[0]
    const localDate = ev.dates.start.localDate
    const localTime = ev.dates.start.localTime ?? ''
    const rawDate = new Date(`${localDate}T${localTime || '00:00:00'}`)
    if (isNaN(rawDate.getTime())) return null

    const displayDate = rawDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const displayTime = localTime
      ? new Date(`1970-01-01T${localTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : 'TBA'

    const sortedImages = [...(ev.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
    const imageUrl = sortedImages[0]?.url ?? ''

    const segment = ev.classifications?.[0]?.segment?.name ?? 'Event'
    const genre = ev.classifications?.[0]?.genre?.name ?? ''
    const priceRange = ev.priceRanges?.[0]
    const price = priceRange ? (priceRange.min === 0 ? 'Free' : `From $${Math.round(priceRange.min)}`) : ''

    return {
      id: ev.id,
      name: ev.name,
      date: displayDate,
      rawDate,
      isoDate: localDate,
      time: displayTime,
      venueName: venue?.name ?? 'Los Angeles',
      venueCity: venue?.city?.name ?? 'LA',
      imageUrl,
      category: segment,
      genre,
      url: ev.url,
      price,
      isFree: price === 'Free',
    }
  } catch {
    return null
  }
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']
const CATEGORY_FILTERS = ['All', 'Music', 'Arts', 'Comedy', 'Sports', 'Food', 'Free']

export default function EventsScreen() {
  const navigate = useNavigate()
  const today = new Date()
  // Use local date string to avoid UTC offset issues
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [openEvent, setOpenEvent] = useState<EventItem | null>(null)
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    setLoading(true)
    setError(null)

    try {
      // Call our serverless proxy — avoids CORS and keeps API key server-side
      const [r1, r2, r3, r4] = await Promise.all([
        fetch('/api/ticketmaster?category=music&size=50'),
        fetch('/api/ticketmaster?category=food&size=30'),
        fetch('/api/ticketmaster?category=arts&size=25'),
        fetch('/api/ticketmaster?category=comedy&size=20'),
      ])

      const [d1, d2, d3, d4] = await Promise.all([r1.json(), r2.json(), r3.json(), r4.json()])

      const rawAll = [
        ...(d1.events ?? []),
        ...(d2.events ?? []),
        ...(d3.events ?? []),
        ...(d4.events ?? []),
      ]

      if (d1.error === 'API key not configured') {
        setError('no_key')
        setLoading(false)
        return
      }

      const seen = new Set<string>()
      const unique = rawAll
        .filter(ev => { if (!ev?.id || seen.has(ev.id)) return false; seen.add(ev.id); return true })
        .map(parseTMEvent)
        .filter((ev): ev is EventItem => ev !== null)
        .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())

      setEvents(unique)

      // Auto-select first date that has events if today has none
      if (unique.length > 0) {
        const hasTodayEvent = unique.some(e => e.isoDate === todayStr)
        if (!hasTodayEvent) setSelectedDate(unique[0].isoDate)
      }
    } catch (err) {
      console.error('Events error:', err)
      setError('Failed to load events.')
    } finally {
      setLoading(false)
    }
  }

  // Days that have events this month
  const eventDays = new Set(events.map(e => e.isoDate))

  // Calendar grid
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  function isoForCell(cellIndex: number): string {
    const dayNum = cellIndex - firstDay + 1
    if (dayNum < 1 || dayNum > daysInMonth) return ''
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  // Filtered events for selected date
  const filteredEvents = events.filter(e => {
    const dateMatch = e.isoDate === selectedDate
    if (!dateMatch) return false
    if (activeCategory === 'All') return true
    if (activeCategory === 'Free') return e.isFree
    if (activeCategory === 'Music') return e.category === 'Music'
    if (activeCategory === 'Arts') return e.category === 'Arts & Theatre'
    if (activeCategory === 'Comedy') return e.genre?.toLowerCase().includes('comedy') || e.category === 'Comedy'
    if (activeCategory === 'Sports') return e.category === 'Sports'
    if (activeCategory === 'Food') return e.category === 'Miscellaneous' || e.genre?.toLowerCase().includes('food')
    return true
  })

  // All events for selected date (for showing count)
  const allSelectedDateEvents = events.filter(e => e.isoDate === selectedDate)

  return (
    <div style={{ minHeight: '100dvh', background: '#f8f9fa', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        paddingTop: 'env(safe-area-inset-top, 44px)',
        paddingBottom: 12,
      }}>
        <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)}
            style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="#071126" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <h1 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 800, fontSize: 22, color: '#071126', margin: 0 }}>
              Events
            </h1>
            <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>
              Discover what's happening
            </p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ background: '#fff', margin: '12px 16px', borderRadius: 20, padding: '16px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={prevMonth}
            style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f4f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 700, fontSize: 15, color: '#071126' }}>
            {MONTHS[calMonth]} {calYear}
          </span>
          <button onClick={nextMonth}
            style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f4f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: 10, color: '#9ca3af', padding: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {Array.from({ length: totalCells }).map((_, i) => {
            const iso = isoForCell(i)
            const dayNum = iso ? parseInt(iso.split('-')[2]) : null
            const isToday = iso === todayStr
            const isSelected = iso === selectedDate
            const hasEvent = iso ? eventDays.has(iso) : false
            const isPast = iso ? iso < todayStr : false

            if (!dayNum) return <div key={i} />

            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.9 }}
                onClick={() => iso && setSelectedDate(iso)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 38,
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  background: isSelected
                    ? '#0048f9'
                    : isToday
                    ? 'rgba(0,72,249,0.08)'
                    : 'transparent',
                  gap: 2,
                }}
              >
                <span style={{
                  fontFamily: 'Open Sans, sans-serif',
                  fontWeight: isSelected || isToday ? 700 : 400,
                  fontSize: 13,
                  color: isSelected ? '#fff' : isToday ? '#0048f9' : isPast ? '#c4c9d4' : '#071126',
                }}>
                  {dayNum}
                </span>
                {hasEvent && (
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: isSelected ? 'rgba(255,255,255,0.8)' : '#0048f9',
                  }} />
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Category filters */}
      <div style={{ padding: '0 16px 8px', overflowX: 'auto', display: 'flex', gap: 8, scrollbarWidth: 'none' }}>
        {CATEGORY_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setActiveCategory(f)}
            style={{
              flexShrink: 0,
              padding: '7px 16px',
              borderRadius: 999,
              border: activeCategory === f ? '1.5px solid #0048f9' : '1.5px solid #e5e7eb',
              background: activeCategory === f ? '#0048f9' : '#fff',
              color: activeCategory === f ? '#fff' : '#6b7280',
              fontFamily: 'Open Sans, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Selected date label */}
      <div style={{ padding: '8px 20px 4px' }}>
        <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 700, fontSize: 14, color: '#071126', margin: 0 }}>
          {selectedDate === todayStr ? 'Today' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12, marginLeft: 8 }}>
            {allSelectedDateEvents.length} event{allSelectedDateEvents.length !== 1 ? 's' : ''}
          </span>
        </p>
      </div>

      {/* Events content */}
      {loading ? (
        <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#0048f9', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontFamily: 'Open Sans', fontSize: 13, color: '#9ca3af', margin: 0 }}>Loading events…</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : error === 'no_key' ? (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 40 }}>🎟️</span>
          <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 16, color: '#071126', margin: '12px 0 6px' }}>Events coming soon</p>
          <p style={{ fontFamily: 'Open Sans', fontSize: 13, color: '#9ca3af', margin: 0 }}>
            Add <code>VITE_TICKETMASTER_KEY</code> in Vercel environment variables.
          </p>
        </div>
      ) : error ? (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 40 }}>⚠️</span>
          <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 15, color: '#071126', margin: '12px 0 6px' }}>Couldn't load events</p>
          <p style={{ fontFamily: 'Open Sans', fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>{error}</p>
          <button onClick={loadEvents} style={{ background: '#0048f9', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontFamily: 'Open Sans', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Try Again
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 40 }}>📅</span>
          <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 15, color: '#071126', margin: '12px 0 6px' }}>No events this day</p>
          <p style={{ fontFamily: 'Open Sans', fontSize: 13, color: '#9ca3af', margin: 0 }}>Try another date or category</p>
        </div>
      ) : (
        <div style={{ padding: '8px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {filteredEvents.map((ev, i) => (
            <motion.button
              key={ev.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setOpenEvent(ev)}
              style={{
                background: '#fff',
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid #f0f0f0',
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                cursor: 'pointer',
                textAlign: 'left',
                padding: 0,
              }}
            >
              {/* Event image */}
              <div style={{ height: 100, position: 'relative', background: '#e5e7eb' }}>
                {ev.imageUrl ? (
                  <img src={ev.imageUrl} alt={ev.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🎵</div>
                )}
                {/* Category badge */}
                <div style={{
                  position: 'absolute', top: 7, left: 7,
                  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                  color: '#fff', fontFamily: 'Open Sans', fontWeight: 700, fontSize: 9,
                  padding: '2px 7px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {ev.genre || ev.category}
                </div>
                {ev.isFree && (
                  <div style={{
                    position: 'absolute', top: 7, right: 7,
                    background: '#10b981', color: '#fff',
                    fontFamily: 'Open Sans', fontWeight: 700, fontSize: 9,
                    padding: '2px 7px', borderRadius: 999,
                  }}>
                    FREE
                  </div>
                )}
              </div>

              {/* Event info */}
              <div style={{ padding: '10px 10px 12px' }}>
                <p style={{
                  fontFamily: 'Open Sans, sans-serif', fontWeight: 700, fontSize: 12,
                  color: '#071126', margin: '0 0 4px',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {ev.name}
                </p>
                <p style={{ fontFamily: 'Open Sans', fontSize: 10, color: '#9ca3af', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📍 {ev.venueName}
                </p>
                <p style={{ fontFamily: 'Open Sans', fontSize: 10, color: '#9ca3af', margin: 0 }}>
                  🕐 {ev.time}
                </p>
                {ev.price && !ev.isFree && (
                  <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 11, color: '#0048f9', margin: '4px 0 0' }}>
                    {ev.price}
                  </p>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Event detail sheet */}
      <AnimatePresence>
        {openEvent && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400 }}
              onClick={() => setOpenEvent(null)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 410,
                background: '#fff', borderRadius: '24px 24px 0 0',
                maxHeight: '80vh', overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
              </div>

              {openEvent.imageUrl && (
                <div style={{ height: 180, margin: '0 16px 16px', borderRadius: 16, overflow: 'hidden' }}>
                  <img src={openEvent.imageUrl} alt={openEvent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              <div style={{ padding: '0 20px 96px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 10, color: '#0048f9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {openEvent.genre || openEvent.category}
                    </span>
                    <h2 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 800, fontSize: 18, color: '#071126', margin: '4px 0 0', lineHeight: 1.3 }}>
                      {openEvent.name}
                    </h2>
                  </div>
                  {openEvent.isFree && (
                    <span style={{ background: '#10b981', color: '#fff', fontFamily: 'Open Sans', fontWeight: 700, fontSize: 11, padding: '4px 10px', borderRadius: 999, flexShrink: 0 }}>
                      FREE
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>📅</span>
                    <span style={{ fontFamily: 'Open Sans', fontSize: 13, color: '#374151' }}>{openEvent.date} · {openEvent.time}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>📍</span>
                    <div>
                      <span style={{ fontFamily: 'Open Sans', fontSize: 13, color: '#374151', fontWeight: 600 }}>{openEvent.venueName}</span>
                      {openEvent.venueCity && (
                        <span style={{ fontFamily: 'Open Sans', fontSize: 12, color: '#6b7280' }}>{', '}{openEvent.venueCity}</span>
                      )}
                    </div>
                  </div>
                  {openEvent.price && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>🎟️</span>
                      <span style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 13, color: openEvent.isFree ? '#10b981' : '#0048f9' }}>{openEvent.price}</span>
                    </div>
                  )}
                </div>

                <a
                  href={openEvent.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '14px 0', borderRadius: 16, textDecoration: 'none',
                    background: '#0048f9', color: '#fff',
                    fontFamily: 'Open Sans, sans-serif', fontWeight: 700, fontSize: 15,
                  }}
                >
                  🎟️ Get Tickets
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
