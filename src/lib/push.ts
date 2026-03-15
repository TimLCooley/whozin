import { getFirebaseAdmin } from '@/lib/firebase'
import { getAdminClient } from '@/lib/supabase/admin'

interface SendPushParams {
  userId: string
  title: string
  body: string
  link?: string
  data?: Record<string, string>
}

/** Send a push notification to a single user */
export async function sendPush({ userId, title, body, link, data }: SendPushParams) {
  const admin = getAdminClient()
  const { data: user } = await admin
    .from('whozin_users')
    .select('push_token, push_notifications_enabled')
    .eq('id', userId)
    .single()

  if (!user?.push_token || !user.push_notifications_enabled) return false

  try {
    const firebase = getFirebaseAdmin()
    await firebase.messaging().send({
      token: user.push_token,
      notification: { title, body },
      data: {
        ...data,
        ...(link ? { link } : {}),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
    })
    return true
  } catch (err: unknown) {
    const error = err as { code?: string }
    // Token is invalid/expired — clear it
    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      await admin
        .from('whozin_users')
        .update({ push_token: null })
        .eq('id', userId)
    }
    console.error('Push notification failed:', error)
    return false
  }
}

/** Send push notifications to multiple users */
export async function sendPushToUsers(
  userIds: string[],
  notification: Omit<SendPushParams, 'userId'>
) {
  const results = await Promise.allSettled(
    userIds.map((userId) => sendPush({ userId, ...notification }))
  )
  return results.filter((r) => r.status === 'fulfilled' && r.value).length
}

/** Send push to all group members except one user */
export async function pushGroupMembers(
  groupId: string,
  excludeUserId: string,
  notification: Omit<SendPushParams, 'userId'>
) {
  const admin = getAdminClient()
  const { data: members } = await admin
    .from('whozin_group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .neq('user_id', excludeUserId)

  if (!members?.length) return 0
  return sendPushToUsers(members.map((m) => m.user_id), notification)
}
