import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createAlert } from '@/lib/alerts'
import { sendSms } from '@/lib/sms'

// POST — host cancels the activity. Marks it 'cancelled' and notifies everyone
// who was In, invited, or on the wait list via BOTH push and text (cancellations
// are high-stakes — people are planning around this, so we don't rely on push
// alone). Distinct from DELETE, which hard-removes an activity with no one in it.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id, first_name')
    .eq('auth_user_id', user.id)
    .single()
  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('id, creator_id, status, activity_name, activity_date, activity_time')
    .eq('id', id)
    .single()
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  if (activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Only the host can cancel' }, { status: 403 })
  }
  if (activity.status === 'cancelled') {
    return NextResponse.json({ error: 'Activity is already cancelled' }, { status: 400 })
  }

  // Everyone who's In, mid-invite, or waiting — the people planning around it.
  // (Not 'tbd' — they were never notified — nor 'out'/'missed' — they opted out.)
  const { data: members } = await admin
    .from('whozin_activity_member')
    .select('user_id, whozin_users(id, first_name, phone, country_code)')
    .eq('activity_id', id)
    .in('status', ['confirmed', 'waiting', 'waitlist'])
    .neq('user_id', whozinUser.id)

  // Flip to cancelled and stop any pending invites from going out.
  await admin.from('whozin_activity').update({ status: 'cancelled' }).eq('id', id)
  await admin
    .from('whozin_invite')
    .update({ status: 'expired' })
    .eq('activity_id', id)
    .eq('status', 'pending')

  // Build the human-readable when-string once.
  let whenStr = ''
  if (activity.activity_date) {
    const d = new Date(activity.activity_date + 'T00:00:00')
    whenStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
    if (activity.activity_time) {
      const [h, m] = activity.activity_time.split(':')
      const hour = parseInt(h)
      const ampm = hour >= 12 ? 'pm' : 'am'
      const h12 = hour % 12 || 12
      whenStr += ` at ${h12}:${m}${ampm}`
    }
  }

  const hostName = whozinUser.first_name || 'The host'
  const name = activity.activity_name || 'the activity'
  const smsBody = `Whozin: ${hostName} cancelled ${name}${whenStr ? ` (${whenStr})` : ''}. See you next time!`

  // Notify each affected person on BOTH channels — push/in-app and SMS.
  const recipients = (members ?? [])
    .map((m) => m.whozin_users as unknown as { id: string; phone: string | null; country_code: string | null } | null)
    .filter((u): u is { id: string; phone: string | null; country_code: string | null } => !!u)

  await Promise.allSettled(
    recipients.flatMap((u) => {
      const tasks: Promise<unknown>[] = [
        createAlert({
          user_id: u.id,
          type: 'activity_invite',
          title: `Cancelled: ${name}`,
          body: `${hostName} cancelled ${name}${whenStr ? ` (${whenStr})` : ''}.`,
          link: `/app/activities/${id}`,
        }),
      ]
      if (u.phone) {
        const phone = u.phone.startsWith('+') ? u.phone : `+${u.country_code ?? '1'}${u.phone}`
        tasks.push(sendSms(phone, smsBody))
      }
      return tasks
    }),
  )

  return NextResponse.json({ success: true, notified: recipients.length })
}
