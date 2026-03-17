import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export { createServerSupabaseClient as createServerClient }

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                maxAge: options?.maxAge ?? 60 * 60 * 24 * 30,
                sameSite: options?.sameSite ?? 'lax',
                secure: options?.secure ?? process.env.NODE_ENV === 'production',
              })
            )
          } catch {
            // This can be ignored in Server Components
          }
        },
      },
    }
  )
}
