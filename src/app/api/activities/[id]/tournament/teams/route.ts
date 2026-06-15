import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { formTeams, shuffleArray, type DoublesTeam } from '@/lib/tournament'
import { rebuildDoublesFromTeams, computePlayerRatings, skillMatchTeams } from '@/lib/tournament-server'

// GET — per-player ratings for the Teams tab (DUPR + group W/L + effective).
// Available to the host and confirmed members.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('creator_id')
    .eq('id', id)
    .single()
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })

  const isHost = activity.creator_id === whozinUser.id
  if (!isHost) {
    const { data: me } = await admin
      .from('whozin_activity_member')
      .select('status')
      .eq('activity_id', id)
      .eq('user_id', whozinUser.id)
      .single()
    if (me?.status !== 'confirmed') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
  }

  const { data: confirmed } = await admin
    .from('whozin_activity_member')
    .select('user_id')
    .eq('activity_id', id)
    .eq('status', 'confirmed')
  const playerIds = (confirmed ?? []).map((m) => m.user_id)

  const ratings = await computePlayerRatings(id, playerIds)
  return NextResponse.json({ ratings: Object.fromEntries(ratings) })
}

// POST — host edits the doubles teams. Body:
//   { action: 'reroll' }                 → re-randomize teams from the roster
//   { action: 'set', teams: [[a,b],...] } → use the provided arrangement
// Either way the round-robin is rebuilt from the new teams (results reset).
// Fixed-partner doubles only — rotating mode reshuffles every round.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('creator_id, tournament_mode, tournament_doubles, tournament_partner_rotation, tournament_started_at')
    .eq('id', id)
    .single()
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  if (activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (!activity.tournament_mode || !activity.tournament_doubles) {
    return NextResponse.json({ error: 'Not a doubles tournament' }, { status: 400 })
  }
  if (activity.tournament_partner_rotation) {
    return NextResponse.json({ error: 'Teams rotate each round in rotating-partner mode' }, { status: 400 })
  }
  if (!activity.tournament_started_at) {
    return NextResponse.json({ error: 'Start the tournament first' }, { status: 400 })
  }

  // Current confirmed roster — teams must be drawn from exactly these players.
  const { data: confirmed } = await admin
    .from('whozin_activity_member')
    .select('user_id')
    .eq('activity_id', id)
    .eq('status', 'confirmed')
  const roster = new Set((confirmed ?? []).map((m) => m.user_id))

  const body = await req.json()
  let teams: DoublesTeam[]
  // reroll / skill_match genuinely change the matchups, so they wipe results.
  // add_team / set only add or shuffle slots — keep results for unchanged games.
  let preserveResults = false

  if (body.action === 'reroll') {
    if (roster.size < 4) {
      return NextResponse.json({ error: 'Doubles needs at least 4 confirmed players' }, { status: 400 })
    }
    teams = formTeams(shuffleArray(Array.from(roster)))
  } else if (body.action === 'skill_match') {
    if (roster.size < 4) {
      return NextResponse.json({ error: 'Doubles needs at least 4 confirmed players' }, { status: 400 })
    }
    const ratings = await computePlayerRatings(id, Array.from(roster))
    teams = skillMatchTeams(Array.from(roster), ratings)
  } else if (body.action === 'add_team') {
    // Append an empty team (two open slots) to the current arrangement.
    const { data: act } = await admin
      .from('whozin_activity')
      .select('tournament_teams')
      .eq('id', id)
      .single()
    const current: DoublesTeam[] = Array.isArray(act?.tournament_teams) ? act!.tournament_teams : []
    teams = [...current, [null, null]]
    preserveResults = true
  } else if (body.action === 'set') {
    const raw = body.teams
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: 'teams must be an array of pairs' }, { status: 400 })
    }
    // Validate: each entry is a pair (slots may be null = open); real players
    // must be on the roster and used at most once.
    const seen = new Set<string>()
    const parsed: DoublesTeam[] = []
    for (const pair of raw) {
      if (!Array.isArray(pair) || pair.length !== 2) {
        return NextResponse.json({ error: 'Each team must have two slots' }, { status: 400 })
      }
      const slot = (v: unknown): string | null => {
        if (v == null) return null
        if (typeof v !== 'string' || !roster.has(v) || seen.has(v)) {
          throw new Error('Teams must use each confirmed player at most once')
        }
        seen.add(v)
        return v
      }
      try {
        const a = slot(pair[0])
        const b = slot(pair[1])
        if (a != null && a === b) {
          return NextResponse.json({ error: 'A team can\u2019t have the same player twice' }, { status: 400 })
        }
        parsed.push([a, b])
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 400 })
      }
    }
    teams = parsed
    preserveResults = true
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  await rebuildDoublesFromTeams(id, teams, { preserveResults })
  return NextResponse.json({ teams })
}
