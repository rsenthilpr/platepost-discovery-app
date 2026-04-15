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
    try { await navigator.share({ title: name, text, url }) } catch {}
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
        key: ev.id, name: ev.name, date: ev.date, time: ev.time, url: ev.url,
        source: 'eventbrite' as const,
      })))
      setLoadingEvents(false)
      return
    }
    const { data } = await supabase.from('events').select('*').eq('restaurant_id', r.id)
    const supabaseEvents: DisplayEvent[] = (data ?? []).map((ev: Event) => ({
      key: String(ev.id), name: ev.event_name, date: ev.event_date, time: ev.event_time,
      url: ev.eventbrite_url, source: 'supabase' as const,
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
    if (placeData.photoUrl) setHeroImage(placeData.photoUrl)
    else if (pexelsPhoto?.url) setHeroImage(pexelsPhoto.url)
    setLoadingPlace(false)
  }

  function getDirectionsUrl() {
    const q = encodeURIComponent(`${r.name}, ${r.city}, ${r.state}`)
    return `https://www.google.com/maps/search/?api=1&query=${q}`
  }

  // Pill style — consistent border-radius for ALL pills (Emilia fix)
  const pillStyle = (blue?: boolean): React.CSSProperties => ({
    fontSize: 11,
    fontFamily: 'Open Sans, sans-serif',
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 999, // consistent full-pill for all tags
    display: 'inline-flex',
    alignItems: 'center',
    ...(blue
      ? { background: '#0048f9', color: '#fff' }
      : { background: 'rgba(69,118,239,0.18)', color: '#6B9EFF' }),
  })

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-30"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        ref={sheetRef}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-40 rounded-t-3xl overflow-hidden"
        style={{ background: '#0e1f42', maxHeight: '90vh', overflowY: 'auto', scrollbarWidth: 'none' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Hero image — full bleed, no white gap (Emilia fix) */}
        <div className="relative" style={{ height: 210 }}>
          <img
            src={heroImage}
            alt={r.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
            onError={() => setHeroImage(r.image_url)}
          />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(14,31,66,0.9) 0%, transparent 50%)' }} />

          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.45)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={() => shareRestaurant(r.name, r.city)}
            className="absolute top-3 right-12 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.45)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          {onToggleFavorite && (
            <button onClick={onToggleFavorite}
              className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.45)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={isFavorite ? '#E11D48' : 'none'}
                stroke={isFavorite ? '#E11D48' : 'white'} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          )}
        </div>

        {/* Name + tags — all in one row, consistent pill radius (Emilia fix) */}
        <div className="px-4 pt-3 pb-3">
          <h2 style={{
            fontFamily: 'Open Sans, sans-serif', fontWeight: 800, color: '#FAFBFF',
            fontSize: '1.2rem', letterSpacing: '-0.01em', marginBottom: 8,
          }}>
            {r.name}
          </h2>

          {/* Tags row — cuisine + PRO inline, same pill shape (Emilia fix) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={pillStyle()}>{r.cuisine}</span>
            {r.tier === 'pro' && <span style={pillStyle(true)}>PRO</span>}
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'Open Sans', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              </svg>
              {r.city}, {r.state}
            </span>
          </div>

          {/* Rating */}
          {loadingPlace ? (
            <div className="h-4 w-36 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
          ) : placeInfo.rating ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Stars rating={placeInfo.rating} />
              <span style={{ color: '#FBBF24', fontFamily: 'Open Sans', fontWeight: 700, fontSize: 13 }}>
                {placeInfo.rating.toFixed(1)}
              </span>
              {placeInfo.userRatingsTotal && (
                <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Open Sans', fontSize: 11 }}>
                  ({placeInfo.userRatingsTotal.toLocaleString()})
                </span>
              )}
            </div>
          ) : null}

          {/* Description */}
          {r.description && (
            <p style={{ fontFamily: 'Open Sans, sans-serif', color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.55, marginTop: 6 }}>
              {r.description}
            </p>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px 16px' }} />

        {/* Location + Phone (Emilia fix — show these) */}
        <div className="px-4 mb-4" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {r.address && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📍</span>
              <p style={{ fontFamily: 'Open Sans, sans-serif', color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: 0, lineHeight: 1.4 }}>{r.address}</p>
            </div>
          )}
          {r.phone && (
            <a href={`tel:${r.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>📞</span>
              <p style={{ fontFamily: 'Open Sans, sans-serif', color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: 0 }}>{r.phone}</p>
            </a>
          )}
          {r.hours && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🕐</span>
              <p style={{ fontFamily: 'Open Sans, sans-serif', color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: 0 }}>{r.hours}</p>
            </div>
          )}
        </div>

        {/* Action buttons — Directions + Website */}
        <div className="px-4 mb-4" style={{ display: 'flex', gap: 10 }}>
          <a
            href={getDirectionsUrl()}
            target="_blank"
            rel="noreferrer"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '11px 0', borderRadius: 14, textDecoration: 'none',
              background: 'rgba(255,255,255,0.07)', color: '#FAFBFF',
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: 13,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor" opacity={0.7} />
            </svg>
            Directions
          </a>
          {r.website_url ? (
            <button
              onClick={() => setIframeUrl(r.website_url)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '11px 0', borderRadius: 14,
                background: 'rgba(255,255,255,0.07)', color: '#FAFBFF',
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity={0.7} />
                <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="currentColor" strokeWidth="2" opacity={0.7} />
              </svg>
              Website
            </button>
          ) : (
            <button
              onClick={() => navigate(`/menu/${r.id}`)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '11px 0', borderRadius: 14,
                background: 'rgba(255,255,255,0.07)', color: '#FAFBFF',
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polygon points="5,3 19,12 5,21" fill="currentColor" opacity={0.7} />
              </svg>
              Details
            </button>
          )}
        </div>

        {/* VideoMenu — primary CTA for pro customers */}
        {r.platepost_menu_url && (
          <div className="px-4 mb-4">
            <button
              onClick={() => setIframeUrl(r.platepost_menu_url)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px 0', borderRadius: 16, cursor: 'pointer',
                background: '#0048f9', color: '#fff',
                fontFamily: 'Open Sans, sans-serif', fontWeight: 700, fontSize: 14,
                border: 'none',
              }}
            >
              <img src="/pp-mark.png" alt="" width={16} height={16}
                style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
              VideoMenu
            </button>
          </div>
        )}

        {/* Upcoming event preview */}
        {!loadingEvents && events.length > 0 && (
          <div className="mx-4 mb-4 rounded-xl p-3 flex items-center gap-3"
            style={{ background: 'rgba(69,118,239,0.12)', border: '1px solid rgba(69,118,239,0.25)' }}>
            <span style={{ fontSize: 22 }}>🎟️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#FAFBFF', fontFamily: 'Open Sans', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                {events[0].name}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Open Sans', fontSize: 11, margin: '2px 0 0' }}>
                {events[0].date} · {events[0].time}
              </p>
            </div>
            {events.length > 1 && (
              <span style={{ background: '#4576EF', color: '#fff', fontFamily: 'Open Sans', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999 }}>
                +{events.length - 1}
              </span>
            )}
          </div>
        )}

        {/* Full events list */}
        {!loadingEvents && events.length > 0 && (
          <div id="events-section" ref={eventsSectionRef} className="px-4 mb-8">
            <h3 style={{ fontFamily: 'Open Sans', color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
              Upcoming Events
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map((ev: any) => (
                <button key={ev.key} onClick={() => setIframeUrl(ev.url)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, borderRadius: 12, padding: 12,
                    background: 'rgba(69,118,239,0.1)', border: '1px solid rgba(69,118,239,0.2)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(69,118,239,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    🎟️
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: '#FAFBFF', fontFamily: 'Open Sans', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                      {ev.name}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Open Sans', fontSize: 11, margin: '2px 0 0' }}>
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

        {/* Bottom spacer for nav */}
        <div style={{ height: 80 }} />
      </motion.div>

      {iframeUrl && <SmartIframe url={iframeUrl} onClose={() => setIframeUrl(null)} />}
    </>
  )
}

function SmartIframe({ url, onClose }: { url: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  const isVideoMenu = url.includes('platepost.io')
  const isEventbrite = url.includes('eventbrite.com')
  const alwaysOpenExternal = ['hollywoodbowl.com', 'thelighthousecafe', 'theecho.com', 'troubadour.com'].some(d => url.includes(d))

  useEffect(() => {
    if (alwaysOpenExternal) { window.open(url, '_blank'); onClose(); return }
    const timer = setTimeout(() => { if (!loaded) setTimedOut(true) }, 5000)
    return () => clearTimeout(timer)
  }, [url])

  if (alwaysOpenExternal) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#0e1f42', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
        {isVideoMenu && <img src="/pp-mark.png" alt="" width={16} height={16} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />}
        <span style={{ color: '#fff', fontFamily: 'Open Sans', fontSize: 14, fontWeight: 600 }}>
          {isVideoMenu ? 'VideoMenu' : isEventbrite ? 'Get Tickets' : url.includes('ticketmaster') ? 'Get Tickets' : 'Website'}
        </span>
        <a href={url} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', background: '#0048f9', color: '#fff', textDecoration: 'none', fontFamily: 'Open Sans', fontWeight: 600, fontSize: 12, padding: '6px 14px', borderRadius: 999 }}>
          Open ↗
        </a>
      </div>
      {timedOut ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#070d1f', padding: '0 24px' }}>
          <span style={{ fontSize: 48 }}>🌐</span>
          <p style={{ fontFamily: 'Open Sans', color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center', margin: 0 }}>Couldn't load this page</p>
          <a href={url} target="_blank" rel="noreferrer" style={{ background: '#0048f9', color: '#fff', textDecoration: 'none', fontFamily: 'Open Sans', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 16 }}>
            Open in Browser ↗
          </a>
        </div>
      ) : (
        <iframe src={url} style={{ flex: 1, width: '100%', border: 'none' }} title="Content" onLoad={() => setLoaded(true)} />
      )}
    </div>
  )
}
