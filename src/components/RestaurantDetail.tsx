import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchPlaceDetails } from '../lib/googlePlaces'
import { fetchPexelsPhoto } from '../lib/pexels'
import { searchEventbriteEvents } from '../lib/eventbrite'
import type { Restaurant, Event } from '../types'

interface Props {
  restaurant: Restaurant
  onClose: () => void
}

interface PlaceInfo {
  rating?: number
  userRatingsTotal?: number
  photoUrl?: string
}

// Normalised event — works for both Supabase rows and live Eventbrite results
interface DisplayEvent {
  key: string
  name: string
  date: string
  time: string
  url: string
  source: 'eventbrite' | 'supabase'
}

// Star rating display
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width="13" height="13" viewBox="0 0 24 24">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={star <= Math.round(rating) ? '#FBBF24' : '#374151'}
          />
        </svg>
      ))}
    </div>
  )
}

export default function RestaurantDetail({ restaurant: r, onClose }: Props) {
  const navigate = useNavigate()
  const [events, setEvents] = useState<DisplayEvent[]>([])
  const [placeInfo, setPlaceInfo] = useState<PlaceInfo>({})
  const [heroImage, setHeroImage] = useState(r.image_url)
  const [loadingPlace, setLoadingPlace] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)

  useEffect(() => {
    fetchEvents()
    loadPlaceInfo()
  }, [r.id])

  async function fetchEvents() {
    setLoadingEvents(true)

    // Try Eventbrite first for live events
    const liveEvents = await searchEventbriteEvents(r.name, r.city, r.state)

    if (liveEvents.length > 0) {
      setEvents(
        liveEvents.map((ev) => ({
          key: ev.id,
          name: ev.name,
          date: ev.date,
          time: ev.time,
          url: ev.url,
          source: 'eventbrite' as const,
        })),
      )
      setLoadingEvents(false)
      return
    }

    // Fall back to seeded Supabase events
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('restaurant_id', r.id)

    const supabaseEvents: DisplayEvent[] = (data ?? []).map((ev: Event) => ({
      key: String(ev.id),
      name: ev.event_name,
      date: ev.event_date,
      time: ev.event_time,
      url: ev.eventbrite_url,
      source: 'supabase' as const,
    }))

    setEvents(supabaseEvents)
    setLoadingEvents(false)
  }

  async function loadPlaceInfo() {
    setLoadingPlace(true)

    // Fetch Google Places data and Pexels photo in parallel
    const [placeData, pexelsPhoto] = await Promise.all([
      fetchPlaceDetails(r.name, r.city),
      fetchPexelsPhoto(`${r.name} ${r.cuisine} restaurant`),
    ])

    setPlaceInfo(placeData)

    // Priority: Google Places photo > Pexels photo > original Unsplash
    if (placeData.photoUrl) {
      setHeroImage(placeData.photoUrl)
    } else if (pexelsPhoto?.url) {
      setHeroImage(pexelsPhoto.url)
    }

    setLoadingPlace(false)
  }

  function getDirectionsUrl() {
    const q = encodeURIComponent(`${r.name}, ${r.city}, ${r.state}`)
    return `https://www.google.com/maps/search/?api=1&query=${q}`
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-30"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-40 rounded-t-3xl overflow-hidden"
        style={{
          background: '#0e1f42',
          maxHeight: '90vh',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Hero image */}
        <div className="relative mx-4 mb-4 rounded-2xl overflow-hidden" style={{ height: 200 }}>
          <img
            src={heroImage}
            alt={r.name}
            className="w-full h-full object-cover"
            onError={() => setHeroImage(r.image_url)}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(14,31,66,0.85) 0%, transparent 55%)' }}
          />
          {r.tier === 'pro' && (
            <div
              className="absolute top-3 left-3 text-xs font-bold px-2 py-1 rounded-lg"
              style={{ background: '#4576EF', color: '#fff', fontFamily: 'Manrope' }}
            >
              PRO
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Name + rating */}
        <div className="px-4 mb-4">
          <h2
            className="font-bold text-xl mb-1 leading-tight"
            style={{ fontFamily: 'Bungee, cursive', color: '#FAFBFF', letterSpacing: '0.03em' }}
          >
            {r.name}
          </h2>

          {/* Cuisine badge + location */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span
              className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(69,118,239,0.18)', color: '#6B9EFF', fontFamily: 'Manrope' }}
            >
              {r.cuisine}
            </span>
            <span
              className="text-xs opacity-50 flex items-center gap-1"
              style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor" />
              </svg>
              {r.city}, {r.state}
            </span>
          </div>

          {/* Rating row */}
          {loadingPlace ? (
            <div className="h-5 w-40 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)' }} />
          ) : placeInfo.rating ? (
            <div className="flex items-center gap-2">
              <Stars rating={placeInfo.rating} />
              <span
                className="text-sm font-bold"
                style={{ color: '#FBBF24', fontFamily: 'Manrope' }}
              >
                {placeInfo.rating.toFixed(1)}
              </span>
              {placeInfo.userRatingsTotal && (
                <span className="text-xs opacity-40" style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}>
                  ({placeInfo.userRatingsTotal.toLocaleString()} reviews)
                </span>
              )}
            </div>
          ) : null}

          {/* Description */}
          {r.description && (
            <p
              className="text-sm leading-relaxed mt-3 opacity-60"
              style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}
            >
              {r.description}
            </p>
          )}
        </div>

        {/* Upcoming event preview (if any) */}
        {!loadingEvents && events.length > 0 && (
          <div className="mx-4 mb-4 rounded-xl p-3 flex items-center gap-3"
            style={{ background: 'rgba(69,118,239,0.12)', border: '1px solid rgba(69,118,239,0.25)' }}
          >
            <span style={{ fontSize: 22 }}>🎟️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}>
                {events[0].name}
              </p>
              <p className="text-xs opacity-50" style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}>
                {events[0].date} · {events[0].time}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {events[0].source === 'eventbrite' && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: '#F05537', color: '#fff', fontFamily: 'Manrope', fontSize: 9 }}>
                  LIVE
                </span>
              )}
              {events.length > 1 && (
                <span className="text-xs font-bold px-2 py-1 rounded-full"
                  style={{ background: '#4576EF', color: '#fff', fontFamily: 'Manrope' }}>
                  +{events.length - 1}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action buttons — 2 column grid */}
        <div className="px-4 mb-4 grid grid-cols-2 gap-3">
          {/* View Menu — dark navy, primary */}
          <ActionButton
            icon="🍽️"
            label="View Menu"
            primary
            onClick={() => { onClose(); navigate(`/menu/${r.id}`) }}
          />

          {/* View Website */}
          {r.website_url && (
            <ActionButton
              icon="🌐"
              label="View Website"
              onClick={() => window.open(r.website_url, '_blank')}
            />
          )}

          {/* Get Directions */}
          <ActionButton
            icon="🗺️"
            label="Get Directions"
            onClick={() => window.open(getDirectionsUrl(), '_blank')}
          />

          {/* Events — only shown if events found (live Eventbrite or seeded) */}
          {!loadingEvents && events.length > 0 && (
            <ActionButton
              icon="🎟️"
              label={`Events (${events.length})`}
              onClick={() => {
                document.getElementById('events-section')?.scrollIntoView({ behavior: 'smooth' })
              }}
            />
          )}
        </div>

        {/* Full events list */}
        {!loadingEvents && events.length > 0 && (
          <div id="events-section" className="px-4 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-xs font-bold uppercase tracking-widest opacity-40"
                style={{ fontFamily: 'Manrope', color: '#FAFBFF' }}
              >
                Upcoming Events
              </h3>
              {events[0].source === 'eventbrite' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: '#F05537', color: '#fff', fontFamily: 'Manrope', fontSize: 9 }}>
                  LIVE FROM EVENTBRITE
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {events.map((ev) => (
                <a
                  key={ev.key}
                  href={ev.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{
                    background: 'rgba(69,118,239,0.1)',
                    border: '1px solid rgba(69,118,239,0.2)',
                    textDecoration: 'none',
                  }}
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(69,118,239,0.2)', fontSize: 18 }}
                  >
                    🎟️
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}>
                      {ev.name}
                    </p>
                    <p className="text-xs opacity-50" style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}>
                      {ev.date} · {ev.time}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="#4576EF" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}
      </motion.div>

    </>
  )
}

// ── Action button ──────────────────────────────────────────────────────────
function ActionButton({
  icon, label, onClick, primary = false,
}: {
  icon: string
  label: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all active:scale-95"
      style={{
        fontFamily: 'Manrope, sans-serif',
        background: primary ? '#071126' : 'rgba(255,255,255,0.07)',
        color: '#FAFBFF',
        border: primary ? '1px solid rgba(69,118,239,0.4)' : '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <span>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

