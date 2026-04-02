import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { searchEventbriteByLocation } from '../lib/eventbrite'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

function loadFavorites(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem('pp_favorites') ?? '[]')) } catch { return new Set() }
}
function saveFavorites(f: Set<number>) {
  localStorage.setItem('pp_favorites', JSON.stringify([...f]))
}

interface EventItem {
  id: string
  name: string
  date: string
  time: string
  rawDate: Date
  url: string
  restaurant: Restaurant | null
  venueName: string
  heroImage: string | null
  source: 'eventbrite' | 'supabase'
}

function getTimeCategory(time: string): 'afternoon' | 'evening' | 'late' {
  const hour = parseInt(time.split(':')[0])
  const isPM = time.toLowerCase().includes('pm')
  let h = isNaN(hour) ? 12 : hour
  if (isPM && h !== 12) h += 12
  if (!isPM && h === 12) h = 0
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'late'
}

const TIME_LABELS = {
  afternoon: { label: 'This Afternoon', emoji: '☀️', color: '#F59E0B' },
  evening: { label: 'This Evening', emoji: '🌆', color: '#8B5CF6' },
  late: { label: 'Late Night', emoji: '🌙', color: '#3B82F6' },
}

// Generate 30-day calendar
function generateDays(count = 30) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return d
  })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export default function TonightScreen() {
  const navigate = useNavigate()
  const [allEvents, setAllEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const [activeCategory, setActiveCategory] = useState<'all' | 'afternoon' | 'evening' | 'late'>('all')
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const days = generateDays(30)
  const selectedDay = days[selectedDayIndex]

  function toggleFavorite(id: number) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      saveFavorites(next)
      return next
    })
  }

  useEffect(() => { loadAllEvents() }, [])

  async function loadAllEvents() {
    setLoading(true)

    // Single location-based search — food & drink + music in LA for next 90 days
    const startDate = new Date()
    const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    const liveEvents = await searchEventbriteByLocation(startDate, endDate)

    // Get restaurants for matching venue names
    const { data: restaurantData } = await supabase.from('restaurants').select('*')
    const restaurants: Restaurant[] = restaurantData ?? []

    const collected: EventItem[] = liveEvents.map(ev => {
      const matched = restaurants.find(r =>
        (ev.venueName ?? '').toLowerCase().includes(r.name.toLowerCase()) ||
        r.name.toLowerCase().includes((ev.venueName ?? '').toLowerCase())
      )
      return {
        id: ev.id,
        name: ev.name,
        date: ev.date,
        time: ev.time,
        rawDate: ev.rawDate,
        url: ev.url,
        restaurant: matched ?? null,
        venueName: ev.venueName ?? ev.venueCity ?? 'Los Angeles',
        heroImage: ev.imageUrl ?? matched?.image_url ?? null,
        source: 'eventbrite' as const,
      }
    })

    // Deduplicate by id
    const seen = new Set<string>()
    const deduped = collected.filter(ev => {
      if (seen.has(ev.id)) return false
      seen.add(ev.id)
      return true
    }).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())

    console.log(`Events loaded: ${deduped.length}`)
    setAllEvents(deduped)
    setLoading(false)
  }

  // Filter events for selected day
  const eventsForDay = allEvents.filter(ev => isSameDay(ev.rawDate, selectedDay))
  const filtered = activeCategory === 'all'
    ? eventsForDay
    : eventsForDay.filter(e => getTimeCategory(e.time) === activeCategory)

  const grouped = {
    afternoon: filtered.filter(e => getTimeCategory(e.time) === 'afternoon'),
    evening: filtered.filter(e => getTimeCategory(e.time) === 'evening'),
    late: filtered.filter(e => getTimeCategory(e.time) === 'late'),
  }

  const now = new Date()
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Group days by month for display
  const months = days.reduce((acc, day) => {
    const key = day.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!acc[key]) acc[key] = []
    acc[key].push(day)
    return acc
  }, {} as Record<string, Date[]>)

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#070d1f', fontFamily: 'Open Sans, sans-serif' }}>

      {/* Header */}
      <div className="flex-shrink-0 pt-12 px-5 pb-3"
        style={{ background: 'rgba(7,13,31,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {todayStr}
            </p>
            <h1 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 800, color: '#fff', fontSize: 22 }}>
              Events 🎟️
            </h1>
          </div>
          {!loading && (
            <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(0,72,249,0.2)', color: '#60a5fa', border: '1px solid rgba(0,72,249,0.3)' }}>
              {eventsForDay.length} events
            </span>
          )}
        </div>

        {/* Calendar — Apple-style horizontal scroll by month */}
        <div className="overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {Object.entries(months).map(([monthLabel, monthDays]) => (
            <div key={monthLabel} className="mb-2">
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 2 }}>
                {monthLabel}
              </p>
              <div className="flex gap-2">
                {monthDays.map((day) => {
                  const globalIdx = days.findIndex(d => isSameDay(d, day))
                  const isSelected = globalIdx === selectedDayIndex
                  const isToday = isSameDay(day, new Date())
                  const hasEvents = allEvents.some(ev => isSameDay(ev.rawDate, day))
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDayIndex(globalIdx)}
                      className="flex-shrink-0 flex flex-col items-center rounded-xl transition-all"
                      style={{
                        width: 44,
                        padding: '8px 0',
                        background: isSelected ? '#0048f9' : isToday ? 'rgba(0,72,249,0.15)' : 'rgba(255,255,255,0.05)',
                        border: isSelected ? '1px solid #0048f9' : isToday ? '1px solid rgba(0,72,249,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span style={{ fontFamily: 'Open Sans', color: isSelected ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span style={{ fontFamily: 'Open Sans', color: isSelected ? '#fff' : isToday ? '#60a5fa' : 'rgba(255,255,255,0.8)', fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>
                        {day.getDate()}
                      </span>
                      {/* Dot indicator for days with events */}
                      <div style={{ width: 4, height: 4, borderRadius: '50%', marginTop: 2, background: hasEvents ? (isSelected ? '#fff' : '#0048f9') : 'transparent' }} />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Time filters */}
        <div className="flex gap-2 mt-1">
          {(['all', 'afternoon', 'evening', 'late'] as const).map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: activeCategory === cat ? '#0048f9' : 'rgba(255,255,255,0.07)',
                color: activeCategory === cat ? '#fff' : 'rgba(255,255,255,0.5)',
                border: activeCategory === cat ? '1px solid #0048f9' : '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'Open Sans',
              }}>
              {cat === 'all' ? 'All' : TIME_LABELS[cat].emoji + ' ' + TIME_LABELS[cat].label.split(' ').pop()}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-10" style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#0048f9' }} />
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'Open Sans' }}>
              Finding real events in LA...
            </p>
          </div>
        ) : eventsForDay.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 px-6">
            <span style={{ fontSize: 48 }}>🎭</span>
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center', fontFamily: 'Open Sans' }}>
              No events on {selectedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', fontFamily: 'Open Sans' }}>
              Try a different date — blue dots show days with events
            </p>
          </div>
        ) : (
          <div className="px-4 pt-4">
            {(['afternoon', 'evening', 'late'] as const).map(cat => {
              const catEvents = grouped[cat]
              if (catEvents.length === 0) return null
              const label = TIME_LABELS[cat]
              return (
                <div key={cat} className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ fontSize: 14 }}>{label.emoji}</span>
                    <h2 style={{ fontFamily: 'Open Sans', fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      {cat === 'late' ? 'Late Night' : label.label.split(' ').slice(1).join(' ')}
                    </h2>
                  </div>
                  <div className="flex flex-col gap-3">
                    {catEvents.map(ev => (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        isFavorite={ev.restaurant ? favorites.has(ev.restaurant.id) : false}
                        onToggleFavorite={() => ev.restaurant && toggleFavorite(ev.restaurant.id)}
                        onRestaurantClick={() => ev.restaurant && setSelectedRestaurant(ev.restaurant)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedRestaurant && (
          <RestaurantDetail
            restaurant={selectedRestaurant}
            onClose={() => setSelectedRestaurant(null)}
            isFavorite={favorites.has(selectedRestaurant.id)}
            onToggleFavorite={() => toggleFavorite(selectedRestaurant.id)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function EventCard({ event: ev, isFavorite, onToggleFavorite, onRestaurantClick }: {
  event: EventItem
  isFavorite: boolean
  onToggleFavorite: () => void
  onRestaurantClick: () => void
}) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Hero image */}
        {ev.heroImage && (
          <div className="relative" style={{ height: 140 }}>
            <img src={ev.heroImage} alt={ev.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)' }} />
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: 'Open Sans', backdropFilter: 'blur(8px)' }}>
              {ev.time}
            </div>
            {ev.source === 'eventbrite' && (
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-xs font-bold"
                style={{ background: '#F05537', color: '#fff', fontFamily: 'Open Sans', fontSize: 9 }}>
                EVENTBRITE
              </div>
            )}
          </div>
        )}

        <div className="p-3">
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'Open Sans', marginBottom: 2 }}>
            {ev.venueName} · {ev.date}
          </p>
          <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'Open Sans', marginBottom: 8, lineHeight: 1.3 }}>
            {ev.name}
          </p>

          <div className="flex items-center gap-2">
            {ev.restaurant?.cuisine && (
              <span className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(0,72,249,0.2)', color: '#60a5fa', fontFamily: 'Open Sans', fontWeight: 600 }}>
                {ev.restaurant.cuisine}
              </span>
            )}
            <div className="flex gap-2 ml-auto">
              <button onClick={onToggleFavorite}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.07)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24"
                  fill={isFavorite ? '#E11D48' : 'none'}
                  stroke={isFavorite ? '#E11D48' : 'rgba(255,255,255,0.5)'}
                  strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
              {ev.restaurant && (
                <button onClick={onRestaurantClick}
                  className="px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', fontFamily: 'Open Sans' }}>
                  Info
                </button>
              )}
              <button
                onClick={() => { window.open(ev.url, '_blank') }}
                className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: '#0048f9', color: '#fff', fontFamily: 'Open Sans' }}>
                Get Tickets
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {iframeUrl && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#0e1f42' }}>
            <button onClick={() => setIframeUrl(null)}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
            <span style={{ color: '#fff', fontFamily: 'Open Sans', fontSize: 14, fontWeight: 600 }}>Get Tickets</span>
            <a href={iframeUrl} target="_blank" rel="noreferrer"
              className="ml-auto text-xs px-3 py-1.5 rounded-full"
              style={{ background: '#0048f9', color: '#fff', textDecoration: 'none', fontFamily: 'Open Sans' }}>
              Open ↗
            </a>
          </div>
          <iframe src={iframeUrl} className="flex-1 w-full border-0" title="Tickets" />
        </div>
      )}
    </>
  )
}
