import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPush, hasReachablePush } from '@/lib/push'
import { sendReminderSms } from '@/lib/sms'
import { renderTemplate } from '@/lib/notification-templates'

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

        const { title: pushTitle, body: pushBody } = await renderTemplate('activity_reminder', 'push', {
          activity_name: activity.activity_name,
          window_label: window.label,
        })

        // Send reminder to each confirmed member
        for (const member of members) {
          await admin.from('whozin_alerts').insert({
            user_id: member.user_id,
            type: 'system',
            title: pushTitle ?? `Reminder: ${activity.activity_name}`,
            body: pushBody,
            link: `/app/activities/${activity.id}`,
            meta: { reminder_key: reminderKey },
          })

          sendPush({
            userId: member.user_id,
            title: pushTitle ?? `Reminder: ${activity.activity_name}`,
            body: pushBody,
            link: `/app/activities/${activity.id}`,
          }).catch(() => {})

          const phone = (member as unknown as { whozin_users?: { phone?: string } }).whozin_users?.phone
          if (phone) {
            ;(async () => {
              if (await hasReachablePush(member.user_id)) return
              sendReminderSms(phone, activity.activity_name, window.label).catch(() => {})
            })().catch(() => {})
          }

          sent++
        }
      }
    }
  }

  // ── Follow-up invites: ~24h before, nudge non-responders if not full ──────
  const followupSent = await processFollowupInvites(admin, now)

  return NextResponse.json({ ok: true, sent, followupSent })
}

/**
 * Last-call follow-up. For activities with followup_invite_enabled that are
 * still open (not full) and ~24h out, message everyone who hasn't decided
 * (member status not confirmed/out) and give them a fresh pending invite so
 * they can reply IN by SMS or in-app. Deduped per activity via an alert key.
 */
async function processFollowupInvites(
  admin: ReturnType<typeof getAdminClient>,
  now: Date,
): Promise<number> {
  let sent = 0

  const { data: activities } = await admin
    .from('whozin_activity')
    .select('id, activity_name, activity_date, activity_time, timezone, max_capacity, creator_id, image_url')
    .eq('followup_invite_enabled', true)
    .eq('status', 'open') // 'full' is excluded by definition
    .not('activity_date', 'is', null)
    .not('activity_time', 'is', null)

  if (!activities?.length) return 0

  for (const activity of activities) {
    const activityDateTime = parseActivityTime(activity.activity_date, activity.activity_time, activity.timezone)
    if (isNaN(activityDateTime.getTime())) continue

    const minutesUntil = (activityDateTime.getTime() - now.getTime()) / (1000 * 60)
    // Fire in the 24h window: between 24h and 24h-5min before start.
    if (!(minutesUntil <= 24 * 60 && minutesUntil > 24 * 60 - 5)) continue

    // Dedupe — only one follow-up blast per activity.
    const followupKey = `followup_${activity.id}`
    const { data: alreadySent } = await admin
      .from('whozin_alerts')
      .select('id')
      .eq('meta->>followup_key', followupKey)
      .limit(1)
      .maybeSingle()
    if (alreadySent) continue

    // Double-check there's still room.
    const { count: confirmedCount } = await admin
      .from('whozin_activity_member')
      .select('id', { count: 'exact', head: true })
      .eq('activity_id', activity.id)
      .eq('status', 'confirmed')
    const confirmed = confirmedCount ?? 0
    if (activity.max_capacity && confirmed >= activity.max_capacity) continue

    // Non-responders: everyone who isn't confirmed (in) or out.
    const { data: members } = await admin
      .from('whozin_activity_member')
      .select('user_id, whozin_users!inner(phone, country_code)')
      .eq('activity_id', activity.id)
      .not('status', 'in', '(confirmed,out)')

    if (!members?.length) continue

    const { data: host } = await admin
      .from('whozin_users')
      .select('first_name')
      .eq('id', activity.creator_id)
      .single()
    const hostName = host?.first_name ?? 'Someone'

    let dateTimeStr = ''
    if (activity.activity_date) {
      const d = new Date(activity.activity_date + 'T00:00:00')
      dateTimeStr = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
      if (activity.activity_time) {
        const [h, m] = activity.activity_time.split(':')
        const hour = parseInt(h)
        const ampm = hour >= 12 ? 'pm' : 'am'
        const h12 = hour % 12 || 12
        dateTimeStr += ` at ${h12}:${m} ${ampm}`
      }
    }

    const { body: smsBody } = await renderTemplate('followup_invite', 'sms', {
      inviter_name: hostName,
      activity_name: activity.activity_name,
      date_time: dateTimeStr || 'TBD',
    })
    const { title: pushTitle, body: pushBody } = await renderTemplate('followup_invite', 'push', {
      inviter_name: hostName,
      activity_name: activity.activity_name,
      date_time: dateTimeStr || 'TBD',
    })

    const { sendActivitySms } = await import('@/lib/sms')

    for (const member of members) {
      // Fresh pending invite so an SMS "IN" reply maps to this activity.
      await admin.from('whozin_invite').insert({
        activity_id: activity.id,
        user_id: member.user_id,
        batch_number: 998, // follow-up sentinel
        status: 'pending',
        sent_at: now.toISOString(),
        expires_at: activityDateTime.toISOString(),
      })

      await admin.from('whozin_alerts').insert({
        user_id: member.user_id,
        type: 'activity_invite',
        title: pushTitle ?? `Last call: ${activity.activity_name}`,
        body: pushBody,
        link: `/app/activities/${activity.id}`,
        meta: { followup_key: followupKey },
      })

      sendPush({
        userId: member.user_id,
        title: pushTitle ?? `Last call: ${activity.activity_name}`,
        body: pushBody ?? 'Still has room — tap to join!',
        link: `/app/activities/${activity.id}`,
      }).catch(() => {})

      const u = (member as unknown as { whozin_users?: { phone?: string; country_code?: string } }).whozin_users
      if (u?.phone) {
        ;(async () => {
          if (await hasReachablePush(member.user_id)) return
          const phone = u.phone!.startsWith('+') ? u.phone! : `+${u.country_code ?? '1'}${u.phone}`
          sendActivitySms(phone, smsBody, activity.image_url || undefined).catch(() => {})
        })().catch(() => {})
      }

      sent++
    }
  }

  return sent
}
