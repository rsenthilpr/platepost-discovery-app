const PEXELS_KEY = import.meta.env.VITE_PEXELS_KEY

export interface PexelsPhoto {
  url: string
  photographer: string
}

export interface PexelsVideo {
  url: string
}

export async function fetchPexelsPhoto(query: string): Promise<PexelsPhoto | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const photo = data?.photos?.[0]
    if (!photo) return null
    return {
      url: photo.src.large,
      photographer: photo.photographer,
    }
  } catch {
    return null
  }
}

// Used for hero videos (MenuPage, HomeScreen) — landscape orientation
export async function fetchPexelsVideo(query: string): Promise<PexelsVideo | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const video = data?.videos?.[0]
    if (!video) return null
    const file =
      video.video_files?.find((f: { quality: string }) => f.quality === 'hd') ??
      video.video_files?.[0]
    if (!file?.link) return null
    return { url: file.link }
  } catch {
    return null
  }
}

// Used for reels feed (ListViewScreen) — any orientation, CSS handles cropping
export async function fetchPexelsPortraitVideo(query: string): Promise<PexelsVideo | null> {
  try {
    // Try landscape first (more results), CSS object-cover handles vertical cropping
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5`,
      { headers: { Authorization: PEXELS_KEY } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const videos = data?.videos ?? []
    for (const video of videos) {
      // Prefer SD/HD files under 10MB for fast mobile loading
      const file =
        video.video_files?.find((f: { quality: string; height: number }) =>
          f.quality === 'sd' && f.height >= 480
        ) ??
        video.video_files?.find((f: { quality: string }) => f.quality === 'hd') ??
        video.video_files?.[0]
      if (file?.link) return { url: file.link }
    }
    return null
  } catch {
    return null
  }
}
