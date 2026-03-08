import { getAdminClient } from '@/lib/supabase/admin'
import { sendActivityInvite } from '@/lib/sms'
import { createAlert } from '@/lib/alerts'

/**
 * Process priority invites for a single activity.
 * Called by cron and after activity creation.
 *
 * Flow:
 * 1. Check for expired 'waiting' members → move to 'missed'
 * 2. Count remaining spots (max_capacity - confirmed)
 * 3. If spots remain, invite next batch of 'tbd' members (batch size = remaining spots)
 * 4. Set them to 'waiting', send SMS, create invite records
 * 5. If activity is full or everyone contacted, update status
 */
export async function processActivityInvites(activityId: string) {
  const admin = getAdminClient()

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('*')
    .eq('id', activityId)
    .single()

  if (!activity) return { processed: false, reason: 'not_found' }
  if (activity.status !== 'open') return { processed: false, reason: 'not_open' }
  if (!activity.priority_invite) return { processed: false, reason: 'not_priority' }

  const maxCapacity = activity.max_capacity
  if (!maxCapacity) return { processed: false, reason: 'no_capacity_limit' }

  const timerMs = (activity.response_timer_minutes ?? 5) * 60 * 1000
  console.log('[invite-processor] timer:', activity.response_timer_minutes, 'min =', timerMs, 'ms')

  // Step 1: Expire waiting members whose timer has run out
  const { data: waitingMembers } = await admin
    .from('whozin_activity_member')
    .select('id, user_id')
    .eq('activity_id', activityId)
    .eq('status', 'waiting')

  // Check their invite expiry
  for (const wm of (waitingMembers ?? [])) {
    const { data: invite } = await admin
      .from('whozin_invite')
      .select('expires_at')
      .eq('activity_id', activityId)
      .eq('user_id', wm.user_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    console.log('[invite-processor] waiting member', wm.user_id, 'expires_at:', invite?.expires_at, 'now:', new Date().toISOString(), 'expired:', invite ? new Date(invite.expires_at) <= new Date() : 'no invite')
    if (invite && new Date(invite.expires_at) <= new Date()) {
      console.log('[invite-processor] EXPIRING member', wm.user_id)
      await admin
        .from('whozin_activity_member')
        .update({ status: 'missed' })
        .eq('id', wm.id)

      await admin
        .from('whozin_invite')
        .update({ status: 'expired' })
        .eq('activity_id', activityId)
        .eq('user_id', wm.user_id)
        .eq('status', 'pending')
    }
  }

  // Step 2: Count confirmed members
  const { count: confirmedCount } = await admin
    .from('whozin_activity_member')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', activityId)
    .eq('status', 'confirmed')

  const confirmed = confirmedCount ?? 0
  const remainingSpots = maxCapacity - confirmed

  // Check if full
  if (remainingSpots <= 0) {
    await admin
      .from('whozin_activity')
      .update({ status: 'full', capacity_current: confirmed })
      .eq('id', activityId)
    return { processed: true, reason: 'full' }
  }

  // Step 3: Check if there are still people waiting (active timers)
  const { count: stillWaiting } = await admin
    .from('whozin_activity_member')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', activityId)
    .eq('status', 'waiting')

  // If people are still actively waiting, don't send the next batch yet
  console.log('[invite-processor] confirmed:', confirmed, 'remaining spots:', remainingSpots, 'still waiting:', stillWaiting)
  if ((stillWaiting ?? 0) > 0) {
    await admin
      .from('whozin_activity')
      .update({ capacity_current: confirmed })
      .eq('id', activityId)
    return { processed: true, reason: 'waiting_in_progress' }
  }

  // Step 4: Get next batch of TBD members
  const { data: nextBatch } = await admin
    .from('whozin_activity_member')
    .select('id, user_id')
    .eq('activity_id', activityId)
    .eq('status', 'tbd')
    .order('priority_order', { ascending: true })
    .limit(remainingSpots)

  if (!nextBatch || nextBatch.length === 0) {
    // No more people to invite — update capacity
    await admin
      .from('whozin_activity')
      .update({ capacity_current: confirmed })
      .eq('id', activityId)
    return { processed: true, reason: 'no_more_tbd' }
  }

  // Step 5: Move them to 'waiting' and send SMS
  const batchUserIds = nextBatch.map((m) => m.user_id)

  // Update current_invite_batch
  const newBatch = (activity.current_invite_batch ?? 0) + 1
  await admin
    .from('whozin_activity')
    .update({ current_invite_batch: newBatch, invite_processing: true, capacity_current: confirmed })
    .eq('id', activityId)

  // Set members to waiting
  for (const member of nextBatch) {
    await admin
      .from('whozin_activity_member')
      .update({ status: 'waiting' })
      .eq('id', member.id)
  }

  // Get user details for SMS
  const { data: users } = await admin
    .from('whozin_users')
    .select('id, phone, country_code')
    .in('id', batchUserIds)

  // Get creator name
  const { data: creator } = await admin
    .from('whozin_users')
    .select('first_name')
    .eq('id', activity.creator_id)
    .single()

  // Format date/time
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

  const expiresAt = new Date(Date.now() + timerMs).toISOString()

  // Send SMS and create invite records
  for (const user of (users ?? [])) {
    const phone = user.phone.startsWith('+') ? user.phone : `+${user.country_code}${user.phone}`

    const result = await sendActivityInvite(
      phone,
      creator?.first_name ?? 'Someone',
      activity.activity_name,
      dateTimeStr || 'TBD'
    )

    await admin.from('whozin_invite').insert({
      activity_id: activityId,
      user_id: user.id,
      batch_number: newBatch,
      status: 'pending',
      sms_sid: result.success ? result.sid : null,
      sent_at: new Date().toISOString(),
      expires_at: expiresAt,
    })

    // In-app alert too
    await createAlert({
      user_id: user.id,
      type: 'activity_invite',
      title: `You're invited: ${activity.activity_name}`,
      body: `${creator?.first_name ?? 'Someone'} invited you. Reply IN or OUT!`,
      link: `/app/activities/${activityId}`,
    })
  }

  await admin
    .from('whozin_activity')
    .update({ invite_processing: false })
    .eq('id', activityId)

  return { processed: true, reason: 'batch_sent', batch: newBatch, count: nextBatch.length }
}

/**
 * Process all open activities with priority invites.
 * Called by the cron job.
 */
export async function processAllPendingInvites() {
  const admin = getAdminClient()

  const { data: activities } = await admin
    .from('whozin_activity')
    .select('id')
    .eq('status', 'open')
    .eq('priority_invite', true)

  const results = []
  for (const a of (activities ?? [])) {
    const result = await processActivityInvites(a.id)
    results.push({ activity_id: a.id, ...result })
  }

  return results
}
