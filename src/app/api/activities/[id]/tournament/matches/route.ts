import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET — list all matches for this activity's tournament plus the standings.
// Anyone confirmed in the activity (or the host) can see them.
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
    .select('creator_id, tournament_mode, tournament_format, tournament_started_at, tournament_current_round, tournament_track_scores, tournament_doubles')
    .eq('id', id)
    .single()
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })

  const isHost = activity.creator_id === whozinUser.id
  const { data: myMember } = await admin
    .from('whozin_activity_member')
    .select('status')
    .eq('activity_id', id)
    .eq('user_id', whozinUser.id)
    .single()
  const isConfirmed = myMember?.status === 'confirmed'
  if (!isHost && !isConfirmed) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { data: matches } = await admin
    .from('whozin_match')
    .select('id, round_number, player_a_id, player_b_id, player_c_id, player_d_id, winner_id, status, score_a, score_b, recorded_by, recorded_at, created_at')
    .eq('activity_id', id)
    .order('round_number', { ascending: true })
    .order('created_at', { ascending: true })

  return NextResponse.json({
    tournament_mode: activity.tournament_mode,
    tournament_format: activity.tournament_format,
    tournament_started_at: activity.tournament_started_at,
    tournament_current_round: activity.tournament_current_round ?? 0,
    tournament_track_scores: activity.tournament_track_scores ?? false,
    tournament_doubles: activity.tournament_doubles ?? false,
    matches: matches ?? [],
  })
}

// POST — add a match. Only used for the 'assigned' format. Host only.
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
    .select('creator_id, tournament_mode, tournament_format')
    .eq('id', id)
    .single()
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  if (activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (!activity.tournament_mode || activity.tournament_format !== 'assigned') {
    return NextResponse.json({ error: 'This activity is not in assigned-tournament mode' }, { status: 400 })
  }

  const { player_a_id, player_b_id, round_number } = await req.json()
  if (!player_a_id || !player_b_id) {
    return NextResponse.json({ error: 'Both players are required' }, { status: 400 })
  }
  if (player_a_id === player_b_id) {
    return NextResponse.json({ error: 'A match needs two different players' }, { status: 400 })
  }

  // Validate both players are confirmed members of this activity.
  const { data: members } = await admin
    .from('whozin_activity_member')
    .select('user_id, status')
    .eq('activity_id', id)
    .in('user_id', [player_a_id, player_b_id])

  const okIds = new Set((members ?? []).filter((m) => m.status === 'confirmed').map((m) => m.user_id))
  if (!okIds.has(player_a_id) || !okIds.has(player_b_id)) {
    return NextResponse.json({ error: 'Both players must be confirmed in this activity' }, { status: 400 })
  }

  const { data: match, error } = await admin
    .from('whozin_match')
    .insert({
      activity_id: id,
      round_number: typeof round_number === 'number' && round_number > 0 ? round_number : 1,
      player_a_id,
      player_b_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(match)
}
