import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth'

const COOKIE = 'whozin_impersonate'

/** Start impersonating. Super admin only. */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const admin = getAdminClient()
  const { data: target } = await admin
    .from('whozin_users')
    .select('id, auth_user_id, first_name, last_name')
    .eq('id', user_id)
    .single()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!target.auth_user_id) {
    return NextResponse.json({ error: 'User has no app account yet (text-only invite).' }, { status: 400 })
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE, target.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  })

  return NextResponse.json({
    success: true,
    target: { id: target.id, name: `${target.first_name} ${target.last_name}`.trim() },
  })
}

/** Stop impersonating. No auth — anyone can clear their own cookie. */
export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE)
  return NextResponse.json({ success: true })
}

/** Banner status. */
export async function GET() {
  const cookieStore = await cookies()
  const targetId = cookieStore.get(COOKIE)?.value
  if (!targetId) return NextResponse.json({ impersonating: false })

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
