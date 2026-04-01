import { useEffect, useState, useRef } from 'react'
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
  initialSection?: 'events' | 'directions' | 'menu' | null
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

interface PlaceInfo {
  rating?: number
  userRatingsTotal?: number
  photoUrl?: string
}

interface DisplayEvent {
  key: string
  name: string
  date: string
  time: string
  url: string
  source: 'eventbrite' | 'supabase'
}

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

function trackRecentlyViewed(id: number) {
  try {
    const existing = JSON.parse(localStorage.getItem('pp_recently_viewed') ?? '[]') as number[]
    const updated = [id, ...existing.filter((i: number) => i !== id)].slice(0, 10)
    localStorage.setItem('pp_recently_viewed', JSON.stringify(updated))
  } catch {}
}

async function shareRestaurant(name: string, city: string) {
  const text = `Check out ${name} in ${city} on PlatePost! 🍽️`
  const url = window.location.origin
  if (navigator.share) {
    try {
      await navigator.share({ title: name, text, url })
    } catch {}
  } else {
    await navigator.clipboard.writeText(`${text} ${url}`)
    alert('Link copied to clipboard!')
  }
}

export default function RestaurantDetail({ restaurant: r, onClose, initialSection, isFavorite = false, onToggleFavorite }: Props) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const navigate = useNavigate()
  const [events, setEvents] = useState<DisplayEvent[]>([])
  const [placeInfo, setPlaceInfo] = useState<PlaceInfo>({})
  const [heroImage, setHeroImage] = useState(r.image_url)
  const [loadingPlace, setLoadingPlace] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const eventsSectionRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchEvents()
    loadPlaceInfo()
    trackRecentlyViewed(r.id)
  }, [r.id])

  // Auto-scroll to section if initialSection is passed from feed card buttons
  useEffect(() => {
    if (!initialSection || loadingEvents) return
    if (initialSection === 'events' && eventsSectionRef.current) {
      setTimeout(() => {
        eventsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 400)
    }
    if (initialSection === 'directions') {
      window.open(getDirectionsUrl(), '_blank')
    }
  }, [initialSection, loadingEvents])

  async function fetchEvents() {
    setLoadingEvents(true)
    const liveEvents = await searchEventbriteEvents(r.name, r.city, r.state)

    if (liveEvents.length > 0) {
      setEvents(liveEvents.map((ev) => ({
        key: ev.id,
        name: ev.name,
        date: ev.date,
        time: ev.time,
        url: ev.url,
        source: 'eventbrite' as const,
      })))
      setLoadingEvents(false)
      return
    }

    const { data } = await supabase.from('events').select('*').eq('restaurant_id', r.id)
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
    const [placeData, pexelsPhoto] = await Promise.all([
      fetchPlaceDetails(r.name, r.city),
      fetchPexelsPhoto(`${r.name} ${r.cuisine} restaurant`),
    ])
    setPlaceInfo(placeData)
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
        ref={sheetRef}
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
          {/* Share button */}
          <button
            onClick={() => shareRestaurant(r.name, r.city)}
            className="absolute top-3 right-12 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          {/* Favorite button */}
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.45)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={isFavorite ? '#E11D48' : 'none'}
                stroke={isFavorite ? '#E11D48' : 'white'}
                strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          )}
        </div>

        {/* Name + rating */}
        <div className="px-4 mb-4">
          <h2
            className="font-bold text-xl mb-1 leading-tight"
            style={{ fontFamily: 'Bungee, cursive', color: '#FAFBFF', letterSpacing: '0.03em' }}
          >
            {r.name}
          </h2>

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

          {loadingPlace ? (
            <div className="h-5 w-40 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)' }} />
          ) : placeInfo.rating ? (
            <div className="flex items-center gap-2">
              <Stars rating={placeInfo.rating} />
              <span className="text-sm font-bold" style={{ color: '#FBBF24', fontFamily: 'Manrope' }}>
                {placeInfo.rating.toFixed(1)}
              </span>
              {placeInfo.userRatingsTotal && (
                <span className="text-xs opacity-40" style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}>
                  ({placeInfo.userRatingsTotal.toLocaleString()} reviews)
                </span>
              )}
            </div>
          ) : null}

          {r.description && (
            <p
              className="text-sm leading-relaxed mt-3 opacity-60"
              style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}
            >
              {r.description}
            </p>
          )}
        </div>

        {/* Upcoming event preview */}
        {!loadingEvents && events.length > 0 && (
          <div className="mx-4 mb-4 rounded-xl p-3 flex items-center gap-3"
            style={{ background: 'rgba(69,118,239,0.12)', border: '1px solid rgba(69,118,239,0.25)' }}>
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

        {/* Action buttons — VideoMenu full width on top for PlatePost customers */}
        <div className="px-4 mb-4">
          {r.platepost_menu_url && (
            <button
              onClick={() => setIframeUrl(r.platepost_menu_url)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl mb-3 text-sm font-bold"
              style={{ background: '#0048f9', color: '#fff', fontFamily: 'Open Sans, sans-serif' }}
            >
              <svg width="16" height="16" viewBox="0 0 100 100" fill="none">
                <path d="M15 8 L90 50 L15 92 Z" fill="white" />
                <ellipse cx="52" cy="36" rx="10" ry="12" fill="#0048f9" />
                <rect x="44" y="46" width="7" height="22" rx="3.5" fill="#0048f9" transform="rotate(15 47 57)" />
              </svg>
              VideoMenu
            </button>
          )}
          <button
            onClick={() => { onClose(); navigate(`/menu/${r.id}`) }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.07)', color: '#FAFBFF', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'Open Sans, sans-serif' }}
          >
            🍽️ More Info
          </button>
        </div>

        {/* Address + hours */}
        <div className="px-4 mb-4">
          {r.address && (
            <div className="flex items-start gap-2 mb-2">
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 2 }}>📍</span>
              <p style={{ fontFamily: 'Open Sans, sans-serif', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{r.address}</p>
            </div>
          )}
          {r.phone && (
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: 14 }}>📞</span>
              <p style={{ fontFamily: 'Open Sans, sans-serif', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{r.phone}</p>
            </div>
          )}
          {r.website_url && (
            <button
              onClick={() => setIframeUrl(r.website_url)}
              className="flex items-center gap-2"
            >
              <span style={{ fontSize: 14 }}>🔗</span>
              <span style={{ fontFamily: 'Open Sans, sans-serif', color: '#60a5fa', fontSize: 13, textDecoration: 'underline' }}>
                Visit Website
              </span>
            </button>
          )}
        </div>

        {/* Full events list */}
        {!loadingEvents && events.length > 0 && (
          <div id="events-section" ref={eventsSectionRef} className="px-4 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-40"
                style={{ fontFamily: 'Manrope', color: '#FAFBFF' }}>
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
                <button
                  key={ev.key}
                  onClick={() => setIframeUrl(ev.url)}
                  className="flex items-center gap-3 rounded-xl p-3 w-full text-left"
                  style={{
                    background: 'rgba(69,118,239,0.1)',
                    border: '1px solid rgba(69,118,239,0.2)',
                  }}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(69,118,239,0.2)', fontSize: 18 }}>
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
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Smart Iframe Modal ── */}
      {iframeUrl && (
        <SmartIframe url={iframeUrl} onClose={() => setIframeUrl(null)} />
      )}
    </>
  )
}

// Smart iframe — always tries iframe first, Open in Browser always available in header
function SmartIframe({ url, onClose }: { url: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  const isVideoMenu = url.includes('platepost.io')
  const isEventbrite = url.includes('eventbrite.com')
  const isHollywoodBowl = url.includes('hollywoodbowl.com')
  const isLighthouse = url.includes('thelighthousecafe')
  const isTheEcho = url.includes('theecho.com')
  const isTroubadour = url.includes('troubadour.com')

  // These sites are known to block iframes — open directly in new tab
  const alwaysOpenExternal = isHollywoodBowl || isLighthouse || isTheEcho || isTroubadour

  useEffect(() => {
    if (alwaysOpenExternal) {
      window.open(url, '_blank')
      onClose()
      return
    }
    // 5 second timeout — if iframe hasn't loaded, show fallback
    const timer = setTimeout(() => {
      if (!loaded) setTimedOut(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [url])

  if (alwaysOpenExternal) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: '#0e1f42', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.1)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
        {isVideoMenu && (
          <img src="/pp-mark.png" alt="" width={16} height={16}
            style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        )}
        <span style={{ color: '#fff', fontFamily: 'Open Sans', fontSize: 14, fontWeight: 600 }}>
          {isVideoMenu ? 'VideoMenu' : isEventbrite ? 'Get Tickets' : 'Visit Website'}
        </span>
        <a href={url} target="_blank" rel="noreferrer"
          className="ml-auto text-xs px-3 py-1.5 rounded-full flex items-center gap-1"
          style={{ background: '#0048f9', color: '#fff', textDecoration: 'none', fontFamily: 'Open Sans', fontWeight: 600 }}>
          Open ↗
        </a>
      </div>

      {/* Iframe */}
      {timedOut ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6"
          style={{ background: '#070d1f' }}>
          <span style={{ fontSize: 48 }}>🌐</span>
          <p style={{ fontFamily: 'Open Sans', color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>
            Couldn't load this page
          </p>
          <a href={url} target="_blank" rel="noreferrer"
            className="px-6 py-3 rounded-2xl text-sm font-bold"
            style={{ background: '#0048f9', color: '#fff', textDecoration: 'none', fontFamily: 'Open Sans' }}>
            Open in Browser ↗
          </a>
        </div>
      ) : (
        <iframe
          src={url}
          className="flex-1 w-full border-0"
          title="Content"
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  )
}
