import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Restaurant, Event } from '../types'

interface Props {
  restaurant: Restaurant
  onClose: () => void
}

export default function RestaurantDetail({ restaurant: r, onClose }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [r.id])

  async function fetchEvents() {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('restaurant_id', r.id)
    setEvents(data ?? [])
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
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
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
          border: '1px solid rgba(69,118,239,0.2)',
          maxHeight: '88vh',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Hero image */}
        <div className="relative mx-4 mb-4 rounded-2xl overflow-hidden" style={{ height: 180 }}>
          <img
            src={r.image_url}
            alt={r.name}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(14,31,66,0.8) 0%, transparent 60%)' }}
          />
          {r.tier === 'pro' && (
            <div
              className="absolute top-3 left-3 text-xs font-bold px-2 py-1 rounded-lg"
              style={{ background: '#4576EF', color: '#fff', fontFamily: 'Manrope' }}
            >
              PRO
            </div>
          )}
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="px-4 mb-5">
          <h2
            className="font-bold text-xl mb-1"
            style={{ fontFamily: 'Bungee, cursive', color: '#FAFBFF', letterSpacing: '0.03em' }}
          >
            {r.name}
          </h2>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(69,118,239,0.15)', color: '#6B9EFF', fontFamily: 'Manrope' }}
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
          {r.description && (
            <p
              className="text-sm leading-relaxed opacity-60"
              style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}
            >
              {r.description}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-4 mb-4 grid grid-cols-2 gap-3">
          {/* View Menu */}
          {r.platepost_menu_url || r.website_url ? (
            <ActionButton
              icon="🍽️"
              label="View Menu"
              onClick={() => setMenuOpen(true)}
              primary
            />
          ) : null}

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

          {/* Events — only if Eventbrite events exist */}
          {events.length > 0 && (
            <ActionButton
              icon="🎟️"
              label={`Events (${events.length})`}
              onClick={() => {
                const el = document.getElementById('events-section')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
            />
          )}
        </div>

        {/* Events section */}
        {events.length > 0 && (
          <div id="events-section" className="px-4 mb-8">
            <h3
              className="text-sm font-bold mb-3 opacity-60 uppercase tracking-widest"
              style={{ fontFamily: 'Manrope', color: '#FAFBFF', fontSize: 11 }}
            >
              Upcoming Events
            </h3>
            <div className="flex flex-col gap-2">
              {events.map((ev) => (
                <a
                  key={ev.id}
                  href={ev.eventbrite_url}
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
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}
                    >
                      {ev.event_name}
                    </p>
                    <p
                      className="text-xs opacity-50"
                      style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}
                    >
                      {ev.event_date} · {ev.event_time}
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

      {/* In-app menu browser */}
      {menuOpen && (
        <MenuBrowser
          url={r.platepost_menu_url || r.website_url}
          name={r.name}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  )
}

// ── Action button ────────────────────────────────────────────────────────────
function ActionButton({
  icon,
  label,
  onClick,
  primary = false,
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
        background: primary ? 'linear-gradient(135deg, #4576EF 0%, #2a56d4 100%)' : 'rgba(255,255,255,0.07)',
        color: '#FAFBFF',
        border: primary ? 'none' : '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <span>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

// ── In-app menu browser ──────────────────────────────────────────────────────
function MenuBrowser({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#071126' }}
    >
      {/* PlatePost branding bar */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: '#0e1f42', borderBottom: '1px solid rgba(69,118,239,0.2)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: 'Bungee, cursive', color: '#4576EF', fontSize: 16 }}>
            PlatePost
          </span>
          <span
            className="text-xs opacity-40 truncate max-w-32"
            style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}
          >
            · {name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="#FAFBFF" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* iframe */}
      <iframe
        src={url}
        title={`${name} menu`}
        className="flex-1 w-full"
        style={{ border: 'none' }}
      />
    </motion.div>
  )
}
