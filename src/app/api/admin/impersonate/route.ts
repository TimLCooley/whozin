import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientReal, IMPERSONATE_COOKIE } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth'

/** Start impersonating a user. Super admin only. */
export async function POST(req: NextRequest) {
  const supabase = await createServerClientReal()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { user_id } = await req.json()
  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  // Sanity check: target user exists and is not the admin themselves.
  const admin = getAdminClient()
  const { data: target } = await admin
    .from('whozin_users')
    .select('id, auth_user_id, first_name, last_name')
    .eq('id', user_id)
    .single()
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (!target.auth_user_id) {
    return NextResponse.json(
      { error: 'This user has no app account yet — only invited.' },
      { status: 400 }
    )
  }

  const cookieStore = await cookies()
  cookieStore.set(IMPERSONATE_COOKIE, target.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // Short-lived: 8 hours. Re-impersonate after that.
    maxAge: 60 * 60 * 8,
  })

  return NextResponse.json({
    success: true,
    target: { id: target.id, name: `${target.first_name} ${target.last_name}`.trim() },
  })
}

/** Stop impersonating. No auth required — anyone can clear their own cookie. */
export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(IMPERSONATE_COOKIE)
  return NextResponse.json({ success: true })
}

/** Read current impersonation status (used by the banner in the app shell). */
export async function GET() {
  const cookieStore = await cookies()
  const targetId = cookieStore.get(IMPERSONATE_COOKIE)?.value
  if (!targetId) return NextResponse.json({ impersonating: false })

  // Confirm caller is still a super admin — otherwise the cookie is inert
  // anyway and we should report not-impersonating.
  const supabase = await createServerClientReal()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ impersonating: false })
  }

  const admin = getAdminClient()
  const { data: target } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name')
    .eq('id', targetId)
    .single()
  if (!target) return NextResponse.json({ impersonating: false })

  return NextResponse.json({
    impersonating: true,
    target: { id: target.id, name: `${target.first_name} ${target.last_name}`.trim() },
  })
}
