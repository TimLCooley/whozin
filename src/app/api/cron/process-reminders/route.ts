import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/push'

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
    .select('id, name, activity_date, activity_time, group_id')
    .eq('reminder_enabled', true)
    .eq('status', 'open')
    .not('activity_date', 'is', null)
    .not('activity_time', 'is', null)

  if (!activities?.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  for (const activity of activities) {
    // Parse activity datetime
    const activityDateTime = new Date(`${activity.activity_date}T${activity.activity_time}`)
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

        // Get confirmed members for this activity
        const { data: members } = await admin
          .from('whozin_activity_members')
          .select('user_id')
          .eq('activity_id', activity.id)
          .eq('status', 'confirmed')

        if (!members?.length) continue

        // Send reminder to each confirmed member
        for (const member of members) {
          await admin.from('whozin_alerts').insert({
            user_id: member.user_id,
            type: 'system',
            title: `Reminder: ${activity.name}`,
            body: `Starting in ${window.label}!`,
            link: `/app/activities/${activity.id}`,
            meta: { reminder_key: reminderKey },
          })

          sendPush({
            userId: member.user_id,
            title: `Reminder: ${activity.name}`,
            body: `Starting in ${window.label}!`,
            link: `/app/activities/${activity.id}`,
          }).catch(() => {})

          sent++
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent })
}
