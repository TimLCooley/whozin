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
  is_creator: boolean
  current_user_id: string
  tournament_mode: boolean
  tournament_format: 'assigned' | 'round_robin' | null
  tournament_started_at: string | null
}

interface Match {
  id: string
  round_number: number
  player_a_id: string
  player_b_id: string
  winner_id: string | null
  status: 'pending' | 'completed' | 'forfeit'
  recorded_by: string | null
  recorded_at: string | null
}

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
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [newA, setNewA] = useState('')
  const [newB, setNewB] = useState('')
  const [addingMatch, setAddingMatch] = useState(false)

  const players = useMemo(() => {
    const map = new Map<string, Player>()
    for (const m of confirmed) {
      if (m.user) map.set(m.user_id, m.user)
    }
    return map
  }, [confirmed])

  const playerIds = useMemo(() => confirmed.map((m) => m.user_id), [confirmed])

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/activities/${activity.id}/tournament/matches`)
    if (res.ok) {
      const data = await res.json()
      setMatches(data.matches ?? [])
    }
    setLoading(false)
  }, [activity.id])

  useEffect(() => { refresh() }, [refresh])

  const standings = useMemo(() => {
    const rows = matches as MatchRow[]
    return computeStandings(rows, playerIds)
  }, [matches, playerIds])

  const myMatches = useMemo(() => {
    return matches.filter((m) => m.player_a_id === activity.current_user_id || m.player_b_id === activity.current_user_id)
  }, [matches, activity.current_user_id])

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

  async function recordResult(matchId: string, winnerId: string | null) {
    // Optimistic update
    setMatches((prev) => prev.map((m) =>
      m.id === matchId
        ? { ...m, winner_id: winnerId, status: winnerId ? 'completed' : 'pending' }
        : m
    ))
    const res = await fetch(`/api/activities/${activity.id}/tournament/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner_id: winnerId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      alert(data?.error ?? 'Failed to record result')
      refresh()
    }
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

  // ── Pre-start view (host only — non-hosts can't see the tab yet) ─────────
  if (!started) {
    return (
      <div className="px-4 pt-4 space-y-4 animate-enter">
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="text-[14px] font-bold text-amber-900">Tournament not started</p>
          <p className="text-[12px] text-amber-800/80 mt-1 leading-snug">
            {activity.tournament_format === 'round_robin'
              ? `Generates ${roundRobinMatchCount(confirmed.length)} matches from your ${confirmed.length} confirmed player${confirmed.length === 1 ? '' : 's'}.`
              : 'You\u2019ll add each match manually once started.'}
          </p>
        </div>

        <div className="bg-background border border-border/50 rounded-xl divide-y divide-border/40 overflow-hidden">
          <div className="px-4 py-2 bg-surface/50">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Players ({confirmed.length})</p>
          </div>
          {confirmed.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted">No confirmed players yet.</div>
          ) : (
            confirmed.map((m) => (
              <div key={m.user_id} className="px-4 py-3 flex items-center gap-3">
                <Avatar player={m.user} />
                <p className="text-[14px] font-semibold text-foreground">
                  {m.user ? `${m.user.first_name} ${m.user.last_name}` : 'Unknown'}
                </p>
              </div>
            ))
          )}
        </div>

        <button
          onClick={startTournament}
          disabled={starting || confirmed.length < 2}
          className="w-full py-3 rounded-xl bg-primary text-white text-[14px] font-bold disabled:opacity-60 active:opacity-80 transition-opacity"
        >
          {starting ? 'Starting...' : 'Start Tournament'}
        </button>
        {confirmed.length < 2 && (
          <p className="text-[12px] text-muted text-center">Need at least 2 confirmed players.</p>
        )}
      </div>
    )
  }

  // ── In-progress view ────────────────────────────────────────────────────
  const matchesByRound = groupByRound(matches)

  return (
    <div className="px-4 pt-4 space-y-5 animate-enter pb-6">
      {/* Standings */}
      <div className="bg-background border border-border/50 rounded-xl overflow-hidden">
        <div className="px-4 py-2 bg-surface/50 flex items-center justify-between">
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

      {/* My matches */}
      {myMatches.length > 0 && (
        <div className="bg-background border border-border/50 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-surface/50">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Your matches</p>
          </div>
          <div className="divide-y divide-border/40">
            {myMatches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                players={players}
                meId={activity.current_user_id}
                isHost={activity.is_creator}
                onRecord={recordResult}
                onDelete={deleteMatch}
              />
            ))}
          </div>
        </div>
      )}

      {/* All matches */}
      <div className="bg-background border border-border/50 rounded-xl overflow-hidden">
        <div className="px-4 py-2 bg-surface/50 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            All matches ({matches.length})
          </p>
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
        ) : matches.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-muted">
            {activity.tournament_format === 'assigned' ? 'No matches yet. Tap + Add to create one.' : 'No matches.'}
          </div>
        ) : (
          Array.from(matchesByRound.entries()).map(([round, list]) => (
            <div key={round}>
              {activity.tournament_format === 'round_robin' && (
                <div className="px-4 py-1.5 bg-surface/30 border-t border-border/40">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Round {round}</p>
                </div>
              )}
              <div className="divide-y divide-border/40">
                {list.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    players={players}
                    meId={activity.current_user_id}
                    isHost={activity.is_creator}
                    onRecord={recordResult}
                    onDelete={deleteMatch}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

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

function MatchRow({
  match,
  players,
  meId,
  isHost,
  onRecord,
  onDelete,
}: {
  match: Match
  players: Map<string, Player>
  meId: string
  isHost: boolean
  onRecord: (matchId: string, winnerId: string | null) => void
  onDelete: (matchId: string) => void
}) {
  const a = players.get(match.player_a_id)
  const b = players.get(match.player_b_id)
  const iAmA = match.player_a_id === meId
  const iAmB = match.player_b_id === meId
  const canRecord = (iAmA || iAmB || isHost) && match.status === 'pending'
  const completed = match.status === 'completed' && match.winner_id
  const winner = completed ? players.get(match.winner_id!) : null
  const winnerLabel = winner ? `${winner.first_name}` : ''
  const aLabel = a ? `${a.first_name}` : 'Unknown'
  const bLabel = b ? `${b.first_name}` : 'Unknown'

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {completed ? (
            <p className="text-[14px] text-foreground">
              <span className="font-bold">{winnerLabel}</span>
              <span className="text-muted"> beat </span>
              <span>{match.winner_id === match.player_a_id ? bLabel : aLabel}</span>
            </p>
          ) : (
            <p className="text-[14px] font-semibold text-foreground truncate">
              {aLabel} <span className="text-muted">vs</span> {bLabel}
            </p>
          )}
        </div>
        {canRecord ? (
          iAmA || iAmB ? (
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => onRecord(match.id, meId)}
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
          ) : (
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => onRecord(match.id, match.player_a_id)}
                className="px-2.5 py-1.5 rounded-lg bg-surface text-foreground text-[11px] font-bold border border-border/50 active:opacity-80"
              >
                {aLabel} won
              </button>
              <button
                onClick={() => onRecord(match.id, match.player_b_id)}
                className="px-2.5 py-1.5 rounded-lg bg-surface text-foreground text-[11px] font-bold border border-border/50 active:opacity-80"
              >
                {bLabel} won
              </button>
            </div>
          )
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
        ) : (
          isHost && (
            <button
              onClick={() => onDelete(match.id)}
              className="text-[11px] font-semibold text-danger active:opacity-70 flex-shrink-0"
            >
              Delete
            </button>
          )
        )}
      </div>
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
