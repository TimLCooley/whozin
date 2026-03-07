import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET single activity detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .select('*')
    .eq('id', id)
    .single()

  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })

  // Get members with user info
  const { data: members } = await admin
    .from('whozin_activity_member')
    .select('*')
    .eq('activity_id', id)
    .order('priority_order', { ascending: true })

  const memberUserIds = (members ?? []).map((m) => m.user_id)
  const { data: memberUsers } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name, avatar_url')
    .in('id', memberUserIds)

  const userMap = new Map((memberUsers ?? []).map((u) => [u.id, u]))

  const membersWithInfo = (members ?? []).map((m) => ({
    ...m,
    user: userMap.get(m.user_id) ?? null,
  }))

  // Get group name
  const { data: group } = await admin
    .from('whozin_groups')
    .select('name')
    .eq('id', activity.group_id)
    .single()

  // Get creator info
  const { data: creator } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name')
    .eq('id', activity.creator_id)
    .single()

  // My membership status
  const myMember = (members ?? []).find((m) => m.user_id === whozinUser.id)

  return NextResponse.json({
    ...activity,
    group_name: group?.name ?? 'Unknown',
    creator_name: creator ? `${creator.first_name} ${creator.last_name}` : 'Unknown',
    is_creator: activity.creator_id === whozinUser.id,
    current_user_id: whozinUser.id,
    my_status: myMember?.status ?? null,
    members: membersWithInfo,
    confirmed_count: (members ?? []).filter((m) => m.status === 'confirmed').length,
  })
}

// PUT respond to activity (in/out)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await req.json()
  const { response } = body // 'in' or 'out'

  if (!['in', 'out'].includes(response)) {
    return NextResponse.json({ error: 'Invalid response' }, { status: 400 })
  }

  const newStatus = response === 'in' ? 'confirmed' : 'out'

  const { error } = await admin
    .from('whozin_activity_member')
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq('activity_id', id)
    .eq('user_id', whozinUser.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update capacity_current count
  const { data: confirmedMembers } = await admin
    .from('whozin_activity_member')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', id)
    .eq('status', 'confirmed')

  const confirmedCount = confirmedMembers ?? 0

  await admin
    .from('whozin_activity')
    .update({ capacity_current: typeof confirmedCount === 'number' ? confirmedCount : 0 })
    .eq('id', id)

  return NextResponse.json({ status: newStatus })
}
