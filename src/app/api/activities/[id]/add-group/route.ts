import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendFillInvite } from '@/lib/sms'
import { hasReachablePush } from '@/lib/push'

// POST — bulk-invite every member of one of the caller's owned groups to the
// activity. Sends an immediate Fill-style SMS to everyone, attributed to the
// activity host. Caller must be the host OR a confirmed attendee of an
// open-invite activity, AND must own the source group.
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

  const { group_id } = await req.json()
  if (!group_id) return NextResponse.json({ error: 'group_id is required' }, { status: 400 })

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('creator_id, status, open_invite, activity_name, activity_date, activity_time, image_url, max_capacity, response_timer_minutes')
    .eq('id', id)
    .single()

  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })

  const isCreator = activity.creator_id === whozinUser.id
  let isConfirmedAttendee = false
  if (!isCreator && activity.open_invite) {
    const { data: myMember } = await admin
      .from('whozin_activity_member')
      .select('status')
      .eq('activity_id', id)
      .eq('user_id', whozinUser.id)
      .single()
    isConfirmedAttendee = myMember?.status === 'confirmed'
  }
  if (!isCreator && !isConfirmedAttendee) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // The source group must be owned by the caller.
  const { data: group } = await admin
    .from('whozin_groups')
    .select('creator_id')
    .eq('id', group_id)
    .single()

  if (!group || group.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized for this group' }, { status: 403 })
  }

  const { data: groupMembers } = await admin
    .from('whozin_group_members')
    .select('user_id')
    .eq('group_id', group_id)

  const candidateIds = (groupMembers ?? [])
    .map((m) => m.user_id)
    .filter((uid) => uid !== whozinUser.id && uid !== activity.creator_id)

  if (candidateIds.length === 0) {
    return NextResponse.json({ added: 0, skipped: 0 })
  }

  const { data: existingMembers } = await admin
    .from('whozin_activity_member')
    .select('user_id')
    .eq('activity_id', id)
    .in('user_id', candidateIds)

  const existingIds = new Set((existingMembers ?? []).map((m) => m.user_id))
  const newIds = candidateIds.filter((uid) => !existingIds.has(uid))

  if (newIds.length === 0) {
    return NextResponse.json({ added: 0, skipped: candidateIds.length })
  }

  const { data: lastMember } = await admin
    .from('whozin_activity_member')
    .select('priority_order')
    .eq('activity_id', id)
    .order('priority_order', { ascending: false })
    .limit(1)
    .single()

  const baseOrder = lastMember?.priority_order ?? 0

  // Status 'waiting' = invite has been sent, response pending — same shape the
  // POST /api/activities all-at-once path uses.
  const inserts = newIds.map((uid, i) => ({
    activity_id: id,
    user_id: uid,
    status: 'waiting' as const,
    priority_order: baseOrder + i + 1,
  }))

  await admin.from('whozin_activity_member').insert(inserts)

  // Friends pool (mirror the single-member add)
  await Promise.all([
    admin.from('whozin_friends').upsert(
      newIds.map((uid) => ({ user_id: whozinUser.id, friend_id: uid })),
      { onConflict: 'user_id,friend_id' }
    ),
    admin.from('whozin_friends').upsert(
      newIds.map((uid) => ({ user_id: uid, friend_id: whozinUser.id })),
      { onConflict: 'user_id,friend_id' }
    ),
  ])

  // Look up host (creator) for SMS attribution
  const { data: host } = await admin
    .from('whozin_users')
    .select('first_name')
    .eq('id', activity.creator_id)
    .single()

  const hostName = host?.first_name ?? 'Host'

  // Look up the new invitees' phones
  const { data: invitees } = await admin
    .from('whozin_users')
    .select('id, phone, country_code')
    .in('id', newIds)

  // Format date/time string for the SMS
  let dateTimeStr = ''
  if (activity.activity_date) {
    const d = new Date(activity.activity_date + 'T00:00:00')
    dateTimeStr = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
    if (activity.activity_time) {
      const [h, m] = activity.activity_time.split(':')
      const hour = parseInt(h)
      const ampm = hour >= 12 ? 'pm' : 'am'
      const h12 = hour % 12 || 12
      dateTimeStr += ` at ${h12}:${m} ${ampm}`
    }
  }

  // How many spots are still open right now (the SMS reads "needs N more")
  const { count: confirmedCount } = await admin
    .from('whozin_activity_member')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', id)
    .eq('status', 'confirmed')

  const spotsNeeded = activity.max_capacity
    ? Math.max(activity.max_capacity - (confirmedCount ?? 0), 1)
    : (newIds.length || 1)

  const responseTimerMs = (activity.response_timer_minutes ?? 5) * 60 * 1000
  const expiresAt = new Date(Date.now() + responseTimerMs).toISOString()

  for (const invitee of (invitees ?? [])) {
    const phone = invitee.phone.startsWith('+') ? invitee.phone : `+${invitee.country_code}${invitee.phone}`
    let smsSid: string | null = null
    if (!(await hasReachablePush(invitee.id))) {
      const result = await sendFillInvite(
        phone,
        hostName,
        activity.activity_name,
        dateTimeStr || 'TBD',
        spotsNeeded,
        activity.image_url || undefined,
      )
      if (result.success) smsSid = result.sid ?? null
    }
    await admin.from('whozin_invite').insert({
      activity_id: id,
      user_id: invitee.id,
      batch_number: 1,
      status: 'pending',
      sms_sid: smsSid,
      sent_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
  }

  return NextResponse.json({
    added: newIds.length,
    skipped: candidateIds.length - newIds.length,
  })
}
