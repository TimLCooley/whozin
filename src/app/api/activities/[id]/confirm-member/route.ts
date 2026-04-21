import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { processActivityInvites } from '@/lib/invite-processor'
import { createAlert } from '@/lib/alerts'
import { sendSms } from '@/lib/sms'

// POST — host marks an On Deck member as confirmed
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
    .select('creator_id, max_capacity, priority_invite, activity_name, chat_enabled')
    .eq('id', id)
    .single()

  if (!activity || activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { user_id: targetUserId } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })

  // Allow confirming any non-confirmed member (host override)
  const { data: member } = await admin
    .from('whozin_activity_member')
    .select('id, status')
    .eq('activity_id', id)
    .eq('user_id', targetUserId)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.status === 'confirmed') return NextResponse.json({ error: 'Already confirmed' }, { status: 400 })

  await admin
    .from('whozin_activity_member')
    .update({ status: 'confirmed', responded_at: new Date().toISOString() })
    .eq('id', member.id)

  // Update capacity count and check if full
  const { count } = await admin
    .from('whozin_activity_member')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', id)
    .eq('status', 'confirmed')

  const confirmed = count ?? 0
  const isFull = activity.max_capacity ? confirmed >= activity.max_capacity : false

  await admin
    .from('whozin_activity')
    .update({
      capacity_current: confirmed,
      ...(isFull ? { status: 'full' } : {}),
    })
    .eq('id', id)

  // Notify the confirmed member (fire and forget)
  const [{ data: targetUser }, { data: host }] = await Promise.all([
    admin
      .from('whozin_users')
      .select('push_token, phone, text_notifications_enabled')
      .eq('id', targetUserId)
      .single(),
    admin
      .from('whozin_users')
      .select('first_name')
      .eq('id', whozinUser.id)
      .single(),
  ])

  const hostName = host?.first_name || 'The host'
  const activityName = activity.activity_name || 'the activity'

  // In-app alert + push notification
  createAlert({
    user_id: targetUserId,
    type: 'activity_invite',
    title: "You're in!",
    body: `${hostName} confirmed you for ${activityName}.`,
    link: `/app/activities/${id}`,
  }).catch(() => {})

  // SMS to all confirmed members (in addition to push) unless they've opted out
  if (targetUser?.phone && targetUser.text_notifications_enabled !== false) {
    const chatLine = activity.chat_enabled
      ? ` Open or download the app to chat: https://whozin.io/dl`
      : ` See details in the app: https://whozin.io/dl`
    sendSms(
      targetUser.phone,
      `You're in for ${activityName}!${chatLine}`
    ).catch(() => {})
  }

  // If not full and priority invites are active, process the queue
  // (confirming a waiting member frees a slot for the next tbd member)
  if (!isFull && activity.priority_invite) {
    await processActivityInvites(id)
  }

  return NextResponse.json({ success: true })
}
