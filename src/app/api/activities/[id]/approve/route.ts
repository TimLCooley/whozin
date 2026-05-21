import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { fanOutActivityInvites } from '@/lib/activity-fanout'

// Approve a draft activity: flip status to 'open' and run the invite fan-out.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .select('id, creator_id, status')
    .eq('id', id)
    .single()

  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  if (activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Only the host can approve' }, { status: 403 })
  }
  if (activity.status !== 'draft') {
    return NextResponse.json({ error: 'Activity is not a draft' }, { status: 400 })
  }

  await admin
    .from('whozin_activity')
    .update({ status: 'open' })
    .eq('id', id)

  await fanOutActivityInvites(id)

  return NextResponse.json({ success: true })
}
