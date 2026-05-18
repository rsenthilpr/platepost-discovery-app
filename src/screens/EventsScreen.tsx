// src/screens/EventsScreen.tsx
//
// v2 changes (Fix #1.5):
// - Passes city.lat/lng to Ticketmaster API for international queries
//   (Ticketmaster's `latlong` param works globally; stateCode is US-only).
// - Empty state with friendly explanation when no events are available
//   in the user's region (especially common outside US/EU).
// - Resilient to API failures — won't blank-screen if Ticketmaster is down.
//
// Note: Ticketmaster's catalog is US/EU-heavy. Events in India/SE Asia/Africa
// will be sparse or empty. This is a data limitation, not a bug. The empty
// state explains this honestly.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import BottomNav from '../components/BottomNav'
import { useCityStore, isUSCity } from '../lib/cityStore'

interface TicketmasterEvent {
  id: string
  name: string
  url: string
  imageUrl: string | null
  date: string
  time: string | null
  venue: string
  city: string
  classification: string
  priceMin: number | null
  priceMax: number | null
}

const CATEGORIES = [
  { label: 'All', tmCategory: '' },
  { label: 'Music', tmCategory: 'KZFzniwnSyZfZ7v7nJ' },
  { label: 'Food & Drink', tmCategory: 'KZFzniwnSyZfZ7v7lv' },
  { label: 'Arts', tmCategory: 'KZFzniwnSyZfZ7v7na' },
  { label: 'Sports', tmCategory: 'KZFzniwnSyZfZ7v7nE' },
  { label: 'Family', tmCategory: 'KZFzniwnSyZfZ7v7n1' },
]

function formatDate(iso: string): { day: string; month: string; weekday: string } {
  const d = new Date(iso)
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
  }
}

