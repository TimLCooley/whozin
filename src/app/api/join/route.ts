import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/auth'
import { sendSmsInvite } from '@/lib/sms'
import { createAlert, alertGroupMembers } from '@/lib/alerts'

// POST — unauthenticated join via QR code
// Allows a non-app user to enter their phone number and get added
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { phone, country_code, inviter_id, group_id } = body

  if (!phone || !inviter_id) {
    return NextResponse.json({ error: 'Phone and inviter_id are required' }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(phone, country_code || '1')

  // Basic phone validation
  const digits = normalizedPhone.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) {
    return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Verify inviter exists
  const { data: inviter } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name')
    .eq('id', inviter_id)
    .single()

  if (!inviter) {
    return NextResponse.json({ error: 'Inviter not found' }, { status: 404 })
  }

  // Find or create the user by phone
  let targetUserId: string

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
        first_name: '',
        last_name: '',
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

  // Prevent self-join
  if (targetUserId === inviter.id) {
    return NextResponse.json({ error: "That's the inviter's number" }, { status: 400 })
  }

  const inviterName = `${inviter.first_name} ${inviter.last_name}`.trim() || 'Someone'

  // If group_id provided, add to group
  if (group_id) {
    // Verify group exists
    const { data: group } = await admin
      .from('whozin_groups')
      .select('id, name')
      .eq('id', group_id)
      .single()

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Check if already a member
    const { data: existing } = await admin
      .from('whozin_group_members')
      .select('id')
      .eq('group_id', group_id)
      .eq('user_id', targetUserId)
      .single()

    if (!existing) {
      // Get next priority order
      const { data: members } = await admin
        .from('whozin_group_members')
        .select('priority_order')
        .eq('group_id', group_id)
        .order('priority_order', { ascending: false })
        .limit(1)

      const nextOrder = (members?.[0]?.priority_order ?? 0) + 1

      await admin.from('whozin_group_members').insert({
        group_id: group_id,
        user_id: targetUserId,
        priority_order: nextOrder,
      })

      // Alert the new member
      await createAlert({
        user_id: targetUserId,
        type: 'group_invite',
        title: `Added to ${group.name}`,
        body: `You joined "${group.name}" via QR code.`,
        link: `/app/groups/${group_id}`,
      })

      // Alert existing group members
      await alertGroupMembers(group_id, targetUserId, {
        type: 'member_joined',
        title: `New member in ${group.name}`,
        body: `A new member joined "${group.name}".`,
        link: `/app/groups/${group_id}`,
      })
    }
  }

  // Auto-add as friends (both directions)
  await Promise.all([
    admin.from('whozin_friends').upsert(
      { user_id: inviter.id, friend_id: targetUserId },
      { onConflict: 'user_id,friend_id' }
    ),
    admin.from('whozin_friends').upsert(
      { user_id: targetUserId, friend_id: inviter.id },
      { onConflict: 'user_id,friend_id' }
    ),
  ])

  // Send SMS invite to download the app
  if (!existingUser) {
    await sendSmsInvite(normalizedPhone, inviterName)
  }

  return NextResponse.json({ success: true })
}
