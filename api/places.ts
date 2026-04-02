// api/places.ts
// Serverless proxy for Google Places API
// Searches for real LA/OC restaurants and returns structured data
// Runtime: Node.js (NOT edge)

export const config = { runtime: 'nodejs' }

const GOOGLE_API_KEY = process.env.VITE_GOOGLE_PLACES_KEY || process.env.VITE_GOOGLE_MAPS_KEY

// LA/OC search queries — comprehensive coverage
const SEARCH_QUERIES = [
  // Coffee — core vertical
  { query: 'best coffee shop Los Angeles', cuisine: 'Coffee', neighborhood: 'Los Angeles' },
  { query: 'best coffee shop Silver Lake Los Angeles', cuisine: 'Coffee', neighborhood: 'Silver Lake' },
  { query: 'best coffee shop West Hollywood', cuisine: 'Coffee', neighborhood: 'West Hollywood' },
  { query: 'best coffee shop Venice Beach Los Angeles', cuisine: 'Coffee', neighborhood: 'Venice' },
  { query: 'best coffee shop Arts District Los Angeles', cuisine: 'Coffee', neighborhood: 'Arts District' },
  { query: 'best coffee shop Orange County California', cuisine: 'Coffee', neighborhood: 'Orange County' },
  { query: 'best coffee shop Koreatown Los Angeles', cuisine: 'Coffee', neighborhood: 'Koreatown' },
  { query: 'best coffee shop Echo Park Los Angeles', cuisine: 'Coffee', neighborhood: 'Echo Park' },
  { query: 'best coffee shop Highland Park Los Angeles', cuisine: 'Coffee', neighborhood: 'Highland Park' },
  { query: 'best coffee shop Culver City', cuisine: 'Coffee', neighborhood: 'Culver City' },
  { query: 'best coffee shop Santa Monica', cuisine: 'Coffee', neighborhood: 'Santa Monica' },
  { query: 'best coffee shop Pasadena California', cuisine: 'Coffee', neighborhood: 'Pasadena' },
  { query: 'best coffee shop Anaheim California', cuisine: 'Coffee', neighborhood: 'Anaheim' },
  { query: 'best coffee shop Irvine California', cuisine: 'Coffee', neighborhood: 'Irvine' },
  { query: 'best coffee shop Fullerton California', cuisine: 'Coffee', neighborhood: 'Fullerton' },
  { query: 'specialty coffee Los Angeles', cuisine: 'Coffee', neighborhood: 'Los Angeles' },
  { query: 'third wave coffee shop Los Angeles', cuisine: 'Coffee', neighborhood: 'Los Angeles' },
  // American / Brunch
  { query: 'best brunch restaurant Los Angeles', cuisine: 'American', neighborhood: 'Los Angeles' },
  { query: 'best brunch West Hollywood', cuisine: 'American', neighborhood: 'West Hollywood' },
  { query: 'best brunch Santa Monica', cuisine: 'American', neighborhood: 'Santa Monica' },
  { query: 'best burger restaurant Los Angeles', cuisine: 'American', neighborhood: 'Los Angeles' },
  { query: 'best rooftop restaurant Los Angeles', cuisine: 'American', neighborhood: 'Los Angeles' },
  { query: 'best American restaurant Beverly Hills', cuisine: 'American', neighborhood: 'Beverly Hills' },
  { query: 'best restaurant West Hollywood Los Angeles', cuisine: 'American', neighborhood: 'West Hollywood' },
  // Japanese / Sushi
  { query: 'best Japanese restaurant Los Angeles', cuisine: 'Japanese', neighborhood: 'Los Angeles' },
  { query: 'best sushi restaurant Los Angeles', cuisine: 'Japanese', neighborhood: 'Los Angeles' },
  { query: 'best ramen Los Angeles', cuisine: 'Japanese', neighborhood: 'Los Angeles' },
  { query: 'best omakase sushi Los Angeles', cuisine: 'Japanese', neighborhood: 'Los Angeles' },
  // Italian
  { query: 'best Italian restaurant Los Angeles', cuisine: 'Italian', neighborhood: 'Los Angeles' },
  { query: 'best pizza Los Angeles', cuisine: 'Italian', neighborhood: 'Los Angeles' },
  { query: 'best Italian restaurant Silver Lake', cuisine: 'Italian', neighborhood: 'Silver Lake' },
  // Mexican
  { query: 'best Mexican restaurant Los Angeles', cuisine: 'Mexican', neighborhood: 'Los Angeles' },
  { query: 'best tacos Los Angeles', cuisine: 'Mexican', neighborhood: 'Los Angeles' },
  { query: 'best Mexican restaurant East LA', cuisine: 'Mexican', neighborhood: 'East LA' },
  // Korean
  { query: 'best Korean BBQ Los Angeles Koreatown', cuisine: 'Korean', neighborhood: 'Koreatown' },
  { query: 'best Korean restaurant Los Angeles', cuisine: 'Korean', neighborhood: 'Los Angeles' },
  // Thai / Asian
  { query: 'best Thai restaurant Los Angeles', cuisine: 'Thai', neighborhood: 'Los Angeles' },
  { query: 'best Vietnamese restaurant Los Angeles', cuisine: 'Vietnamese', neighborhood: 'Los Angeles' },
  { query: 'best Chinese restaurant Los Angeles', cuisine: 'Chinese', neighborhood: 'Los Angeles' },
  { query: 'best dim sum Los Angeles', cuisine: 'Chinese', neighborhood: 'Los Angeles' },
  // Mediterranean / Other
  { query: 'best Mediterranean restaurant Los Angeles', cuisine: 'Mediterranean', neighborhood: 'Los Angeles' },
  { query: 'best Indian restaurant Los Angeles', cuisine: 'Indian', neighborhood: 'Los Angeles' },
  // Music / Jazz
  { query: 'jazz club Los Angeles', cuisine: 'Jazz', neighborhood: 'Los Angeles' },
  { query: 'live music venue Los Angeles', cuisine: 'Music', neighborhood: 'Los Angeles' },
  { query: 'live music bar Silver Lake', cuisine: 'Music', neighborhood: 'Silver Lake' },
  // Cafes / Bakeries
  { query: 'best cafe bakery Los Angeles', cuisine: 'Cafe', neighborhood: 'Los Angeles' },
  { query: 'best bakery West Hollywood', cuisine: 'Cafe', neighborhood: 'West Hollywood' },
  { query: 'best breakfast cafe Los Angeles', cuisine: 'Cafe', neighborhood: 'Los Angeles' },
  // Expanded geography — Long Beach, San Diego, Riverside
  { query: 'best coffee shop Long Beach California', cuisine: 'Coffee', neighborhood: 'Long Beach' },
  { query: 'best restaurant Long Beach California', cuisine: 'American', neighborhood: 'Long Beach' },
  { query: 'best coffee shop San Diego California', cuisine: 'Coffee', neighborhood: 'San Diego' },
  { query: 'best brunch San Diego', cuisine: 'American', neighborhood: 'San Diego' },
  { query: 'best coffee shop Riverside California', cuisine: 'Coffee', neighborhood: 'Riverside' },
  { query: 'best coffee shop Pomona California', cuisine: 'Coffee', neighborhood: 'Pomona' },
  { query: 'best coffee shop Pasadena California', cuisine: 'Coffee', neighborhood: 'Pasadena' },
  { query: 'best restaurant Pasadena California', cuisine: 'American', neighborhood: 'Pasadena' },
  { query: 'best coffee shop Burbank California', cuisine: 'Coffee', neighborhood: 'Burbank' },
  { query: 'best coffee shop Glendale California', cuisine: 'Coffee', neighborhood: 'Glendale' },
  // More LA neighborhoods
  { query: 'best restaurant Boyle Heights Los Angeles', cuisine: 'Mexican', neighborhood: 'Boyle Heights' },
  { query: 'best restaurant Inglewood California', cuisine: 'American', neighborhood: 'Inglewood' },
  { query: 'best coffee shop Leimert Park Los Angeles', cuisine: 'Coffee', neighborhood: 'Leimert Park' },
  { query: 'best restaurant Mar Vista Los Angeles', cuisine: 'American', neighborhood: 'Mar Vista' },
  { query: 'best date night restaurant Los Angeles', cuisine: 'American', neighborhood: 'Los Angeles' },
  { query: 'best happy hour bar Los Angeles', cuisine: 'American', neighborhood: 'Los Angeles' },
  { query: 'best wine bar Los Angeles', cuisine: 'American', neighborhood: 'Los Angeles' },
  { query: 'best ramen shop Los Angeles', cuisine: 'Japanese', neighborhood: 'Los Angeles' },
  { query: 'best pho Vietnamese Los Angeles', cuisine: 'Vietnamese', neighborhood: 'Los Angeles' },
]

