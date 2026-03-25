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
    // Pick the HD or SD file
    const file =
      video.video_files?.find((f: { quality: string }) => f.quality === 'hd') ??
      video.video_files?.[0]
    if (!file?.link) return null
    return { url: file.link }
  } catch {
    return null
  }
}
