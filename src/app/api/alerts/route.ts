import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET alerts for current user
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()

  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Check if just counting unread
  const countOnly = req.nextUrl.searchParams.get('count')
  if (countOnly === 'unread') {
    const { count } = await admin
      .from('whozin_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', whozinUser.id)
      .eq('read', false)

    return NextResponse.json({ unread: count ?? 0 })
  }

  const { data: alerts } = await admin
    .from('whozin_alerts')
    .select('*')
    .eq('user_id', whozinUser.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json(alerts ?? [])
}

// PUT mark alerts as read
export async function PUT(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()

  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()

  if (body.mark_all_read) {
    await admin
      .from('whozin_alerts')
      .update({ read: true })
      .eq('user_id', whozinUser.id)
      .eq('read', false)
  } else if (body.alert_id) {
    await admin
      .from('whozin_alerts')
      .update({ read: true })
      .eq('id', body.alert_id)
      .eq('user_id', whozinUser.id)
  }

  return NextResponse.json({ success: true })
}
