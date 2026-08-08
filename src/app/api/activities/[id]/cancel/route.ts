import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createAlert } from '@/lib/alerts'
import { sendSms } from '@/lib/sms'
import { hasReachablePush } from '@/lib/push'

// POST — host cancels the activity. Marks it 'cancelled' and notifies everyone
// who was In, invited, or on the wait list via BOTH push and text (cancellations
// are high-stakes — people are planning around this, so we don't rely on push
// alone). Distinct from DELETE, which hard-removes an activity with no one in it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const endSeries = body?.end_series === true
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
    .select('id, creator_id, status, activity_name, activity_date, activity_time, repeat_interval')
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

  // Notify each affected person: in-app + push always, and SMS only for those
  // without reachable push (app users get the push, non-app users get a text) —
  // same policy as invite fan-out.
  const recipients = (members ?? [])
    .map((m) => m.whozin_users as unknown as { id: string; phone: string | null; country_code: string | null } | null)
    .filter((u): u is { id: string; phone: string | null; country_code: string | null } => !!u)

  await Promise.allSettled(
    recipients.map(async (u) => {
      await createAlert({
        user_id: u.id,
        type: 'activity_invite',
        title: `Cancelled: ${name}`,
        body: `${hostName} cancelled ${name}${whenStr ? ` (${whenStr})` : ''}.`,
        link: `/app/activities/${id}`,
      })
      if (u.phone && !(await hasReachablePush(u.id))) {
        const phone = u.phone.startsWith('+') ? u.phone : `+${u.country_code ?? '1'}${u.phone}`
        await sendSms(phone, smsBody)
      }
    }),
  )

  // Recurring: decide whether the series lives on. Default is to keep it going —
  // cancelling one week shouldn't quietly kill the whole series.
  const isRecurring = !!activity.repeat_interval && activity.repeat_interval !== 'none'
  if (isRecurring) {
    if (endSeries) {
      // Stop the series: clear the repeat and drop any queued next draft.
      await admin.from('whozin_activity').update({ repeat_interval: 'none' }).eq('id', id)
      await admin.from('whozin_activity').delete().eq('parent_activity_id', id).eq('status', 'draft')
    } else {
      // Keep it going: make sure the next occurrence is queued (no-op if one
      // already exists). It surfaces around its own date, per the draft rules.
      const { spawnNextDraft } = await import('@/lib/recurring')
      await spawnNextDraft(id)
    }
  }

  return NextResponse.json({ success: true, notified: recipients.length, series_ended: isRecurring && endSeries })
}
