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
    .select('id, activity_id, player_a_id, player_b_id, status')
    .eq('id', matchId)
    .single()
  if (!match || match.activity_id !== id) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  const isHost = activity.creator_id === whozinUser.id
  const isPlayer = whozinUser.id === match.player_a_id || whozinUser.id === match.player_b_id
  if (!isHost && !isPlayer) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await req.json()
  const winner: unknown = body.winner_id
  if (winner !== null && winner !== match.player_a_id && winner !== match.player_b_id) {
    return NextResponse.json({ error: 'winner_id must be one of the match players or null' }, { status: 400 })
  }

  const update = winner === null
    ? { winner_id: null, status: 'pending' as const, recorded_by: null, recorded_at: null }
    : { winner_id: winner as string, status: 'completed' as const, recorded_by: whozinUser.id, recorded_at: new Date().toISOString() }

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
