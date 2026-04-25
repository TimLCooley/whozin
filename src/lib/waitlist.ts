import { getAdminClient } from '@/lib/supabase/admin'
import { sendSms, isTestNumber } from '@/lib/sms'
import { createAlert } from '@/lib/alerts'

const ADMIN_PHONE = '+16193019180'

/**
 * Add a user to the wait list for an activity.
 * Caller is responsible for verifying activity is full and waitlist is enabled.
 * Sends in-app alert + SMS.
 */
export async function addToWaitlist(activityId: string, userId: string) {
  const admin = getAdminClient()

  await admin
    .from('whozin_activity_member')
    .update({ status: 'waitlist', responded_at: new Date().toISOString() })
    .eq('activity_id', activityId)
    .eq('user_id', userId)

  const [{ data: activity }, { data: user }, { count: position }] = await Promise.all([
    admin.from('whozin_activity').select('activity_name').eq('id', activityId).single(),
    admin
      .from('whozin_users')
      .select('phone, country_code, text_notifications_enabled')
      .eq('id', userId)
      .single(),
    admin
      .from('whozin_activity_member')
      .select('id', { count: 'exact', head: true })
      .eq('activity_id', activityId)
      .eq('status', 'waitlist'),
  ])

  const activityName = activity?.activity_name || 'the activity'
  const pos = position ?? 1

  createAlert({
    user_id: userId,
    type: 'activity_invite',
    title: `You're on the wait list`,
    body: `Spot #${pos} for ${activityName}. We'll notify you if a spot opens up.`,
    link: `/app/activities/${activityId}`,
  }).catch(() => {})

  if (user?.phone && user.text_notifications_enabled !== false) {
    const phone = user.phone.startsWith('+') ? user.phone : `+${user.country_code}${user.phone}`
    const actualTo = isTestNumber(phone) ? ADMIN_PHONE : phone
    const testNote = isTestNumber(phone) ? ` [TEST: originally to ${phone}]` : ''

    sendSms(
      actualTo,
      `You're on the wait list for ${activityName} (spot #${pos}). We'll text you if a spot opens up.${testNote}`
    ).catch(() => {})
  }

  return { position: pos }
}

/**
 * Promote the earliest wait list member (by responded_at) to confirmed.
 * Returns true if someone was promoted.
 */
export async function promoteFromWaitlist(activityId: string): Promise<boolean> {
  const admin = getAdminClient()

  const { data: nextUp } = await admin
    .from('whozin_activity_member')
    .select('id, user_id')
    .eq('activity_id', activityId)
    .eq('status', 'waitlist')
    .order('responded_at', { ascending: true })
    .limit(1)
    .single()

  if (!nextUp) return false

  await admin
    .from('whozin_activity_member')
    .update({ status: 'confirmed', responded_at: new Date().toISOString() })
    .eq('id', nextUp.id)

  // Refresh capacity_current and activity status
  const { count: confirmedCount } = await admin
    .from('whozin_activity_member')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', activityId)
    .eq('status', 'confirmed')

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('activity_name, max_capacity')
    .eq('id', activityId)
    .single()

  const confirmed = confirmedCount ?? 0
  const isFull = activity?.max_capacity ? confirmed >= activity.max_capacity : false

  await admin
    .from('whozin_activity')
    .update({ capacity_current: confirmed, status: isFull ? 'full' : 'open' })
    .eq('id', activityId)

  // Notify the promoted user
  const { data: user } = await admin
    .from('whozin_users')
    .select('phone, country_code, text_notifications_enabled')
    .eq('id', nextUp.user_id)
    .single()

  const activityName = activity?.activity_name || 'the activity'

  createAlert({
    user_id: nextUp.user_id,
    type: 'activity_invite',
    title: `A spot opened up!`,
    body: `You're now confirmed for ${activityName}. Open the app to change your status.`,
    link: `/app/activities/${activityId}`,
  }).catch(() => {})

  if (user?.phone && user.text_notifications_enabled !== false) {
    const phone = user.phone.startsWith('+') ? user.phone : `+${user.country_code}${user.phone}`
    const actualTo = isTestNumber(phone) ? ADMIN_PHONE : phone
    const testNote = isTestNumber(phone) ? ` [TEST: originally to ${phone}]` : ''

    sendSms(
      actualTo,
      `A spot opened up — you're now in for ${activityName}! Open the app to change to OUT if you can't make it: https://whozin.io/dl${testNote}`
    ).catch(() => {})
  }

  return true
}
