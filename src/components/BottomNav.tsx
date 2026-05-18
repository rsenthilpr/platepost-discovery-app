// src/components/BottomNav.tsx
// Fix #1: Four equal tabs. No center FAB. No floating orbs.
// Piggy AI moved to the Home hero as an "Ask PlatePost" pill.

import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

const TABS = [
  {
    id: 'home',
    path: '/',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"
          fill={active ? '#0048f9' : 'none'}
          stroke={active ? '#0048f9' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 21V12h6v9"
          stroke={active ? '#fff' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'map',
    path: '/map',
    label: 'Map',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"
          fill={active ? '#0048f9' : 'none'}
          stroke={active ? '#0048f9' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9 4v14M15 6v14"
          stroke={active ? '#fff' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'feed',
    path: '/list',
    label: 'Feed',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="3"
          fill={active ? '#0048f9' : 'none'}
          stroke={active ? '#0048f9' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8"
        />
        <polygon
          points="10,8 16,12 10,16"
          fill={active ? '#fff' : 'rgba(255,255,255,0.65)'}
        />
      </svg>
    ),
  },
  {
    id: 'events',
    path: '/events',
    label: 'Events',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="5"
          width="18"
          height="16"
          rx="2"
          fill={active ? '#0048f9' : 'none'}
          stroke={active ? '#0048f9' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8"
        />
        <path
          d="M16 3v4M8 3v4M3 11h18"
          stroke={active ? '#fff' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/'
    // Feed tab is active for both /list (reels) and any list-derived path
    if (path === '/list') return location.pathname.startsWith('/list')
    return location.pathname.startsWith(path)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 500,
        background: 'rgba(4,6,16,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.16)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.5)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', height: 64 }}>
        {TABS.map((tab) => {
          const active = isActive(tab.path)
          return (
            <motion.button
              key={tab.id}
              onClick={() => {
                // Feed defaults to video reels (dark), not list view
                if (tab.id === 'feed') {
                  navigate('/list', { state: { listView: false } })
                } else {
                  navigate(tab.path)
                }
              }}
              whileTap={{ scale: 0.85 }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                height: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                position: 'relative',
              }}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
            >
              {/* Active indicator — top bar */}
              {active && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 20,
                    height: 3,
                    borderRadius: '0 0 3px 3px',
                    background: '#0048f9',
                  }}
                />
              )}
              {tab.icon(active)}
              <span
                style={{
                  fontFamily: 'Open Sans, sans-serif',
                  fontSize: 9,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#4d8bff' : 'rgba(255,255,255,0.55)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
