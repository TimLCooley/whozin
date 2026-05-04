import { getAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/push'
import { sendSms, isTestNumber } from '@/lib/sms'
import { renderTemplate } from '@/lib/notification-templates'

interface CreateAlertParams {
  user_id: string
  type: 'group_invite' | 'member_joined' | 'chat_message' | 'activity_invite' | 'system'
  title: string
  body: string
  link?: string
  meta?: Record<string, unknown>
}

const DOWNLOAD_LINK = 'https://whozin.io/dl'

/**
 * Try push first; if the user has no push token or push is disabled, fall back
 * to SMS for chat messages so recipients without the app still get notified.
 */
async function deliverChatNotification(userId: string, title: string, body: string, link?: string) {
  const sent = await sendPush({ userId, title, body, link }).catch(() => false)
  if (sent) return

  const admin = getAdminClient()
  const { data: user } = await admin
    .from('whozin_users')
    .select('phone, country_code, text_notifications_enabled')
    .eq('id', userId)
    .single()

  if (!user?.phone || user.text_notifications_enabled === false) return

  const phone = user.phone.startsWith('+')
    ? user.phone
    : `+${(user.country_code || '1').replace(/\D/g, '')}${user.phone.replace(/\D/g, '')}`

  const finalTo = isTestNumber(phone) ? '+16193019180' : phone
  const { body: fallbackBody } = await renderTemplate('chat_message', 'sms', {
    download_link: DOWNLOAD_LINK,
  })
  await sendSms(finalTo, fallbackBody).catch(() => {})
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

  if (params.type === 'chat_message') {
    deliverChatNotification(params.user_id, params.title, params.body, params.link).catch(() => {})
  } else {
    sendPush({
      userId: params.user_id,
      title: params.title,
      body: params.body,
      link: params.link,
    }).catch(() => {})
  }
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

  if (alert.type === 'chat_message') {
    Promise.allSettled(
      members.map((m) => deliverChatNotification(m.user_id, alert.title, alert.body, alert.link))
    ).catch(() => {})
  } else {
    Promise.allSettled(
      members.map((m) =>
        sendPush({
          userId: m.user_id,
          title: alert.title,
          body: alert.body,
          link: alert.link,
        })
      )
    ).catch(() => {})
  }
}
