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
    .select('creator_id, tournament_mode, tournament_started_at, tournament_current_round')
    .eq('id', id)
    .single()
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  if (activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (!activity.tournament_mode || !activity.tournament_started_at) {
    return NextResponse.json({ error: 'Tournament not started' }, { status: 400 })
  }

  // Cap advancement at the highest round_number we have matches for. Going past
  // that is a no-op (effectively "tournament finished" — UI handles that case).
  const { data: maxRow } = await admin
    .from('whozin_match')
    .select('round_number')
    .eq('activity_id', id)
    .order('round_number', { ascending: false })
    .limit(1)
    .single()

  const maxRound = maxRow?.round_number ?? activity.tournament_current_round ?? 1
  const nextRound = Math.min((activity.tournament_current_round ?? 0) + 1, maxRound)

  await admin
    .from('whozin_activity')
    .update({ tournament_current_round: nextRound })
    .eq('id', id)

  return NextResponse.json({ tournament_current_round: nextRound })
}
