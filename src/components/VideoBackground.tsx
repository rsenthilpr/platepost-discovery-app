// src/components/VideoBackground.tsx
import { useRef, useEffect, useState } from 'react'

interface Props {
  cuisine: string
  fallbackImage: string
  isActive: boolean
  orientation?: 'portrait' | 'landscape'
  style?: React.CSSProperties
}

// Module-level cache keyed by cuisine:orientation
const videoUrlCache: Record<string, string | null> = {}

export default function VideoBackground({ cuisine, fallbackImage, isActive, orientation = 'portrait', style }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cacheKey = `${cuisine}:${orientation}`
  const [videoUrl, setVideoUrl] = useState<string | null>(
    cacheKey in videoUrlCache ? videoUrlCache[cacheKey] : null
  )
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)

  useEffect(() => {
    if (cacheKey in videoUrlCache) {
      setVideoUrl(videoUrlCache[cacheKey])
      return
    }
    fetch(`/api/pexels-video?cuisine=${encodeURIComponent(cuisine)}&orientation=${orientation}`)
      .then(r => r.json())
      .then(data => {
        const url = data.url ?? null
        videoUrlCache[cacheKey] = url
        setVideoUrl(url)
      })
      .catch(() => {
        videoUrlCache[cacheKey] = null
        setVideoUrl(null)
      })
  }, [cacheKey])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl || videoFailed) return
    if (isActive) {
      // Always try to play — works instantly if cached, onCanPlay handles first load
      video.play().catch(() => {
        // Not ready yet — will play via onCanPlay when loaded
      })
    } else {
      video.pause()
    }
  }, [isActive, videoUrl, videoFailed, videoLoaded])

  return (
    <div style={{ position: 'absolute', inset: 0, ...style }}>
      {/* Fallback photo always visible instantly */}
      {fallbackImage && (
        <img
          src={fallbackImage}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* Video fades in on top when ready */}
      {videoUrl && !videoFailed && (
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          loop
          playsInline
          autoPlay={isActive}
          preload="auto"
          onCanPlay={() => {
            setVideoLoaded(true)
            // Play immediately when ready — fixes first-load delay
            if (isActive) videoRef.current?.play().catch(() => {})
          }}
          onError={() => { setVideoFailed(true); videoUrlCache[cacheKey] = null }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: videoLoaded && isActive ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        />
      )}
    </div>
  )
}
