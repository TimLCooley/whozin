import { getAdminClient } from '@/lib/supabase/admin'
import { sendSms, sendFillInvite, isTestNumber } from '@/lib/sms'
import { createAlert } from '@/lib/alerts'
import { renderTemplate } from '@/lib/notification-templates'
import { hasReachablePush } from '@/lib/push'

const ADMIN_PHONE = '+16193019180'

/**
 * Send emergency fill blast to all missed/tbd members.
 * Priority order is OFF — first to reply IN wins.
 */
export async function sendEmergencyFill(activityId: string) {
  const admin = getAdminClient()

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('*')
    .eq('id', activityId)
    .single()

  if (!activity) return { success: false, reason: 'not_found' }

  // Get confirmed count
  const { count: confirmedCount } = await admin
    .from('whozin_activity_member')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', activityId)
    .eq('status', 'confirmed')

  const spotsOpen = activity.max_capacity
    ? activity.max_capacity - (confirmedCount ?? 0)
    : 1

  if (spotsOpen <= 0) return { success: false, reason: 'already_full' }

  // Get all members who can be contacted (missed, tbd — NOT out)
  const { data: eligibleMembers } = await admin
    .from('whozin_activity_member')
    .select('id, user_id')
    .eq('activity_id', activityId)
    .in('status', ['missed', 'tbd'])

  if (!eligibleMembers || eligibleMembers.length === 0) {
    return { success: false, reason: 'no_eligible_members' }
  }

  const userIds = eligibleMembers.map((m) => m.user_id)

  // Set all eligible to 'waiting' (emergency round)
  await admin
    .from('whozin_activity_member')
    .update({ status: 'waiting' })
    .eq('activity_id', activityId)
    .in('user_id', userIds)

  // Get user contact info
  const { data: users } = await admin
    .from('whozin_users')
    .select('id, phone, country_code')
    .in('id', userIds)

  // Format date/time for SMS
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

  // Get creator name for soft branding
  const { data: creator } = await admin
    .from('whozin_users')
    .select('first_name')
    .eq('id', activity.creator_id)
    .single()

  const creatorName = creator?.first_name || 'Someone'
  const spotsText = spotsOpen === 1 ? '1 spot just opened' : `${spotsOpen} spots just opened`

  // Send emergency SMS to everyone (skip SMS for users reachable via push)
  for (const user of (users ?? [])) {
    const phone = user.phone.startsWith('+') ? user.phone : `+${user.country_code}${user.phone}`

    let smsSid: string | null = null
    if (!(await hasReachablePush(user.id))) {
      const result = await sendFillInvite(
        phone,
        creatorName,
        activity.activity_name,
        dateTimeStr || 'TBD',
        spotsOpen,
        activity.image_url || undefined,
        activity.tournament_mode ? activity.tournament_format : null,
      )
      if (result.success) smsSid = result.sid ?? null
    }

    // Create invite record for tracking
    await admin.from('whozin_invite').insert({
      activity_id: activityId,
      user_id: user.id,
      batch_number: 999, // emergency batch
      status: 'pending',
      sms_sid: smsSid,
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour for emergency
    })

    // In-app alert
    const isTournament = !!activity.tournament_mode && !!activity.tournament_format
    const pushEventId = isTournament ? 'tournament_fill_invite' : 'fill_invite'
    const pushVars: Record<string, string> = {
      activity_name: activity.activity_name,
      spots_text: spotsText,
      inviter_name: creatorName,
      date_time: dateTimeStr || 'TBD',
    }
    if (isTournament) {
      const { formatLabel } = await import('@/lib/tournament')
      pushVars.tournament_format = formatLabel(activity.tournament_format)
    }
    const { title: pushTitle, body: pushBody } = await renderTemplate(pushEventId, 'push', pushVars)
    await createAlert({
      user_id: user.id,
      type: 'activity_invite',
      title: pushTitle ?? `${activity.activity_name}: ${spotsText}!`,
      body: pushBody,
      link: `/app/activities/${activityId}`,
    })
  }

  // Update activity status back to open
  await admin
    .from('whozin_activity')
    .update({ status: 'open' })
    .eq('id', activityId)

  return { success: true, notified: users?.length ?? 0 }
}

/**
 * Notify the host that someone dropped out.
 * Sends in-app alert + SMS so they can reply FILL.
 */
export async function notifyHostOfDropout(
  activityId: string,
  dropoutName: string
) {
  const admin = getAdminClient()

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('activity_name, creator_id')
    .eq('id', activityId)
    .single()

  if (!activity) return

  // Get host contact info
  const { data: host } = await admin
    .from('whozin_users')
    .select('id, phone, country_code')
    .eq('id', activity.creator_id)
    .single()

  if (!host) return

  // In-app alert with link
  const { title: pushTitle, body: pushBody } = await renderTemplate('dropout_notification', 'push', {
    dropout_name: dropoutName,
    activity_name: activity.activity_name,
  })
  await createAlert({
    user_id: host.id,
    type: 'activity_invite',
    title: pushTitle ?? `${dropoutName} dropped out of ${activity.activity_name}!`,
    body: pushBody,
    link: `/app/activities/${activityId}?emergency=true`,
  })

  // SMS to host — but only if push won't reach them.
  // (FILL-by-text reply still works for SMS-only hosts; app users can tap the push.)
  if (!(await hasReachablePush(host.id))) {
    const phone = host.phone.startsWith('+') ? host.phone : `+${host.country_code}${host.phone}`
    const actualTo = isTestNumber(phone) ? ADMIN_PHONE : phone
    const testNote = isTestNumber(phone) ? ` [TEST: originally to ${phone}]` : ''

    const { body: smsBody } = await renderTemplate('dropout_notification', 'sms', {
      dropout_name: dropoutName,
      activity_name: activity.activity_name,
    })
    await sendSms(actualTo, smsBody + testNote)
  }
}
