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

  if (roster.size < 4 || roster.size % 2 === 1) {
    return NextResponse.json({ error: 'Doubles needs an even number of confirmed players (at least 4)' }, { status: 400 })
  }

  const body = await req.json()
  let teams: DoublesTeam[]

  if (body.action === 'reroll') {
    teams = formTeams(shuffleArray(Array.from(roster)))
  } else if (body.action === 'skill_match') {
    const ratings = await computePlayerRatings(id, Array.from(roster))
    teams = skillMatchTeams(Array.from(roster), ratings)
  } else if (body.action === 'set') {
    const raw = body.teams
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: 'teams must be an array of pairs' }, { status: 400 })
    }
    // Validate: every entry is a pair of distinct roster players, and every
    // roster player appears exactly once.
    const seen = new Set<string>()
    const parsed: DoublesTeam[] = []
    for (const pair of raw) {
      if (!Array.isArray(pair) || pair.length !== 2) {
        return NextResponse.json({ error: 'Each team must be a pair of players' }, { status: 400 })
      }
      const [a, b] = pair
      if (a === b || !roster.has(a) || !roster.has(b) || seen.has(a) || seen.has(b)) {
        return NextResponse.json({ error: 'Teams must use each confirmed player exactly once' }, { status: 400 })
      }
      seen.add(a); seen.add(b)
      parsed.push([a, b])
    }
    if (seen.size !== roster.size) {
      return NextResponse.json({ error: 'Every confirmed player must be on a team' }, { status: 400 })
    }
    teams = parsed
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  await rebuildDoublesFromTeams(id, teams)
  return NextResponse.json({ teams })
}
