import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY

export interface PlacesResult {
  rating?: number
  userRatingsTotal?: number
  photoUrl?: string
  allPhotoUrls?: string[]
}

let initialized = false

async function ensureMapsLoaded() {
  if (!initialized) {
    setOptions({ key: API_KEY, v: 'weekly', libraries: ['places'] })
    initialized = true
  }
  await importLibrary('places')
}

function scoredPhotos(photos: google.maps.places.PlacePhoto[]): string[] {
  return photos
    .map(photo => {
      const width = photo.width || 1
      const height = photo.height || 1
      const ratio = width / height
      const score = ratio > 1.1 ? 2 : ratio > 0.9 ? 1 : 0
      return { photo, score }
    })
    .sort((a, b) => b.score - a.score)
    .map(({ photo }) => photo.getUrl({ maxWidth: 1600, maxHeight: 1200 }))
}

export async function fetchPlaceDetails(name: string, city: string): Promise<PlacesResult> {
  try {
    await ensureMapsLoaded()
    return new Promise((resolve) => {
      const service = new google.maps.places.PlacesService(document.createElement('div'))
      service.findPlaceFromQuery(
        { query: `${name} ${city}`, fields: ['place_id'] },
        (results, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.[0]?.place_id) {
            return resolve({})
          }
          service.getDetails(
            { placeId: results[0].place_id!, fields: ['rating', 'user_ratings_total', 'photos'] },
            (place, detailStatus) => {
              if (detailStatus !== google.maps.places.PlacesServiceStatus.OK || !place) {
                return resolve({})
              }
              const photos = place.photos || []
              const scored = photos.length > 0 ? scoredPhotos(photos) : []
              resolve({
                rating: place.rating,
                userRatingsTotal: place.user_ratings_total,
                photoUrl: scored[0] || undefined,
                allPhotoUrls: scored.slice(0, 5),
              })
            }
          )
        }
      )
    })
  } catch {
    return {}
  }
}
