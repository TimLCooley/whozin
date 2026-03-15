import { getAdminClient } from '@/lib/supabase/admin'
import { sendPush, pushGroupMembers } from '@/lib/push'

interface CreateAlertParams {
  user_id: string
  type: 'group_invite' | 'member_joined' | 'chat_message' | 'activity_invite' | 'system'
  title: string
  body: string
  link?: string
  meta?: Record<string, unknown>
}

export async function createAlert(params: CreateAlertParams) {
  const admin = getAdminClient()
  await admin.from('whozin_alerts').insert({
    user_id: params.user_id,
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link || null,
    meta: params.meta || {},
  })

  // Also send push notification (fire and forget)
  sendPush({
    userId: params.user_id,
    title: params.title,
    body: params.body,
    link: params.link,
  }).catch(() => {})
}

// Create alerts for all group members except the actor
export async function alertGroupMembers(
  groupId: string,
  excludeUserId: string,
  alert: Omit<CreateAlertParams, 'user_id'>
) {
  const admin = getAdminClient()
  const { data: members } = await admin
    .from('whozin_group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .neq('user_id', excludeUserId)

  if (!members?.length) return

  const rows = members.map((m) => ({
    user_id: m.user_id,
    type: alert.type,
    title: alert.title,
    body: alert.body,
    link: alert.link || null,
    meta: alert.meta || {},
  }))

  await admin.from('whozin_alerts').insert(rows)

  // Also send push notifications (fire and forget)
  pushGroupMembers(groupId, excludeUserId, {
    title: alert.title,
    body: alert.body,
    link: alert.link,
  }).catch(() => {})
}
