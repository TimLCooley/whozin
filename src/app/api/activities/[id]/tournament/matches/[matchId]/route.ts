import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// PATCH — record / change a match result. Either player in the match can
// record their own outcome; the host can override anyone. The body should
// contain { winner_id } where winner_id is one of player_a_id or
// player_b_id, or null to clear the result.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id, matchId } = await params
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
    .select('creator_id, tournament_mode')
    .eq('id', id)
    .single()
  if (!activity?.tournament_mode) {
    return NextResponse.json({ error: 'Tournament not enabled' }, { status: 400 })
  }

  const { data: match } = await admin
    .from('whozin_match')
    .select('id, activity_id, player_a_id, player_b_id, player_c_id, player_d_id, status')
    .eq('id', matchId)
    .single()
  if (!match || match.activity_id !== id) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  const sideA: string[] = [match.player_a_id, ...(match.player_c_id ? [match.player_c_id] : [])]
  const sideB: string[] = [match.player_b_id, ...(match.player_d_id ? [match.player_d_id] : [])]
  const validWinnerIds = new Set<string>([...sideA, ...sideB])

  const isHost = activity.creator_id === whozinUser.id
  const isPlayer = validWinnerIds.has(whozinUser.id)
  if (!isHost && !isPlayer) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await req.json()
  const winner: unknown = body.winner_id
  const scoreA: unknown = body.score_a
  const scoreB: unknown = body.score_b
  const hasScores = (typeof scoreA === 'number' && Number.isFinite(scoreA)) ||
                    (typeof scoreB === 'number' && Number.isFinite(scoreB))

  // Decide what to write. Three paths:
  //   1. Clearing: winner_id = null, scores get cleared too
  //   2. Scores provided: derive winner from higher score (tie rejected)
  //   3. Just a winner: trust the caller's pick
  let update: Record<string, unknown>
  if (winner === null && !hasScores) {
    update = { winner_id: null, status: 'pending', score_a: null, score_b: null, recorded_by: null, recorded_at: null }
  } else if (hasScores) {
    const a = typeof scoreA === 'number' ? Math.max(0, Math.floor(scoreA)) : null
    const b = typeof scoreB === 'number' ? Math.max(0, Math.floor(scoreB)) : null
    if (a === null || b === null) {
      return NextResponse.json({ error: 'Both scores required' }, { status: 400 })
    }
    if (a === b) {
      return NextResponse.json({ error: 'Scores can\u2019t be tied' }, { status: 400 })
    }
    // Set winner to the canonical first player on the winning side. Standings
    // logic checks side membership, not exact id, so this is just a marker.
    const winningId = a > b ? match.player_a_id : match.player_b_id
    update = {
      winner_id: winningId,
      score_a: a,
      score_b: b,
      status: 'completed',
      recorded_by: whozinUser.id,
      recorded_at: new Date().toISOString(),
    }
  } else {
    if (winner !== null && !validWinnerIds.has(winner as string)) {
      return NextResponse.json({ error: 'winner_id must be one of the match players or null' }, { status: 400 })
    }
    update = {
      winner_id: winner as string,
      status: 'completed',
      recorded_by: whozinUser.id,
      recorded_at: new Date().toISOString(),
    }
  }

  const { data: updated, error } = await admin
    .from('whozin_match')
    .update(update)
    .eq('id', matchId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(updated)
}

// DELETE — remove a match. Host only. Mostly for the assigned format when
// a host adds the wrong pairing.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id, matchId } = await params
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
  if (!activity || activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { error } = await admin.from('whozin_match').delete().eq('id', matchId).eq('activity_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
