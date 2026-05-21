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

  const nextDate = nextDateFor(parent.activity_date, parent.repeat_interval as RepeatInterval)
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
 * Delete any of the user's drafts whose event date has already passed
 * (host never approved before the date). Stops the chain — also marks each
 * deleted draft's parent as 'none' repeat so the sweep doesn't immediately
 * respawn another stale draft from the same parent.
 */
export async function cleanupStaleDrafts(userId: string, todayUtc: string): Promise<void> {
  const admin = getAdminClient()

  const { data: stale } = await admin
    .from('whozin_activity')
    .select('id, parent_activity_id')
    .eq('creator_id', userId)
    .eq('status', 'draft')
    .lt('activity_date', todayUtc)

  if (!stale || stale.length === 0) return

  const parentIds = stale
    .map((s) => s.parent_activity_id)
    .filter((p): p is string => !!p)

  if (parentIds.length > 0) {
    await admin
      .from('whozin_activity')
      .update({ repeat_interval: 'none' })
      .in('id', parentIds)
  }

  await admin
    .from('whozin_activity')
    .delete()
    .in('id', stale.map((s) => s.id))
}
