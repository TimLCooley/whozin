import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// PUT — host reorders TBD members during the countdown
// Body: { order: [{ activity_member_id, priority_order }] }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('creator_id, invite_starts_at')
    .eq('id', id)
    .single()

  if (!activity || activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  if (!activity.invite_starts_at || new Date(activity.invite_starts_at) <= new Date()) {
    return NextResponse.json({ error: 'Reordering is only allowed during the countdown' }, { status: 400 })
  }

  const body = await req.json()
  const order: { activity_member_id: string; priority_order: number }[] = Array.isArray(body?.order) ? body.order : []
  if (order.length === 0) return NextResponse.json({ error: 'No order provided' }, { status: 400 })

  for (const item of order) {
    await admin
      .from('whozin_activity_member')
      .update({ priority_order: item.priority_order })
      .eq('id', item.activity_member_id)
      .eq('activity_id', id)
      .eq('status', 'tbd')
  }

  return NextResponse.json({ success: true })
}
