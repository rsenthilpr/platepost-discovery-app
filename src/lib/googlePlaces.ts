import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY

export interface PlacesResult {
  rating?: number
  userRatingsTotal?: number
  photoUrl?: string
}

let initialized = false

async function ensureMapsLoaded() {
  if (!initialized) {
    setOptions({ key: API_KEY, v: 'weekly', libraries: ['places'] })
    initialized = true
  }
  await importLibrary('places')
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
              resolve({
                rating: place.rating,
                userRatingsTotal: place.user_ratings_total,
                photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 800 }),
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
