import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface EventItem {
  id: string
  name: string
  description: string
  date: string
  time: string
  rawDate: Date
  url: string
  venueName: string
  venueCity: string
  imageUrl: string | null
  category: string
  isFree: boolean
  price?: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return iso }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch { return iso }
}

function parseEvent(ev: any): EventItem {
  const startLocal = ev.start?.local ?? ev.start?.utc ?? ''
  const isFree = ev.is_free ?? false
  const minPrice = ev.ticket_availability?.minimum_ticket_price?.major_value
  return {
    id: ev.id,
    name: ev.name?.text ?? 'Event',
    description: ev.description?.text?.slice(0, 120) ?? '',
    date: formatDate(startLocal),
    time: formatTime(startLocal),
    rawDate: new Date(startLocal),
    url: ev.url,
    venueName: ev.venue?.name ?? 'Los Angeles',
    venueCity: ev.venue?.address?.city ?? ev.venue?.address?.localized_area_display ?? 'LA',
    imageUrl: ev.logo?.url ?? ev.logo?.original?.url ?? null,
    category: ev.category_id === '103' ? 'Music' : ev.category_id === '110' ? 'Food & Drink' : 'Event',
    isFree,
    price: isFree ? 'Free' : minPrice ? `From $${minPrice}` : undefined,
  }
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function generateDays(count = 30) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return d
  })
}

const CATEGORY_FILTERS = ['All', 'Food & Drink', 'Music', 'Free']

