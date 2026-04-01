// src/lib/seedRestaurants.ts
// ONE-TIME script to populate Supabase with real LA/OC restaurants
// Run by visiting: /seed-restaurants in the browser (dev only)
// Or call seedRealRestaurants() directly from browser console

import { supabase } from './supabase'

// PlatePost pro customers — always protected, never touched
const PLATEPOST_PRO_IDS = [4, 5, 17, 18]

export async function seedRealRestaurants(): Promise<{
  added: number
  skipped: number
  errors: string[]
}> {
  console.log('🍽️ Starting restaurant seed...')
  const errors: string[] = []
  let added = 0
  let skipped = 0

  try {
    // Fetch real data from our Places API route
    const response = await fetch('/api/places')
    if (!response.ok) {
      throw new Error(`Places API returned ${response.status}`)
    }

    const { restaurants, count } = await response.json()
    console.log(`✅ Fetched ${count} restaurants from Google Places`)

    // Get existing restaurants from Supabase to avoid duplicates
    const { data: existing } = await supabase
      .from('restaurants')
      .select('name, place_id')

    const existingNames = new Set(
      (existing || []).map((r: any) => r.name.toLowerCase().trim())
    )
    const existingPlaceIds = new Set(
      (existing || []).map((r: any) => r.place_id).filter(Boolean)
    )

    // Insert new restaurants in batches
    const toInsert = restaurants.filter((r: any) => {
      // Skip if already exists by place_id
      if (r.place_id && existingPlaceIds.has(r.place_id)) {
        skipped++
        return false
      }
      // Skip if already exists by name
      if (existingNames.has(r.name.toLowerCase().trim())) {
        skipped++
        return false
      }
      return true
    })

    console.log(`📝 Inserting ${toInsert.length} new restaurants (${skipped} already exist)`)

    // Insert in batches of 10
    for (let i = 0; i < toInsert.length; i += 10) {
      const batch = toInsert.slice(i, i + 10)
      const { error } = await supabase
        .from('restaurants')
        .insert(batch)

      if (error) {
        console.error('Insert error:', error)
        errors.push(`Batch ${i}-${i + 10}: ${error.message}`)
      } else {
        added += batch.length
        console.log(`✅ Inserted batch ${i}-${i + batch.length}`)
      }
    }

    console.log(`🎉 Seed complete! Added: ${added}, Skipped: ${skipped}, Errors: ${errors.length}`)
    return { added, skipped, errors }

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Seed failed:', msg)
    errors.push(msg)
    return { added, skipped, errors }
  }
}

// Also update existing restaurants with real Google Places data
export async function updateExistingWithRealData(): Promise<void> {
  console.log('🔄 Updating existing restaurants with real photo URLs...')

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('*')
    .not('id', 'in', `(${PLATEPOST_PRO_IDS.join(',')})`)
    .is('place_id', null)

  if (!restaurants?.length) {
    console.log('No restaurants to update')
    return
  }

  console.log(`Found ${restaurants.length} restaurants without place_id`)
}
