// src/lib/videoMap.ts
// Maps cuisine types to Pexels hosted video URLs — no local files needed

const PEXELS_VIDEOS: Record<string, string> = {
  Coffee: 'https://videos.pexels.com/video-files/5980/pexels-latte-art-coffee-5980.mp4',
  Cafe: 'https://videos.pexels.com/video-files/5980/pexels-latte-art-coffee-5980.mp4',
  Japanese: 'https://videos.pexels.com/video-files/3191586/3191586-hd_1080_1920_25fps.mp4',
  Italian: 'https://videos.pexels.com/video-files/3195394/3195394-hd_1080_1920_25fps.mp4',
  American: 'https://videos.pexels.com/video-files/4253925/4253925-hd_1080_1920_25fps.mp4',
  Mexican: 'https://videos.pexels.com/video-files/3296902/3296902-hd_1080_1920_25fps.mp4',
  Korean: 'https://videos.pexels.com/video-files/3191586/3191586-hd_1080_1920_25fps.mp4',
  Thai: 'https://videos.pexels.com/video-files/3296902/3296902-hd_1080_1920_25fps.mp4',
  Vietnamese: 'https://videos.pexels.com/video-files/3195394/3195394-hd_1080_1920_25fps.mp4',
  Chinese: 'https://videos.pexels.com/video-files/3191586/3191586-hd_1080_1920_25fps.mp4',
  Indian: 'https://videos.pexels.com/video-files/3195394/3195394-hd_1080_1920_25fps.mp4',
  Mediterranean: 'https://videos.pexels.com/video-files/4253925/4253925-hd_1080_1920_25fps.mp4',
}

const FALLBACK = 'https://videos.pexels.com/video-files/4253925/4253925-hd_1080_1920_25fps.mp4'

export function getVideoForCuisine(cuisine: string): string {
  return PEXELS_VIDEOS[cuisine] ?? FALLBACK
}

export function hasVideoForCuisine(cuisine: string): boolean {
  return cuisine in PEXELS_VIDEOS
}
