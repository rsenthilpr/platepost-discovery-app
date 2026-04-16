import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'
import BottomNav from '../components/BottomNav'
import { useCityStore } from '../lib/cityStore'

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

// PNG map — Emilia's illustrated piggies
const PIGGY_IMAGES = {
  // Core states
  idle:     '/piggy/hi piggy.png',
  thinking: '/piggy/hmm piggy.png',
  happy:    '/piggy/yayy piggy.png',
  squished: '/piggy/awesome piggy.png',
  // Extra personality piggies — used on tap
  extras: [
    '/piggy/coffee bliss piggy.png',
    '/piggy/cafe togo piggy.png',
    '/piggy/pour over piggy.png',
    '/piggy/iced coffee piggy.png',
    '/piggy/milk foamer piggy.png',
    '/piggy/shot master piggy.png',
    '/piggy/greetings piggy.png',
    '/piggy/bye bye piggy.png',
  ]
}

function KawaiiPiggy({
  state: pigState,
  onTap,
  quip,
  size = 52,
}: {
  eyeTarget: { x: number; y: number } | null
  state: 'idle' | 'thinking' | 'happy' | 'squished'
  onTap: () => void
  quip: string | null
  size?: number
  showTapHint?: boolean
}) {
  const [_tapCount, setTapCount] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  // 3D tilt — follows cursor/touch position
  useEffect(() => {
    function handleMove(e: MouseEvent | TouchEvent) {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const clientX = 'touches' in e ? e.touches[0]?.clientX ?? cx : e.clientX
      const clientY = 'touches' in e ? e.touches[0]?.clientY ?? cy : e.clientY
      // Normalize to -1..1 based on distance from center of screen
      const dx = (clientX - cx) / (window.innerWidth / 2)
      const dy = (clientY - cy) / (window.innerHeight / 2)
      // Clamp tilt to max ±18 degrees
      setTilt({
        x: Math.max(-18, Math.min(18, dy * -18)),  // tilt up when cursor above
        y: Math.max(-18, Math.min(18, dx * 18)),   // tilt right when cursor right
      })
    }
    function handleLeave() { setTilt({ x: 0, y: 0 }) }

    window.addEventListener('mousemove', handleMove, { passive: true })
    window.addEventListener('touchmove', handleMove, { passive: true })
    window.addEventListener('mouseleave', handleLeave)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  const imgSrc = PIGGY_IMAGES[pigState] ?? PIGGY_IMAGES.idle

  // State animations — combined with 3D tilt
  const stateAnimate =
    pigState === 'thinking' ? { rotateZ: [-3, 3, -3] } :
    pigState === 'happy'    ? { y: [0, -14, 0], rotateZ: [0, -6, 6, 0] } :
    pigState === 'squished' ? { scaleX: 1.2, scaleY: 0.82 } :
    { y: [0, -7, 0] } // idle float

  const stateTransition =
    pigState === 'thinking' ? { duration: 0.55, repeat: Infinity, ease: 'easeInOut' as const } :
    pigState === 'happy'    ? { duration: 0.45, ease: 'easeOut' as const } :
    pigState === 'squished' ? { duration: 0.12, type: 'spring' as const, stiffness: 600 } :
    { duration: 3.2, repeat: Infinity, ease: [0.45, 0, 0.55, 1] as any, repeatType: 'mirror' as const }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {/* Speech bubble */}
      <AnimatePresence>
        {quip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              position: 'absolute', bottom: '108%', left: '60%',
              background: '#fff', color: '#222',
              fontFamily: 'Open Sans', fontWeight: 600, fontSize: 12,
              borderRadius: 14, padding: '8px 12px',
              whiteSpace: 'normal', wordBreak: 'break-word',
              zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              border: '1px solid rgba(0,0,0,0.06)', width: 160, lineHeight: 1.4,
            }}
          >
            {quip}
            <div style={{
              position: 'absolute', top: '100%', left: 14,
              width: 0, height: 0,
              borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
              borderTop: '7px solid #fff',
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D wrapper — handles cursor tilt with smooth spring */}
      <motion.div
        animate={{
          rotateX: tilt.x,
          rotateY: tilt.y,
        }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        style={{ perspective: 400, transformStyle: 'preserve-3d' }}
      >
        {/* Piggy image with state animation */}
        <motion.img
          key={pigState}
          src={imgSrc}
          alt={`PlatePost Piggy — ${pigState}`}
          onClick={() => { setTapCount(c => c + 1); onTap() }}
          animate={stateAnimate}
          transition={stateTransition}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.85 }}
          style={{
            width: size,
            height: size,
            objectFit: 'contain',
            cursor: 'pointer',
            display: 'block',
            filter: 'drop-shadow(0 6px 16px rgba(255,100,150,0.35))',
            outline: 'none',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
          }}
          draggable={false}
        />
      </motion.div>
    </div>
  )
}



