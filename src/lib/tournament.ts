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

export interface StandingsRow {
  player_id: string
  wins: number
  losses: number
  played: number
}

export interface MatchRow {
  player_a_id: string
  player_b_id: string
  winner_id: string | null
  status: 'pending' | 'completed' | 'forfeit'
}

/**
 * Compute standings from a list of matches. Forfeits and completed matches
 * both contribute to wins/losses; pending matches do not.
 */
export function computeStandings(matches: MatchRow[], playerIds: string[]): StandingsRow[] {
  const rows = new Map<string, StandingsRow>()
  for (const id of playerIds) {
    rows.set(id, { player_id: id, wins: 0, losses: 0, played: 0 })
  }

  for (const m of matches) {
    if (m.status === 'pending') continue
    if (!m.winner_id) continue
    const winner = rows.get(m.winner_id)
    const loserId = m.winner_id === m.player_a_id ? m.player_b_id : m.player_a_id
    const loser = rows.get(loserId)
    if (winner) {
      winner.wins += 1
      winner.played += 1
    }
    if (loser) {
      loser.losses += 1
      loser.played += 1
    }
  }

  // Sort by wins desc, then fewer losses, then more played (broke a tie via
  // head-to-head later if needed; for v1 the wins ordering is enough).
  return Array.from(rows.values()).sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins
    if (x.losses !== y.losses) return x.losses - y.losses
    return y.played - x.played
  })
}
