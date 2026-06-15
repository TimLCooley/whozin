import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/auth'
import { rebuildDoublesFromTeams } from '@/lib/tournament-server'
import type { DoublesTeam } from '@/lib/tournament'

// POST — host fills an open team slot with a player. Body:
//   { team_index, slot_index, user_id }                        → existing user
//   { team_index, slot_index, phone, first_name, last_name }   → create/find
// The player is added to the activity as confirmed (host override) and dropped
// into the slot; matches regenerate from the complete teams.
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
    .select('creator_id, tournament_mode, tournament_doubles, tournament_teams, group_id')
    .eq('id', id)
    .single()
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  if (activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (!activity.tournament_mode || !activity.tournament_doubles) {
    return NextResponse.json({ error: 'Not a doubles tournament' }, { status: 400 })
  }

  const { team_index, slot_index, user_id, phone, country_code, first_name, last_name } = await req.json()
  const teams: DoublesTeam[] = Array.isArray(activity.tournament_teams) ? activity.tournament_teams : []
  if (typeof team_index !== 'number' || (slot_index !== 0 && slot_index !== 1) || !teams[team_index]) {
    return NextResponse.json({ error: 'Invalid slot' }, { status: 400 })
  }
  if (teams[team_index][slot_index] != null) {
    return NextResponse.json({ error: 'That slot is already filled' }, { status: 400 })
  }

  // Resolve or create the target user.
  let targetUserId: string | undefined = user_id
  if (!targetUserId) {
    if (!phone) return NextResponse.json({ error: 'Phone or user_id required' }, { status: 400 })
    const normalizedPhone = normalizePhone(phone, country_code || '1')
    const { data: existing } = await admin
      .from('whozin_users')
      .select('id')
      .eq('phone', normalizedPhone)
      .single()
    if (existing) {
      targetUserId = existing.id
    } else {
      const { data: newUser, error: createErr } = await admin
        .from('whozin_users')
        .insert({
          phone: normalizedPhone,
          country_code: country_code || '1',
          first_name: first_name?.trim() || '',
          last_name: last_name?.trim() || '',
          status: 'invited',
          membership_tier: 'free',
        })
        .select('id')
        .single()
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
      targetUserId = newUser.id
    }
  }

  // Can't place someone already on a team.
  for (const t of teams) {
    if (t[0] === targetUserId || t[1] === targetUserId) {
      return NextResponse.json({ error: 'That player is already on a team' }, { status: 409 })
    }
  }

  // Add to the activity as confirmed (host override). Upsert handles the case
  // where they were already a member in some other status.
  await admin
    .from('whozin_activity_member')
    .upsert(
      { activity_id: id, user_id: targetUserId, status: 'confirmed', priority_order: 0 },
      { onConflict: 'activity_id,user_id' },
    )

  // Friends pool (mirror the normal add-member behaviour).
  await Promise.all([
    admin.from('whozin_friends').upsert({ user_id: whozinUser.id, friend_id: targetUserId }, { onConflict: 'user_id,friend_id' }),
    admin.from('whozin_friends').upsert({ user_id: targetUserId, friend_id: whozinUser.id }, { onConflict: 'user_id,friend_id' }),
  ])

  // Drop into the slot and rebuild.
  const next = teams.map((t) => t.slice() as DoublesTeam)
  next[team_index][slot_index] = targetUserId!
  // Filling a slot only adds a newly-complete team's matches; existing games
  // keep their recorded results.
  await rebuildDoublesFromTeams(id, next, { preserveResults: true })

  return NextResponse.json({ teams: next, user_id: targetUserId })
}
