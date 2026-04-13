import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/auth'
import { processActivityInvites } from '@/lib/invite-processor'

// POST — host adds a new member to the activity (on deck) and optionally to the group
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()

  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id, first_name')
    .eq('auth_user_id', user.id)
    .single()

  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Verify they're the creator
  const { data: activity } = await admin
    .from('whozin_activity')
    .select('creator_id, group_id, status, priority_invite, max_capacity')
    .eq('id', id)
    .single()

  if (!activity || activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { phone, country_code, first_name, last_name, user_id, add_to_group } = await req.json()

  let targetUserId = user_id

  // Resolve or create user by phone
  if (!targetUserId) {
    if (!phone) {
      return NextResponse.json({ error: 'Phone number or user_id is required' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone, country_code || '1')

    const { data: existingUser } = await admin
      .from('whozin_users')
      .select('id')
      .eq('phone', normalizedPhone)
      .single()

    if (existingUser) {
      targetUserId = existingUser.id
    } else {
      const { data: newUser, error: createError } = await admin
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

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }
      targetUserId = newUser.id
    }
  }

  // Check if already in the activity
  const { data: existingMember } = await admin
    .from('whozin_activity_member')
    .select('id')
    .eq('activity_id', id)
    .eq('user_id', targetUserId)
    .single()

  if (existingMember) {
    return NextResponse.json({ error: 'Already in this activity' }, { status: 409 })
  }

  // Get the highest priority_order to put them at the bottom
  const { data: lastMember } = await admin
    .from('whozin_activity_member')
    .select('priority_order')
    .eq('activity_id', id)
    .order('priority_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (lastMember?.priority_order ?? 0) + 1

  // Add to activity as 'tbd' (on deck)
  await admin.from('whozin_activity_member').insert({
    activity_id: id,
    user_id: targetUserId,
    status: 'tbd',
    priority_order: nextOrder,
  })

  // Optionally add to the group permanently
  if (add_to_group && activity.group_id) {
    const { data: existingGroupMember } = await admin
      .from('whozin_group_members')
      .select('id')
      .eq('group_id', activity.group_id)
      .eq('user_id', targetUserId)
      .single()

    if (!existingGroupMember) {
      const { data: lastGroupMember } = await admin
        .from('whozin_group_members')
        .select('priority_order')
        .eq('group_id', activity.group_id)
        .order('priority_order', { ascending: false })
        .limit(1)
        .single()

      await admin.from('whozin_group_members').insert({
        group_id: activity.group_id,
        user_id: targetUserId,
        priority_order: (lastGroupMember?.priority_order ?? 0) + 1,
      })
    }
  }

  // Auto-add to friends pool
  await Promise.all([
    admin.from('whozin_friends').upsert(
      { user_id: whozinUser.id, friend_id: targetUserId },
      { onConflict: 'user_id,friend_id' }
    ),
    admin.from('whozin_friends').upsert(
      { user_id: targetUserId, friend_id: whozinUser.id },
      { onConflict: 'user_id,friend_id' }
    ),
  ])

  // If the activity is actively running invites, trigger the processor
  // so this new member gets picked up if there are open spots
  if (activity.status === 'open' && activity.priority_invite) {
    await processActivityInvites(id)
  }

  // Get the added user's name for the confirmation
  const { data: addedUser } = await admin
    .from('whozin_users')
    .select('first_name')
    .eq('id', targetUserId)
    .single()

  return NextResponse.json({
    success: true,
    user_id: targetUserId,
    first_name: addedUser?.first_name || first_name || 'Member',
  })
}
