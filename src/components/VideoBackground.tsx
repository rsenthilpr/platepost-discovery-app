// src/components/VideoBackground.tsx
// Fetches a real HD food video from Pexels API via serverless proxy
// Falls back silently to restaurant photo if video fails

import { useRef, useEffect, useState } from 'react'

interface Props {
  cuisine: string
  fallbackImage: string
  isActive: boolean
  style?: React.CSSProperties
}

// Module-level cache so we don't refetch the same cuisine twice per session
const videoUrlCache: Record<string, string | null> = {}

export default function VideoBackground({ cuisine, fallbackImage, isActive, style }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(videoUrlCache[cuisine] ?? null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)

  // Fetch video URL from Pexels proxy
  useEffect(() => {
    if (videoUrlCache[cuisine] !== undefined) {
      // Already fetched (may be null if failed)
      setVideoUrl(videoUrlCache[cuisine])
      return
    }

    fetch(`/api/pexels-video?cuisine=${encodeURIComponent(cuisine)}`)
      .then(r => r.json())
      .then(data => {
        const url = data.url ?? null
        videoUrlCache[cuisine] = url
        setVideoUrl(url)
      })
      .catch(() => {
        videoUrlCache[cuisine] = null
        setVideoUrl(null)
      })
  }, [cuisine])

  // Play/pause based on active state
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl || videoFailed) return

    if (isActive && videoLoaded) {
      video.play().catch(() => setVideoFailed(true))
    } else {
      video.pause()
    }
  }, [isActive, videoUrl, videoFailed, videoLoaded])

  // Always show fallback image underneath for instant load
  return (
    <div style={{ position: 'absolute', inset: 0, ...style }}>
      {/* Fallback photo — always visible instantly */}
      <img
        src={fallbackImage}
        alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
        }}
      />

      {/* Video overlay — loads on top when ready */}
      {videoUrl && !videoFailed && (
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          loop
          playsInline
          preload={isActive ? 'auto' : 'none'}
          onCanPlay={() => setVideoLoaded(true)}
          onError={() => {
            setVideoFailed(true)
            videoUrlCache[cuisine] = null
          }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: videoLoaded && isActive ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        />
      )}
    </div>
  )
}