function formatTime(iso: string, time: string | null): string {
  try {
    const d = time ? new Date(`${iso.split('T')[0]}T${time}`) : new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch { return '' }
}

export default function EventsScreen() {
  const navigate = useNavigate()
  const { city } = useCityStore()
  const [events, setEvents] = useState<TicketmasterEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchEvents()
  }, [city.name, city.countryCode, activeCategory])

  async function fetchEvents() {
    setLoading(true)
    setError(null)
    try {
      // Build query params:
      // - For US cities, use stateCode (Ticketmaster's recommended path).
      // - For international, use latlong + radius — works globally.
      const params = new URLSearchParams()
      if (isUSCity(city)) {
        params.set('city', city.name)
        if (city.state) params.set('stateCode', city.state)
      } else {
        // Ticketmaster supports latlong=lat,lng + radius for global queries
        params.set('latlong', `${city.lat},${city.lng}`)
        params.set('radius', '50') // 50 mile radius
        params.set('unit', 'miles')
      }
      const category = CATEGORIES.find(c => c.label === activeCategory)
      if (category?.tmCategory) params.set('classificationId', category.tmCategory)
      params.set('size', '50')
      params.set('sort', 'date,asc')

      const res = await fetch(`/api/ticketmaster?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`Ticketmaster returned ${res.status}`)
      }
      const data = await res.json()
      setEvents(data.events ?? [])
    } catch (err) {
      console.error('Events fetch error:', err)
      setError("Couldn't load events right now.")
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = events.filter(e => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return e.name.toLowerCase().includes(q) ||
      e.venue.toLowerCase().includes(q) ||
      e.classification.toLowerCase().includes(q)
  })

  // Group events by date for the timeline-style list
  const grouped: Record<string, TicketmasterEvent[]> = {}
  filtered.forEach(e => {
    const key = e.date.split('T')[0]
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(e)
  })

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#f8f9fa' }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        paddingTop: 'env(safe-area-inset-top, 44px)',
      }}>
        <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/')}
            style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="#071126" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'Open Sans', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
              Events in
            </p>
            <h1 style={{
              fontFamily: 'Open Sans, sans-serif', fontWeight: 800, fontSize: 20,
              color: '#071126', margin: '2px 0 0',
            }}>
              {city.name}
            </h1>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f5f5', borderRadius: 12, padding: '10px 14px', border: '1.5px solid #e5e7eb' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" stroke="#071126" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Open Sans', fontSize: 14, color: '#071126' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, padding: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="#071126" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 16px 12px', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(c => (
            <button key={c.label} onClick={() => setActiveCategory(c.label)}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 999,
                fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                background: activeCategory === c.label ? '#0048f9' : '#fff',
                color: activeCategory === c.label ? '#fff' : '#6b7280',
                border: activeCategory === c.label ? '1.5px solid #0048f9' : '1.5px solid #e5e7eb',
              }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div style={{ padding: '8px 20px 4px', flexShrink: 0 }}>
        <p style={{ fontFamily: 'Open Sans', fontSize: 12, color: '#9ca3af', margin: 0 }}>
          {loading ? 'Loading…' : `${filtered.length} event${filtered.length !== 1 ? 's' : ''}`}
          {!loading && search ? ` for "${search}"` : ''}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-24" style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#0048f9', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : error ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <span style={{ fontSize: 48 }}>⚠️</span>
            <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 16, color: '#071126', margin: '12px 0 6px' }}>
              {error}
            </p>
            <p style={{ fontFamily: 'Open Sans', fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>
              Try again in a moment
            </p>
            <button onClick={fetchEvents}
              style={{ background: '#0048f9', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontFamily: 'Open Sans', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state — honest about data limitations outside US/EU */
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <span style={{ fontSize: 48 }}>🎪</span>
            <p style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 16, color: '#071126', margin: '12px 0 6px' }}>
              No events found
            </p>
            <p style={{ fontFamily: 'Open Sans', fontSize: 13, color: '#9ca3af', margin: '0 auto', maxWidth: 280, lineHeight: 1.5 }}>
              {!isUSCity(city)
                ? `We don't have many event listings in ${city.name} yet. Our coverage is strongest in the US and Europe.`
                : `No upcoming ${activeCategory === 'All' ? '' : activeCategory.toLowerCase() + ' '}events in ${city.name} right now. Try a different category.`}
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                marginTop: 20,
                background: '#0048f9', color: '#fff', border: 'none',
                borderRadius: 12, padding: '10px 24px',
                fontFamily: 'Open Sans', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>
              Discover restaurants instead
            </button>
          </div>
        ) : (
          /* Events grouped by date */
          <motion.div
            initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
          >
            {Object.entries(grouped).map(([dateKey, dayEvents]) => {
              const { day, month, weekday } = formatDate(dateKey)
              return (
                <div key={dateKey} style={{ marginTop: 16 }}>
                  {/* Date header */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, padding: '0 4px' }}>
                    <span style={{ fontFamily: 'Open Sans', fontWeight: 800, fontSize: 22, color: '#071126' }}>{day}</span>
                    <span style={{ fontFamily: 'Open Sans', fontWeight: 700, fontSize: 12, color: '#9ca3af', letterSpacing: '0.08em' }}>{month}</span>
                    <span style={{ fontFamily: 'Open Sans', fontWeight: 600, fontSize: 11, color: '#9ca3af' }}>·</span>
                    <span style={{ fontFamily: 'Open Sans', fontWeight: 600, fontSize: 11, color: '#9ca3af' }}>{weekday}</span>
                  </div>

                  {/* Day's events */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dayEvents.map(e => (
                      <motion.a
                        key={e.id}
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: '#fff', borderRadius: 16, padding: 12,
                          border: '1px solid #f0f0f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                          textDecoration: 'none',
                        }}
                      >
                        <div style={{
                          width: 72, height: 72, borderRadius: 12,
                          background: '#e5e7eb', flexShrink: 0, overflow: 'hidden',
                          position: 'relative',
                        }}>
                          {e.imageUrl ? (
                            <img src={e.imageUrl} alt={e.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(ev) => { (ev.target as HTMLImageElement).style.opacity = '0.3' }}
                            />
                          ) : (
                            <div style={{
                              width: '100%', height: '100%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'linear-gradient(135deg, #0048f9, #1a2f5e)',
                            }}>
                              <span style={{ fontSize: 28 }}>🎟️</span>
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontFamily: 'Open Sans', fontWeight: 700, fontSize: 14,
                            color: '#071126', margin: '0 0 3px',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}>
                            {e.name}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'Open Sans', fontSize: 11, fontWeight: 600, color: '#0048f9', background: 'rgba(0,72,249,0.08)', padding: '2px 8px', borderRadius: 999 }}>
                              {e.classification}
                            </span>
                            {(e.priceMin !== null && e.priceMin > 0) && (
                              <span style={{ fontFamily: 'Open Sans', fontSize: 11, fontWeight: 600, color: '#10b981' }}>
                                from ${e.priceMin}
                              </span>
                            )}
                          </div>
                          <p style={{ fontFamily: 'Open Sans', fontSize: 11, color: '#9ca3af', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            🕒 {formatTime(e.date, e.time)} · 📍 {e.venue}
                          </p>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.25 }}>
                          <path d="M7 17L17 7M17 7H7M17 7v10" stroke="#071126" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </motion.a>
                    ))}
                  </div>
                </div>
              )
            })}
            <div style={{ height: 40 }} />
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
