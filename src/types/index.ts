export interface Restaurant {
  id: number
  name: string
  cuisine: string
  tier: 'pro' | 'basic'
  city: string
  state: string
  latitude: number
  longitude: number
  website_url: string
  platepost_menu_url: string
  image_url: string
  description: string
  created_at: string
}

export interface Event {
  id: number
  restaurant_id: number
  event_name: string
  event_date: string
  event_time: string
  eventbrite_url: string
  created_at: string
}
