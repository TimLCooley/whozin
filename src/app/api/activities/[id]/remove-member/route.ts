import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendEmergencyFill } from '@/lib/emergency-fill'
import { processActivityInvites } from '@/lib/invite-processor'

// POST — host removes a member from the activity
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // Verify they're the creator
  const { data: activity } = await admin
    .from('whozin_activity')
    .select('creator_id, status, max_capacity, priority_invite')
    .eq('id', id)
    .single()

  if (!activity || activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { user_id: targetUserId, notify } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })

  // Allow removing 'tbd' or 'confirmed' members
  const { data: member } = await admin
    .from('whozin_activity_member')
    .select('id, status')
    .eq('activity_id', id)
    .eq('user_id', targetUserId)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.status !== 'tbd' && member.status !== 'confirmed') {
    return NextResponse.json({ error: 'Can only remove confirmed or on-deck members' }, { status: 400 })
  }

  const wasConfirmed = member.status === 'confirmed'
  const wasFull = activity.status === 'full'

  // Remove the member
  await admin
    .from('whozin_activity_member')
    .update({ status: 'out' })
    .eq('id', member.id)

  // If they were confirmed, update capacity and activity status
  if (wasConfirmed) {
    const { count: confirmedCount } = await admin
      .from('whozin_activity_member')
      .select('id', { count: 'exact', head: true })
      .eq('activity_id', id)
      .eq('status', 'confirmed')

    await admin
      .from('whozin_activity')
      .update({
        capacity_current: confirmedCount ?? 0,
        status: 'open',
      })
      .eq('id', id)

    // Send emergency fill if requested and the activity was full
    if (notify && wasFull) {
      await sendEmergencyFill(id)
    } else if (activity.priority_invite) {
      // Otherwise advance the invite queue to fill the opened spot
      await processActivityInvites(id)
    }
  }

  return NextResponse.json({ success: true })
}
