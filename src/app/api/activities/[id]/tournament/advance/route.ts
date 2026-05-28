import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// POST — host bumps tournament_current_round so the next round of matches
// becomes visible to players. No validation that the prior round is finished;
// the social use case is "we'll come back to those later".
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .select('creator_id, tournament_mode, tournament_format, tournament_started_at, tournament_current_round, tournament_doubles, tournament_partner_rotation')
    .eq('id', id)
    .single()
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  if (activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (!activity.tournament_mode || !activity.tournament_started_at) {
    return NextResponse.json({ error: 'Tournament not started' }, { status: 400 })
  }

  const currentRound = activity.tournament_current_round ?? 0
  const nextRoundNum = currentRound + 1

  // Rotating-partner doubles: generate a fresh round on the fly with new
  // partner + opponent pairings.
  if (activity.tournament_doubles && activity.tournament_partner_rotation && activity.tournament_format === 'round_robin') {
    const { data: confirmed } = await admin
      .from('whozin_activity_member')
      .select('user_id')
      .eq('activity_id', id)
      .eq('status', 'confirmed')

    const playerIds = (confirmed ?? []).map((m) => m.user_id)
    if (playerIds.length < 4) {
      return NextResponse.json({ error: 'Not enough confirmed players to form a round' }, { status: 400 })
    }

    const { generateRotatingRoundDoubles } = await import('@/lib/tournament')
    const pairings = generateRotatingRoundDoubles(playerIds, nextRoundNum)
    if (pairings.length > 0) {
      await admin.from('whozin_match').insert(
        pairings.map((p) => ({
          activity_id: id,
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
      .eq('id', id)

    return NextResponse.json({ tournament_current_round: nextRoundNum })
  }

  // Pre-generated schedule (singles or fixed-partner doubles): cap at the
  // highest round_number we already have.
  const { data: maxRow } = await admin
    .from('whozin_match')
    .select('round_number')
    .eq('activity_id', id)
    .order('round_number', { ascending: false })
    .limit(1)
    .single()

  const maxRound = maxRow?.round_number ?? currentRound ?? 1
  const nextRound = Math.min(currentRound + 1, maxRound)

  await admin
    .from('whozin_activity')
    .update({ tournament_current_round: nextRound })
    .eq('id', id)

  return NextResponse.json({ tournament_current_round: nextRound })
}
