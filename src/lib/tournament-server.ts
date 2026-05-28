import { getAdminClient } from '@/lib/supabase/admin'
import { generateRotatingRoundDoubles } from '@/lib/tournament'

/**
 * Bump tournament_current_round for an activity. If the activity is in
 * rotating-partner doubles mode, generate the next round's matches on the
 * fly. Caps advancement at the highest pre-existing round_number when
 * rotation is off. Returns the new current_round (or the existing one if
 * nothing changed).
 *
 * Caller is responsible for authorization — this helper just executes.
 */
export async function advanceRound(activityId: string): Promise<number> {
  const admin = getAdminClient()

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('tournament_mode, tournament_format, tournament_started_at, tournament_current_round, tournament_doubles, tournament_partner_rotation')
    .eq('id', activityId)
    .single()
  if (!activity || !activity.tournament_mode || !activity.tournament_started_at) {
    return activity?.tournament_current_round ?? 0
  }

  const currentRound = activity.tournament_current_round ?? 0
  const nextRoundNum = currentRound + 1

  // Rotating-partner doubles: generate a fresh round.
  if (
    activity.tournament_doubles &&
    activity.tournament_partner_rotation &&
    activity.tournament_format === 'round_robin'
  ) {
    const { data: confirmed } = await admin
      .from('whozin_activity_member')
      .select('user_id')
      .eq('activity_id', activityId)
      .eq('status', 'confirmed')

    const playerIds = (confirmed ?? []).map((m) => m.user_id)
    if (playerIds.length < 4) return currentRound

    const pairings = generateRotatingRoundDoubles(playerIds, nextRoundNum)
    if (pairings.length > 0) {
      await admin.from('whozin_match').insert(
        pairings.map((p) => ({
          activity_id: activityId,
          round_number: p.round_number,
          player_a_id: p.player_a_id,
          player_b_id: p.player_b_id,
          player_c_id: p.player_c_id,
          player_d_id: p.player_d_id,
        })),
      )
    }

    await admin
      .from('whozin_activity')
      .update({ tournament_current_round: nextRoundNum })
      .eq('id', activityId)
    return nextRoundNum
  }

  // Pre-generated schedule: cap at the highest existing round_number.
  const { data: maxRow } = await admin
    .from('whozin_match')
    .select('round_number')
    .eq('activity_id', activityId)
    .order('round_number', { ascending: false })
    .limit(1)
    .single()

  const maxRound = maxRow?.round_number ?? currentRound
  const next = Math.min(currentRound + 1, maxRound)
  if (next === currentRound) return currentRound

  await admin
    .from('whozin_activity')
    .update({ tournament_current_round: next })
    .eq('id', activityId)
  return next
}

/**
 * After a match result lands, check whether every match in the current
 * round is now decided. If so, auto-advance. Returns the (possibly new)
 * current_round so the caller can return it in the response.
 */
export async function maybeAutoAdvanceRound(activityId: string): Promise<number> {
  const admin = getAdminClient()
  const { data: activity } = await admin
    .from('whozin_activity')
    .select('tournament_current_round, tournament_mode')
    .eq('id', activityId)
    .single()
  if (!activity || !activity.tournament_mode) return activity?.tournament_current_round ?? 0

  const current = activity.tournament_current_round ?? 0
  if (current === 0) return current

  const { data: pending } = await admin
    .from('whozin_match')
    .select('id')
    .eq('activity_id', activityId)
    .eq('round_number', current)
    .eq('status', 'pending')
    .limit(1)

  if (pending && pending.length > 0) return current
  return advanceRound(activityId)
}