async function searchPlaces(query: string): Promise<any[]> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&type=restaurant|cafe|bar&language=en`
  const res = await fetch(url)
  const data = await res.json() as any
  return data.results || []
}

async function getPlaceDetails(placeId: string): Promise<any> {
  const fields = 'place_id,name,formatted_address,formatted_phone_number,geometry,rating,user_ratings_total,opening_hours,photos,website,price_level,types'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`
  const res = await fetch(url)
  const data = await res.json() as any
  return data.result || null
}

function getPhotoUrl(photoReference: string, maxWidth = 1600): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`
}

function extractCity(address: string): string {
  const lower = address.toLowerCase()
  if (lower.includes('orange')) return 'Orange'
  if (lower.includes('placentia')) return 'Placentia'
  if (lower.includes('irvine')) return 'Irvine'
  if (lower.includes('anaheim')) return 'Anaheim'
  if (lower.includes('santa ana')) return 'Santa Ana'
  if (lower.includes('costa mesa')) return 'Costa Mesa'
  if (lower.includes('santa monica')) return 'Santa Monica'
  if (lower.includes('west hollywood')) return 'West Hollywood'
  if (lower.includes('culver city')) return 'Culver City'
  if (lower.includes('pasadena')) return 'Pasadena'
  if (lower.includes('burbank')) return 'Burbank'
  if (lower.includes('glendale')) return 'Glendale'
  return 'Los Angeles'
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const restaurants: any[] = []
    const seenPlaceIds = new Set<string>()
    const seenNames = new Set<string>()

    for (const searchItem of SEARCH_QUERIES) {
      try {
        const results = await searchPlaces(searchItem.query)

        // Take top 3 results per query
        for (const place of results.slice(0, 3)) {
          if (seenPlaceIds.has(place.place_id)) continue
          if (seenNames.has(place.name.toLowerCase())) continue

          // Only include highly rated places (4.0+)
          if (place.rating < 4.0) continue

          // Get full details
          const details = await getPlaceDetails(place.place_id)
          if (!details) continue

          seenPlaceIds.add(place.place_id)
          seenNames.add(place.name.toLowerCase())

          const photoUrl = details.photos?.[0]?.photo_reference
            ? getPhotoUrl(details.photos[0].photo_reference)
            : null

          if (!photoUrl) continue // skip places with no photos

          restaurants.push({
            name: details.name,
            cuisine: searchItem.cuisine,
            tier: 'basic',
            city: extractCity(details.formatted_address || ''),
            state: 'CA',
            latitude: details.geometry?.location?.lat || 34.0522,
            longitude: details.geometry?.location?.lng || -118.2437,
            website_url: details.website || '',
            platepost_menu_url: '',
            image_url: photoUrl,
            description: `${details.name} — ${searchItem.cuisine} · ${extractCity(details.formatted_address || '')}`,
            rating: details.rating || null,
            review_count: details.user_ratings_total || null,
            phone: details.formatted_phone_number || null,
            hours: details.opening_hours?.weekday_text
              ? JSON.stringify(details.opening_hours.weekday_text)
              : null,
            place_id: details.place_id,
            neighborhood: searchItem.neighborhood,
            price_level: details.price_level || null,
            address: details.formatted_address || null,
          })
        }

        // Small delay between requests to avoid rate limiting
        await new Promise(r => setTimeout(r, 200))
      } catch (err) {
        console.error(`Error searching "${searchItem.query}":`, err)
        continue
      }
    }

    return res.status(200).json({
      count: restaurants.length,
      restaurants,
    })
  } catch (err) {
    console.error('Places API error:', err)
    return res.status(500).json({ error: 'Failed to fetch places' })
  }
}
