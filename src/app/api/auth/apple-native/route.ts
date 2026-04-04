import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Redirect to Apple's authorize endpoint directly (bypasses Supabase OAuth).
// Apple will POST back to /auth/apple-callback with the id_token.
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl
  const nonce = request.nextUrl.searchParams.get('nonce')

  if (!nonce) {
    return NextResponse.json({ error: 'Missing nonce' }, { status: 400 })
  }

  // Encode nonce in state so it survives the redirect without cookies
  // Format: randomHex.nonce
  const state = crypto.randomBytes(16).toString('hex') + '.' + nonce

  const params = new URLSearchParams({
    client_id: 'io.whozin.app.signin',
    redirect_uri: `${origin}/auth/apple-callback`,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'email name',
    state,
  })

  // Set cookies directly on the redirect response
  const response = NextResponse.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`)

  response.cookies.set('auth_nonce', nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 300,
    path: '/',
  })

  response.cookies.set('apple_auth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 300,
    path: '/',
  })

  return response
}
