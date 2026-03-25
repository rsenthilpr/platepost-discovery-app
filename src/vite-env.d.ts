/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_EVENTBRITE_TOKEN: string
  readonly VITE_GOOGLE_PLACES_KEY: string
  readonly VITE_PEXELS_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