export default function EventsScreen() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [activeCategory, setActiveCategory] = useState('All')
  const [openEvent, setOpenEvent] = useState<EventItem | null>(null)
  const days = generateDays(30)

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    setLoading(true)
    setError(null)
    try {
      const start = new Date().toISOString()
      const end = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

      const [r1, r2, r3, r4] = await Promise.all([
        fetch(`/api/eventbrite?type=food-drink&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
        fetch(`/api/eventbrite?type=music&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
        fetch(`/api/eventbrite?type=festivals&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
        fetch(`/api/eventbrite?type=parties&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
      ])

      console.log('API status codes:', r1.status, r2.status, r3.status, r4.status)

      const [d1, d2, d3, d4] = await Promise.all([r1.json(), r2.json(), r3.json(), r4.json()])

      console.log('food-drink:', d1.count, 'error:', d1.error)
      console.log('music:', d2.count, 'error:', d2.error)
      console.log('festivals:', d3.count, 'error:', d3.error)
      console.log('parties:', d4.count, 'error:', d4.error)

      if (d1.error || d2.error) {
        console.error('Eventbrite API error:', d1.error || d2.error)
      }

      const allRaw = [...(d1.events ?? []), ...(d2.events ?? []), ...(d3.events ?? []), ...(d4.events ?? [])]
      const seen = new Set<string>()
      const unique = allRaw
        .filter(ev => { if (!ev?.id || seen.has(ev.id)) return false; seen.add(ev.id); return true })
        .map(parseEvent)
        .filter(ev => !isNaN(ev.rawDate.getTime()))
        .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())

      console.log(`Total unique events: ${unique.length}`)
      setEvents(unique)
    } catch (err) {
      console.error('Events load error:', err)
      setError('Could not load events. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Filter events for selected day + category
  const selectedDay = days[selectedDayIndex]
  const todayEvents = events.filter(ev => isSameDay(ev.rawDate, selectedDay))
  const filtered = todayEvents.filter(ev => {
    if (activeCategory === 'Free') return ev.isFree
    if (activeCategory === 'All') return true
    return ev.category === activeCategory
  })

  // Days with events (for dot indicators)
  const daysWithEvents = new Set(events.map(ev => ev.rawDate.toDateString()))

  const now = new Date()

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#070d1f', fontFamily: 'Open Sans, sans-serif' }}>

      {/* Header */}
      <div className="flex-shrink-0 pt-12 px-4 pb-3"
        style={{ background: 'rgba(7,13,31,0.97)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/')}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Open Sans' }}>
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, fontFamily: 'Open Sans', lineHeight: 1 }}>
              Events 🎟️
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!loading && (
              <span style={{ background: 'rgba(0,72,249,0.2)', color: '#60a5fa', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(0,72,249,0.3)' }}>
                {events.length} events
              </span>
            )}
          </div>
        </div>

        {/* Calendar strip */}
        <div className="overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-2">
            {days.map((day, i) => {
              const isSelected = i === selectedDayIndex
              const isToday = isSameDay(day, new Date())
              const hasEvents = daysWithEvents.has(day.toDateString())
              return (
                <button key={i} onClick={() => setSelectedDayIndex(i)}
                  style={{
                    flexShrink: 0, width: 48, padding: '8px 0', borderRadius: 14,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    background: isSelected ? '#0048f9' : isToday ? 'rgba(0,72,249,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isSelected ? '#0048f9' : isToday ? 'rgba(0,72,249,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer',
                  }}>
                  <span style={{ fontFamily: 'Open Sans', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: isSelected ? '#fff' : 'rgba(255,255,255,0.35)' }}>
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span style={{ fontFamily: 'Open Sans', fontSize: 18, fontWeight: 800, color: isSelected ? '#fff' : isToday ? '#60a5fa' : 'rgba(255,255,255,0.85)', lineHeight: 1 }}>
                    {day.getDate()}
                  </span>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: hasEvents ? (isSelected ? '#fff' : '#0048f9') : 'transparent' }} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Category filters */}
        <div className="flex gap-2 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {CATEGORY_FILTERS.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{
                flexShrink: 0, padding: '5px 14px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Open Sans',
                background: activeCategory === cat ? '#0048f9' : 'rgba(255,255,255,0.07)',
                color: activeCategory === cat ? '#fff' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${activeCategory === cat ? '#0048f9' : 'rgba(255,255,255,0.1)'}`,
              }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#0048f9', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'Open Sans' }}>Loading events in LA...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
            <span style={{ fontSize: 40 }}>😕</span>
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'Open Sans' }}>{error}</p>
            <button onClick={loadEvents} style={{ background: '#0048f9', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontFamily: 'Open Sans', fontWeight: 700, cursor: 'pointer' }}>
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, padding: '0 24px' }}>
            <span style={{ fontSize: 48 }}>{events.length === 0 ? '🎭' : '🔍'}</span>
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center', fontFamily: 'Open Sans' }}>
              {events.length === 0 ? 'No events found' : `No ${activeCategory === 'All' ? '' : activeCategory + ' '}events on ${selectedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', fontFamily: 'Open Sans' }}>
              {events.length === 0 ? 'Check back soon — events are updated daily' : 'Try a different date — blue dots show days with events'}
            </p>
            {events.length === 0 && (
              <button onClick={loadEvents} style={{ background: 'rgba(0,72,249,0.2)', color: '#60a5fa', border: '1px solid rgba(0,72,249,0.3)', borderRadius: 12, padding: '8px 20px', fontFamily: 'Open Sans', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Refresh
              </button>
            )}
          </div>
        ) : (
          <div style={{ padding: '16px 16px 40px' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, fontFamily: 'Open Sans', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {filtered.length} event{filtered.length !== 1 ? 's' : ''} · {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>

            {/* Featured event — first card big */}
            {filtered[0] && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setOpenEvent(filtered[0])}
                style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {filtered[0].imageUrl ? (
                  <div style={{ position: 'relative', height: 200 }}>
                    <img src={filtered[0].imageUrl} alt={filtered[0].name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent)' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px' }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <span style={{ background: '#0048f9', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, fontFamily: 'Open Sans' }}>{filtered[0].category.toUpperCase()}</span>
                        {filtered[0].price && <span style={{ background: filtered[0].isFree ? '#059669' : 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, fontFamily: 'Open Sans' }}>{filtered[0].price}</span>}
                      </div>
                      <p style={{ color: '#fff', fontSize: 18, fontWeight: 800, fontFamily: 'Open Sans', lineHeight: 1.2, marginBottom: 4 }}>{filtered[0].name}</p>
                      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Open Sans' }}>📍 {filtered[0].venueName} · {filtered[0].time}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 16, background: 'linear-gradient(135deg, rgba(0,72,249,0.2), rgba(0,72,249,0.05))' }}>
                    <span style={{ background: '#0048f9', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, fontFamily: 'Open Sans', display: 'inline-block', marginBottom: 8 }}>{filtered[0].category.toUpperCase()}</span>
                    <p style={{ color: '#fff', fontSize: 18, fontWeight: 800, fontFamily: 'Open Sans', lineHeight: 1.2, marginBottom: 6 }}>{filtered[0].name}</p>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Open Sans' }}>📍 {filtered[0].venueName} · {filtered[0].time}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Rest as 2-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {filtered.slice(1).map((ev, i) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setOpenEvent(ev)}
                  style={{ borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {ev.imageUrl ? (
                    <div style={{ position: 'relative', height: 100 }}>
                      <img src={ev.imageUrl} alt={ev.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
                      {ev.price && <div style={{ position: 'absolute', top: 6, right: 6, background: ev.isFree ? '#059669' : 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 999, fontFamily: 'Open Sans' }}>{ev.price}</div>}
                    </div>
                  ) : (
                    <div style={{ height: 60, background: 'linear-gradient(135deg, rgba(0,72,249,0.15), rgba(0,72,249,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                      {ev.category === 'Music' ? '🎵' : ev.category === 'Food & Drink' ? '🍽️' : '🎟️'}
                    </div>
                  )}
                  <div style={{ padding: '8px 10px 10px' }}>
                    <p style={{ color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'Open Sans', lineHeight: 1.3, marginBottom: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {ev.name}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'Open Sans' }}>
                      {ev.time}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'Open Sans', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📍 {ev.venueName}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Event detail modal */}
      <AnimatePresence>
        {openEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}
            onClick={() => setOpenEvent(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', background: '#0e1628', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', maxHeight: '85vh', overflowY: 'auto' }}
            >
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 16px' }} />
              {openEvent.imageUrl && (
                <img src={openEvent.imageUrl} alt={openEvent.name} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 14, marginBottom: 16 }} />
              )}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <span style={{ background: '#0048f9', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, fontFamily: 'Open Sans' }}>{openEvent.category}</span>
                {openEvent.price && <span style={{ background: openEvent.isFree ? '#059669' : 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, fontFamily: 'Open Sans' }}>{openEvent.price}</span>}
              </div>
              <p style={{ color: '#fff', fontSize: 20, fontWeight: 800, fontFamily: 'Open Sans', lineHeight: 1.2, marginBottom: 8 }}>{openEvent.name}</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Open Sans', marginBottom: 6 }}>📍 {openEvent.venueName} · {openEvent.venueCity}</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Open Sans', marginBottom: 12 }}>🗓 {openEvent.date} · ⏰ {openEvent.time}</p>
              {openEvent.description && (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: 'Open Sans', lineHeight: 1.6, marginBottom: 20 }}>{openEvent.description}</p>
              )}
              <button
                onClick={() => window.open(openEvent.url, '_blank')}
                style={{ width: '100%', background: '#0048f9', color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontFamily: 'Open Sans', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Get Tickets →
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
