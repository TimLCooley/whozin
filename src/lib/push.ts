import { getFirebaseAdmin } from '@/lib/firebase'
import { getAdminClient } from '@/lib/supabase/admin'
import jwt from 'jsonwebtoken'

interface SendPushParams {
  userId: string
  title: string
  body: string
  link?: string
  data?: Record<string, string>
}

/** Send a push notification to a single user (FCM for Android, APNs for iOS) */
export async function sendPush({ userId, title, body, link, data }: SendPushParams) {
  const admin = getAdminClient()
  const { data: user } = await admin
    .from('whozin_users')
    .select('push_token, push_platform, push_notifications_enabled')
    .eq('id', userId)
    .single()

  if (!user?.push_token || !user.push_notifications_enabled) return false

  try {
    if (user.push_platform === 'ios') {
      return await sendApns(user.push_token, title, body, link, data)
    } else {
      return await sendFcm(user.push_token, title, body, link, data)
    }
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string }
    // Token is invalid/expired — clear it
    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token' ||
        error.message?.includes('BadDeviceToken') ||
        error.message?.includes('Unregistered')) {
      await admin
        .from('whozin_users')
        .update({ push_token: null })
        .eq('id', userId)
    }
    console.error('Push notification failed:', error)
    return false
  }
}

/** Send via Firebase Cloud Messaging (Android) */
async function sendFcm(token: string, title: string, body: string, link?: string, data?: Record<string, string>) {
  const firebase = getFirebaseAdmin()
  await firebase.messaging().send({
    token,
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
}

/** Send via Apple Push Notification service (iOS) using HTTP/2 */
async function postApns(
  host: string,
  deviceToken: string,
  authToken: string,
  payload: string,
): Promise<{ status: number; body: string }> {
  const http2 = await import('http2')
  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${host}`)

    client.on('error', (err) => {
      client.close()
      reject(new Error(`APNs connection error: ${err.message}`))
    })

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${authToken}`,
      'apns-topic': 'io.whozin.app',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    })

    let responseData = ''
    let status = 0

    req.on('response', (headers) => {
      status = headers[':status'] as number
    })

    req.on('data', (chunk: Buffer) => {
      responseData += chunk.toString()
    })

    req.on('end', () => {
      client.close()
      resolve({ status, body: responseData })
    })

    req.on('error', (err) => {
      client.close()
      reject(new Error(`APNs request error: ${err.message}`))
    })

    req.write(payload)
    req.end()
  })
}

async function sendApns(deviceToken: string, title: string, body: string, link?: string, data?: Record<string, string>) {
  const teamId = process.env.APPLE_TEAM_ID?.replace(/\\n/g, '').trim()
  const keyId = (process.env.APPLE_PUSH_KEY_ID || process.env.APPLE_KEY_ID)?.replace(/\\n/g, '').trim()
  const privateKey = (process.env.APPLE_PUSH_PRIVATE_KEY || process.env.APPLE_PRIVATE_KEY)?.trim()

  if (!teamId || !keyId || !privateKey) {
    console.error('APNs credentials not configured')
    return false
  }

  const now = Math.floor(Date.now() / 1000)
  const authToken = jwt.sign(
    { iss: teamId, iat: now },
    privateKey.replace(/\\n/g, '\n'),
    { algorithm: 'ES256', keyid: keyId }
  )

  const customData = {
    ...data,
    ...(link ? { link } : {}),
  }

  const payload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: 'default',
      badge: 1,
    },
    // Root-level for direct access + nested under "data" for Capacitor compatibility
    ...customData,
    ...(Object.keys(customData).length ? { data: customData } : {}),
  })

  // Try production first; if the token is a dev-build token APNs returns
  // BadDeviceToken, in which case retry against sandbox.
  const prod = await postApns('api.push.apple.com', deviceToken, authToken, payload)
  if (prod.status === 200) return true

  if (prod.status === 400 && prod.body.includes('BadDeviceToken')) {
    const sandbox = await postApns('api.sandbox.push.apple.com', deviceToken, authToken, payload)
    if (sandbox.status === 200) return true
    throw new Error(`APNs error ${sandbox.status}: ${sandbox.body}`)
  }

  throw new Error(`APNs error ${prod.status}: ${prod.body}`)
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
