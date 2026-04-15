import type { SupabaseClient } from '@supabase/supabase-js'
import { suggestOptimalSchedule } from './optimal-times'

/**
 * Returns the next scheduling slot for a new content item, channel-aware.
 * Loads all future-scheduled items and asks `suggestOptimalSchedule` to find
 * the next preferred window that (a) comes after the queue's tail and
 * (b) is at least 1 hour from now.
 */
export async function getNextScheduledSlot(
  admin: SupabaseClient,
  channel = 'other',
): Promise<string> {
  const nowIso = new Date().toISOString()

  const { data } = await admin
    .from('whozin_marketing_content_items')
    .select('scheduled_at')
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', nowIso)

  const existingISOs = (data ?? [])
    .map((r) => r.scheduled_at as string | null)
    .filter((s): s is string => !!s)

  return suggestOptimalSchedule(channel, existingISOs).iso
}
