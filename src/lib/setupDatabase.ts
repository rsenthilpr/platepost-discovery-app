import { supabase } from './supabase'

export async function setupDatabase() {
  console.log('Setting up database...')

  // Create restaurants table via RPC (raw SQL)
  const createRestaurantsSQL = `
    CREATE TABLE IF NOT EXISTS restaurants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      cuisine TEXT,
      tier TEXT DEFAULT 'basic',
      city TEXT,
      state TEXT,
      latitude FLOAT,
      longitude FLOAT,
      website_url TEXT,
      platepost_menu_url TEXT,
      image_url TEXT,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  const createEventsSQL = `
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
      event_name TEXT NOT NULL,
      event_date TEXT,
      event_time TEXT,
      eventbrite_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  const { error: e1 } = await supabase.rpc('exec_sql', { sql: createRestaurantsSQL })
  if (e1) console.error('restaurants table error:', e1)

  const { error: e2 } = await supabase.rpc('exec_sql', { sql: createEventsSQL })
  if (e2) console.error('events table error:', e2)

  console.log('Database setup complete.')
}
