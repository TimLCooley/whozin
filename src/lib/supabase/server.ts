import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isSuperAdmin } from '@/lib/auth'

export const IMPERSONATE_COOKIE = 'whozin_impersonate'

export { createServerSupabaseClient as createServerClient }

export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  const base = createServerClient(
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

  // If a super admin has set the impersonate cookie, swap the auth user the
  // rest of the app sees. Real Supabase session is untouched.
  const targetWhozinUserId = cookieStore.get(IMPERSONATE_COOKIE)?.value
  if (!targetWhozinUserId) return base

  const { data: { user: realUser } } = await base.auth.getUser()
  if (!realUser || !isSuperAdmin(realUser.email)) return base

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceUrl || !serviceKey) return base

  const service = createServiceClient(serviceUrl, serviceKey)
  const { data: target } = await service
    .from('whozin_users')
    .select('auth_user_id')
    .eq('id', targetWhozinUserId)
    .single()
  if (!target?.auth_user_id) return base

  const { data: targetAuth } = await service.auth.admin.getUserById(target.auth_user_id)
  if (!targetAuth?.user) return base
  const fakeUser = targetAuth.user

  return new Proxy(base, {
    get(t, prop, receiver) {
      if (prop !== 'auth') return Reflect.get(t, prop, receiver)
      return new Proxy(t.auth, {
        get(at, ap, ar) {
          if (ap === 'getUser') {
            return async () => ({ data: { user: fakeUser }, error: null })
          }
          if (ap === 'getSession') {
            return async () => {
              const { data, error } = await t.auth.getSession()
              if (!data.session) return { data, error }
              return { data: { session: { ...data.session, user: fakeUser } }, error }
            }
          }
          return Reflect.get(at, ap, ar)
        },
      })
    },
  }) as SupabaseClient
}
