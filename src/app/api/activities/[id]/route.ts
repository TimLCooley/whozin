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

  // Process any expired invites on every load (replaces slow cron)
  if (activity.priority_invite && activity.status === 'open') {
    const { processActivityInvites } = await import('@/lib/invite-processor')
    await processActivityInvites(id)
  }

  // Re-fetch activity after processing (status/members may have changed)
  const { data: freshActivity } = await admin
    .from('whozin_activity')
    .select('*')
    .eq('id', id)
    .single()

  const activityData = freshActivity ?? activity

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
    ...activityData,
    group_id: activityData.group_id,
    group_name: group?.name ?? 'Unknown',
    creator_name: creator ? `${creator.first_name} ${creator.last_name}` : 'Unknown',
    is_creator: activityData.creator_id === whozinUser.id,
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

  // Check if activity was full BEFORE this response (for emergency fill detection)
  const { data: activityBefore } = await admin
    .from('whozin_activity')
    .select('status, max_capacity, auto_emergency_fill, creator_id')
    .eq('id', id)
    .single()

  const wasFull = activityBefore?.status === 'full'

  // Block non-host users from confirming when activity is full
  if (response === 'in' && wasFull && activityBefore?.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Activity is full' }, { status: 409 })
  }

  const { error } = await admin
    .from('whozin_activity_member')
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq('activity_id', id)
    .eq('user_id', whozinUser.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also mark the invite as responded
  await admin
    .from('whozin_invite')
    .update({ status: 'responded', response: response })
    .eq('activity_id', id)
    .eq('user_id', whozinUser.id)
    .eq('status', 'pending')

  // Update capacity_current count
  const { count: confirmedCount } = await admin
    .from('whozin_activity_member')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', id)
    .eq('status', 'confirmed')

  const confirmed = confirmedCount ?? 0
  const nowFull = activityBefore?.max_capacity ? confirmed >= activityBefore.max_capacity : false

  await admin
    .from('whozin_activity')
    .update({
      capacity_current: confirmed,
      status: nowFull ? 'full' : 'open',
    })
    .eq('id', id)

  // Emergency fill: someone dropped out of a FULL activity
  if (response === 'out' && wasFull && activityBefore) {
    // Get the name of who dropped out
    const { data: dropout } = await admin
      .from('whozin_users')
      .select('first_name, last_name')
      .eq('id', whozinUser.id)
      .single()

    const dropoutName = dropout ? `${dropout.first_name} ${dropout.last_name}` : 'Someone'

    const { sendEmergencyFill, notifyHostOfDropout } = await import('@/lib/emergency-fill')

    if (activityBefore.auto_emergency_fill) {
      // Auto mode: blast everyone immediately
      await sendEmergencyFill(id)
    } else {
      // Manual mode: notify host, they decide
      await notifyHostOfDropout(id, dropoutName)
    }
  } else {
    // Normal flow: advance the invite queue
    const { processActivityInvites } = await import('@/lib/invite-processor')
    await processActivityInvites(id)
  }

  return NextResponse.json({ status: newStatus })
}

// PATCH activity fields (creator only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()

  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id, membership_tier, phone')
    .eq('auth_user_id', user.id)
    .single()

  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: existing } = await admin
    .from('whozin_activity')
    .select('creator_id')
    .eq('id', id)
    .single()

  if (!existing || existing.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await req.json()
  const isPro = whozinUser.membership_tier === 'pro'
  const isTestUser = whozinUser.phone?.includes('999')

  const updates: Record<string, unknown> = {}

  if (body.activity_type !== undefined) updates.activity_type = body.activity_type
  if (body.activity_name !== undefined) {
    if (!body.activity_name?.trim()) {
      return NextResponse.json({ error: 'Activity name is required' }, { status: 400 })
    }
    updates.activity_name = body.activity_name.trim()
  }
  if (body.activity_date !== undefined) updates.activity_date = body.activity_date || null
  if (body.activity_time !== undefined) updates.activity_time = body.activity_time || null
  if (body.duration_hours !== undefined) updates.duration_hours = body.duration_hours ?? null
  if (body.location !== undefined) updates.location = body.location?.trim() || null
  if (body.note !== undefined) updates.note = body.note?.trim() || null
  if (body.cost_type !== undefined) {
    updates.cost_type = body.cost_type
    updates.cost = body.cost_type !== 'free' ? (body.cost ?? null) : null
  } else if (body.cost !== undefined) {
    updates.cost = body.cost
  }
  if (body.max_capacity !== undefined) {
    updates.max_capacity = body.max_capacity === 'all' ? null : body.max_capacity
  }
  if (body.response_timer_minutes !== undefined) {
    updates.response_timer_minutes = body.response_timer_minutes
  }
  if (body.priority_invite !== undefined) updates.priority_invite = body.priority_invite
  if (body.chat_enabled !== undefined) updates.chat_enabled = isPro ? body.chat_enabled : false
  if (body.reminder_enabled !== undefined) updates.reminder_enabled = isPro ? body.reminder_enabled : false
  if (body.image_url !== undefined) updates.image_url = body.image_url || null
  if (body.auto_emergency_fill !== undefined) updates.auto_emergency_fill = body.auto_emergency_fill

  if (Object.keys(updates).length === 0 && !body.stop_current_batch) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await admin
      .from('whozin_activity')
      .update(updates)
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If requested, stop current batch: expire all waiting members and their invites,
  // then process the queue so the next batch goes out with the new timer
  if (body.stop_current_batch) {
    await admin
      .from('whozin_activity_member')
      .update({ status: 'missed' })
      .eq('activity_id', id)
      .eq('status', 'waiting')

    await admin
      .from('whozin_invite')
      .update({ status: 'expired' })
      .eq('activity_id', id)
      .eq('status', 'pending')

    const { processActivityInvites } = await import('@/lib/invite-processor')
    await processActivityInvites(id)
  }

  // Return the normalized field values so the client mirrors what's actually
  // stored (post-trim, post-null-conversion) without needing a re-fetch.
  return NextResponse.json({ success: true, updates })
}

// DELETE activity (creator only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (!activity || activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  await admin.from('whozin_activity').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
