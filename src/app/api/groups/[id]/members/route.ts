import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/auth'
import { sendSmsInvite } from '@/lib/sms'
import { createAlert, alertGroupMembers } from '@/lib/alerts'

// POST add member to group
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()

  // Get the inviter's whozin_user record
  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name')
    .eq('auth_user_id', user.id)
    .single()

  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const { phone, country_code, first_name, last_name, user_id } = body

  let targetUserId = user_id

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

      // Send SMS invite (test numbers with area code 999 route to admin phone)
      const inviterName = `${whozinUser.first_name} ${whozinUser.last_name}`.trim() || 'Someone'
      await sendSmsInvite(normalizedPhone, inviterName)
    }
  }

  // Check if already a member
  const { data: existing } = await admin
    .from('whozin_group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', targetUserId)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already a member of this group' }, { status: 409 })
  }

  // Get next priority order
  const { data: members } = await admin
    .from('whozin_group_members')
    .select('priority_order')
    .eq('group_id', groupId)
    .order('priority_order', { ascending: false })
    .limit(1)

  const nextOrder = (members?.[0]?.priority_order ?? 0) + 1

  const { error } = await admin.from('whozin_group_members').insert({
    group_id: groupId,
    user_id: targetUserId,
    priority_order: nextOrder,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get group name and new member name for alerts
  const { data: groupData } = await admin.from('whozin_groups').select('name').eq('id', groupId).single()
  const { data: targetUser } = await admin.from('whozin_users').select('first_name, last_name').eq('id', targetUserId).single()
  const groupName = groupData?.name || 'a group'
  const inviterName = `${whozinUser.first_name} ${whozinUser.last_name}`.trim() || 'Someone'
  const targetName = targetUser ? `${targetUser.first_name} ${targetUser.last_name}`.trim() : 'Someone'

  // Alert the new member they were added to the group
  await createAlert({
    user_id: targetUserId,
    type: 'group_invite',
    title: `Added to ${groupName}`,
    body: `${inviterName} added you to the group "${groupName}".`,
    link: `/app/groups/${groupId}`,
  })

  // Alert existing group members that someone joined
  await alertGroupMembers(groupId, whozinUser.id, {
    type: 'member_joined',
    title: `New member in ${groupName}`,
    body: `${targetName} was added to "${groupName}".`,
    link: `/app/groups/${groupId}`,
  })

  // Auto-add to friends pool (both directions)
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

  return NextResponse.json({ success: true, user_id: targetUserId })
}

// PUT reorder members
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const body = await req.json()
  const { order } = body as { order: { membership_id: string; priority_order: number }[] }

  const updates = order.map((item) =>
    admin
      .from('whozin_group_members')
      .update({ priority_order: item.priority_order })
      .eq('id', item.membership_id)
      .eq('group_id', groupId)
  )

  await Promise.all(updates)

  return NextResponse.json({ success: true })
}

// DELETE remove member
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const { searchParams } = new URL(req.url)
  const membershipId = searchParams.get('membership_id')

  if (!membershipId) {
    return NextResponse.json({ error: 'membership_id is required' }, { status: 400 })
  }

  const { error } = await admin
    .from('whozin_group_members')
    .delete()
    .eq('id', membershipId)
    .eq('group_id', groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
