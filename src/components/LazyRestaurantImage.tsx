import { useState, useEffect, useRef } from 'react'
import { fetchPexelsPhoto } from '../lib/pexels'

interface Props {
  fallbackUrl: string
  query: string        // e.g. "Cafe Yoto Japanese restaurant"
  alt: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Shows the static fallback image immediately, then upgrades to a real
 * Pexels photo once the element scrolls into view. The transition is a
 * smooth cross-fade so the swap is barely noticeable.
 */
export default function LazyRestaurantImage({ fallbackUrl, query, alt, className = '', style }: Props) {
  const [src, setSrc] = useState(fallbackUrl)
  const [loaded, setLoaded] = useState(false)
  const [upgraded, setUpgraded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fetchedRef.current) {
          fetchedRef.current = true
          observer.disconnect()
          fetchPexelsPhoto(query).then((photo) => {
            if (photo?.url) {
              // Preload before swapping so there's no flicker
              const img = new Image()
              img.src = photo.url
              img.onload = () => {
                setSrc(photo.url)
                setUpgraded(true)
              }
            }
          })
        }
      },
      { rootMargin: '200px' }   // start fetching 200px before card enters view
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [query])

  return (
    <div ref={ref} className={className} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        style={{
          transition: upgraded ? 'opacity 0.4s ease' : 'none',
          opacity: loaded ? 1 : 0,
        }}
        onLoad={() => setLoaded(true)}
        onError={() => { setSrc(fallbackUrl); setLoaded(true) }}
      />
      {/* Skeleton shimmer shown until image loads */}
      {!loaded && (
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
          }}
        />
      )}
    </div>
  )
}
