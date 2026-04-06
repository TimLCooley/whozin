import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/sms'

export async function POST(req: NextRequest) {
  const { userIds } = await req.json()
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: 'Missing userIds array' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Fetch users who are "invited" only (no auth account)
  const { data: users, error } = await admin
    .from('whozin_users')
    .select('id, phone, first_name')
    .in('id', userIds)
    .is('auth_user_id', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ error: 'No invited-only users found in selection' }, { status: 400 })
  }

  const results: { phone: string; success: boolean }[] = []

  for (const user of users) {
    const name = user.first_name || 'Someone'
    const message =
      `Hey${user.first_name ? ` ${user.first_name}` : ''}! You've been added to a group on Whozin.\n\n` +
      `How it works: When there's an activity, you'll get a text. Just reply IN or OUT — that's it. No app needed.\n\n` +
      `Want to see your groups and manage activities? Download the app: https://whozin.io/dl`

    const result = await sendSms(user.phone, message)
    results.push({ phone: user.phone, success: result.success })
  }

  const sent = results.filter((r) => r.success).length
  return NextResponse.json({ sent, total: results.length, results })
}
