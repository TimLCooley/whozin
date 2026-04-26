import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth'

const ORIGIN_COOKIE = 'whozin_run_as_origin'
const ACTIVE_COOKIE = 'whozin_run_as_active'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller || !isSuperAdmin(caller.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'No active session' }, { status: 401 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  const admin = getAdminClient()

  const { data: target, error: targetErr } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name, auth_user_id')
    .eq('id', userId)
    .single()

  if (targetErr || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (!target.auth_user_id) {
    return NextResponse.json({ error: 'User has no app account — text-only invitee' }, { status: 400 })
  }
  if (target.auth_user_id === caller.id) {
    return NextResponse.json({ error: 'Cannot run as yourself' }, { status: 400 })
  }

  const { data: targetAuth, error: authErr } = await admin.auth.admin.getUserById(target.auth_user_id)
  if (authErr || !targetAuth?.user?.email) {
    return NextResponse.json({ error: 'Target auth account not found' }, { status: 404 })
  }
  const targetEmail = targetAuth.user.email

  // Mint a one-time sign-in token for the target user without touching their
  // password or existing sessions. The client exchanges this for a session via
  // supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: linkErr?.message ?? 'Failed to mint sign-in token' }, { status: 500 })
  }

  const targetName = `${target.first_name ?? ''} ${target.last_name ?? ''}`.trim() || targetEmail

  console.log(
    `[run-as] super_admin=${caller.email} (${caller.id}) → target=${targetName} (${target.id}, ${targetEmail}) at ${new Date().toISOString()}`,
  )

  const res = NextResponse.json({
    token_hash: linkData.properties.hashed_token,
  })

  res.cookies.set(ORIGIN_COOKIE, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    admin_email: caller.email,
    admin_id: caller.id,
    target_id: target.id,
    started_at: Date.now(),
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 4,
  })

  res.cookies.set(ACTIVE_COOKIE, JSON.stringify({
    target_name: targetName,
    target_id: target.id,
  }), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 4,
  })

  return res
}

export async function DELETE() {
  const supabase = await createServerClient()
  const cookieStore = await cookies()
  const originRaw = cookieStore.get(ORIGIN_COOKIE)?.value
  if (!originRaw) {
    return NextResponse.json({ error: 'Not impersonating' }, { status: 400 })
  }

  let origin: { access_token: string; refresh_token: string; admin_email?: string; target_id?: string }
  try {
    origin = JSON.parse(originRaw)
  } catch {
    return NextResponse.json({ error: 'Invalid origin cookie' }, { status: 400 })
  }

  const { error } = await supabase.auth.setSession({
    access_token: origin.access_token,
    refresh_token: origin.refresh_token,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(
    `[run-as] stopped: super_admin=${origin.admin_email} → target=${origin.target_id} at ${new Date().toISOString()}`,
  )

  const res = NextResponse.json({ success: true })
  res.cookies.delete(ORIGIN_COOKIE)
  res.cookies.delete(ACTIVE_COOKIE)
  return res
}