export default function CraveScreen() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'assistant',
    text: "Hi! I'm your personal pig 🐷\n\nTell me what you're craving — the more detail the better. I'll find the perfect spot.",
  }])
  const { city } = useCityStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [googleRestaurants, setGoogleRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const [piggyState, setPiggyState] = useState<'idle' | 'thinking' | 'happy' | 'squished'>('idle')
  const [piggyQuip, setPiggyQuip] = useState<string | null>("Oink! I know all the best spots 🐷")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const conversationHistory = useRef<{ role: string; content: string }[]>([])
  const quipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.from('restaurants').select('*').then(({ data }) => setRestaurants(data ?? []))
    const t = setTimeout(() => setPiggyQuip(null), 4000)
    return () => clearTimeout(t)
  }, [])

  // Load Google Places for selected city
  useEffect(() => {
    async function loadCityRestaurants() {
      try {
        const res = await fetch(`/api/places-search?city=${encodeURIComponent(city.name)}&lat=${city.lat}&lng=${city.lng}`)
        if (res.ok) {
          const data = await res.json()
          setGoogleRestaurants(data.places ?? [])
        }
      } catch {}
    }
    loadCityRestaurants()
  }, [city.name])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      const allRestaurantsList = [
        ...restaurants
          .filter(r => r.city?.toLowerCase().includes(city.name.toLowerCase()) ||
            ['Los Angeles', 'Anaheim', 'Orange', 'Placentia', 'Westminster', 'Irvine'].includes(city.name))
          .map(r =>
            `ID:${r.id} | ${r.name} | ${r.cuisine} | ${r.city}, ${r.state} | Rating: ${r.rating ?? 'N/A'} | ${r.description ?? ''} | PlatePost customer`
          ),
        ...googleRestaurants.slice(0, 40).map((p: any) =>
          `GOOGLE:${p.place_id} | ${p.name} | ${p.cuisine ?? 'Restaurant'} | ${city.name} | Rating: ${p.rating ?? 'N/A'} | ${p.description ?? ''}`
        ),
      ].join('\n')

      const systemPrompt = `You are PlatePost Piggy, a warm and fun AI food guide for ${city.name}, ${city.state}. You're powered by PlatePost — the video-first restaurant discovery platform.

The user is currently in ${city.name}, ${city.state}. Only recommend restaurants IN ${city.name} from the list below.

Your personality:
- Warm, genuine, conversational — like a local friend texting a recommendation
- Never corporate, never stiff
- Know neighborhoods and food culture in ${city.name}

CRITICAL FORMATTING RULES — follow exactly or the app breaks:
1. NEVER use markdown — no **bold**, no *italic*, no # headers, no asterisk bullets
2. NEVER show IDs, database codes, or the [RESTAURANTS:...] tag in your visible text
3. Write ONLY in plain conversational sentences
4. Keep it short — 1-2 sentences per restaurant, max 3 restaurants
5. Sound like a friend texting, not a review site
6. ONLY recommend restaurants from the list below — never make up places

Available restaurants in ${city.name}:
${allRestaurantsList || `No restaurants loaded yet for ${city.name}. Tell the user to try again in a moment.`}

PlatePost pro customers (mention their VideoMenu when relevant, LA only):
- Kei Coffee House — platepost.io/kch
- Wish You Were Here Coffee — platepost.io/wywhcoffee
- Ape Coffee Orange — platepost.io/apecoffeeorange
- Ape Coffee Placentia — platepost.io/apecoffeeplacentia

RULES:
- Recommend 2-3 restaurants from the list that match the request
- End every response with [RESTAURANTS:id1,id2] using the numeric IDs or GOOGLE place IDs — never show this tag to the user
- If the user asks about a different city than ${city.name}, tell them to change their city in the app first
- If no restaurants match, say so honestly`

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

      // Strip [RESTAURANTS:...] tag — handles both numeric IDs and alphanumeric Google Place IDs
      const idMatch = rawText.match(/\[RESTAURANTS:([^\]]+)\]/)
      const recommendedIds = idMatch
        ? idMatch[1].split(',').map((s: string) => s.trim()).filter(Boolean)
        : []

      // Strip [RESTAURANTS:...] tag and clean markdown formatting
      let cleanText = rawText
        .replace(/\[RESTAURANTS:[^\]]+\]/g, '')  // remove tag
        .replace(/\*\*([^*]+)\*\*/g, '$1')        // remove **bold**
        .replace(/\*([^*]+)\*/g, '$1')            // remove *italic*
        .replace(/^#+\s*/gm, '')                  // remove headers
        .trim()

      // Match IDs: numeric IDs → Supabase restaurants, alphanumeric → Google Places by place_id or name
      const numericIds = recommendedIds.map(Number).filter((n: number) => !isNaN(n))
      const stringIds = recommendedIds.filter((id: string) => isNaN(Number(id)))

      const supabaseMatches = restaurants.filter(r => numericIds.includes(r.id))

      // Match Google Places by place_id first, then fall back to name matching
      const googleMatches = stringIds.length > 0
        ? googleRestaurants.filter((p: any) =>
            stringIds.some((id: string) =>
              p.place_id === id ||
              p.name?.toLowerCase().includes(id.toLowerCase().slice(0, 8))
            )
          ).map((p: any, i: number) => ({
            id: -(i + 3000),
            name: p.name,
            cuisine: p.cuisine ?? 'Restaurant',
            city: city.name,
            state: city.state,
            rating: p.rating,
            image_url: p.image_url ?? '',
            address: p.address ?? '',
            latitude: p.latitude ?? 0,
            longitude: p.longitude ?? 0,
          } as any))
        : []

      const recommendedRestaurants = [...supabaseMatches, ...googleMatches]

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
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      background: '#070d1f', fontFamily: 'Open Sans, sans-serif',
      paddingBottom: 64, // BottomNav height
    }}>

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
          eyeTarget={null}
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
            PlatePost Piggy
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
              <div className="flex-shrink-0 mr-2 mt-0.5"
                style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,179,198,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src="/piggy/hi piggy.png"
                  alt="Crave"
                  style={{ width: 24, height: 24, objectFit: 'contain' }}
                />
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
              eyeTarget={null}
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
              style={{ color: '#fff', fontFamily: 'Open Sans', fontSize: 16 }}
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
      {/* SurpriseOrb hidden on Crave screen — would overlap send button */}
      <BottomNav />
    </div>
  )
}
