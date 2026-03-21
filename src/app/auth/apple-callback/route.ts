import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'

function resultPage(title: string, message: string) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa;color:#333;}
    .card{text-align:center;padding:2rem;}</style></head>
    <body><div class="card"><h2>${title}</h2><p>${message}</p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}

// Apple sends a POST with id_token in form data (response_mode=form_post)
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl
  const cookieStore = await cookies()

  const formData = await request.formData()
  const idToken = formData.get('id_token') as string
  const state = formData.get('state') as string
  const error = formData.get('error') as string

  if (error) {
    return resultPage('Sign-in Failed', 'Apple sign-in was cancelled or failed. Close this tab and try again.')
  }

  // Verify state for CSRF
  const savedState = cookieStore.get('apple_auth_state')?.value
  if (!state || state !== savedState) {
    return resultPage('Sign-in Failed', 'Session expired. Close this tab and try again.')
  }
  cookieStore.delete('apple_auth_state')

  if (!idToken) {
    return resultPage('Sign-in Failed', 'No authentication token received from Apple. Close this tab and try again.')
  }

  // Use signInWithIdToken (same as web flow — this works!)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: sessionData, error: signInError } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: idToken,
  })

  if (signInError || !sessionData.user) {
    return resultPage('Sign-in Failed', 'Could not complete sign-in. Close this tab and try again.')
  }

  // Ensure user profile exists
  const user = sessionData.user
  const admin = getAdminClient()
  const { data: existingUser } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!existingUser) {
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
    const nameParts = fullName.split(' ')
    const firstName = user.user_metadata?.given_name || nameParts[0] || ''
    const lastName = user.user_metadata?.family_name || nameParts.slice(1).join(' ') || ''

    // Check for invited user by email
    let linkedUser = null
    if (user.email) {
      const { data } = await admin
        .from('whozin_users')
        .select('id, auth_user_id')
        .eq('email', user.email)
        .is('auth_user_id', null)
        .maybeSingle()
      linkedUser = data
    }

    if (linkedUser) {
      await admin.from('whozin_users').update({
        auth_user_id: user.id,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        status: 'active',
      }).eq('id', linkedUser.id)
    } else {
      await admin.from('whozin_users').insert({
        auth_user_id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        status: 'active',
        membership_tier: 'free',
      })
    }
  }

  // Store session for WebView polling
  const nonce = cookieStore.get('auth_nonce')?.value
  if (nonce && sessionData.session) {
    const { error: insertError } = await admin.from('pending_auth_sessions').insert({
      nonce,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    })
    cookieStore.delete('auth_nonce')

    return resultPage('Signed in!', 'Return to the Whozin app.')
  }

  // No nonce — regular web flow, redirect to app
  return NextResponse.redirect(`${origin}/app`)
}
