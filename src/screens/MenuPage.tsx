import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { fetchPexelsPhoto, fetchPexelsVideo } from '../lib/pexels'
import { getMenuData, getHeroVideoQuery } from '../lib/menuData'
import type { Restaurant } from '../types'
import type { MenuItem } from '../lib/menuData'

// ── Fallback photos per category so the grid always shows something ─────────
const FALLBACK: Record<string, string> = {
  Coffee: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80',
  Cafe: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80',
  Japanese: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&q=80',
  Italian: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80',
  American: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
  Music: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&q=80',
  Jazz: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&q=80',
}

export default function MenuPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [heroVideoUrl, setHeroVideoUrl] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState(0)
  const [itemPhotos, setItemPhotos] = useState<Record<string, string>>({})
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedItemIndex, setSelectedItemIndex] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)

  const menuCategories = restaurant ? getMenuData(restaurant.cuisine) : []
  const allItems = menuCategories.flatMap((c) => c.items)

  useEffect(() => {
    if (id) loadRestaurant(parseInt(id))
  }, [id])

  useEffect(() => {
    if (restaurant) {
      loadHeroVideo(restaurant.cuisine)
      loadItemPhotos(restaurant.cuisine)
    }
  }, [restaurant])

  async function loadRestaurant(restaurantId: number) {
    const { data } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single()
    if (data) setRestaurant(data)
  }

  async function loadHeroVideo(cuisine: string) {
    const query = getHeroVideoQuery(cuisine)
    const video = await fetchPexelsVideo(query)
    if (video?.url) setHeroVideoUrl(video.url)
  }

  async function loadItemPhotos(cuisine: string) {
    const categories = getMenuData(cuisine)
    const items = categories.flatMap((c) => c.items)
    const fallback = FALLBACK[cuisine] ?? FALLBACK['American']

    // Fetch all item photos in parallel (batched to avoid rate limits)
    const results = await Promise.all(
      items.map(async (item) => {
        const photo = await fetchPexelsPhoto(item.pexelsQuery)
        return { id: item.id, url: photo?.url ?? fallback }
      })
    )

    const photoMap: Record<string, string> = {}
    results.forEach(({ id, url }) => { photoMap[id] = url })
    setItemPhotos(photoMap)
  }

  function openItem(item: MenuItem) {
    const idx = allItems.findIndex((i) => i.id === item.id)
    setSelectedItemIndex(idx)
    setSelectedItem(item)
  }

  function navigateItem(dir: 1 | -1) {
    const next = selectedItemIndex + dir
    if (next < 0 || next >= allItems.length) return
    setSelectedItemIndex(next)
    setSelectedItem(allItems[next])
  }

  function scrollTabIntoView(idx: number) {
    const row = tabsRef.current
    if (!row) return
    const tab = row.querySelectorAll<HTMLButtonElement>('button')[idx]
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#fff' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#071126', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const currentItems = menuCategories[activeCategory]?.items ?? []

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fff', fontFamily: 'Manrope, sans-serif' }}>

      {/* ── Back button ── */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-12 left-4 z-30 w-9 h-9 flex items-center justify-center rounded-full"
        style={{ background: 'rgba(0,0,0,0.4)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ── Hero video section ── */}
      <div className="relative w-full flex-shrink-0 overflow-hidden" style={{ height: '52vh' }}>
        {heroVideoUrl ? (
          <video
            src={heroVideoUrl}
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <img
            src={restaurant.image_url}
            alt={restaurant.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }}
        />

        {/* Restaurant name + info overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: 'rgba(255,255,255,0.6)' }}>
            {restaurant.cuisine} · {restaurant.city}, {restaurant.state}
          </p>
          <h1
            className="font-bold italic leading-none mb-4"
            style={{
              fontFamily: 'Bungee, cursive',
              color: '#fff',
              fontSize: 'clamp(1.8rem, 7vw, 2.8rem)',
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            {restaurant.name}
          </h1>

          {/* Hero action row */}
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name + ' ' + restaurant.city)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.3)', textDecoration: 'none' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" />
              </svg>
              Directions
            </a>
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold"
              style={{ background: '#4576EF', color: '#fff', border: 'none' }}
              onClick={() => alert('Coming soon — contact restaurant to order')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 17a2 2 0 100 4 2 2 0 000-4zM9 19a2 2 0 100 4 2 2 0 000-4z" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Order Online
            </button>
            {restaurant.website_url && (
              <a
                href={restaurant.website_url}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.25)', textDecoration: 'none' }}
              >
                🌐 Website
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div
        className="flex-shrink-0 sticky top-0 z-10 bg-white border-b"
        style={{ borderColor: '#f0f0f0' }}
      >
        <div
          ref={tabsRef}
          className="flex overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {menuCategories.map((cat, idx) => (
            <button
              key={cat.name}
              onClick={() => {
                setActiveCategory(idx)
                scrollTabIntoView(idx)
              }}
              className="flex-shrink-0 px-5 py-3.5 text-sm font-semibold relative transition-colors"
              style={{
                color: activeCategory === idx ? '#071126' : '#999',
                background: 'transparent',
                border: 'none',
                fontFamily: 'Manrope, sans-serif',
                borderBottom: activeCategory === idx ? '2.5px solid #071126' : '2.5px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Menu grid ── */}
      <div className="flex-1 px-4 pt-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {currentItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              photoUrl={itemPhotos[item.id]}
              onClick={() => openItem(item)}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className="text-center py-5 text-xs"
        style={{ color: '#aaa', fontFamily: 'Manrope', borderTop: '1px solid #f0f0f0' }}
      >
        VideoMenu Powered By 🔷 PlatePost
      </div>

      {/* ── Item detail popup ── */}
      <AnimatePresence>
        {selectedItem && (
          <MenuItemPopup
            item={selectedItem}
            photoUrl={itemPhotos[selectedItem.id]}
            onClose={() => setSelectedItem(null)}
            onPrev={selectedItemIndex > 0 ? () => navigateItem(-1) : undefined}
            onNext={selectedItemIndex < allItems.length - 1 ? () => navigateItem(1) : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Menu item card ────────────────────────────────────────────────────────────
function MenuItemCard({
  item, photoUrl, onClick,
}: {
  item: MenuItem
  photoUrl?: string
  onClick: () => void
}) {
  const fallback = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80'
  const [imgLoaded, setImgLoaded] = useState(false)
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="flex flex-col text-left rounded-2xl overflow-hidden"
      style={{ background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0' }}
    >
      {/* Square photo */}
      <div className="relative w-full" style={{ paddingTop: '100%' }}>
        {/* Shimmer skeleton shown while photo loads */}
        {!imgLoaded && (
          <div className="absolute inset-0" style={{ background: '#f0f0f0', animation: 'shimmer 1.4s infinite',
            backgroundImage: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '200% 100%' }} />
        )}
        <img
          src={photoUrl ?? fallback}
          alt={item.name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={(e) => { (e.target as HTMLImageElement).src = fallback; setImgLoaded(true) }}
        />
        {item.popular && (
          <div
            className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#FF6B35', color: '#fff', fontSize: 10, fontFamily: 'Manrope' }}
          >
            Popular
          </div>
        )}
        {/* Expand arrow */}
        <div
          className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="font-bold text-xs tracking-wide mb-0.5 leading-snug"
          style={{ color: '#071126', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {item.name}
        </p>
        <p className="text-xs leading-snug mb-1.5"
          style={{ color: '#888', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.description}
        </p>
        <p className="text-sm font-bold" style={{ color: '#071126' }}>{item.price}</p>
      </div>
    </motion.button>
  )
}

// ── Menu item popup ───────────────────────────────────────────────────────────
function MenuItemPopup({
  item, photoUrl, onClose, onPrev, onNext,
}: {
  item: MenuItem
  photoUrl?: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [thumbsUp, setThumbsUp] = useState<boolean | null>(null)
  const [orderMsg, setOrderMsg] = useState<'iwant' | 'order' | null>(null)
  const fallback = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80'

  useEffect(() => {
    setVideoUrl(null)
    setThumbsUp(null)
    setOrderMsg(null)
    loadVideo()
  }, [item.id])

  async function loadVideo() {
    const video = await fetchPexelsVideo(`${item.pexelsQuery} food preparation`)
    if (video?.url) setVideoUrl(video.url)
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
        style={{ background: '#fff', maxHeight: '88vh', overflowY: 'auto', scrollbarWidth: 'none' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-white z-10">
          <div className="w-10 h-1 rounded-full" style={{ background: '#e0e0e0' }} />
        </div>

        {/* Video / photo hero */}
        <div className="relative mx-4 mb-4 rounded-2xl overflow-hidden" style={{ height: 220 }}>
          {videoUrl ? (
            <video
              key={videoUrl}
              src={videoUrl}
              autoPlay muted loop playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={photoUrl ?? fallback}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = fallback }}
            />
          )}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)' }} />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* Nav arrows */}
          {onPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev() }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {onNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Item info */}
        <div className="px-4 mb-4">
          <div className="flex items-start justify-between mb-1">
            <h2
              className="font-bold italic text-xl leading-tight flex-1 mr-2"
              style={{ color: '#071126', fontFamily: 'Bungee, cursive' }}
            >
              {item.name}
            </h2>
            <p className="text-xl font-bold flex-shrink-0" style={{ color: '#071126' }}>
              {item.price}
            </p>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#666' }}>
            {item.description}
          </p>
        </div>

        {/* How's this dish? */}
        <div
          className="mx-4 mb-4 rounded-2xl p-4 flex items-center justify-between"
          style={{ background: '#f8f8f8' }}
        >
          <p className="text-sm font-semibold" style={{ color: '#071126' }}>
            How's this dish?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setThumbsUp(true)}
              className="text-2xl transition-transform active:scale-90"
              style={{ opacity: thumbsUp === false ? 0.3 : 1 }}
            >
              👍
            </button>
            <button
              onClick={() => setThumbsUp(false)}
              className="text-2xl transition-transform active:scale-90"
              style={{ opacity: thumbsUp === true ? 0.3 : 1 }}
            >
              👎
            </button>
          </div>
        </div>

        {/* Order message */}
        <AnimatePresence>
          {orderMsg && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-4 mb-3 rounded-xl p-3 text-center text-sm"
              style={{ background: '#EEF2FF', color: '#4576EF', fontFamily: 'Manrope' }}
            >
              Coming soon — contact restaurant to order
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA buttons */}
        <div className="px-4 mb-8 flex flex-col gap-3">
          <button
            onClick={() => setOrderMsg('iwant')}
            className="w-full py-3.5 rounded-2xl text-sm font-bold"
            style={{ background: '#071126', color: '#fff', fontFamily: 'Manrope' }}
          >
            I want this
          </button>
          <button
            onClick={() => setOrderMsg('order')}
            className="w-full py-3.5 rounded-2xl text-sm font-bold"
            style={{ background: 'transparent', color: '#071126', border: '2px solid #071126', fontFamily: 'Manrope' }}
          >
            Order Online
          </button>
        </div>
      </motion.div>
    </>
  )
}
