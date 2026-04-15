// src/components/VideoBackground.tsx
import { useRef, useEffect, useState } from 'react'

interface Props {
  cuisine: string
  fallbackImage: string
  isActive: boolean
  orientation?: 'portrait' | 'landscape'
  directVideoUrl?: string | null  // Pass pre-fetched URL to skip API call
  style?: React.CSSProperties
}

// Module-level cache keyed by cuisine:orientation
const videoUrlCache: Record<string, string | null> = {}

export default function VideoBackground({
  cuisine, fallbackImage, isActive,
  orientation = 'portrait',
  directVideoUrl,
  style,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cacheKey = `${cuisine}:${orientation}`

  // If directVideoUrl provided, use it — skip API fetch entirely
  const [videoUrl, setVideoUrl] = useState<string | null>(
    directVideoUrl !== undefined ? directVideoUrl :
    cacheKey in videoUrlCache ? videoUrlCache[cacheKey] : null
  )
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)

  // Sync if directVideoUrl changes
  useEffect(() => {
    if (directVideoUrl !== undefined) {
      setVideoUrl(directVideoUrl)
      setVideoFailed(false)
      return
    }
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
  }, [cacheKey, directVideoUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl || videoFailed) return
    if (isActive) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [isActive, videoUrl, videoFailed, videoLoaded])

  // Mobile Safari — resume on visibility change
  useEffect(() => {
    if (!isActive) return
    function handleVisibility() {
      if (document.visibilityState === 'visible' && videoRef.current && isActive) {
        videoRef.current.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isActive])

  return (
    <div style={{ position: 'absolute', inset: 0, ...style }}>
      {fallbackImage && (
        <img src={fallbackImage} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {videoUrl && !videoFailed && (
        <video
          ref={videoRef}
          src={videoUrl}
          muted loop playsInline
          autoPlay={isActive}
          preload="auto"
          onCanPlay={() => {
            setVideoLoaded(true)
            if (isActive) videoRef.current?.play().catch(() => {})
          }}
          onError={() => { setVideoFailed(true); if (directVideoUrl === undefined) videoUrlCache[cacheKey] = null }}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: videoLoaded && isActive ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        />
      )}
    </div>
  )
}
