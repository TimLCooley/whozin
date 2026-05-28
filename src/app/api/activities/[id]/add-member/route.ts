import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/auth'
import { processActivityInvites } from '@/lib/invite-processor'
import { hasReachablePush } from '@/lib/push'
import { createAlert } from '@/lib/alerts'
import { renderTemplate } from '@/lib/notification-templates'

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

  // Verify they're the creator OR a confirmed member of an open-invite activity
  const { data: activity } = await admin
    .from('whozin_activity')
    .select('creator_id, group_id, status, priority_invite, max_capacity, open_invite, activity_name, activity_date, activity_time, image_url, response_timer_minutes, tournament_mode, tournament_format')
    .eq('id', id)
    .single()

  if (!activity) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const isCreator = activity.creator_id === whozinUser.id
  let isConfirmedAttendee = false
  if (!isCreator && activity.open_invite) {
    const { data: myMember } = await admin
      .from('whozin_activity_member')
      .select('status')
      .eq('activity_id', id)
      .eq('user_id', whozinUser.id)
      .single()
    isConfirmedAttendee = myMember?.status === 'confirmed'
  }

  if (!isCreator && !isConfirmedAttendee) {
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

  // All-at-once activities (priority_invite = false) skip the On Deck queue:
  // a newly-added member should be invited immediately like everyone else
  // already was. Priority-invite activities still go through On Deck and the
  // queue processor handles the rest.
  const allAtOnce = !activity.priority_invite && activity.status === 'open'
  const initialStatus: 'tbd' | 'waiting' = allAtOnce ? 'waiting' : 'tbd'

  await admin.from('whozin_activity_member').insert({
    activity_id: id,
    user_id: targetUserId,
    status: initialStatus,
    priority_order: nextOrder,
  })

  // Optionally add to the group permanently (host only)
  if (add_to_group && activity.group_id && isCreator) {
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

  // All-at-once: send the new member the same Fill SMS the original
  // batch got, attributed to the host.
  if (allAtOnce) {
    const [{ data: host }, { data: invitee }, { count: confirmedCount }] = await Promise.all([
      admin.from('whozin_users').select('first_name').eq('id', activity.creator_id).single(),
      admin.from('whozin_users').select('phone, country_code').eq('id', targetUserId).single(),
      admin
        .from('whozin_activity_member')
        .select('id', { count: 'exact', head: true })
        .eq('activity_id', id)
        .eq('status', 'confirmed'),
    ])

    let dateTimeStr = ''
    if (activity.activity_date) {
      const d = new Date(activity.activity_date + 'T00:00:00')
      dateTimeStr = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
      if (activity.activity_time) {
        const [h, m] = activity.activity_time.split(':')
        const hour = parseInt(h)
        const ampm = hour >= 12 ? 'pm' : 'am'
        const h12 = hour % 12 || 12
        dateTimeStr += ` at ${h12}:${m} ${ampm}`
      }
    }

    const spotsNeeded = activity.max_capacity
      ? Math.max(activity.max_capacity - (confirmedCount ?? 0), 1)
      : 1

    if (invitee?.phone) {
      const phone = invitee.phone.startsWith('+') ? invitee.phone : `+${invitee.country_code}${invitee.phone}`
      const spotsText = spotsNeeded === 1 ? '1 spot' : `${spotsNeeded} spots`
      const reachableViaPush = await hasReachablePush(targetUserId)

      // Push first (if reachable); only fall back to Fill SMS if no push
      if (reachableViaPush) {
        const { title: pushTitle, body: pushBody } = await renderTemplate('fill_invite', 'push', {
          activity_name: activity.activity_name,
          spots_text: spotsText,
          inviter_name: host?.first_name ?? 'Someone',
          date_time: dateTimeStr || 'TBD',
        })
        createAlert({
          user_id: targetUserId,
          type: 'activity_invite',
          title: pushTitle ?? `${activity.activity_name}: ${spotsText}!`,
          body: pushBody,
          link: `/app/activities/${id}`,
        }).catch(() => {})
      }

      let smsSid: string | null = null
      if (!reachableViaPush) {
        const { sendFillInvite } = await import('@/lib/sms')
        const result = await sendFillInvite(
          phone,
          host?.first_name ?? 'Someone',
          activity.activity_name,
          dateTimeStr || 'TBD',
          spotsNeeded,
          activity.image_url || undefined,
          activity.tournament_mode ? activity.tournament_format : null,
        )
        if (result.success) smsSid = result.sid ?? null
      }
      const responseTimerMs = (activity.response_timer_minutes ?? 5) * 60 * 1000
      await admin.from('whozin_invite').insert({
        activity_id: id,
        user_id: targetUserId,
        batch_number: 1,
        status: 'pending',
        sms_sid: smsSid,
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + responseTimerMs).toISOString(),
      })
    }
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
