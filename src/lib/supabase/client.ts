import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

// Singleton for native to ensure session persistence across all calls
let nativeClient: SupabaseClient | null = null

// Use supabase-js directly on native (localStorage-based session persistence)
// Use SSR browser client on web (cookie-based for SSR compatibility)
export function createClient() {
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    if (!nativeClient) {
      nativeClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage,
          },
        }
      )
    }
    return nativeClient
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  )
}
