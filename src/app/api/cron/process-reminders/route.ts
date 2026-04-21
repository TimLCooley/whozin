import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/push'
import { sendReminderSms } from '@/lib/sms'

/** Convert activity date + time in a given IANA timezone to a UTC Date */
function parseActivityTime(dateStr: string, timeStr: string, timezone?: string | null): Date {
  // Postgres `time` columns serialize as "HH:MM:SS"; inputs may also be "HH:MM".
  // Normalize to "HH:MM:SS" before composing an ISO string.
  const hm = timeStr.slice(0, 5)
  const normalizedTime = `${hm}:00`

  if (!timezone) {
    // No timezone stored — treat as UTC (legacy activities)
    return new Date(`${dateStr}T${normalizedTime}Z`)
  }

  // Interpret the date/time as UTC, then figure out the timezone offset
  const asUtc = new Date(`${dateStr}T${normalizedTime}Z`)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(asUtc)

  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? '00'
  const localAtUtc = new Date(`${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}:${p('second')}Z`)
  const offsetMs = localAtUtc.getTime() - asUtc.getTime()

  // Actual UTC = naive UTC - offset
  return new Date(asUtc.getTime() - offsetMs)
}

// Reminder windows: how far before the event to send each reminder
const REMINDER_WINDOWS = [
  { minutes: 24 * 60, label: '24 hours' },
  { minutes: 60, label: '1 hour' },
  { minutes: 10, label: '10 minutes' },
]

// Called by Vercel Cron every 5 minutes to send activity reminders
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  const now = new Date()
  let sent = 0

  // Get all activities with reminders enabled that have a date and time
  const { data: activities } = await admin
    .from('whozin_activity')
    .select('id, activity_name, activity_date, activity_time, group_id, timezone')
    .eq('reminder_enabled', true)
    .in('status', ['open', 'full'])
    .not('activity_date', 'is', null)
    .not('activity_time', 'is', null)

  if (!activities?.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  for (const activity of activities) {
    // Parse activity datetime in the creator's timezone (falls back to UTC)
    const activityDateTime = parseActivityTime(
      activity.activity_date,
      activity.activity_time,
      activity.timezone
    )
    if (isNaN(activityDateTime.getTime())) continue

    const minutesUntil = (activityDateTime.getTime() - now.getTime()) / (1000 * 60)

    // Skip past activities
    if (minutesUntil < 0) continue

    for (const window of REMINDER_WINDOWS) {
      // Check if we're within the reminder window (within 5 minutes of the target)
      // e.g., for 60-minute reminder: send when minutesUntil is between 55 and 60
      const targetMinutes = window.minutes
      if (minutesUntil <= targetMinutes && minutesUntil > targetMinutes - 5) {
        // Check if we already sent this reminder
        const reminderKey = `reminder_${activity.id}_${window.minutes}`
        const { data: existing } = await admin
          .from('whozin_alerts')
          .select('id')
          .eq('meta->>reminder_key', reminderKey)
          .limit(1)
          .maybeSingle()

        if (existing) continue // Already sent

        // Get confirmed members (with phone for SMS) for this activity
        const { data: members } = await admin
          .from('whozin_activity_member')
          .select('user_id, whozin_users!inner(phone)')
          .eq('activity_id', activity.id)
          .eq('status', 'confirmed')

        if (!members?.length) continue

        // Send reminder to each confirmed member
        for (const member of members) {
          await admin.from('whozin_alerts').insert({
            user_id: member.user_id,
            type: 'system',
            title: `Reminder: ${activity.activity_name}`,
            body: `Starting in ${window.label}!`,
            link: `/app/activities/${activity.id}`,
            meta: { reminder_key: reminderKey },
          })

          sendPush({
            userId: member.user_id,
            title: `Reminder: ${activity.activity_name}`,
            body: `Starting in ${window.label}!`,
            link: `/app/activities/${activity.id}`,
          }).catch(() => {})

          const phone = (member as unknown as { whozin_users?: { phone?: string } }).whozin_users?.phone
          if (phone) {
            sendReminderSms(phone, activity.activity_name, window.label).catch(() => {})
          }

          sent++
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent })
}
