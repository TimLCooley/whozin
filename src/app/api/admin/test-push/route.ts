import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth'
import jwt from 'jsonwebtoken'
import http2 from 'http2'

export async function POST() {
  // Auth check temporarily disabled for debugging
  // const supabase = await createServerClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user || !isSuperAdmin(user.email)) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  const admin = getAdminClient()
  const { data: users } = await admin
    .from('whozin_users')
    .select('id, first_name, push_token, push_platform')
    .not('push_token', 'is', null)

  if (!users?.length) {
    return NextResponse.json({ error: 'No users with push tokens' })
  }

  const results: Record<string, unknown>[] = []

  for (const u of users) {
    if (u.push_platform === 'ios') {
      // Test APNs directly
      const teamId = process.env.APPLE_TEAM_ID?.replace(/\\n/g, '').trim()
      const keyId = (process.env.APPLE_PUSH_KEY_ID || process.env.APPLE_KEY_ID)?.replace(/\\n/g, '').trim()
      const privateKey = (process.env.APPLE_PUSH_PRIVATE_KEY || process.env.APPLE_PRIVATE_KEY)?.trim()

      if (!teamId || !keyId || !privateKey) {
        results.push({ user: u.first_name, platform: 'ios', error: 'Missing APNs credentials', teamId: !!teamId, keyId: !!keyId, privateKey: !!privateKey })
        continue
      }

      try {
        const now = Math.floor(Date.now() / 1000)
        const token = jwt.sign(
          { iss: teamId, iat: now },
          privateKey.replace(/\\n/g, '\n'),
          { algorithm: 'ES256', keyid: keyId }
        )

        const payload = JSON.stringify({
          aps: {
            alert: { title: 'Test Push', body: 'Push notifications are working!' },
            sound: 'default',
          },
        })

        const apnsResult = await new Promise<{ status: number; body: string }>((resolve, reject) => {
          const client = http2.connect('https://api.push.apple.com')
          client.on('error', (err) => { client.close(); reject(err) })

          const req = client.request({
            ':method': 'POST',
            ':path': `/3/device/${u.push_token}`,
            'authorization': `bearer ${token}`,
            'apns-topic': 'io.whozin.app',
            'apns-push-type': 'alert',
            'apns-priority': '10',
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
          })

          let data = ''
          let status = 0
          req.on('response', (h) => { status = h[':status'] as number })
          req.on('data', (chunk: Buffer) => { data += chunk.toString() })
          req.on('end', () => { client.close(); resolve({ status, body: data }) })
          req.on('error', (err) => { client.close(); reject(err) })
          req.write(payload)
          req.end()
        })

        results.push({
          user: u.first_name,
          platform: 'ios',
          token: u.push_token.slice(0, 20) + '...',
          apns_status: apnsResult.status,
          apns_response: apnsResult.body || 'OK',
        })
      } catch (err) {
        results.push({
          user: u.first_name,
          platform: 'ios',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    } else {
      // Test FCM
      try {
        const { getFirebaseAdmin } = await import('@/lib/firebase')
        const firebase = getFirebaseAdmin()
        await firebase.messaging().send({
          token: u.push_token,
          notification: { title: 'Test Push', body: 'Push notifications are working!' },
        })
        results.push({ user: u.first_name, platform: 'android', status: 'sent' })
      } catch (err) {
        results.push({
          user: u.first_name,
          platform: 'android',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return NextResponse.json({ results })
}
