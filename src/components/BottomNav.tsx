// src/components/BottomNav.tsx
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PlatePostOrbMark } from './PlatePostLogo'

const TABS = [
  {
    id: 'home', path: '/', label: 'Home',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"
          fill={active ? '#0048f9' : 'none'}
          stroke={active ? '#0048f9' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 21V12h6v9"
          stroke={active ? '#fff' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'map', path: '/map', label: 'Map',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill={active ? '#0048f9' : 'none'}
          stroke={active ? '#0048f9' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8" />
        <circle cx="12" cy="9" r="2.5" fill={active ? '#fff' : 'rgba(255,255,255,0.65)'} />
      </svg>
    ),
  },
  { id: 'crave', path: '/concierge', label: 'Crave', isCrave: true },
  {
    id: 'feed', path: '/list', label: 'Feed',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <polygon points="5,3 19,12 5,21"
          fill={active ? '#0048f9' : 'none'}
          stroke={active ? '#0048f9' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'events', path: '/events', label: 'Events',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2"
          fill={active ? '#0048f9' : 'none'}
          stroke={active ? '#0048f9' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8" />
        <path d="M16 2v4M8 2v4M3 10h18"
          stroke={active ? '#fff' : 'rgba(255,255,255,0.65)'}
          strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 500,
      background: 'rgba(4,6,16,0.97)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderTop: '1px solid rgba(255,255,255,0.16)',
      boxShadow: '0 -4px 32px rgba(0,0,0,0.5)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 64 }}>
        {TABS.map((tab) => {
          const active = isActive(tab.path)
          if (tab.isCrave) {
            return (
              <div key={tab.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <motion.button
                  onClick={() => navigate(tab.path)}
                  whileTap={{ scale: 0.88 }}
                  animate={{ boxShadow: ['0 0 14px rgba(0,72,249,0.55)', '0 0 28px rgba(0,72,249,0.85)', '0 0 14px rgba(0,72,249,0.55)'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0048f9, #3b82f6)',
                    border: '2.5px solid rgba(255,255,255,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', marginTop: -12,
                  }}
                >
                  <PlatePostOrbMark size={22} />
                </motion.button>
                <span style={{
                  fontFamily: 'Open Sans, sans-serif', fontSize: 9, fontWeight: 600,
                  color: active ? '#4d8bff' : 'rgba(255,255,255,0.55)',
                  letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 3,
                }}>Crave</span>
              </div>
            )
          }
          return (
            <motion.button
              key={tab.id}
              onClick={() => {
                // Feed tab always opens light list view, not dark reels
                if (tab.id === 'feed') {
                  navigate('/list', { state: { listView: true } })
                } else {
                  navigate(tab.path)
                }
              }}
              whileTap={{ scale: 0.85 }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 4, height: '100%',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
              }}
            >
              {/* Active indicator bar at top */}
              {active && (
                <motion.div
                  layoutId="navBar"
                  style={{
                    position: 'absolute', top: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 32, height: 2.5, borderRadius: '0 0 3px 3px',
                    background: '#0048f9',
                  }}
                />
              )}
              {(tab as any).icon(active)}
              <span style={{
                fontFamily: 'Open Sans, sans-serif', fontSize: 9,
                fontWeight: active ? 700 : 500,
                color: active ? '#4d8bff' : 'rgba(255,255,255,0.55)',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
