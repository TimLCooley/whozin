import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isSuperAdmin } from '@/lib/auth'

export const IMPERSONATE_COOKIE = 'whozin_impersonate'

function buildBaseClient() {
  return cookies().then((cookieStore) =>
    createSupabaseServerClient(
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
  )
}

/**
 * Returns the Supabase server client tied to the real signed-in user.
 * Use this in admin routes (anything checking isSuperAdmin) and in the
 * impersonation endpoints themselves — anywhere you need the underlying
 * admin identity even when an impersonation cookie is present.
 */
export async function createServerClientReal() {
  return buildBaseClient()
}

/**
 * Returns the Supabase server client. If a super admin has set the
 * impersonation cookie, supabase.auth.getUser() / getSession() will return
 * the impersonated user instead of the real signed-in admin. Every other
 * call passes through unchanged. RLS-checked queries still use the real
 * JWT, but the codebase uses the service-role admin client for DB work,
 * so this is a non-issue in practice.
 */
export async function createServerClient(): Promise<SupabaseClient> {
  const real = await buildBaseClient()
  const cookieStore = await cookies()
  const targetWhozinUserId = cookieStore.get(IMPERSONATE_COOKIE)?.value
  if (!targetWhozinUserId) return real

  // Only honor the cookie if the real signed-in user is actually a super admin.
  const { data: { user: realUser } } = await real.auth.getUser()
  if (!realUser || !isSuperAdmin(realUser.email)) return real

  // Look up the impersonated user's auth_user_id via service role.
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceUrl || !serviceKey) return real

  const service = createServiceClient(serviceUrl, serviceKey)
  const { data: target } = await service
    .from('whozin_users')
    .select('auth_user_id')
    .eq('id', targetWhozinUserId)
    .single()

  if (!target?.auth_user_id) return real

  // Fabricate the auth user the rest of the app will see. Most routes
  // only read `id` and `email`, so we keep the shape minimal but accurate.
  const { data: targetAuth } = await service.auth.admin.getUserById(target.auth_user_id)
  if (!targetAuth?.user) return real
  const fakeUser = targetAuth.user

  const fakeAuth = new Proxy(real.auth, {
    get(target, prop, receiver) {
      if (prop === 'getUser') {
        return async () => ({ data: { user: fakeUser }, error: null })
      }
      if (prop === 'getSession') {
        return async () => {
          const { data, error } = await real.auth.getSession()
          if (!data.session) return { data, error }
          return {
            data: { session: { ...data.session, user: fakeUser } },
            error,
          }
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  })

  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'auth') return fakeAuth
      return Reflect.get(target, prop, receiver)
    },
  }) as SupabaseClient
}
