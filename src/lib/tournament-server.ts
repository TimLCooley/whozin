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
  // Odd count: the leftover middle player gets an open slot.
  if (lo === hi) teams.push([sorted[lo], null])
  return teams
}

// Canonical key for an unordered doubles matchup (two unordered teams), so we
// can recognize the "same match" across a rebuild even if team/side order
// changed. e.g. (A,B) vs (C,D) === (C,D) vs (B,A).
function teamKey(x: string, y: string): string {
  return [x, y].sort().join('+')
}
function matchupKey(a: string, c: string, b: string, d: string): string {
  return [teamKey(a, c), teamKey(b, d)].sort().join('|')
}

/**
 * Persist the given fixed-partner doubles teams and rebuild the activity's
 * round-robin from them.
 *
 * By default this is a clean wipe: every existing match (and its recorded
 * result) is deleted and the schedule is regenerated from scratch with
 * current_round reset to 1. That's correct for reroll / skill-match where the
 * matchups genuinely change.
 *
 * Pass `{ preserveResults: true }` for operations that only *add* or *shuffle*
 * slots without changing who-plays-whom for the already-decided games — adding
 * an empty team, filling an open slot, removing a player, or a manual swap.
 * Then any recorded result whose exact 2v2 matchup still exists in the new
 * schedule is carried over (scores re-aligned to the new side order), so we
 * don't "drop" games that already happened. current_round is left untouched.
 */
export async function rebuildDoublesFromTeams(
  activityId: string,
  teams: DoublesTeam[],
  opts: { preserveResults?: boolean } = {},
): Promise<void> {
  const admin = getAdminClient()
  const preserve = opts.preserveResults === true

  // Snapshot existing results before we delete, if we're preserving them.
  const resultByMatchup = new Map<
    string,
    { player_a_id: string; player_c_id: string | null; winner_id: string | null; status: string; score_a: number | null; score_b: number | null; recorded_by: string | null; recorded_at: string | null }
  >()
  if (preserve) {
    const { data: existing } = await admin
      .from('whozin_match')
      .select('player_a_id, player_b_id, player_c_id, player_d_id, winner_id, status, score_a, score_b, recorded_by, recorded_at')
      .eq('activity_id', activityId)
    for (const m of existing ?? []) {
      // Only doubles matches with a recorded outcome are worth carrying over.
      if (!m.player_c_id || !m.player_d_id) continue
      if (m.status === 'pending' || !m.winner_id) continue
      const key = matchupKey(m.player_a_id, m.player_c_id, m.player_b_id, m.player_d_id)
      if (!resultByMatchup.has(key)) {
        resultByMatchup.set(key, {
          player_a_id: m.player_a_id,
          player_c_id: m.player_c_id,
          winner_id: m.winner_id,
          status: m.status,
          score_a: m.score_a,
          score_b: m.score_b,
          recorded_by: m.recorded_by,
          recorded_at: m.recorded_at,
        })
      }
    }
  }

  await admin.from('whozin_match').delete().eq('activity_id', activityId)

  const pairings = generateMatchesFromTeams(teams)
  if (pairings.length > 0) {
    await admin.from('whozin_match').insert(
      pairings.map((p) => {
        const row: Record<string, unknown> = {
          activity_id: activityId,
          round_number: p.round_number,
          player_a_id: p.player_a_id,
          player_b_id: p.player_b_id,
          player_c_id: p.player_c_id,
          player_d_id: p.player_d_id,
        }
        if (preserve) {
          const prev = resultByMatchup.get(matchupKey(p.player_a_id, p.player_c_id, p.player_b_id, p.player_d_id))
          if (prev) {
            // Re-align scores: side A of the new pairing is (player_a, player_c).
            const sameSideA = teamKey(p.player_a_id, p.player_c_id) === teamKey(prev.player_a_id, prev.player_c_id ?? '')
            row.winner_id = prev.winner_id
            row.status = prev.status
            row.score_a = sameSideA ? prev.score_a : prev.score_b
            row.score_b = sameSideA ? prev.score_b : prev.score_a
            row.recorded_by = prev.recorded_by
            row.recorded_at = prev.recorded_at
          }
        }
        return row
      }),
    )
  }

  await admin
    .from('whozin_activity')
    .update(preserve ? { tournament_teams: teams } : { tournament_teams: teams, tournament_current_round: 1 })
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
 * Remove a player from the doubles teams (their slot reopens) and rebuild the
 * matches. No-op if the activity has no teams or the player isn't on one.
 * Returns true if anything changed.
 */
export async function removePlayerFromTeams(activityId: string, userId: string): Promise<boolean> {
  const admin = getAdminClient()
  const { data: activity } = await admin
    .from('whozin_activity')
    .select('tournament_mode, tournament_doubles, tournament_teams')
    .eq('id', activityId)
    .single()
  if (!activity?.tournament_mode || !activity.tournament_doubles) return false
  const teams: DoublesTeam[] = Array.isArray(activity.tournament_teams) ? activity.tournament_teams : []

  let changed = false
  const next: DoublesTeam[] = teams.map((t) => {
    const slot = t.slice() as DoublesTeam
    if (slot[0] === userId) { slot[0] = null; changed = true }
    if (slot[1] === userId) { slot[1] = null; changed = true }
    return slot
  })
  if (!changed) return false

  // Preserve results for the matchups that don't involve the removed player.
  await rebuildDoublesFromTeams(activityId, next, { preserveResults: true })
  return true
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
