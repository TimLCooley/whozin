import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { nativeStorage } from './native-storage'

// Singleton for native to ensure session persistence across all calls
let nativeClient: SupabaseClient | null = null

export function createClient() {
  // Detect native WebView inside the function (not module-level — SSR would get false)
  const hasWindow = typeof window !== 'undefined'
  const ua = hasWindow ? navigator.userAgent : ''
  const isNativeWebView = hasWindow && (/wv/i.test(ua) || /Android.*Version\/[\d.]+/i.test(ua))

  // On native WebView: use supabase-js with cookie-based storage
  // Android WebView clears httpOnly server cookies on app close, but keeps JS cookies
  if (isNativeWebView) {
    if (!nativeClient) {
      nativeClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storage: nativeStorage,
          },
        }
      )
    }
    return nativeClient
  }

  // On web: use SSR browser client (cookie-based)
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
