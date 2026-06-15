import { getAdminClient } from '@/lib/supabase/admin'

export type RepeatInterval = 'none' | 'weekly' | 'biweekly' | 'monthly'

/**
 * Add days to a YYYY-MM-DD string, keeping it as YYYY-MM-DD.
 * Treated as a calendar date — DST and timezone don't apply at the date level.
 */
function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

/**
 * Add 1 month while preserving day-of-month. If the next month has fewer
 * days (e.g. Jan 31 → Feb 28), clamp to the last day of the next month.
 */
function addMonth(date: string): string {
  const d = new Date(date + 'T00:00:00Z')
  const targetMonth = d.getUTCMonth() + 1
  const targetYear = d.getUTCFullYear() + Math.floor(targetMonth / 12)
  const month = targetMonth % 12
  const day = d.getUTCDate()
  // Find last day of target month
  const lastDay = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate()
  const clamped = Math.min(day, lastDay)
  const result = new Date(Date.UTC(targetYear, month, clamped))
  return result.toISOString().split('T')[0]
}

export function nextDateFor(date: string, interval: RepeatInterval): string | null {
  if (interval === 'weekly') return addDays(date, 7)
  if (interval === 'biweekly') return addDays(date, 14)
  if (interval === 'monthly') return addMonth(date)
  return null
}

/**
 * Advance `date` by `interval` at least once, then keep advancing until the
 * result is no earlier than `todayUtc`. Always lands on a future-or-today
 * occurrence. Returns null for a non-recurring interval. Used for spawning the
 * next draft, rolling a missed draft forward, and the host "skip" action.
 */
export function nextFutureDate(
  date: string,
  interval: RepeatInterval,
  todayUtc: string,
): string | null {
  let d = nextDateFor(date, interval)
  let guard = 0
  // Guard caps the loop well past any realistic gap (≈ years of weeklies).
  while (d && d < todayUtc && guard < 1000) {
    d = nextDateFor(d, interval)
    guard++
  }
  return d
}

/**
 * Spawn the next-occurrence draft for a parent activity. Idempotent:
 * returns null if the parent has no date, no repeat interval, or already
 * has a child draft.
 */
export async function spawnNextDraft(parentId: string): Promise<string | null> {
  const admin = getAdminClient()

  const { data: parent } = await admin
    .from('whozin_activity')
    .select('*')
    .eq('id', parentId)
    .single()

  if (!parent) return null
  if (!parent.activity_date) return null
  if (parent.repeat_interval === 'none' || !parent.repeat_interval) return null

  // Always queue the next occurrence in the future, even if the parent is
  // several intervals stale (host hasn't opened the app in a while).
  const todayUtc = new Date().toISOString().split('T')[0]
  const nextDate = nextFutureDate(parent.activity_date, parent.repeat_interval as RepeatInterval, todayUtc)
  if (!nextDate) return null

  // Bail if any child already exists for this parent (draft OR already
  // approved). Once a host approves, the draft becomes status='open' and
  // is itself the next parent — spawning from the original again would
  // duplicate the next occurrence at the same date.
  const { data: existing } = await admin
    .from('whozin_activity')
    .select('id')
    .eq('parent_activity_id', parentId)
    .limit(1)
    .maybeSingle()

  if (existing) return null

  const { data: draft, error } = await admin
    .from('whozin_activity')
    .insert({
      creator_id: parent.creator_id,
      group_id: parent.group_id,
      activity_type: parent.activity_type,
      activity_name: parent.activity_name,
      activity_date: nextDate,
      activity_time: parent.activity_time,
      duration_hours: parent.duration_hours,
      location: parent.location,
      address: parent.address,
      note: parent.note,
      cost_type: parent.cost_type,
      cost: parent.cost,
      max_capacity: parent.max_capacity,
      response_timer_minutes: parent.response_timer_minutes,
      priority_invite: parent.priority_invite,
      invite_batch_size: parent.invite_batch_size,
      invite_priority_mode: parent.invite_priority_mode,
      chat_enabled: parent.chat_enabled,
      reminder_enabled: parent.reminder_enabled,
      image_url: parent.image_url,
      auto_emergency_fill: parent.auto_emergency_fill,
      waitlist_enabled: parent.waitlist_enabled,
      open_invite: parent.open_invite,
      timezone: parent.timezone,
      repeat_interval: parent.repeat_interval,
      parent_activity_id: parent.id,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) return null

  // Add creator as a confirmed member (mirrors the create-activity flow).
  await admin.from('whozin_activity_member').insert({
    activity_id: draft.id,
    user_id: parent.creator_id,
    status: 'confirmed',
    priority_order: 0,
  })

  return draft.id
}

/**
 * Handle the user's drafts whose event date has already passed (host never
 * approved before the date).
 *
 * For a *recurring* draft we roll it forward to the next future occurrence
 * rather than deleting it — a single missed week must NOT silently kill the
 * whole series (that previously looked like "the recurring activity got
 * deleted"). The host can still Discard a draft to stop the chain, or set the
 * repeat to "none".
 *
 * A draft with no repeat interval is a true orphan (shouldn't normally happen,
 * since drafts are only spawned for recurring activities) — delete it.
 */
export async function cleanupStaleDrafts(userId: string, todayUtc: string): Promise<void> {
  const admin = getAdminClient()

  const { data: stale } = await admin
    .from('whozin_activity')
    .select('id, activity_date, repeat_interval')
    .eq('creator_id', userId)
    .eq('status', 'draft')
    .lt('activity_date', todayUtc)

  if (!stale || stale.length === 0) return

  for (const d of stale) {
    const interval = (d.repeat_interval ?? 'none') as RepeatInterval
    if (interval !== 'none' && d.activity_date) {
      const next = nextFutureDate(d.activity_date, interval, todayUtc)
      if (next) {
        await admin
          .from('whozin_activity')
          .update({ activity_date: next })
          .eq('id', d.id)
        continue
      }
    }
    await admin.from('whozin_activity').delete().eq('id', d.id)
  }
}
