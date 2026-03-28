import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

// Favorites helpers
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
  "First date tonight, budget $80, somewhere romantic",
  "Best coffee shop to work from in Silver Lake",
  "Live jazz with dinner, not too loud",
  "Late night food after a show in DTLA",
  "Vegetarian-friendly with great ambiance",
]

export default function ConciergeScreen() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: "Hi! I'm your PlatePost Concierge 🍽️\n\nTell me what you're looking for tonight — the more detail the better. I'll find the perfect spot for you.",
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const conversationHistory = useRef<{ role: string; content: string }[]>([])

  useEffect(() => {
    supabase.from('restaurants').select('*').then(({ data }) => {
      setRestaurants(data ?? [])
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text }
    const loadingMsg: Message = { id: 'loading', role: 'assistant', text: '', loading: true }

    setMessages(prev => [...prev, userMsg, loadingMsg])

    conversationHistory.current.push({ role: 'user', content: text })

    try {
      const restaurantList = restaurants.map(r =>
        `ID:${r.id} | ${r.name} | ${r.cuisine} | ${r.city}, ${r.state} | ${r.description ?? ''}`
      ).join('\n')

      const systemPrompt = `You are PlatePost Concierge, an expert restaurant advisor for Los Angeles. You know every great spot in the city and give warm, specific, personalized recommendations like a knowledgeable local friend.

Available restaurants:
${restaurantList}

CRITICAL RULES:
1. Always recommend 2-3 specific restaurants from the list above
2. At the end of your response, always include a JSON block like this: [RESTAURANTS:1,3,5] with the IDs of restaurants you mentioned
3. Be conversational, warm and specific — mention exact details about why each place fits
4. If they give more context (budget, occasion, location), refine your recommendations
5. Keep responses concise — 2-4 sentences per recommendation max
6. Never make up restaurants not in the list`

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
      const rawText = data.content?.[0]?.text ?? "I couldn't find a match. Try describing what you're looking for differently."

      // Extract restaurant IDs from response
      const idMatch = rawText.match(/\[RESTAURANTS:([\d,]+)\]/)
      const recommendedIds = idMatch
        ? idMatch[1].split(',').map(Number)
        : []

      const cleanText = rawText.replace(/\[RESTAURANTS:[\d,]+\]/, '').trim()
      const recommendedRestaurants = restaurants.filter(r => recommendedIds.includes(r.id))

      conversationHistory.current.push({ role: 'assistant', content: cleanText })

      const assistantMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        text: cleanText,
        restaurants: recommendedRestaurants.length > 0 ? recommendedRestaurants : undefined,
      }

      setMessages(prev => [...prev.filter(m => m.id !== 'loading'), assistantMsg])
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      setMessages(prev => [...prev.filter(m => m.id !== 'loading'), {
        id: Date.now().toString(),
        role: 'assistant',
        text: `Sorry, something went wrong: ${errMsg}. Please try again.`,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#070d1f', fontFamily: 'Manrope, sans-serif' }}>

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 pt-12 px-5 pb-4 flex items-center gap-3"
        style={{ background: 'rgba(7,13,31,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Animated orb */}
        <div className="relative flex-shrink-0">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4576EF, #8b5cf6)' }}
          >
            <span style={{ fontSize: 16 }}>✨</span>
          </motion.div>
        </div>

        <div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            AI Powered
          </p>
          <h1 style={{ fontFamily: 'Bungee, cursive', color: '#fff', fontSize: 16, letterSpacing: '0.04em', lineHeight: 1.1 }}>
            PlatePost Concierge
          </h1>
        </div>

        {/* Clear chat */}
        {messages.length > 1 && (
          <button
            onClick={() => {
              conversationHistory.current = []
              setMessages([{
                id: '0', role: 'assistant',
                text: "Hi! I'm your PlatePost Concierge 🍽️\n\nTell me what you're looking for tonight — the more detail the better.",
              }])
            }}
            className="ml-auto text-xs opacity-30 hover:opacity-60 transition-opacity"
            style={{ color: '#fff' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mr-2 mt-0.5"
                style={{ background: 'linear-gradient(135deg, #4576EF, #8b5cf6)', fontSize: 12 }}>
                ✨
              </div>
            )}

            <div className={`max-w-xs lg:max-w-md ${msg.role === 'user' ? '' : 'flex-1'}`}>
              {/* Bubble */}
              <div
                className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={{
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #4576EF, #6B9EFF)'
                    : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                  border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}
              >
                {msg.loading ? (
                  <div className="flex gap-1 items-center py-1">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.4)' }}
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                ) : (
                  <p style={{ whiteSpace: 'pre-line' }}>{msg.text}</p>
                )}
              </div>

              {/* Restaurant cards */}
              {msg.restaurants && msg.restaurants.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-3 flex flex-col gap-2"
                >
                  {msg.restaurants.map(r => (
                    <motion.button
                      key={r.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedRestaurant(r)}
                      className="flex items-center gap-3 rounded-2xl p-3 text-left w-full"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <img
                        src={r.image_url}
                        alt={r.name}
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-white truncate">{r.name}</p>
                        <p className="text-xs opacity-50 text-white">{r.cuisine} · {r.city}</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); toggleFavorite(r.id) }}
                        className="flex-shrink-0"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24"
                          fill={favorites.has(r.id) ? '#E11D48' : 'none'}
                          stroke={favorites.has(r.id) ? '#E11D48' : 'rgba(255,255,255,0.3)'}
                          strokeWidth="2">
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

        {/* Suggested prompts — only on first message */}
        {messages.length === 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-2"
          >
            <p className="text-xs mb-3 opacity-30 text-white font-semibold uppercase tracking-wider">
              Try asking...
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTED_PROMPTS.map(prompt => (
                <motion.button
                  key={prompt}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => sendMessage(prompt)}
                  className="text-left px-4 py-3 rounded-2xl text-sm"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  "{prompt}"
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div
        className="flex-shrink-0 px-4 py-4"
        style={{ background: 'rgba(7,13,31,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(69,118,239,0.3)' }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Tell me what you're looking for..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#fff' }}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: input.trim() ? 'linear-gradient(135deg, #4576EF, #8b5cf6)' : 'rgba(255,255,255,0.08)',
              transition: 'all 0.2s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22 11 13 2 9l20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Restaurant detail sheet */}
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
