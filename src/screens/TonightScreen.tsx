import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { searchEventbriteEvents } from '../lib/eventbrite'
import { fetchPexelsPhoto } from '../lib/pexels'
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
  url: string
  restaurant: Restaurant
  heroImage: string | null
  source: 'eventbrite' | 'supabase'
}

function getTimeCategory(time: string): 'afternoon' | 'evening' | 'late' {
  const hour = parseInt(time.split(':')[0])
  if (isNaN(hour)) return 'evening'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'late'
}

const TIME_LABELS = {
  afternoon: { label: 'This Afternoon', emoji: '☀️', color: '#F59E0B' },
  evening: { label: 'This Evening', emoji: '🌆', color: '#8B5CF6' },
  late: { label: 'Late Night', emoji: '🌙', color: '#3B82F6' },
}

export default function TonightScreen() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const [activeCategory, setActiveCategory] = useState<'all' | 'afternoon' | 'evening' | 'late'>('all')

  function toggleFavorite(id: number) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      saveFavorites(next)
      return next
    })
  }

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    setLoading(true)
    const { data: restaurants } = await supabase.from('restaurants').select('*')
    const allRestaurants = restaurants ?? []

    // Fetch events for all restaurants in parallel
    const eventPromises = allRestaurants.map(async (r) => {
      const liveEvents = await searchEventbriteEvents(r.name, r.city, r.state)
      if (liveEvents.length > 0) {
        const photo = await fetchPexelsPhoto(`${r.cuisine} music venue concert`)
        return liveEvents.slice(0, 2).map(ev => ({
          id: ev.id,
          name: ev.name,
          date: ev.date,
          time: ev.time,
          url: ev.url,
          restaurant: r,
          heroImage: photo?.url ?? r.image_url,
          source: 'eventbrite' as const,
        }))
      }

      // Fall back to Supabase seeded events
      const { data: seededEvents } = await supabase
        .from('events')
        .select('*')
        .eq('restaurant_id', r.id)

      if (seededEvents && seededEvents.length > 0) {
        return seededEvents.slice(0, 1).map(ev => ({
          id: String(ev.id),
          name: ev.event_name,
          date: ev.event_date,
          time: ev.event_time,
          url: ev.eventbrite_url,
          restaurant: r,
          heroImage: r.image_url,
          source: 'supabase' as const,
        }))
      }
      return []
    })

    const results = await Promise.all(eventPromises)
    const allEvents = results.flat().sort((a, b) => a.time.localeCompare(b.time))
    setEvents(allEvents)
    setLoading(false)
  }

  const now = new Date()
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // 14-day calendar
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })
  const [selectedDay, setSelectedDay] = useState(0)

  const filtered = activeCategory === 'all'
    ? events
    : events.filter(e => getTimeCategory(e.time) === activeCategory)

  const grouped = {
    afternoon: filtered.filter(e => getTimeCategory(e.time) === 'afternoon'),
    evening: filtered.filter(e => getTimeCategory(e.time) === 'evening'),
    late: filtered.filter(e => getTimeCategory(e.time) === 'late'),
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#070d1f', fontFamily: 'Open Sans, sans-serif' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 pt-12 px-5 pb-3"
        style={{ background: 'rgba(7,13,31,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
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
              {events.length} events
            </span>
          )}
        </div>

        {/* 14-day calendar scroll */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: 'none' }}>
          {days.map((day, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className="flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition-all"
              style={{
                background: selectedDay === i ? '#0048f9' : 'rgba(255,255,255,0.06)',
                border: selectedDay === i ? '1px solid #0048f9' : '1px solid rgba(255,255,255,0.08)',
                minWidth: 48,
              }}
            >
              <span style={{ fontFamily: 'Open Sans', color: selectedDay === i ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600 }}>
                {day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
              </span>
              <span style={{ fontFamily: 'Open Sans', color: selectedDay === i ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 700 }}>
                {day.getDate()}
              </span>
            </button>
          ))}
        </div>

        {/* Time filters */}
        <div className="flex gap-2">
          {(['all', 'afternoon', 'evening', 'late'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: activeCategory === cat ? '#0048f9' : 'rgba(255,255,255,0.07)',
                color: activeCategory === cat ? '#fff' : 'rgba(255,255,255,0.5)',
                border: activeCategory === cat ? '1px solid #0048f9' : '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'Open Sans',
              }}
            >
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
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'Open Sans' }}>Finding events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <span style={{ fontSize: 48 }}>🎭</span>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', fontFamily: 'Open Sans' }}>
              No events found.{'\n'}Check back later!
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
                    <span style={{ fontSize: 16 }}>{label.emoji}</span>
                    <h2 style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                      {label.label}
                    </h2>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  </div>

                  <div className="flex flex-col gap-3">
                    {catEvents.map((ev, i) => (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="rounded-2xl overflow-hidden cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                        onClick={() => setSelectedRestaurant(ev.restaurant)}
                      >
                        {/* Hero image */}
                        <div className="relative" style={{ height: 140 }}>
                          <img
                            src={ev.heroImage ?? ev.restaurant.image_url}
                            alt={ev.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0"
                            style={{ background: 'linear-gradient(to top, rgba(7,13,31,0.9) 0%, transparent 60%)' }} />

                          {/* Live badge */}
                          {ev.source === 'eventbrite' && (
                            <div
                              className="absolute top-3 left-3 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"
                              style={{ background: '#F05537', color: '#fff', fontSize: 10 }}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              LIVE
                            </div>
                          )}

                          {/* Time */}
                          <div
                            className="absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                          >
                            {ev.time}
                          </div>

                          {/* Venue name overlay */}
                          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                            <p className="text-xs font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                              {ev.restaurant.name} · {ev.restaurant.city}
                            </p>
                            <p className="font-bold text-sm text-white leading-snug">{ev.name}</p>
                          </div>
                        </div>

                        {/* Bottom action row */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <span
                            className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={{ background: 'rgba(69,118,239,0.15)', color: '#6B9EFF' }}
                          >
                            {ev.restaurant.cuisine}
                          </span>
                          <div className="flex-1" />
                          <button
                            onClick={e => { e.stopPropagation(); toggleFavorite(ev.restaurant.id) }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24"
                              fill={favorites.has(ev.restaurant.id) ? '#E11D48' : 'none'}
                              stroke={favorites.has(ev.restaurant.id) ? '#E11D48' : 'rgba(255,255,255,0.3)'}
                              strokeWidth="2">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                          </button>
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs font-bold px-3 py-1.5 rounded-xl"
                            style={{ background: '#4576EF', color: '#fff', textDecoration: 'none' }}
                          >
                            Get Tickets
                          </a>
                        </div>
                      </motion.div>
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
