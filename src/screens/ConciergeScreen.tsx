import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

function loadFavorites(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem('pp_favorites') ?? '[]')) } catch { return new Set() }
}
function saveFavorites(f: Set<number>) {
  localStorage.setItem('pp_favorites', JSON.stringify([...f]))
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  restaurants?: Restaurant[]
  loading?: boolean
}

const SUGGESTED_PROMPTS = [
  { text: "Plan my night 🌙", icon: "🌙", featured: true, prompt: "Plan my perfect night out — dinner and a venue for tonight in LA, budget $100 for 2 people" },
  { text: "First date, budget $80, romantic", icon: "🕯️", featured: false, prompt: "First date tonight, budget $80, somewhere romantic in LA" },
  { text: "Best coffee to work from, Silver Lake", icon: "☕", featured: false, prompt: "Best coffee shop to work from in Silver Lake" },
  { text: "Live jazz with dinner, not too loud", icon: "🎷", featured: false, prompt: "Live jazz with dinner, somewhere not too loud" },
  { text: "Late night food after a show, DTLA", icon: "🌃", featured: false, prompt: "Late night food after a show in DTLA" },
  { text: "Sunday brunch for 4, under $60 each", icon: "🥂", featured: false, prompt: "Sunday brunch for 4 people, under $60 each" },
]

const PIGGY_QUIPS = [
  "Oink! Great taste! 🔥",
  "Trust the pig 🐷",
  "I'm hungry just thinking about it 🍜",
  "Sniff sniff... smells delicious! 👃",
  "The pig approves! ✨",
  "Oink oink! You're my favorite human 🐽",
  "I've eaten there. 10/10. 🐷",
]

