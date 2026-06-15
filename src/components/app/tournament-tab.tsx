'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeStandings, type MatchRow } from '@/lib/tournament'

interface Player {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
}

interface ConfirmedMember {
  user_id: string
  user: Player | null
}

interface ActivityShape {
  id: string
  activity_type?: string
  is_creator: boolean
  current_user_id: string
  tournament_mode: boolean
  tournament_format: 'assigned' | 'round_robin' | null
  tournament_started_at: string | null
  tournament_current_round?: number
  tournament_track_scores?: boolean
  tournament_doubles?: boolean
  tournament_partner_rotation?: boolean
}

interface Match {
  id: string
  round_number: number
  player_a_id: string
  player_b_id: string
  player_c_id?: string | null
  player_d_id?: string | null
  winner_id: string | null
  status: 'pending' | 'completed' | 'forfeit'
  score_a?: number | null
  score_b?: number | null
  recorded_by: string | null
  recorded_at: string | null
}

type SubTab = 'my' | 'bracket' | 'leaderboard' | 'teams' | 'settings'

type Team = [string | null, string | null]

export function TournamentTab({
  activity,
  confirmed,
  onChange,
}: {
  activity: ActivityShape
  confirmed: ConfirmedMember[]
  onChange: () => void
}) {
  const [matches, setMatches] = useState<Match[]>([])
  const [currentRound, setCurrentRound] = useState<number>(activity.tournament_current_round ?? 0)
  const [trackScores, setTrackScores] = useState<boolean>(activity.tournament_track_scores ?? false)
  const [doubles, setDoubles] = useState<boolean>(activity.tournament_doubles ?? false)
  const [partnerRotation, setPartnerRotation] = useState<boolean>(activity.tournament_partner_rotation ?? false)
  const [teams, setTeams] = useState<Team[]>([])
  const [teamsBusy, setTeamsBusy] = useState(false)
  // Tap-to-swap: first tapped player id, then tap another to swap them.
  const [swapPick, setSwapPick] = useState<string | null>(null)
  // Fill-slot sheet: which [teamIndex, slotIndex] is being filled.
  const [fillSlot, setFillSlot] = useState<{ ti: number; si: number } | null>(null)
  const [fillPhone, setFillPhone] = useState('')
  const [fillFirst, setFillFirst] = useState('')
  const [fillLast, setFillLast] = useState('')
  const [fillBusy, setFillBusy] = useState(false)
  const [ratings, setRatings] = useState<Record<string, { pickleball_rating: number | null; group_wins: number; group_losses: number; effective: number }>>({})
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [newA, setNewA] = useState('')
  const [newB, setNewB] = useState('')
  const [addingMatch, setAddingMatch] = useState(false)
  const [subTab, setSubTab] = useState<SubTab>('my')
  const [openRounds, setOpenRounds] = useState<Set<number>>(new Set())

  const players = useMemo(() => {
    const map = new Map<string, Player>()
    for (const m of confirmed) {
      if (m.user) map.set(m.user_id, m.user)
    }
    return map
  }, [confirmed])

  const playerIds = useMemo(() => confirmed.map((m) => m.user_id), [confirmed])

  const refresh = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true)
    const res = await fetch(`/api/activities/${activity.id}/tournament/matches`)
    if (res.ok) {
      const data = await res.json()
      setMatches(data.matches ?? [])
      setCurrentRound(data.tournament_current_round ?? 0)
      setTrackScores(!!data.tournament_track_scores)
      setDoubles(!!data.tournament_doubles)
      setPartnerRotation(!!data.tournament_partner_rotation)
      setTeams(Array.isArray(data.tournament_teams) ? data.tournament_teams : [])
    }
    if (!silent) setLoading(false)
  }, [activity.id])

  // Keep results/standings live: poll every 7s while mounted, and refresh
  // immediately when the app regains focus. Silent so it doesn't flicker the
  // loading state or disrupt an in-progress score entry.
  useEffect(() => {
    const interval = setInterval(() => { refresh({ silent: true }) }, 7000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh({ silent: true }) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  async function updateSetting(
    field: 'tournament_track_scores' | 'tournament_doubles' | 'tournament_partner_rotation',
    value: boolean,
  ) {
    // Optimistic flip
    if (field === 'tournament_track_scores') setTrackScores(value)
    if (field === 'tournament_doubles') setDoubles(value)
    if (field === 'tournament_partner_rotation') setPartnerRotation(value)
    const res = await fetch(`/api/activities/${activity.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) {
      // Revert on failure
      if (field === 'tournament_track_scores') setTrackScores(!value)
      if (field === 'tournament_doubles') setDoubles(!value)
      if (field === 'tournament_partner_rotation') setPartnerRotation(!value)
      const data = await res.json().catch(() => null)
      alert(data?.error ?? 'Failed to update setting')
    }
  }

  useEffect(() => { refresh() }, [refresh])

  // Keep the active round expanded as it changes; leave the rest of the
  // user's open/closed state alone so they can dig through history.
  useEffect(() => {
    if (currentRound > 0) {
      setOpenRounds((prev) => (prev.has(currentRound) ? prev : new Set([...prev, currentRound])))
    }
  }, [currentRound])

  const maxRound = useMemo(() => matches.reduce((mx, m) => Math.max(mx, m.round_number), 0), [matches])

  const standings = useMemo(() => {
    const rows = matches as MatchRow[]
    return computeStandings(rows, playerIds)
  }, [matches, playerIds])

  // Players only see matches up to the current released round. Host sees all.
  const visibleMatches = useMemo(() => {
    if (activity.is_creator) return matches
    return matches.filter((m) => m.round_number <= currentRound)
  }, [matches, activity.is_creator, currentRound])

  const myCurrentRoundMatch = useMemo(() => {
    return matches.find((m) =>
      m.round_number === currentRound &&
      (m.player_a_id === activity.current_user_id || m.player_b_id === activity.current_user_id),
    ) ?? null
  }, [matches, currentRound, activity.current_user_id])

  const myAllMatches = useMemo(() => {
    return matches.filter((m) =>
      m.player_a_id === activity.current_user_id || m.player_b_id === activity.current_user_id,
    )
  }, [matches, activity.current_user_id])

  // Current round is "done" when every match in it has a result.
  const currentRoundDone = useMemo(() => {
    const inRound = matches.filter((m) => m.round_number === currentRound)
    if (inRound.length === 0) return false
    return inRound.every((m) => m.status !== 'pending')
  }, [matches, currentRound])

  // In rotating-partner doubles, rounds are open-ended — host can always
  // advance to generate a fresh round. In pre-generated modes, cap at the
  // highest round_number we already have.
  const canAdvance = activity.is_creator && currentRound > 0 && (partnerRotation || currentRound < maxRound)

  async function startTournament() {
    setStarting(true)
    const res = await fetch(`/api/activities/${activity.id}/tournament/start`, { method: 'POST' })
    setStarting(false)
    if (res.ok) {
      onChange()
      refresh()
    } else {
      const data = await res.json().catch(() => null)
      alert(data?.error ?? 'Failed to start tournament')
    }
  }

  const loadRatings = useCallback(async () => {
    const res = await fetch(`/api/activities/${activity.id}/tournament/teams`)
    if (res.ok) {
      const data = await res.json()
      setRatings(data.ratings ?? {})
    }
  }, [activity.id])

  // Load ratings when the Teams tab is opened.
  useEffect(() => {
    if (subTab === 'teams' && doubles && !partnerRotation) loadRatings()
  }, [subTab, doubles, partnerRotation, loadRatings])

  async function removePlayer(pid: string) {
    const p = players.get(pid)
    const name = p ? p.first_name : 'this player'
    if (!confirm(`Remove ${name} from the tournament? Their slot reopens and matches regenerate.`)) return
    setTeamsBusy(true)
    const res = await fetch(`/api/activities/${activity.id}/remove-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: pid }),
    })
    setTeamsBusy(false)
    setSwapPick(null)
    if (res.ok) {
      onChange()  // roster changed — refresh the parent's member list
      refresh()
      loadRatings()
    } else {
      const d = await res.json().catch(() => null)
      alert(d?.error ?? 'Failed to remove player')
    }
  }

  async function addEmptyTeam() {
    setTeamsBusy(true)
    const res = await fetch(`/api/activities/${activity.id}/tournament/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_team' }),
    })
    setTeamsBusy(false)
    if (res.ok) { refresh(); loadRatings() }
    else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Failed to add team') }
  }

  async function submitFillSlot() {
    if (!fillSlot) return
    const digits = fillPhone.replace(/\D/g, '')
    if (digits.length !== 10 || !fillFirst.trim()) return
    setFillBusy(true)
    const res = await fetch(`/api/activities/${activity.id}/tournament/teams/fill-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_index: fillSlot.ti,
        slot_index: fillSlot.si,
        phone: digits,
        country_code: '1',
        first_name: fillFirst.trim(),
        last_name: fillLast.trim(),
      }),
    })
    setFillBusy(false)
    if (res.ok) {
      setFillSlot(null)
      setFillPhone(''); setFillFirst(''); setFillLast('')
      refresh(); loadRatings()
    } else {
      const d = await res.json().catch(() => null)
      alert(d?.error ?? 'Failed to add player')
    }
  }

  async function teamsAction(action: 'reroll' | 'skill_match') {
    const msg = action === 'reroll'
      ? 'Reroll teams? This regenerates the matches and clears any recorded results.'
      : 'Skill match teams? This balances teams by rating and regenerates the matches, clearing any recorded results.'
    if (!confirm(msg)) return
    setTeamsBusy(true)
    const res = await fetch(`/api/activities/${activity.id}/tournament/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setTeamsBusy(false)
    setSwapPick(null)
    if (res.ok) {
      refresh()
      loadRatings()
    } else {
      const d = await res.json().catch(() => null)
      alert(d?.error ?? 'Failed to update teams')
    }
  }

  // Tap one player, then another, to swap their team slots. Persists the new
  // arrangement (which regenerates matches).
  async function handlePlayerTap(playerId: string) {
    if (!activity.is_creator) return
    if (!swapPick) { setSwapPick(playerId); return }
    if (swapPick === playerId) { setSwapPick(null); return }

    // Build the swapped arrangement.
    const next: Team[] = teams.map((t) => t.slice() as Team)
    let posA: [number, number] | null = null
    let posB: [number, number] | null = null
    for (let i = 0; i < next.length; i++) {
      for (let j = 0; j < 2; j++) {
        if (next[i][j] === swapPick) posA = [i, j]
        if (next[i][j] === playerId) posB = [i, j]
      }
    }
    if (!posA || !posB) { setSwapPick(null); return }
    const tmp = next[posA[0]][posA[1]]
    next[posA[0]][posA[1]] = next[posB[0]][posB[1]]
    next[posB[0]][posB[1]] = tmp

    setSwapPick(null)
    setTeams(next) // optimistic
    setTeamsBusy(true)
    const res = await fetch(`/api/activities/${activity.id}/tournament/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set', teams: next }),
    })
    setTeamsBusy(false)
    if (res.ok) {
      refresh()
    } else {
      const d = await res.json().catch(() => null)
      alert(d?.error ?? 'Failed to update teams')
      refresh()
    }
  }

  async function advanceRound() {
    setAdvancing(true)
    const res = await fetch(`/api/activities/${activity.id}/tournament/advance`, { method: 'POST' })
    setAdvancing(false)
    if (res.ok) {
      refresh()
    } else {
      const data = await res.json().catch(() => null)
      alert(data?.error ?? 'Failed to advance round')
    }
  }

  async function recordResult(
    matchId: string,
    payload: { winner_id: string | null } | { score_a: number; score_b: number },
  ) {
    // Optimistic update
    setMatches((prev) => prev.map((m) => {
      if (m.id !== matchId) return m
      if ('score_a' in payload) {
        const winningId = payload.score_a > payload.score_b ? m.player_a_id : m.player_b_id
        return { ...m, score_a: payload.score_a, score_b: payload.score_b, winner_id: winningId, status: 'completed' }
      }
      return { ...m, winner_id: payload.winner_id, status: payload.winner_id ? 'completed' : 'pending', score_a: null, score_b: null }
    }))
    const res = await fetch(`/api/activities/${activity.id}/tournament/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      alert(data?.error ?? 'Failed to record result')
    }
    // Refresh either way — recording can trigger auto-advance to the next
    // round, which the local optimistic update doesn't know about.
    refresh()
  }

  async function deleteMatch(matchId: string) {
    if (!confirm('Delete this match?')) return
    setMatches((prev) => prev.filter((m) => m.id !== matchId))
    const res = await fetch(`/api/activities/${activity.id}/tournament/matches/${matchId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      alert('Failed to delete match')
      refresh()
    }
  }

  async function addMatch() {
    if (!newA || !newB || newA === newB) return
    setAddingMatch(true)
    const res = await fetch(`/api/activities/${activity.id}/tournament/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_a_id: newA, player_b_id: newB }),
    })
    setAddingMatch(false)
    if (res.ok) {
      setNewA('')
      setNewB('')
      setShowAddMatch(false)
      refresh()
    } else {
      const data = await res.json().catch(() => null)
      alert(data?.error ?? 'Failed to add match')
    }
  }

  const started = !!activity.tournament_started_at

  // Shared props passed to every MatchRowView render.
  const matchRowProps = {
    players,
    meId: activity.current_user_id,
    isHost: activity.is_creator,
    trackScores,
    isDoubles: doubles,
    onRecord: (matchId: string, winnerId: string | null) => recordResult(matchId, { winner_id: winnerId }),
    onRecordScore: (matchId: string, a: number, b: number) => recordResult(matchId, { score_a: a, score_b: b }),
    onDelete: deleteMatch,
  }

  // ── Pre-start view (host only — non-hosts can't see the tab yet) ─────────
  if (!started) {
    return (
      <div className="px-4 pt-4 space-y-4 animate-enter">
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="text-[14px] font-bold text-amber-900">Tournament not started</p>
          <p className="text-[12px] text-amber-800/80 mt-1 leading-snug">
            {activity.tournament_format !== 'round_robin'
              ? 'You\u2019ll add each match manually once started.'
              : partnerRotation
                ? `Round 1 generates fresh random partners and opponents from your ${confirmed.length} confirmed player${confirmed.length === 1 ? '' : 's'}. Tap "Start Round N" after each round to reshuffle.`
                : doubles
                  ? `Pairs up ${confirmed.length} players into ${Math.floor(confirmed.length / 2)} fixed teams, then plays a round-robin between teams.`
                  : `Generates ${roundRobinMatchCount(confirmed.length)} matches across ${roundRobinRoundCount(confirmed.length)} rounds from your ${confirmed.length} confirmed player${confirmed.length === 1 ? '' : 's'}.`}
          </p>
          {activity.is_creator && (
            <>
              <button
                onClick={startTournament}
                disabled={starting || confirmed.length < 2}
                className="w-full mt-3 py-3 rounded-xl bg-primary text-white text-[14px] font-bold disabled:opacity-60 active:opacity-80 transition-opacity"
              >
                {starting ? 'Starting...' : 'Start Tournament'}
              </button>
              {confirmed.length < 2 && (
                <p className="text-[11px] text-amber-800/70 text-center mt-1.5">Need at least 2 confirmed players.</p>
              )}
            </>
          )}
        </div>

        {/* Pre-start settings (host only) — these are the same toggles that
            normally live in the Settings sub-tab. Above Players so they stay
            reachable without scrolling past a long roster. */}
        {activity.is_creator && (
          <div className="bg-background border border-border/50 rounded-xl divide-y divide-border/40 overflow-hidden">
            <div className="px-4 py-2 bg-surface/50">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Settings</p>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground">Track scores</p>
                <p className="text-[11px] text-muted mt-0.5">Enter the score on each match; winner is set automatically.</p>
              </div>
              <ToggleSwitch checked={trackScores} onChange={(v) => updateSetting('tournament_track_scores', v)} />
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground">Doubles</p>
                <p className="text-[11px] text-muted mt-0.5">Each match is 2v2.</p>
              </div>
              <ToggleSwitch checked={doubles} onChange={(v) => updateSetting('tournament_doubles', v)} />
            </div>
            {doubles && (
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-foreground">Rotate partners</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {partnerRotation
                      ? 'Each round picks new partners and opponents at random. Rounds are open-ended.'
                      : 'Partners are fixed for the whole tournament.'}
                  </p>
                </div>
                <ToggleSwitch checked={partnerRotation} onChange={(v) => updateSetting('tournament_partner_rotation', v)} />
              </div>
            )}
          </div>
        )}

        {/* Roster — capped at a max height with an inner scroller so very
            long rosters don't push the Start button off-screen. */}
        <div className="bg-background border border-border/50 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-surface/50">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Players ({confirmed.length})</p>
          </div>
          {confirmed.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted">No confirmed players yet.</div>
          ) : (
            <div className="max-h-[40dvh] overflow-y-auto divide-y divide-border/40">
              {confirmed.map((m) => (
                <div key={m.user_id} className="px-4 py-3 flex items-center gap-3">
                  <Avatar player={m.user} />
                  <p className="text-[14px] font-semibold text-foreground">
                    {m.user ? `${m.user.first_name} ${m.user.last_name}` : 'Unknown'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── In-progress view ────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-4 space-y-4 animate-enter pb-6">
      {/* Round header — only for round_robin. Assigned doesn't bucket by round. */}
      {activity.tournament_format === 'round_robin' && maxRound > 0 && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
              Round {currentRound}{partnerRotation ? '' : ` of ${maxRound}`}
            </p>
            <p className="text-[12px] text-muted mt-0.5">
              {currentRoundDone ? 'All matches recorded.' : `${matches.filter((m) => m.round_number === currentRound && m.status === 'pending').length} matches still pending.`}
            </p>
          </div>
          {canAdvance && (
            <button
              onClick={advanceRound}
              disabled={advancing}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-[12px] font-bold active:opacity-80 disabled:opacity-60"
            >
              {advancing ? '...' : `Start Round ${currentRound + 1}`}
            </button>
          )}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-border/50">
        {([
          { key: 'my', label: 'My Match', show: true },
          { key: 'teams', label: 'Teams', show: doubles && !partnerRotation },
          { key: 'bracket', label: 'Bracket', show: true },
          { key: 'leaderboard', label: 'Leaderboard', show: true },
          { key: 'settings', label: 'Settings', show: activity.is_creator },
        ] as const).filter((opt) => opt.show).map((opt) => {
          const active = subTab === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => setSubTab(opt.key)}
              className={`flex-1 h-9 rounded-lg text-[12px] font-bold transition-colors ${
                active ? 'bg-background shadow-sm text-foreground' : 'text-muted'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* My Match */}
      {subTab === 'my' && (
        myAllMatches.length === 0 ? (
          <EmptyCard text="You’re not in any matches yet." />
        ) : (
          <div className="space-y-3">
            {myCurrentRoundMatch ? (
              <div className="bg-background border border-border/50 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-primary/5 border-b border-primary/10">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                    {activity.tournament_format === 'round_robin' ? `Round ${currentRound} — active` : 'Your current match'}
                  </p>
                </div>
                <MatchRowView match={myCurrentRoundMatch} {...matchRowProps} />
              </div>
            ) : (
              <EmptyCard text={activity.tournament_format === 'round_robin' ? 'You sit this round out.' : 'No match for you right now.'} />
            )}

            {myAllMatches.length > (myCurrentRoundMatch ? 1 : 0) && (
              <div className="bg-background border border-border/50 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-surface/50">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted">All your matches</p>
                </div>
                <div className="divide-y divide-border/40">
                  {myAllMatches.map((m) => (
                    <MatchRowView
                      key={m.id}
                      match={m}
                      {...matchRowProps}
                      hiddenForRound={!activity.is_creator && m.round_number > currentRound}
                      isActive={m.round_number === currentRound}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Bracket */}
      {subTab === 'bracket' && (
        <div className="bg-background border border-border/50 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-surface/50 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Matches</p>
            {activity.is_creator && activity.tournament_format === 'assigned' && (
              <button
                onClick={() => setShowAddMatch(true)}
                className="text-[12px] font-semibold text-primary"
              >
                + Add
              </button>
            )}
          </div>
          {loading && matches.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted">Loading...</div>
          ) : visibleMatches.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted">
              {activity.tournament_format === 'assigned' ? 'No matches yet. Tap + Add to create one.' : 'No matches revealed yet.'}
            </div>
          ) : (
            Array.from(groupByRound(visibleMatches).entries()).map(([round, list]) => {
              const isOpen = activity.tournament_format !== 'round_robin' || openRounds.has(round)
              const isActive = round === currentRound
              const doneCount = list.filter((m) => m.status !== 'pending').length
              return (
                <div key={round}>
                  {activity.tournament_format === 'round_robin' && (
                    <button
                      type="button"
                      onClick={() => setOpenRounds((prev) => {
                        const next = new Set(prev)
                        if (next.has(round)) next.delete(round)
                        else next.add(round)
                        return next
                      })}
                      className={`w-full px-4 py-2 border-t border-border/40 flex items-center justify-between active:bg-surface/50 transition-colors ${isActive ? 'bg-primary/5' : 'bg-surface/30'}`}
                    >
                      <p className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-primary' : 'text-muted'}`}>
                        Round {round}{isActive ? ' — active' : ''}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-muted tabular-nums">{doneCount}/{list.length}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </button>
                  )}
                  {isOpen && (
                    <div className="divide-y divide-border/40">
                      {list.map((m) => (
                        <MatchRowView
                          key={m.id}
                          match={m}
                          {...matchRowProps}
                          hiddenForRound={!activity.is_creator && m.round_number > currentRound}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Leaderboard */}
      {subTab === 'leaderboard' && (
        <div className="bg-background border border-border/50 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-surface/50">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Standings</p>
          </div>
          <div className="divide-y divide-border/40">
            {standings.map((row, i) => {
              const p = players.get(row.player_id)
              return (
                <div key={row.player_id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-[12px] font-bold text-muted w-5 tabular-nums">{i + 1}</span>
                  <Avatar player={p ?? null} />
                  <p className="flex-1 text-[14px] font-semibold text-foreground truncate">
                    {p ? `${p.first_name} ${p.last_name}` : 'Unknown'}
                  </p>
                  <div className="text-[12px] text-muted tabular-nums">
                    <span className="font-bold text-foreground">{row.wins}</span>W &middot; <span className="font-bold text-foreground">{row.losses}</span>L
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Teams (doubles, non-rotation) */}
      {subTab === 'teams' && (
        <div className="space-y-3">
          {activity.is_creator && (
            <div className="space-y-2">
              <p className="text-[12px] text-muted">
                {swapPick ? 'Tap another player\u2019s swap icon to switch them.' : 'Use the swap icon to switch two players, or auto-arrange below.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={addEmptyTeam}
                  disabled={teamsBusy}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-primary bg-primary/10 px-3 py-2 rounded-lg active:opacity-80 disabled:opacity-60"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Team
                </button>
                <button
                  onClick={() => teamsAction('skill_match')}
                  disabled={teamsBusy}
                  className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold text-white bg-primary px-3 py-2 rounded-lg active:opacity-80 disabled:opacity-60"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M3 12h18M3 18h18" /><circle cx="8" cy="6" r="2" fill="currentColor" /><circle cx="16" cy="12" r="2" fill="currentColor" /><circle cx="9" cy="18" r="2" fill="currentColor" />
                  </svg>
                  {teamsBusy ? '…' : 'Skill Match'}
                </button>
                <button
                  onClick={() => teamsAction('reroll')}
                  disabled={teamsBusy}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-primary bg-primary/10 px-3 py-2 rounded-lg active:opacity-80 disabled:opacity-60"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                  </svg>
                  {teamsBusy ? '…' : 'Reroll'}
                </button>
              </div>
            </div>
          )}

          {teams.length === 0 ? (
            <EmptyCard text="Teams will appear once the doubles tournament starts." />
          ) : (
            <div className="space-y-2.5">
              {teams.map((team, ti) => {
                const teamStrength = team.reduce((sum, pid) => sum + (pid ? (ratings[pid]?.effective ?? 3.5) : 0), 0)
                const filledCount = team.filter((pid) => pid != null).length
                return (
                <div key={ti} className="bg-background border border-border/50 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-surface/50 flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Team {ti + 1}</p>
                    {filledCount === 2 && Object.keys(ratings).length > 0 && (
                      <span className="text-[10px] font-semibold text-muted tabular-nums">{teamStrength.toFixed(1)} str</span>
                    )}
                  </div>
                  <div className="divide-y divide-border/40">
                    {team.map((pid, si) => {
                      // Open slot.
                      if (pid == null) {
                        return (
                          <button
                            key={`open-${si}`}
                            type="button"
                            disabled={!activity.is_creator || teamsBusy}
                            onClick={() => { setFillSlot({ ti, si }); setFillPhone(''); setFillFirst(''); setFillLast('') }}
                            className={`w-full px-4 py-3 flex items-center gap-3 text-left ${activity.is_creator ? 'active:bg-surface' : 'cursor-default'}`}
                          >
                            <div className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 text-muted">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </div>
                            <p className="flex-1 text-[14px] font-semibold text-muted">
                              {activity.is_creator ? 'Add player' : 'Open slot'}
                            </p>
                          </button>
                        )
                      }
                      const p = players.get(pid)
                      const picked = swapPick === pid
                      const swapActive = swapPick !== null
                      const r = ratings[pid]
                      return (
                        <div
                          key={pid}
                          className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${picked ? 'bg-primary/5' : ''}`}
                        >
                          <Avatar player={p ?? null} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-foreground truncate">
                              {p ? `${p.first_name} ${p.last_name}` : 'Removed player'}
                            </p>
                            {r && (
                              <p className="text-[11px] text-muted">
                                {r.pickleball_rating != null
                                  ? `DUPR ${r.pickleball_rating.toFixed(2)}`
                                  : 'No DUPR'}
                                {(r.group_wins + r.group_losses) > 0 && (
                                  <span> · {r.group_wins}-{r.group_losses} in group</span>
                                )}
                              </p>
                            )}
                          </div>
                          {activity.is_creator && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handlePlayerTap(pid)}
                                disabled={teamsBusy}
                                aria-label={picked ? 'Cancel swap' : 'Swap this player'}
                                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                                  picked
                                    ? 'bg-primary text-white'
                                    : swapActive
                                      ? 'bg-primary/10 text-primary'
                                      : 'bg-surface text-muted active:bg-primary/10'
                                }`}
                              >
                                {picked ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                  </svg>
                                ) : swapActive ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M7 10l-3 3 3 3" /><path d="M4 13h13" /><path d="M17 14l3-3-3-3" /><path d="M20 11H7" />
                                  </svg>
                                )}
                              </button>
                              {!swapActive && (
                                <button
                                  type="button"
                                  onClick={() => removePlayer(pid)}
                                  disabled={teamsBusy}
                                  aria-label="Remove from tournament"
                                  className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface text-muted active:bg-danger/10 active:text-danger transition-colors disabled:opacity-50"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Settings (host only) */}
      {subTab === 'settings' && activity.is_creator && (
        <div className="space-y-3">
          <div className="bg-background border border-border/50 rounded-xl divide-y divide-border/40 overflow-hidden">
            {/* Track scores */}
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground">Track scores</p>
                <p className="text-[11px] text-muted mt-0.5">Enter the score on each match; winner is set automatically.</p>
              </div>
              <ToggleSwitch checked={trackScores} onChange={(v) => updateSetting('tournament_track_scores', v)} />
            </div>

            {/* Doubles */}
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground">Doubles</p>
                <p className="text-[11px] text-muted mt-0.5">Each match is 2v2.</p>
              </div>
              <ToggleSwitch
                checked={doubles}
                onChange={(v) => updateSetting('tournament_doubles', v)}
                disabled={started}
              />
            </div>

            {/* Rotate partners (only meaningful with doubles) */}
            {doubles && (
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-foreground">Rotate partners</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {partnerRotation
                      ? 'Each round picks new partners and opponents at random. Rounds are open-ended — keep going as long as you want.'
                      : 'Partners are fixed for the whole tournament. Each pair plays every other pair.'}
                  </p>
                </div>
                <ToggleSwitch
                  checked={partnerRotation}
                  onChange={(v) => updateSetting('tournament_partner_rotation', v)}
                  disabled={started}
                />
              </div>
            )}
          </div>

          {started && (
            <p className="text-[11px] text-muted px-1">
              Doubles + partner rotation are locked while the tournament is in progress.
            </p>
          )}
        </div>
      )}

      {/* Fill-slot sheet — add a player to an open team slot */}
      {fillSlot && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40" onClick={() => !fillBusy && setFillSlot(null)}>
          <div className="bg-background rounded-t-2xl p-6 pb-[env(safe-area-inset-bottom)] w-full max-w-lg shadow-2xl max-h-[85dvh] overflow-y-auto animate-enter" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-border rounded-full" /></div>
            <h3 className="text-[16px] font-bold text-foreground text-center mb-1">Add a player</h3>
            <p className="text-[12px] text-muted text-center mb-5">They&apos;ll be confirmed and placed on Team {fillSlot.ti + 1}.</p>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">Phone</label>
              <input
                type="text"
                inputMode="tel"
                value={fillPhone}
                onChange={(e) => setFillPhone(e.target.value)}
                placeholder="(555) 123-4567"
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 box-border"
              />
            </div>
            <div className="flex gap-3 mb-5">
              <div className="flex-1 min-w-0">
                <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">First name</label>
                <input type="text" value={fillFirst} onChange={(e) => setFillFirst(e.target.value)} placeholder="First" className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 box-border" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">Last name</label>
                <input type="text" value={fillLast} onChange={(e) => setFillLast(e.target.value)} placeholder="Last" className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-[14px] text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 box-border" />
              </div>
            </div>
            <button
              onClick={submitFillSlot}
              disabled={fillBusy || fillPhone.replace(/\D/g, '').length !== 10 || !fillFirst.trim()}
              className="btn-primary w-full py-3 text-[14px] disabled:opacity-50"
            >
              {fillBusy ? 'Adding…' : 'Add to Team'}
            </button>
          </div>
        </div>
      )}

      {/* Add-match modal (assigned format, host only) */}
      {showAddMatch && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40" onClick={() => !addingMatch && setShowAddMatch(false)}>
          <div className="bg-background rounded-t-2xl p-6 pb-[env(safe-area-inset-bottom)] w-full max-w-lg shadow-2xl animate-enter" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-border rounded-full" /></div>
            <h3 className="text-[16px] font-bold text-foreground text-center mb-5">New Match</h3>
            <PlayerPicker label="Player A" value={newA} excludeId={newB} confirmed={confirmed} onChange={setNewA} />
            <div className="h-3" />
            <PlayerPicker label="Player B" value={newB} excludeId={newA} confirmed={confirmed} onChange={setNewB} />
            <button
              onClick={addMatch}
              disabled={addingMatch || !newA || !newB}
              className="w-full mt-5 py-3 rounded-xl bg-primary text-white text-[14px] font-bold disabled:opacity-60"
            >
              {addingMatch ? 'Adding...' : 'Add Match'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-[46px] h-[28px] rounded-full transition-colors duration-200 flex-shrink-0 ${disabled ? 'opacity-40' : ''} ${checked ? 'bg-primary' : 'bg-[#d5d9e2]'}`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-[18px]' : ''}`}
      />
    </button>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="bg-background border border-border/50 rounded-xl px-4 py-6 text-center text-[13px] text-muted">
      {text}
    </div>
  )
}

function MatchRowView({
  match,
  players,
  meId,
  isHost,
  trackScores,
  isDoubles,
  onRecord,
  onRecordScore,
  onDelete,
  hiddenForRound,
  isActive,
}: {
  match: Match
  players: Map<string, Player>
  meId: string
  isHost: boolean
  trackScores: boolean
  isDoubles: boolean
  onRecord: (matchId: string, winnerId: string | null) => void
  onRecordScore: (matchId: string, scoreA: number, scoreB: number) => void
  onDelete: (matchId: string) => void
  hiddenForRound?: boolean
  isActive?: boolean
}) {
  const a = players.get(match.player_a_id)
  const b = players.get(match.player_b_id)
  const c = match.player_c_id ? players.get(match.player_c_id) ?? null : null
  const d = match.player_d_id ? players.get(match.player_d_id) ?? null : null

  const aName = (p: Player | null | undefined) => p?.first_name ?? 'Unknown'
  const teamALabel = isDoubles ? `${aName(a)} + ${aName(c)}` : aName(a)
  const teamBLabel = isDoubles ? `${aName(b)} + ${aName(d)}` : aName(b)

  const sideAIds = [match.player_a_id, ...(match.player_c_id ? [match.player_c_id] : [])]
  const sideBIds = [match.player_b_id, ...(match.player_d_id ? [match.player_d_id] : [])]
  const iAmA = sideAIds.includes(meId)
  const iAmB = sideBIds.includes(meId)

  const completed = match.status === 'completed' && match.winner_id
  const aWon = !!completed && sideAIds.includes(match.winner_id!)
  const bWon = !!completed && sideBIds.includes(match.winner_id!)
  const canRecord = (iAmA || iAmB || isHost) && match.status === 'pending' && !hiddenForRound

  if (hiddenForRound) {
    return (
      <div className="px-4 py-3 text-[13px] text-muted/60 italic">
        {teamALabel} vs {teamBLabel} — revealed when host starts this round
      </div>
    )
  }

  // When the recorder isn't a singles participant, we use the two team-name
  // buttons as the whole row — no separate "vs" name line. The buttons
  // themselves carry the matchup. Score entry and singles-as-player still get
  // the traditional name line + right-side controls.
  const buttonsOnlyLayout = canRecord && !trackScores && !(!isDoubles && (iAmA || iAmB))

  if (buttonsOnlyLayout) {
    return (
      <div className="px-4 py-3 space-y-2">
        {isActive && (
          <span className="inline-block text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-white font-bold uppercase tracking-wide">Active</span>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onRecord(match.id, match.player_a_id)}
            className="flex-1 px-3 py-2 rounded-lg bg-surface text-foreground text-[13px] font-semibold border border-border/50 active:opacity-80 truncate"
          >
            {teamALabel} won
          </button>
          <button
            onClick={() => onRecord(match.id, match.player_b_id)}
            className="flex-1 px-3 py-2 rounded-lg bg-surface text-foreground text-[13px] font-semibold border border-border/50 active:opacity-80 truncate"
          >
            {teamBLabel} won
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {completed ? (
              <p className="text-[14px] font-semibold flex items-center gap-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className={aWon ? 'text-[#00C853]' : 'text-foreground/60'}>{teamALabel}</span>
                  <span className={`text-[10px] px-1.5 rounded font-bold ${aWon ? 'bg-[#00C853]/10 text-[#00C853]' : 'bg-red-500/10 text-red-500'}`}>
                    {aWon ? 'W' : 'L'}
                  </span>
                </span>
                {match.score_a != null && match.score_b != null ? (
                  <span className="text-[14px] font-semibold tabular-nums text-muted">{match.score_a} – {match.score_b}</span>
                ) : (
                  <span className="text-muted">·</span>
                )}
                <span className="flex items-center gap-1">
                  <span className={bWon ? 'text-[#00C853]' : 'text-foreground/60'}>{teamBLabel}</span>
                  <span className={`text-[10px] px-1.5 rounded font-bold ${bWon ? 'bg-[#00C853]/10 text-[#00C853]' : 'bg-red-500/10 text-red-500'}`}>
                    {bWon ? 'W' : 'L'}
                  </span>
                </span>
              </p>
            ) : (
              <p className="text-[14px] font-semibold text-foreground">
                {teamALabel} <span className="text-muted">vs</span> {teamBLabel}
              </p>
            )}
            {isActive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-white font-bold uppercase tracking-wide flex-shrink-0">Active</span>
            )}
          </div>

          {/* Score entry form lives inline below the name line. */}
          {canRecord && trackScores && (
            <ScoreEntry matchId={match.id} onSubmit={onRecordScore} />
          )}
        </div>

        {/* Singles where the recorder is one of the two players keeps the
         *  personal "I won / I lost" right-side controls. All other pending
         *  cases use the buttons-only layout above. */}
        {canRecord && !trackScores ? (
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={() => onRecord(match.id, iAmA ? match.player_a_id : match.player_b_id)}
              className="px-3 py-1.5 rounded-lg bg-[#00C853]/10 text-[#00C853] text-[12px] font-bold border border-[#00C853]/30 active:opacity-80"
            >
              I won
            </button>
            <button
              onClick={() => onRecord(match.id, iAmA ? match.player_b_id : match.player_a_id)}
              className="px-3 py-1.5 rounded-lg bg-surface text-muted text-[12px] font-bold border border-border/50 active:opacity-80"
            >
              I lost
            </button>
          </div>
        ) : completed ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            {(iAmA || iAmB || isHost) && (
              <button
                onClick={() => onRecord(match.id, null)}
                className="text-[11px] font-semibold text-muted active:text-primary"
              >
                Undo
              </button>
            )}
            {isHost && (
              <button
                onClick={() => onDelete(match.id)}
                className="text-[11px] font-semibold text-danger active:opacity-70"
              >
                Delete
              </button>
            )}
          </div>
        ) : !canRecord && isHost ? (
          <button
            onClick={() => onDelete(match.id)}
            className="text-[11px] font-semibold text-danger active:opacity-70 flex-shrink-0"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  )
}

function ScoreEntry({ matchId, onSubmit }: { matchId: string; onSubmit: (matchId: string, a: number, b: number) => void }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const nA = parseInt(a, 10)
  const nB = parseInt(b, 10)
  const valid = Number.isFinite(nA) && Number.isFinite(nB) && nA !== nB && nA >= 0 && nB >= 0
  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={a}
        onChange={(e) => setA(e.target.value)}
        placeholder="—"
        className="w-14 h-9 px-2 rounded-lg border border-border bg-background text-[14px] text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="text-muted text-[12px]">–</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={b}
        onChange={(e) => setB(e.target.value)}
        placeholder="—"
        className="w-14 h-9 px-2 rounded-lg border border-border bg-background text-[14px] text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        onClick={() => valid && onSubmit(matchId, nA, nB)}
        disabled={!valid}
        className="px-3 h-9 rounded-lg bg-primary text-white text-[12px] font-bold disabled:opacity-40"
      >
        Save
      </button>
    </div>
  )
}

function PlayerPicker({
  label,
  value,
  excludeId,
  confirmed,
  onChange,
}: {
  label: string
  value: string
  excludeId: string
  confirmed: ConfirmedMember[]
  onChange: (id: string) => void
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1.5">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-3 rounded-xl border border-border bg-background text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      >
        <option value="">Pick a player</option>
        {confirmed
          .filter((m) => m.user_id !== excludeId && m.user)
          .map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.user!.first_name} {m.user!.last_name}
            </option>
          ))}
      </select>
    </div>
  )
}

function Avatar({ player }: { player: Player | null }) {
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
      {player?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-[12px] font-bold text-primary">
          {(player?.first_name || '?')[0]?.toUpperCase()}
        </span>
      )}
    </div>
  )
}

function groupByRound(matches: Match[]): Map<number, Match[]> {
  const map = new Map<number, Match[]>()
  for (const m of matches) {
    const list = map.get(m.round_number) ?? []
    list.push(m)
    map.set(m.round_number, list)
  }
  return new Map([...map.entries()].sort(([a], [b]) => a - b))
}

function roundRobinMatchCount(n: number): number {
  if (n < 2) return 0
  return (n * (n - 1)) / 2
}

function roundRobinRoundCount(n: number): number {
  if (n < 2) return 0
  return n % 2 === 0 ? n - 1 : n
}
