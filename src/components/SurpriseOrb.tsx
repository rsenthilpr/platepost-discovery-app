// src/components/SurpriseOrb.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

export default function SurpriseOrb() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [shook, setShook] = useState(false)
  const lastShake = useRef(0)
  const lastAccel = useRef({ x: 0, y: 0, z: 0 })

  useEffect(() => {
    function handleMotion(e: DeviceMotionEvent) {
      const accel = e.accelerationIncludingGravity
      if (!accel) return
      const { x = 0, y = 0, z = 0 } = accel
      const last = lastAccel.current
      const delta = Math.abs((x ?? 0) - last.x) + Math.abs((y ?? 0) - last.y) + Math.abs((z ?? 0) - last.z)
      lastAccel.current = { x: x ?? 0, y: y ?? 0, z: z ?? 0 }
      const now = Date.now()
      if (delta > 25 && now - lastShake.current > 1000) {
        lastShake.current = now
        triggerShake()
      }
    }

    function triggerShake() {
      setShook(true)
      setExpanded(true)
      setTimeout(() => {
        setShook(false)
        setExpanded(false)
        navigate('/surprise')
      }, 600)
    }

    // Always add listener — on Android/desktop no permission needed
    // On iOS permission is requested on first tap (below in onClick)
    window.addEventListener('devicemotion', handleMotion)
    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [navigate])

  return (
    <div style={{ position: 'fixed', bottom: 84, right: 16, zIndex: 490 }}>
      <motion.button
        onHoverStart={() => setExpanded(true)}
        onHoverEnd={() => setExpanded(false)}
        onTapStart={() => setExpanded(true)}
        onClick={async () => {
          // iOS 13+ requires DeviceMotionEvent permission from a direct user gesture
          const DME = DeviceMotionEvent as any
          if (typeof DME.requestPermission === 'function') {
            try { await DME.requestPermission() } catch {}
          }
          navigate('/surprise')
        }}
        whileTap={{ scale: 0.9 }}
        animate={{
          boxShadow: expanded || shook
            ? ['0 0 20px rgba(245,158,11,0.7)', '0 0 36px rgba(239,68,68,0.8)', '0 0 20px rgba(245,158,11,0.7)']
            : ['0 0 12px rgba(245,158,11,0.4)', '0 0 20px rgba(239,68,68,0.5)', '0 0 12px rgba(245,158,11,0.4)'],
          rotate: shook ? [0, -12, 12, -8, 8, 0] : 0,
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          display: 'flex', alignItems: 'center',
          gap: expanded ? 8 : 0, height: 48, borderRadius: 999,
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          border: '2px solid rgba(255,255,255,0.4)',
          cursor: 'pointer', overflow: 'hidden',
          paddingLeft: 12, paddingRight: expanded ? 16 : 12, minWidth: 48,
        }}
      >
        <motion.span
          animate={{ rotate: shook ? [0, 25, -25, 0] : expanded ? [0, 20, -20, 0] : [0, 15, -15, 0] }}
          transition={{ duration: shook ? 0.3 : expanded ? 0.5 : 3, repeat: expanded || shook ? 0 : Infinity }}
          style={{ fontSize: 20, flexShrink: 0 }}
        >
          🎲
        </motion.span>
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 700, fontSize: 13, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden' }}
            >
              Surprise me
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
