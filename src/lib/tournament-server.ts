import { getAdminClient } from '@/lib/supabase/admin'
import { generateRotatingRoundDoubles, generateMatchesFromTeams, type DoublesTeam } from '@/lib/tournament'

export interface PlayerRating {
  pickleball_rating: number | null
  group_wins: number
  group_losses: number
  /** Single comparable number used by the skill-match draft, on a DUPR-like
   * 2–8 scale: real DUPR if set, else estimated from the player's group win
   * rate, else a neutral default. */
  effective: number
}

/**
 * Per-player ratings for the skill-match: each player's self-reported DUPR plus
 * a win/loss record computed across every completed tournament match in the
 * activity's group (not just this one tournament — "best in the group").
 *
 * Effective rating priority: DUPR → estimate from group win rate (2.5 + rate*3,
 * so a 50% player ≈ 4.0) → 3.5 neutral default.
 */
export async function computePlayerRatings(
  activityId: string,
  playerIds: string[],
): Promise<Map<string, PlayerRating>> {
  const admin = getAdminClient()
  const out = new Map<string, PlayerRating>()
  for (const id of playerIds) {
    out.set(id, { pickleball_rating: null, group_wins: 0, group_losses: 0, effective: 3.5 })
  }
  if (playerIds.length === 0) return out

  // DUPR ratings.
  const { data: users } = await admin
    .from('whozin_users')
    .select('id, pickleball_rating')
    .in('id', playerIds)
  for (const u of (users ?? [])) {
    const row = out.get(u.id)
    if (row && u.pickleball_rating != null) row.pickleball_rating = Number(u.pickleball_rating)
  }

  // All activities in this activity's group → all their completed matches.
  const { data: activity } = await admin
    .from('whozin_activity')
    .select('group_id')
    .eq('id', activityId)
    .single()

  if (activity?.group_id) {
    const { data: groupActivities } = await admin
      .from('whozin_activity')
      .select('id')
      .eq('group_id', activity.group_id)
    const activityIds = (groupActivities ?? []).map((a) => a.id)

    if (activityIds.length > 0) {
      const { data: matches } = await admin
        .from('whozin_match')
        .select('player_a_id, player_b_id, player_c_id, player_d_id, winner_id, status')
        .in('activity_id', activityIds)
        .eq('status', 'completed')

      for (const m of (matches ?? [])) {
        if (!m.winner_id) continue
        const sideA = [m.player_a_id, ...(m.player_c_id ? [m.player_c_id] : [])]
        const sideB = [m.player_b_id, ...(m.player_d_id ? [m.player_d_id] : [])]
        const winnersAreA = sideA.includes(m.winner_id)
        const winners = winnersAreA ? sideA : sideB
        const losers = winnersAreA ? sideB : sideA
        for (const id of winners) { const r = out.get(id); if (r) r.group_wins++ }
        for (const id of losers) { const r = out.get(id); if (r) r.group_losses++ }
      }
    }
  }

  // Effective rating.
  for (const r of out.values()) {
    if (r.pickleball_rating != null) {
      r.effective = r.pickleball_rating
    } else {
      const played = r.group_wins + r.group_losses
      if (played > 0) {
        const rate = r.group_wins / played
        r.effective = 2.5 + rate * 3 // 2.5–5.5
      } else {
        r.effective = 3.5
      }
    }
  }

  return out
}

/**
 * Balance players into doubles teams by pairing the strongest with the
 * weakest (sorted by effective rating, team[i] = best[i] + worst[i]). This
 * minimizes the spread of combined team strength.
 */
export function skillMatchTeams(
  playerIds: string[],
  ratings: Map<string, PlayerRating>,
): DoublesTeam[] {
  const sorted = [...playerIds].sort(
    (a, b) => (ratings.get(b)?.effective ?? 3.5) - (ratings.get(a)?.effective ?? 3.5),
  )
  const teams: DoublesTeam[] = []
  let lo = 0
  let hi = sorted.length - 1
  while (lo < hi) {
    teams.push([sorted[lo], sorted[hi]])
    lo++
    hi--
  }
  return teams
}

/**
 * Persist the given fixed-partner doubles teams and rebuild the activity's
 * round-robin from them, wiping any existing matches (and their results — the
 * matchups are different now). Resets current_round to 1. Used by start,
 * reroll, and manual swap on the Teams tab.
 */
export async function rebuildDoublesFromTeams(activityId: string, teams: DoublesTeam[]): Promise<void> {
  const admin = getAdminClient()

  await admin.from('whozin_match').delete().eq('activity_id', activityId)

  const pairings = generateMatchesFromTeams(teams)
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
    .update({ tournament_teams: teams, tournament_current_round: 1 })
    .eq('id', activityId)
}

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
