import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import RestaurantDetail from '../components/RestaurantDetail'

// ── Favorites helpers ─────────────────────────────────────────────────────────
function loadFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem('pp_favorites')
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as number[])
  } catch { return new Set() }
}
function saveFavorites(favs: Set<number>) {
  localStorage.setItem('pp_favorites', JSON.stringify([...favs]))
}

interface VibeResult {
  restaurant: Restaurant
  reason: string
  matchScore: number
}

const EXAMPLE_VIBES = [
  'romantic dinner with jazz music',
  'casual coffee spot to work from',
  'late night live music and drinks',
  'best sushi experience in LA',
  'date night with great atmosphere',
  'chill brunch with friends',
]

export default function VibeMatchScreen() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [results, setResults] = useState<VibeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('restaurants').select('*').then(({ data }) => {
      setRestaurants(data ?? [])
    })
  }, [])

  function toggleFavorite(id: number) {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveFavorites(next)
      return next
    })
  }

  async function handleSearch() {
    if (!query.trim() || loading) return
    setLoading(true)
    setError(null)
    setResults([])
    setSearched(true)

    try {
      const restaurantList = restaurants.map((r) =>
        `ID:${r.id} | ${r.name} | ${r.cuisine} | ${r.city}, ${r.state} | ${r.description ?? 'No description'}`
      ).join('\n')

      const prompt = `You are a restaurant recommendation AI for PlatePost, a discovery app in Los Angeles.

A user is looking for: "${query}"

Here are the available restaurants:
${restaurantList}

Return the TOP 4 best matches as a JSON array. Each item must have:
- id (number, the restaurant ID)
- reason (string, max 12 words, why it matches — be specific and exciting)
- matchScore (number 1-100)

Sort by matchScore descending. Return ONLY valid JSON array, no other text.
Example: [{"id":1,"reason":"Perfect jazz vibes with intimate dinner setting","matchScore":95}]`

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const text = data.content?.[0]?.text ?? ''

      // Parse JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No results found')

      const matches = JSON.parse(jsonMatch[0]) as { id: number; reason: string; matchScore: number }[]

      const vibeResults: VibeResult[] = matches
        .map((m) => {
          const restaurant = restaurants.find((r) => r.id === m.id)
          if (!restaurant) return null
          return { restaurant, reason: m.reason, matchScore: m.matchScore }
        })
        .filter((r): r is VibeResult => r !== null)

      setResults(vibeResults)
    } catch (err) {
      setError('Something went wrong. Try a different description.')
    } finally {
      setLoading(false)
    }
  }

  function handleExampleTap(example: string) {
    setQuery(example)
  }

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: '#071126', fontFamily: 'Manrope, sans-serif' }}
    >
      {/* ── Header ── */}
      <div className="flex-shrink-0 pt-12 px-5 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              AI Powered
            </p>
            <h1 style={{ fontFamily: 'Bungee, cursive', color: '#fff', fontSize: 22, letterSpacing: '0.04em', lineHeight: 1.1 }}>
              Vibe Match
            </h1>
          </div>
        </div>

        {/* Search input */}
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3.5 mb-4"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1.5px solid rgba(69,118,239,0.4)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ opacity: 0.5 }}>
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Describe your perfect night out..."
            className="flex-1 bg-transparent outline-none"
            style={{ color: '#fff', fontSize: 15 }}
            autoFocus
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setSearched(false) }} style={{ opacity: 0.4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Search button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSearch}
          disabled={!query.trim() || loading}
          className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
          style={{
            background: query.trim() ? 'linear-gradient(135deg, #4576EF 0%, #2a56d4 100%)' : 'rgba(255,255,255,0.08)',
            color: query.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
            transition: 'all 0.2s',
          }}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
              Finding your vibe...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Match My Vibe
            </>
          )}
        </motion.button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-20" style={{ scrollbarWidth: 'none' }}>

        <AnimatePresence mode="wait">

          {/* Loading state */}
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-4"
            >
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(69,118,239,0.2)', borderTopColor: '#4576EF' }} />
                <div className="absolute inset-2 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(69,118,239,0.1)', borderTopColor: '#6B9EFF', animationDirection: 'reverse', animationDuration: '0.8s' }} />
                <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 22 }}>✨</div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' }}>
                AI is finding your perfect match...
              </p>
            </motion.div>
          )}

          {/* Error state */}
          {error && !loading && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 rounded-2xl text-center"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <p style={{ color: '#fca5a5', fontSize: 14 }}>{error}</p>
            </motion.div>
          )}

          {/* Results */}
          {results.length > 0 && !loading && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="mb-4 mt-2" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {results.length} matches for "{query}"
              </p>
              <div className="flex flex-col gap-3">
                {results.map((result, i) => (
                  <motion.button
                    key={result.restaurant.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedRestaurant(result.restaurant)}
                    className="flex gap-3 rounded-2xl p-3 text-left w-full"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {/* Photo */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={result.restaurant.image_url}
                        alt={result.restaurant.name}
                        className="w-20 h-20 rounded-xl object-cover"
                      />
                      {/* Match score badge */}
                      <div
                        className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          background: result.matchScore >= 85 ? '#4576EF' : result.matchScore >= 70 ? '#10b981' : '#6b7280',
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#fff',
                          fontFamily: 'Manrope',
                          border: '2px solid #071126',
                        }}
                      >
                        {result.matchScore}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-bold text-sm leading-snug"
                          style={{ color: '#FAFBFF', fontFamily: 'Manrope' }}>
                          {result.restaurant.name}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(result.restaurant.id) }}
                          className="flex-shrink-0 mt-0.5"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24"
                            fill={favorites.has(result.restaurant.id) ? '#E11D48' : 'none'}
                            stroke={favorites.has(result.restaurant.id) ? '#E11D48' : 'rgba(255,255,255,0.4)'}
                            strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full inline-block mb-1.5"
                        style={{ background: 'rgba(69,118,239,0.15)', color: '#6B9EFF', fontFamily: 'Manrope' }}>
                        {result.restaurant.cuisine}
                      </span>
                      {/* AI reason */}
                      <p className="text-xs leading-snug flex items-start gap-1"
                        style={{ color: 'rgba(255,255,255,0.55)' }}>
                        <span style={{ fontSize: 10 }}>✨</span>
                        {result.reason}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Try another */}
              <button
                onClick={() => { setQuery(''); setResults([]); setSearched(false) }}
                className="w-full mt-4 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Try a different vibe →
              </button>
            </motion.div>
          )}

          {/* Empty state / examples */}
          {!searched && !loading && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="mb-3 mt-2" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Try saying...
              </p>
              <div className="flex flex-col gap-2">
                {EXAMPLE_VIBES.map((example) => (
                  <motion.button
                    key={example}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleExampleTap(example)}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left w-full"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <span style={{ fontSize: 18 }}>✨</span>
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>"{example}"</span>
                  </motion.button>
                ))}
              </div>

              {/* Disclaimer */}
              <p className="mt-6 text-center" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
                Powered by Claude AI · Results based on {restaurants.length} LA restaurants
              </p>
            </motion.div>
          )}

          {/* No results */}
          {searched && results.length === 0 && !loading && !error && (
            <motion.div
              key="noresults"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-3"
            >
              <span style={{ fontSize: 40 }}>🤔</span>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' }}>
                No matches found. Try describing something different.
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Restaurant Detail Sheet ── */}
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
