import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/auth/ensure-profile
 * Ensures a whozin_users record exists for the current authenticated user.
 * Called after OAuth sign-in (Apple/Google) via signInWithIdToken.
 */
export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = getAdminClient()
  const email = user.email
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
  const nameParts = fullName.split(' ')
  const firstName = user.user_metadata?.given_name || nameParts[0] || ''
  const lastName = user.user_metadata?.family_name || nameParts.slice(1).join(' ') || ''

  // Check if user already has a whozin_users record
  const { data: existingUser } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (existingUser) {
    return NextResponse.json({ ok: true, existing: true })
  }

  // Check if there's a record with this email (invited or existing phone user)
  let linkedUser = null
  if (email) {
    const { data } = await admin
      .from('whozin_users')
      .select('id, auth_user_id')
      .eq('email', email)
      .maybeSingle()
    linkedUser = data
  }

  if (linkedUser) {
    // Link this OAuth identity to the existing user record
    await admin
      .from('whozin_users')
      .update({
        auth_user_id: user.id,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        status: 'active',
      })
      .eq('id', linkedUser.id)
  } else {
    await admin.from('whozin_users').insert({
      auth_user_id: user.id,
      email: email,
      first_name: firstName,
      last_name: lastName,
      status: 'active',
      membership_tier: 'free',
    })
  }

  return NextResponse.json({ ok: true, created: true })
}
