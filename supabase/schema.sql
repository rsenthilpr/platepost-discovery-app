-- ============================================================
-- PlatePost Discovery — Full Schema + Seed Data
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- 1. RESTAURANTS TABLE
CREATE TABLE IF NOT EXISTS restaurants (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  cuisine     TEXT,
  tier        TEXT DEFAULT 'basic' CHECK (tier IN ('pro', 'basic')),
  city        TEXT,
  state       TEXT,
  latitude    FLOAT,
  longitude   FLOAT,
  website_url TEXT,
  platepost_menu_url TEXT,
  image_url   TEXT,
  description TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
  id             SERIAL PRIMARY KEY,
  restaurant_id  INT REFERENCES restaurants(id) ON DELETE CASCADE,
  event_name     TEXT NOT NULL,
  event_date     TEXT,
  event_time     TEXT,
  eventbrite_url TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENABLE ROW LEVEL SECURITY (read-only public access)
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read restaurants" ON restaurants
  FOR SELECT USING (true);

CREATE POLICY "Public read events" ON events
  FOR SELECT USING (true);

-- 4. SEED RESTAURANT DATA
INSERT INTO restaurants (name, cuisine, tier, city, state, latitude, longitude, website_url, platepost_menu_url, image_url, description)
VALUES
  -- Pro tier
  ('Cafe Yoto',
   'Japanese', 'pro', 'Minneapolis', 'MN', 44.9861, -93.2750,
   'https://cafeyoto.com', '',
   'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80',
   'Cozy Japanese cafe in the heart of Minneapolis.'),

  ('Sanjusan',
   'Italian', 'pro', 'Minneapolis', 'MN', 44.9823, -93.2494,
   'https://sanjusan.com', '',
   'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
   'Modern Italian cuisine with a Minneapolis twist.'),

  ('FOWLING Minneapolis',
   'American', 'pro', 'Minneapolis', 'MN', 44.9897, -93.2777,
   'https://fowlingwarehouse.com', '',
   'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
   'American food and entertainment venue.'),

  ('Kei Coffee House',
   'Cafe', 'pro', 'Minneapolis', 'MN', 44.9756, -93.2291,
   'https://keicoffeehouse.com', '',
   'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
   'Specialty coffee and light bites.'),

  -- DJ / Event venues
  ('Wish You Were Here Coffee Roasters',
   'Coffee', 'basic', 'Pomona', 'CA', 34.0553, -117.7529,
   'https://wishyouwereherecoffee.com', '',
   'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
   'Artisan coffee roasters with a community vibe.'),

  ('Sound Nightclub',
   'Music', 'basic', 'Los Angeles', 'CA', 34.0983, -118.3317,
   'https://soundnightclub.com', '',
   'https://images.unsplash.com/photo-1571204829887-3b8d69e4094d?w=800&q=80',
   'Premier nightclub featuring world-class DJs.'),

  ('Exchange LA',
   'Music', 'basic', 'Los Angeles', 'CA', 34.0441, -118.2490,
   'https://exchangela.com', '',
   'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
   'Downtown LA historic venue for electronic music.'),

  ('Academy LA',
   'Music', 'basic', 'Los Angeles', 'CA', 34.1016, -118.3317,
   'https://academyla.com', '',
   'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80',
   'Multi-room nightlife destination in Hollywood.'),

  ('The Lighthouse Cafe',
   'Jazz', 'basic', 'Hermosa Beach', 'CA', 33.8622, -118.3989,
   'https://thelighthousecafe.net', '',
   'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&q=80',
   'Legendary jazz venue on the Hermosa Beach pier.'),

  ('Hollywood Bowl',
   'Music', 'basic', 'Los Angeles', 'CA', 34.1122, -118.3390,
   'https://hollywoodbowl.com', '',
   'https://images.unsplash.com/photo-1500673922987-e212871fec22?w=800&q=80',
   'Iconic outdoor amphitheater under the Hollywood stars.'),

  -- Orange County coffee shops
  ('Portola Coffee Lab',
   'Coffee', 'basic', 'Orange', 'CA', 33.7879, -117.8531,
   'https://portolacoffee.com', '',
   'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80',
   'Award-winning specialty coffee lab in OC.'),

  ('Hidden House Coffee',
   'Coffee', 'basic', 'Santa Ana', 'CA', 33.7455, -117.8677,
   'https://hiddenhousecoffee.com', '',
   'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
   'Charming hidden gem for coffee lovers in Santa Ana.'),

  ('Lofty Coffee Co',
   'Coffee', 'basic', 'Carlsbad', 'CA', 33.1581, -117.3506,
   'https://loftycoffee.com', '',
   'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800&q=80',
   'Beach town specialty coffee with a relaxed atmosphere.'),

  ('Kean Coffee',
   'Coffee', 'basic', 'Newport Beach', 'CA', 33.6189, -117.9289,
   'https://keancoffee.com', '',
   'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800&q=80',
   'Newport Beach''s go-to for single-origin espresso.'),

  ('NEAT Coffee',
   'Coffee', 'basic', 'Costa Mesa', 'CA', 33.6411, -117.9187,
   'https://neatcoffee.com', '',
   'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&q=80',
   'Clean, minimal coffee bar in the heart of Costa Mesa.');

-- 5. SAMPLE EVENT DATA (optional)
INSERT INTO events (restaurant_id, event_name, event_date, event_time, eventbrite_url)
VALUES
  (6,  'Saturday Night DJ Set', '2025-04-05', '10:00 PM', 'https://eventbrite.com'),
  (7,  'Exchange LA: Underground Sessions', '2025-04-06', '9:00 PM', 'https://eventbrite.com'),
  (8,  'Academy LA: Spring Rave', '2025-04-12', '9:00 PM', 'https://eventbrite.com'),
  (9,  'Jazz Night at The Lighthouse', '2025-04-08', '7:30 PM', 'https://eventbrite.com'),
  (10, 'Hollywood Bowl Opening Night', '2025-04-19', '7:00 PM', 'https://eventbrite.com');
