import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Poll for pending OAuth session tokens (used by native apps).
// The WebView polls this after opening OAuth in the system browser.
export async function GET(request: NextRequest) {
  const nonce = request.nextUrl.searchParams.get('nonce')
  if (!nonce || nonce.length < 16) {
    return NextResponse.json({ error: 'Invalid nonce' }, { status: 400 })
  }

  const admin = getAdminClient()

  const { data } = await admin
    .from('pending_auth_sessions')
    .select('access_token, refresh_token')
    .eq('nonce', nonce)
    .gt('created_at', new Date(Date.now() - 300_000).toISOString()) // expire after 5 min
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ pending: true })
  }

  // Don't delete — let it expire naturally so recovery polls can use it too
  // Android kills the WebView during OAuth, so the page needs to re-poll on restart

  return NextResponse.json({
    pending: false,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
}
