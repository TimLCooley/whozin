import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side OAuth initiation.
// Generates the Supabase OAuth URL and redirects to it.
// The nonce parameter is passed through to the callback for native session handoff.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const provider = searchParams.get('provider') as 'apple' | 'google'
  const nonce = searchParams.get('nonce')

  if (!provider || !['apple', 'google'].includes(provider)) {
    return NextResponse.redirect(`${origin}/?error=invalid_provider`)
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

  const scopes = provider === 'google'
    ? 'https://www.googleapis.com/auth/contacts.readonly'
    : undefined

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes,
      skipBrowserRedirect: true,
      ...(provider === 'google' ? {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      } : {}),
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/?error=oauth_failed`)
  }

  // Set the nonce as a cookie so the callback can read it (survives redirects)
  const response = NextResponse.redirect(data.url)
  if (nonce) {
    response.cookies.set('auth_nonce', nonce, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
      path: '/',
    })
  }
  return response
}
