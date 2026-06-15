import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { generateRoundRobin, generateRotatingRoundDoubles, formTeams, shuffleArray } from '@/lib/tournament'
import { rebuildDoublesFromTeams } from '@/lib/tournament-server'

// POST — start the tournament. Host only. For round_robin: generates every
// pairing from the current confirmed roster. For assigned: just marks the
// tournament as started so players can see the Mode tab and the host can
// begin adding matches manually.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()

  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id, membership_tier')
    .eq('auth_user_id', user.id)
    .single()
  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (whozinUser.membership_tier !== 'pro') {
    return NextResponse.json({ error: 'Tournament mode requires Pro' }, { status: 402 })
  }

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('creator_id, tournament_mode, tournament_format, tournament_started_at, tournament_doubles, tournament_partner_rotation')
    .eq('id', id)
    .single()

  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  if (activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (!activity.tournament_mode || !activity.tournament_format) {
    return NextResponse.json({ error: 'Tournament mode is not enabled on this activity' }, { status: 400 })
  }
  if (activity.tournament_started_at) {
    return NextResponse.json({ error: 'Tournament already started' }, { status: 409 })
  }

  const { data: confirmed } = await admin
    .from('whozin_activity_member')
    .select('user_id')
    .eq('activity_id', id)
    .eq('status', 'confirmed')

  const playerIds = (confirmed ?? []).map((m) => m.user_id)
  if (playerIds.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 confirmed players to start a tournament' }, { status: 400 })
  }

  if (activity.tournament_format === 'round_robin') {
    if (activity.tournament_doubles && activity.tournament_partner_rotation) {
      // Rotating partners: only generate round 1. Each Advance produces a
      // fresh round with new pairings.
      if (playerIds.length < 4) {
        return NextResponse.json({
          error: 'Rotating doubles needs at least 4 confirmed players',
        }, { status: 400 })
      }
      const round1 = generateRotatingRoundDoubles(playerIds, 1)
      if (round1.length > 0) {
        await admin.from('whozin_match').insert(
          round1.map((p) => ({
            activity_id: id,
            round_number: p.round_number,
            player_a_id: p.player_a_id,
            player_b_id: p.player_b_id,
            player_c_id: p.player_c_id,
            player_d_id: p.player_d_id,
          })),
        )
      }
    } else if (activity.tournament_doubles) {
      // Fixed-partner doubles needs an even player count.
      if (playerIds.length < 4 || playerIds.length % 2 === 1) {
        return NextResponse.json({
          error: 'Doubles needs an even number of confirmed players (at least 4)',
        }, { status: 400 })
      }
      // Form random teams, persist them, and generate the round-robin from
      // them. The host can later rearrange/reroll on the Teams tab.
      const teams = formTeams(shuffleArray(playerIds))
      await rebuildDoublesFromTeams(id, teams)
    } else {
      const pairings = generateRoundRobin(playerIds)
      if (pairings.length > 0) {
        await admin.from('whozin_match').insert(
          pairings.map((p) => ({
            activity_id: id,
            round_number: p.round_number,
            player_a_id: p.player_a_id,
            player_b_id: p.player_b_id,
          })),
        )
      }
    }
  }
  // Assigned format: matches are added later via POST /matches.

  await admin
    .from('whozin_activity')
    .update({
      tournament_started_at: new Date().toISOString(),
      tournament_current_round: 1,
    })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