// Kawaii Piggy SVG Component — bigger, with working eye tracking
function KawaiiPiggy({
  eyeTarget,
  state: pigState,
  onTap,
  quip,
  size = 52,
  showTapHint = false,
}: {
  eyeTarget: { x: number; y: number } | null
  state: 'idle' | 'thinking' | 'happy' | 'squished'
  onTap: () => void
  quip: string | null
  size?: number
  showTapHint?: boolean
}) {
  const pigRef = useRef<SVGSVGElement>(null)
  const [eyeOffset, setEyeOffset] = useState({ lx: 0, ly: 0, rx: 0, ry: 0 })

  // Recalculate eye direction whenever cursor moves
  useEffect(() => {
    if (!eyeTarget || !pigRef.current) {
      setEyeOffset({ lx: 0, ly: 0, rx: 0, ry: 0 })
      return
    }
    const rect = pigRef.current.getBoundingClientRect()
    // Eye centers in screen coords (matching SVG viewBox positions scaled)
    const scale = rect.width / 100
    const leftEyeScreen = { x: rect.left + 36 * scale, y: rect.top + 48 * scale }
    const rightEyeScreen = { x: rect.left + 64 * scale, y: rect.top + 48 * scale }

    const calcOffset = (eyeScreen: { x: number; y: number }) => {
      const dx = eyeTarget.x - eyeScreen.x
      const dy = eyeTarget.y - eyeScreen.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist === 0) return { x: 0, y: 0 }
      const maxPx = 2.8
      return {
        x: (dx / dist) * Math.min(maxPx, dist * 0.12),
        y: (dy / dist) * Math.min(maxPx, dist * 0.12),
      }
    }

    const l = calcOffset(leftEyeScreen)
    const r = calcOffset(rightEyeScreen)
    setEyeOffset({ lx: l.x, ly: l.y, rx: r.x, ry: r.y })
  }, [eyeTarget])

  const isThinking = pigState === 'thinking'
  const isHappy = pigState === 'happy'
  const isSquished = pigState === 'squished'

  return (
    <div className="relative flex-shrink-0 flex flex-col items-center">
      {/* Speech bubble */}
      <AnimatePresence>
        {quip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="absolute whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold"
            style={{
              bottom: '105%', left: '50%', transform: 'translateX(-50%)',
              background: '#0048f9', color: '#fff',
              fontFamily: 'Open Sans', zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,72,249,0.4)',
            }}
          >
            {quip}
            <div style={{
              position: 'absolute', top: '100%', left: '50%',
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #0048f9',
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Piggy SVG */}
      <motion.svg
        ref={pigRef}
        width={size} height={size}
        viewBox="0 0 100 100"
        fill="none"
        onClick={onTap}
        style={{ cursor: 'pointer', display: 'block' }}
        animate={
          isSquished ? { scaleX: 1.3, scaleY: 0.7 } :
          isHappy ? { y: [0, -5, 0, -3, 0] } :
          isThinking ? { rotate: [-2, 2, -2] } :
          { y: [0, -3, 0] }
        }
        transition={
          isSquished ? { duration: 0.12, type: 'spring', stiffness: 400 } :
          isHappy ? { duration: 0.5, times: [0, 0.25, 0.5, 0.75, 1] } :
          isThinking ? { duration: 0.4, repeat: Infinity, ease: 'easeInOut' } :
          { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }
        }
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
      >
        {/* Shadow */}
        <ellipse cx="50" cy="95" rx="22" ry="4" fill="rgba(0,0,0,0.1)" />

        {/* Ears */}
        <ellipse cx="24" cy="34" rx="12" ry="14" fill="#FFB3C6" />
        <ellipse cx="76" cy="34" rx="12" ry="14" fill="#FFB3C6" />
        <ellipse cx="24" cy="35" rx="7" ry="9" fill="#FF85A1" />
        <ellipse cx="76" cy="35" rx="7" ry="9" fill="#FF85A1" />

        {/* Head */}
        <circle cx="50" cy="52" r="36" fill="#FFB3C6" />
        <circle cx="50" cy="50" r="34" fill="#FFDDE7" />

        {/* Cheek blush */}
        <ellipse cx="27" cy="63" rx="9" ry="5.5" fill="#FF85A1" opacity="0.45" />
        <ellipse cx="73" cy="63" rx="9" ry="5.5" fill="#FF85A1" opacity="0.45" />

        {/* Eyes */}
        {isThinking ? (
          <>
            <circle cx="36" cy="48" r="8" fill="white" />
            <circle cx="64" cy="48" r="8" fill="white" />
            <motion.circle cx="36" cy="48" r="4" fill="#1a0a2e"
              animate={{ cx: [32,36,40,36,32], cy: [48,44,48,52,48] }}
              transition={{ duration: 0.8, repeat: Infinity }} />
            <motion.circle cx="64" cy="48" r="4" fill="#1a0a2e"
              animate={{ cx: [60,64,68,64,60], cy: [48,44,48,52,48] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.1 }} />
            {/* Sweat drop */}
            <motion.g animate={{ y: [0, 3, 0] }} transition={{ duration: 0.4, repeat: Infinity }}>
              <ellipse cx="82" cy="28" rx="3.5" ry="5" fill="#93c5fd" opacity="0.9" />
              <path d="M82 23 L85 18" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
            </motion.g>
          </>
        ) : isHappy ? (
          <>
            {/* Happy curved eyes */}
            <path d="M28 48 Q36 40 44 48" stroke="#1a0a2e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M56 48 Q64 40 72 48" stroke="#1a0a2e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            {/* Sparkles */}
            <motion.text fontSize="14" textAnchor="middle"
              x="82" y="30"
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
              transition={{ duration: 0.7 }}>✨</motion.text>
            <motion.text fontSize="11" textAnchor="middle"
              x="16" y="32"
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
              transition={{ duration: 0.7, delay: 0.2 }}>⭐</motion.text>
          </>
        ) : (
          <>
            {/* Normal tracking eyes */}
            <circle cx="36" cy="48" r="8" fill="white" />
            <circle cx="64" cy="48" r="8" fill="white" />
            {/* Pupils — track cursor */}
            <circle cx={36 + eyeOffset.lx} cy={48 + eyeOffset.ly} r="4" fill="#1a0a2e" />
            <circle cx={64 + eyeOffset.rx} cy={48 + eyeOffset.ry} r="4" fill="#1a0a2e" />
            {/* Shine dots */}
            <circle cx={38.5 + eyeOffset.lx * 0.5} cy={45.5 + eyeOffset.ly * 0.5} r="1.5" fill="white" />
            <circle cx={66.5 + eyeOffset.rx * 0.5} cy={45.5 + eyeOffset.ry * 0.5} r="1.5" fill="white" />
          </>
        )}

        {/* Snout */}
        <ellipse cx="50" cy="62" rx="10" ry="7.5" fill="#FF85A1" />
        <circle cx="45.5" cy="61" r="2.2" fill="#d44a72" />
        <circle cx="54.5" cy="61" r="2.2" fill="#d44a72" />

        {/* Mouth */}
        {isHappy ? (
          <path d="M38 70 Q50 79 62 70" stroke="#d44a72" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M42 70 Q50 75 58 70" stroke="#d44a72" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
      </motion.svg>

      {/* Tap me — speech bubble style */}
      {showTapHint && (
        <motion.div
          animate={{ opacity: [0.7, 1, 0.7], y: [0, -2, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            position: 'absolute',
            bottom: '108%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 12,
            padding: '5px 10px',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          <span style={{ fontFamily: 'Open Sans', color: '#fff', fontSize: 10, fontWeight: 700 }}>
            👆 Tap me!
          </span>
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: '5px solid rgba(255,255,255,0.15)',
          }} />
        </motion.div>
      )}
    </div>
  )
}

export default function CraveScreen() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'assistant',
    text: "Hi! I'm PlatePost Crave 🍽️\n\nTell me what you're craving tonight — the more detail the better. I'll find the perfect spot.",
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const [piggyState, setPiggyState] = useState<'idle' | 'thinking' | 'happy' | 'squished'>('idle')
  const [piggyQuip, setPiggyQuip] = useState<string | null>(null)
  const [eyeTarget, setEyeTarget] = useState<{ x: number; y: number } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const conversationHistory = useRef<{ role: string; content: string }[]>([])
  const quipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.from('restaurants').select('*').then(({ data }) => setRestaurants(data ?? []))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Track cursor/touch for eye following
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const point = 'touches' in e ? e.touches[0] : e
      if (point) setEyeTarget({ x: point.clientX, y: point.clientY })
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('touchmove', handleMove)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('touchmove', handleMove)
    }
  }, [])

  function handlePiggyTap() {
    // Squish animation
    setPiggyState('squished')
    setTimeout(() => setPiggyState('idle'), 300)

    // Show random quip
    const quip = PIGGY_QUIPS[Math.floor(Math.random() * PIGGY_QUIPS.length)]
    setPiggyQuip(quip)
    if (quipTimeout.current) clearTimeout(quipTimeout.current)
    quipTimeout.current = setTimeout(() => {
      setPiggyQuip(null)
      // Random restaurant suggestion
      if (restaurants.length > 0) {
        const random = restaurants[Math.floor(Math.random() * restaurants.length)]
        const suggestionText = `Oink! How about ${random.name}? 🐷 I've got a good feeling about this one!`
        setInput(suggestionText)
        inputRef.current?.focus()
      }
    }, 1500)
  }

  function toggleFavorite(id: number) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      saveFavorites(next)
      return next
    })
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    setInput('')
    setLoading(true)
    setPiggyState('thinking')

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text }
    const loadingMsg: Message = { id: 'loading', role: 'assistant', text: '', loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    conversationHistory.current.push({ role: 'user', content: text })

    try {
      const restaurantList = restaurants.map(r =>
        `ID:${r.id} | ${r.name} | ${r.cuisine} | ${r.city}, ${r.state} | Rating: ${r.rating ?? 'N/A'} | ${r.description ?? ''}`
      ).join('\n')

      const systemPrompt = `You are PlatePost Crave, a fun, warm, and slightly cheeky AI food guide for Los Angeles. You're powered by PlatePost — the video-first restaurant discovery platform. You're like that friend who always knows the perfect spot.

Your personality:
- Warm, genuine, conversational — never corporate
- You give specific, confident recommendations with personality
- You sometimes reference the PlatePost VideoMenu (if the restaurant has one, mention it!)
- You're knowledgeable about LA neighborhoods and food culture
- Occasionally playful — you can mention the PlatePost piggy mascot if it fits naturally

Available restaurants in PlatePost:
${restaurantList}

PlatePost pro customers with VideoMenus (always mention these first when relevant):
- Kei Coffee House (ID 4) - platepost.io/kch
- Wish You Were Here Coffee Roasters (ID 5) - platepost.io/wywhcoffee  
- Ape Coffee Orange (ID 17) - platepost.io/apecoffeeorange
- Ape Coffee Placentia (ID 18) - platepost.io/apecoffeeplacentia

RULES:
1. Always recommend 2-3 restaurants from the list
2. End with [RESTAURANTS:1,3,5] with the IDs
3. Be specific — mention exact details, vibe, what to order
4. For "Plan my night": build a full evening: 🍽️ DINNER → 🎵 VENUE → [RESTAURANTS:id,id]
5. Never make up restaurants not in the list
6. Keep it concise — 2-3 sentences per recommendation max`

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          system: systemPrompt,
          messages: conversationHistory.current,
        }),
      })

      const data = await response.json()
      const rawText = data.content?.[0]?.text ?? "I couldn't find a match. Try describing what you're craving differently!"
      const idMatch = rawText.match(/\[RESTAURANTS:([\d,]+)\]/)
      const recommendedIds = idMatch ? idMatch[1].split(',').map(Number) : []
      const cleanText = rawText.replace(/\[RESTAURANTS:[\d,]+\]/, '').trim()
      const recommendedRestaurants = restaurants.filter(r => recommendedIds.includes(r.id))

      conversationHistory.current.push({ role: 'assistant', content: cleanText })
      setMessages(prev => [...prev.filter(m => m.id !== 'loading'), {
        id: Date.now().toString(),
        role: 'assistant',
        text: cleanText,
        restaurants: recommendedRestaurants.length > 0 ? recommendedRestaurants : undefined,
      }])
      setPiggyState('happy')
      setTimeout(() => setPiggyState('idle'), 1500)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      setMessages(prev => [...prev.filter(m => m.id !== 'loading'), {
        id: Date.now().toString(),
        role: 'assistant',
        text: `Oops, something went wrong: ${errMsg}. Try again!`,
      }])
      setPiggyState('idle')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#070d1f', fontFamily: 'Open Sans, sans-serif' }}>

      {/* Header */}
      <div className="flex-shrink-0 pt-12 px-5 pb-4 flex items-center gap-3"
        style={{ background: 'rgba(7,13,31,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate('/')}
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Piggy in header — small */}
        <KawaiiPiggy
          eyeTarget={eyeTarget}
          state={piggyState}
          onTap={handlePiggyTap}
          quip={null}
          size={38}
          showTapHint={false}
        />

        <div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            AI Powered
          </p>
          <h1 style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 800, color: '#fff', fontSize: 16, lineHeight: 1.1 }}>
            PlatePost Crave
          </h1>
        </div>

        {messages.length > 1 && (
          <button
            onClick={() => {
              setMessages([messages[0]])
              conversationHistory.current = []
            }}
            className="ml-auto text-xs opacity-30 hover:opacity-60 transition-opacity"
            style={{ color: '#fff' }}>
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
        {messages.map((msg) => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mr-2 mt-0.5 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #FFB3C6, #FF85A1)', fontSize: 14 }}>
                🐷
              </div>
            )}

            <div className={`max-w-xs lg:max-w-md ${msg.role === 'user' ? '' : 'flex-1'}`}>
              <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={{
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #0048f9, #3b82f6)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                  border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}>
                {msg.loading ? (
                  <div className="flex gap-1 items-center py-1">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="w-2 h-2 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.4)' }}
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </div>
                ) : (
                  <p style={{ whiteSpace: 'pre-line' }}>{msg.text}</p>
                )}
              </div>

              {/* Restaurant cards */}
              {msg.restaurants && msg.restaurants.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }} className="mt-3 flex flex-col gap-2">
                  {msg.restaurants.map(r => (
                    <motion.button key={r.id} whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedRestaurant(r)}
                      className="flex items-center gap-3 rounded-2xl p-3 text-left w-full"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <img src={r.image_url} alt={r.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-white truncate">{r.name}</p>
                        <p className="text-xs opacity-50 text-white">{r.cuisine} · {r.city}</p>
                        {r.rating && <p className="text-xs" style={{ color: '#FBBF24' }}>★ {r.rating.toFixed(1)}</p>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleFavorite(r.id) }} className="flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24"
                          fill={favorites.has(r.id) ? '#E11D48' : 'none'}
                          stroke={favorites.has(r.id) ? '#E11D48' : 'rgba(255,255,255,0.3)'} strokeWidth="2">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </button>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}

        {/* Suggested prompts */}
        {messages.length === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-2">
            <p className="text-xs mb-3 opacity-30 text-white font-semibold uppercase tracking-wider">Try asking...</p>
            <div className="flex flex-col gap-2">
              {SUGGESTED_PROMPTS.map(p => (
                <motion.button key={p.text} whileTap={{ scale: 0.97 }}
                  onClick={() => { setInput(p.prompt); inputRef.current?.focus() }}
                  className="text-left px-4 py-3 rounded-2xl text-sm flex items-center gap-3"
                  style={{
                    background: p.featured ? 'linear-gradient(135deg, rgba(0,72,249,0.2), rgba(0,72,249,0.1))' : 'rgba(255,255,255,0.04)',
                    border: p.featured ? '1px solid rgba(0,72,249,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    color: p.featured ? '#fff' : 'rgba(255,255,255,0.6)',
                  }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
                  <span style={{ fontFamily: 'Open Sans' }}>{p.featured ? <strong>{p.text}</strong> : `"${p.text}"`}</span>
                  {p.featured && <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,72,249,0.3)', color: '#60a5fa' }}>Featured</span>}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input + Piggy row */}
      <div className="flex-shrink-0 px-4 py-4"
        style={{ background: 'rgba(7,13,31,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-end gap-3">
          {/* Floating piggy buddy — bigger, with tap hint */}
          <div className="relative flex-shrink-0 mb-1">
            <KawaiiPiggy
              eyeTarget={eyeTarget}
              state={piggyState}
              onTap={handlePiggyTap}
              quip={piggyQuip}
              size={72}
              showTapHint={messages.length <= 1}
            />
          </div>

          {/* Input */}
          <div className="flex-1 flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(0,72,249,0.3)' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="Tell me what you're craving..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: '#fff', fontFamily: 'Open Sans' }}
            />
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: input.trim() ? 'linear-gradient(135deg, #0048f9, #3b82f6)' : 'rgba(255,255,255,0.08)',
                transition: 'all 0.2s',
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 2L15 22 11 13 2 9l20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>
          </div>
        </div>
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
