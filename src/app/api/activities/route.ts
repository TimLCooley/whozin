import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createAlert, alertGroupMembers } from '@/lib/alerts'

// GET activities for the current user (upcoming + past)
export async function GET(req: NextRequest) {
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

  const tab = req.nextUrl.searchParams.get('tab') ?? 'upcoming'

  // Get activities where user is a member OR creator
  const { data: memberActivities } = await admin
    .from('whozin_activity_member')
    .select('activity_id')
    .eq('user_id', whozinUser.id)

  const { data: createdActivities } = await admin
    .from('whozin_activity')
    .select('id')
    .eq('creator_id', whozinUser.id)

  const activityIds = new Set([
    ...(memberActivities ?? []).map((m) => m.activity_id),
    ...(createdActivities ?? []).map((a) => a.id),
  ])

  if (activityIds.size === 0) return NextResponse.json([])

  let query = admin
    .from('whozin_activity')
    .select('*, whozin_activity_member(count)')
    .in('id', Array.from(activityIds))

  if (tab === 'upcoming') {
    query = query.in('status', ['open', 'full']).order('activity_date', { ascending: true, nullsFirst: false })
  } else {
    query = query.in('status', ['past', 'cancelled']).order('activity_date', { ascending: false })
  }

  const { data: activities } = await query

  // Get user's response status for each activity
  const { data: myStatuses } = await admin
    .from('whozin_activity_member')
    .select('activity_id, status')
    .eq('user_id', whozinUser.id)
    .in('activity_id', Array.from(activityIds))

  const statusMap = new Map((myStatuses ?? []).map((s) => [s.activity_id, s.status]))

  // Get creator names
  const creatorIds = [...new Set((activities ?? []).map((a) => a.creator_id))]
  const { data: creators } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name')
    .in('id', creatorIds)

  const creatorMap = new Map((creators ?? []).map((c) => [c.id, c]))

  // Get group names
  const groupIds = [...new Set((activities ?? []).map((a) => a.group_id))]
  const { data: groups } = await admin
    .from('whozin_groups')
    .select('id, name')
    .in('id', groupIds)

  const groupMap = new Map((groups ?? []).map((g) => [g.id, g]))

  const result = (activities ?? []).map((a) => {
    const creator = creatorMap.get(a.creator_id)
    const group = groupMap.get(a.group_id)
    return {
      id: a.id,
      activity_type: a.activity_type,
      activity_name: a.activity_name,
      activity_date: a.activity_date,
      activity_time: a.activity_time,
      location: a.location,
      cost: a.cost,
      cost_type: a.cost_type ?? 'free',
      max_capacity: a.max_capacity,
      member_count: a.whozin_activity_member?.[0]?.count ?? 0,
      status: a.status,
      chat_enabled: a.chat_enabled,
      image_url: a.image_url,
      note: a.note,
      creator_id: a.creator_id,
      is_creator: a.creator_id === whozinUser.id,
      my_status: statusMap.get(a.id) ?? null,
      creator_name: creator ? `${creator.first_name} ${creator.last_name}` : 'Unknown',
      group_name: group?.name ?? 'Unknown',
      group_id: a.group_id,
      created_at: a.created_at,
    }
  })

  return NextResponse.json(result)
}

// POST create a new activity
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()

  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id, membership_tier, first_name')
    .eq('auth_user_id', user.id)
    .single()

  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const {
    group_id,
    activity_type,
    activity_name,
    activity_date,
    activity_time,
    location,
    note,
    cost_type,
    cost,
    max_capacity,
    response_timer_minutes,
    priority_invite,
    chat_enabled,
    reminder_enabled,
    image_url,
  } = body

  if (!group_id) return NextResponse.json({ error: 'Group is required' }, { status: 400 })
  if (!activity_name?.trim()) return NextResponse.json({ error: 'Activity name is required' }, { status: 400 })

  const isPro = whozinUser.membership_tier === 'pro'

  // Validate Pro features
  const finalChatEnabled = isPro ? (chat_enabled ?? false) : false
  const finalReminderEnabled = isPro ? (reminder_enabled ?? false) : false
  const finalMaxCapacity = max_capacity === 'all' ? null : (max_capacity ?? null)
  const finalResponseTimer = isPro
    ? (response_timer_minutes ?? 5)
    : 5

  // Create the activity
  const { data: activity, error } = await admin
    .from('whozin_activity')
    .insert({
      creator_id: whozinUser.id,
      group_id,
      activity_type: activity_type ?? 'other',
      activity_name: activity_name.trim(),
      activity_date: activity_date || null,
      activity_time: activity_time || null,
      location: location?.trim() || null,
      note: note?.trim() || null,
      cost_type: cost_type ?? 'free',
      cost: cost_type !== 'free' ? (cost ?? null) : null,
      max_capacity: finalMaxCapacity,
      response_timer_minutes: finalResponseTimer,
      priority_invite: priority_invite ?? true,
      chat_enabled: finalChatEnabled,
      reminder_enabled: finalReminderEnabled,
      image_url: image_url || null,
      status: 'open',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add creator as a confirmed member
  await admin.from('whozin_activity_member').insert({
    activity_id: activity.id,
    user_id: whozinUser.id,
    status: 'confirmed',
    priority_order: 0,
  })

  // Get group members to add them as activity members
  const { data: groupMembers } = await admin
    .from('whozin_group_members')
    .select('user_id, priority_order')
    .eq('group_id', group_id)
    .neq('user_id', whozinUser.id)
    .order('priority_order', { ascending: true })

  if (groupMembers && groupMembers.length > 0) {
    // Add all group members as activity members with 'tbd' status
    const memberInserts = groupMembers.map((m) => ({
      activity_id: activity.id,
      user_id: m.user_id,
      status: 'tbd' as const,
      priority_order: m.priority_order,
    }))

    await admin.from('whozin_activity_member').insert(memberInserts)

    // Get group name for alert
    const { data: group } = await admin
      .from('whozin_groups')
      .select('name')
      .eq('id', group_id)
      .single()

    // Alert all group members about the new activity
    await alertGroupMembers(group_id, whozinUser.id, {
      type: 'activity_invite',
      title: `New activity: ${activity_name.trim()}`,
      body: `${whozinUser.first_name} created "${activity_name.trim()}" in ${group?.name ?? 'your group'}`,
      link: `/app/activities/${activity.id}`,
    })
  }

  return NextResponse.json(activity)
}
