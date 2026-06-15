/**
 * Tournament generation + standings helpers.
 *
 * v1 covers two formats:
 *   * round_robin — every player faces every other player exactly once.
 *     We use the circle method: fix player 0 in place, rotate the rest.
 *     With N players (or N+1 if odd, where the extra is a bye), we get
 *     N-1 rounds of N/2 pairings each.
 *   * assigned — host adds matches manually; nothing to generate.
 */

/** Human-readable label for the SMS / push text. Pass into templates. */
export function formatLabel(format: 'assigned' | 'round_robin' | null | undefined): string {
  if (format === 'round_robin') return 'Round Robin'
  if (format === 'assigned') return 'Assigned'
  return 'Tournament'
}

export interface MatchPairing {
  round_number: number
  player_a_id: string
  player_b_id: string
}

/**
 * Generate every pairing for a round-robin among `playerIds`.
 * Returns one MatchPairing per match, with round_number set so the UI can
 * group "Round 1", "Round 2", etc. Empty array if fewer than 2 players.
 */
export function generateRoundRobin(playerIds: string[]): MatchPairing[] {
  if (playerIds.length < 2) return []

  // Add a bye sentinel if we have an odd number so the circle method works.
  const BYE = '__bye__'
  const players: string[] = [...playerIds]
  if (players.length % 2 === 1) players.push(BYE)

  const n = players.length
  const rounds = n - 1
  const half = n / 2
  const pairings: MatchPairing[] = []

  // We keep a working array and rotate everyone except index 0 each round.
  const arr = [...players]

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a === BYE || b === BYE) continue // the bye player sits out this round
      pairings.push({
        round_number: r + 1,
        player_a_id: a,
        player_b_id: b,
      })
    }
    // Rotate: keep arr[0] fixed, move arr[1] to the end, shift the rest left.
    const fixed = arr[0]
    const rotated = arr.slice(2).concat(arr[1])
    arr.splice(1, n - 1, ...rotated)
    arr[0] = fixed
  }

  return pairings
}

export interface DoublesMatchPairing extends MatchPairing {
  player_c_id: string
  player_d_id: string
}

export type DoublesTeam = [string, string]

/**
 * Pair a player list into fixed doubles teams of two, in order. The caller
 * shuffles first if random teams are wanted. A trailing odd player is dropped
 * (doubles can't bye a single player cleanly).
 */
export function formTeams(playerIds: string[]): DoublesTeam[] {
  const teams: DoublesTeam[] = []
  for (let i = 0; i + 1 < playerIds.length; i += 2) {
    teams.push([playerIds[i], playerIds[i + 1]])
  }
  return teams
}

/**
 * Round-robin among explicit doubles teams via the circle method. Each output
 * pairing is a team-vs-team match with all four player ids filled.
 */
export function generateMatchesFromTeams(teams: DoublesTeam[]): DoublesMatchPairing[] {
  if (teams.length < 2) return []
  const teamIndices = teams.map((_, i) => String(i))
  const teamPairings = generateRoundRobin(teamIndices)
  return teamPairings.map((p) => {
    const [a, c] = teams[parseInt(p.player_a_id, 10)]
    const [b, d] = teams[parseInt(p.player_b_id, 10)]
    return {
      round_number: p.round_number,
      player_a_id: a,
      player_c_id: c,
      player_b_id: b,
      player_d_id: d,
    }
  })
}

/**
 * Convenience: form teams from a (pre-shuffled) player list and generate the
 * round-robin in one call.
 */
export function generateRoundRobinDoubles(playerIds: string[]): DoublesMatchPairing[] {
  return generateMatchesFromTeams(formTeams(playerIds))
}

export interface StandingsRow {
  player_id: string
  wins: number
  losses: number
  played: number
}

export interface MatchRow {
  player_a_id: string
  player_b_id: string
  player_c_id?: string | null
  player_d_id?: string | null
  winner_id: string | null
  status: 'pending' | 'completed' | 'forfeit'
}

/**
 * Compute standings from a list of matches. For doubles matches (player_c/
 * player_d present), both winners get a win and both losers get a loss.
 * Forfeits and completed matches contribute; pending matches do not.
 */
export function computeStandings(matches: MatchRow[], playerIds: string[]): StandingsRow[] {
  const rows = new Map<string, StandingsRow>()
  for (const id of playerIds) {
    rows.set(id, { player_id: id, wins: 0, losses: 0, played: 0 })
  }

  for (const m of matches) {
    if (m.status === 'pending') continue
    if (!m.winner_id) continue
    const sideA: string[] = [m.player_a_id, ...(m.player_c_id ? [m.player_c_id] : [])]
    const sideB: string[] = [m.player_b_id, ...(m.player_d_id ? [m.player_d_id] : [])]
    const winnersAreA = sideA.includes(m.winner_id)
    const winners = winnersAreA ? sideA : sideB
    const losers = winnersAreA ? sideB : sideA
    for (const id of winners) {
      const row = rows.get(id)
      if (row) { row.wins += 1; row.played += 1 }
    }
    for (const id of losers) {
      const row = rows.get(id)
      if (row) { row.losses += 1; row.played += 1 }
    }
  }

  return Array.from(rows.values()).sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins
    if (x.losses !== y.losses) return x.losses - y.losses
    return y.played - x.played
  })
}

/**
 * Generate a single round of doubles matches with random partner + opponent
 * pairings. Used for rotating-partner mode where every round reshuffles.
 *
 * Algorithm: shuffle players, take groups of four; first two are team A,
 * next two are team B. Any leftover players (1, 2, or 3) sit this round
 * out — we accept that for v1 rather than over-engineering byes.
 */
export function generateRotatingRoundDoubles(
  playerIds: string[],
  roundNumber: number,
): DoublesMatchPairing[] {
  if (playerIds.length < 4) return []
  const shuffled = shuffleArray(playerIds)
  const out: DoublesMatchPairing[] = []
  for (let i = 0; i + 3 < shuffled.length; i += 4) {
    out.push({
      round_number: roundNumber,
      player_a_id: shuffled[i],
      player_c_id: shuffled[i + 1],
      player_b_id: shuffled[i + 2],
      player_d_id: shuffled[i + 3],
    })
  }
  return out
}

export function shuffleArray<T>(arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
