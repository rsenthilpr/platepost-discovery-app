// api/places-search.ts — Google Places (New) proxy for city-based restaurant search
export const config = { runtime: 'nodejs' }

const PLACES_KEY = process.env.VITE_GOOGLE_PLACES_KEY ?? process.env.VITE_GOOGLE_MAPS_KEY

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (!PLACES_KEY) {
    console.error('No Google Places API key found')
    return res.status(200).json({ places: [], error: 'API key not configured' })
  }

  const { city, lat, lng, type = 'restaurant', query } = req.query

  try {
    // Use Places API (New) — Text Search
    const searchQuery = query
      ? `${query} in ${city || 'Los Angeles'}`
      : `${type === 'coffee' ? 'coffee shops cafes' : 'restaurants'} in ${city || 'Los Angeles'}`

    const body: any = {
      textQuery: searchQuery,
      maxResultCount: 20,
      languageCode: 'en',
    }

    // If we have coordinates, add location bias
    if (lat && lng) {
      body.locationBias = {
        circle: {
          center: { latitude: parseFloat(lat as string), longitude: parseFloat(lng as string) },
          radius: 15000, // 15km radius
        },
      }
    }

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': PLACES_KEY,
          'X-Goog-FieldMask': [
            'places.id',
            'places.displayName',
            'places.formattedAddress',
            'places.location',
            'places.rating',
            'places.userRatingCount',
            'places.priceLevel',
            'places.primaryTypeDisplayName',
            'places.photos',
            'places.regularOpeningHours',
            'places.internationalPhoneNumber',
            'places.websiteUri',
            'places.editorialSummary',
          ].join(','),
        },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('Google Places error:', response.status, errText.slice(0, 300))
      return res.status(200).json({ places: [], error: `Google Places API error: ${response.status}` })
    }

    const data = await response.json() as any
    const rawPlaces = data.places ?? []

    // Normalize to a consistent shape
    const places = rawPlaces.map((p: any) => {
      // Get best photo reference
      const photoRef = p.photos?.[0]?.name ?? null
      const photoUrl = photoRef
        ? `https://places.googleapis.com/v1/${photoRef}/media?maxHeightPx=400&maxWidthPx=600&key=${PLACES_KEY}`
        : null

      // Determine open/closed
      const isOpen = p.regularOpeningHours?.openNow ?? null

      return {
        place_id: p.id,
        name: p.displayName?.text ?? 'Unknown',
        address: p.formattedAddress ?? '',
        latitude: p.location?.latitude ?? 0,
        longitude: p.location?.longitude ?? 0,
        rating: p.rating ?? null,
        review_count: p.userRatingCount ?? null,
        price_level: p.priceLevel ?? null,
        cuisine: p.primaryTypeDisplayName?.text ?? 'Restaurant',
        phone: p.internationalPhoneNumber ?? null,
        website_url: p.websiteUri ?? null,
        description: p.editorialSummary?.text ?? null,
        image_url: photoUrl,
        is_open: isOpen,
        source: 'google_places',
      }
    })

    return res.status(200).json({ places, count: places.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Places proxy error:', message)
    return res.status(200).json({ places: [], error: message })
  }
}
