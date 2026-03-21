import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`)
  }

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

  // Exchange the code for a session
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !sessionData.user) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`)
  }

  const user = sessionData.user
  const email = user.email
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
  const nameParts = fullName.split(' ')
  const firstName = user.user_metadata?.given_name || nameParts[0] || ''
  const lastName = user.user_metadata?.family_name || nameParts.slice(1).join(' ') || ''

  // Check if this OAuth user already has a whozin_users record
  const admin = getAdminClient()
  const { data: existingUser } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!existingUser) {
    // Check if there's a whozin_users record with this email (invited via email)
    let linkedUser = null
    if (email) {
      const { data } = await admin
        .from('whozin_users')
        .select('id, auth_user_id')
        .eq('email', email)
        .is('auth_user_id', null)
        .maybeSingle()
      linkedUser = data
    }

    if (linkedUser) {
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
  }

  return NextResponse.redirect(`${origin}/app`)
}
