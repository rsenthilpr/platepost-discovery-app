// api/yelp.ts
// Serverless proxy for Yelp Fusion API
// Yelp blocks browser CORS so all calls must go through this proxy
// Runtime: Node.js (NOT edge)

export const config = { runtime: 'nodejs' }

const YELP_API_KEY = process.env.VITE_YELP_API

export default async function handler(req: any, res: any) {
  // Allow CORS from our app
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!YELP_API_KEY) {
    return res.status(500).json({ error: 'Yelp API key not configured' })
  }

  const { name, city, limit = '1' } = req.query

  if (!name || !city) {
    return res.status(400).json({ error: 'name and city are required' })
  }

  try {
    // Search for the business
    const searchUrl = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(name)}&location=${encodeURIComponent(city + ', CA')}&limit=${limit}&sort_by=best_match`

    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${YELP_API_KEY}`,
        Accept: 'application/json',
      },
    })

    if (!searchRes.ok) {
      return res.status(searchRes.status).json({ error: 'Yelp search failed' })
    }

    const searchData = await searchRes.json()
    const businesses = searchData.businesses || []

    if (businesses.length === 0) {
      return res.status(200).json({ photos: [], rating: null, reviewCount: null })
    }

    const business = businesses[0]

    // Get full business details including photos
    const detailRes = await fetch(`https://api.yelp.com/v3/businesses/${business.id}`, {
      headers: {
        Authorization: `Bearer ${YELP_API_KEY}`,
        Accept: 'application/json',
      },
    })

    if (!detailRes.ok) {
      // Return basic info from search even if detail fails
      return res.status(200).json({
        photos: business.image_url ? [business.image_url] : [],
        rating: business.rating,
        reviewCount: business.review_count,
        yelpUrl: business.url,
      })
    }

    const detail = await detailRes.json()

    return res.status(200).json({
      photos: detail.photos || (business.image_url ? [business.image_url] : []),
      rating: detail.rating,
      reviewCount: detail.review_count,
      yelpUrl: detail.url,
      phone: detail.display_phone,
      address: detail.location?.display_address?.join(', '),
    })

  } catch (err) {
    console.error('Yelp proxy error:', err)
    return res.status(500).json({ error: 'Yelp API error' })
  }
}
