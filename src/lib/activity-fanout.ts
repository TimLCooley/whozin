import { getAdminClient } from '@/lib/supabase/admin'
import { alertGroupMembers } from '@/lib/alerts'
import { sendFillInvite } from '@/lib/sms'
import { hasReachablePush } from '@/lib/push'

/**
 * Add the rest of the group as activity members (tbd/waiting) and either
 * schedule the priority-invite countdown or text everyone immediately.
 *
 * Used by both POST /api/activities (new activity) and POST /api/activities/[id]/approve
 * (recurring draft approval) so the two flows stay in sync.
 *
 * Caller is responsible for having already inserted the creator as a confirmed
 * member. This function only adds the *rest* of the group.
 */
export async function fanOutActivityInvites(activityId: string): Promise<void> {
  const admin = getAdminClient()

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('*')
    .eq('id', activityId)
    .single()

  if (!activity) return

  const { data: creator } = await admin
    .from('whozin_users')
    .select('first_name')
    .eq('id', activity.creator_id)
    .single()

  const creatorFirstName = creator?.first_name ?? 'Someone'

  const { data: groupMembers } = await admin
    .from('whozin_group_members')
    .select('user_id, priority_order')
    .eq('group_id', activity.group_id)
    .neq('user_id', activity.creator_id)
    .order('priority_order', { ascending: true })

  if (!groupMembers || groupMembers.length === 0) return

  // Add all non-creator group members as 'tbd'. Use upsert in case a member
  // row already exists (e.g. re-approving a draft after a prior partial run).
  const memberInserts = groupMembers.map((m) => ({
    activity_id: activityId,
    user_id: m.user_id,
    status: 'tbd' as const,
    priority_order: m.priority_order,
  }))

  await admin
    .from('whozin_activity_member')
    .upsert(memberInserts, { onConflict: 'activity_id,user_id' })

  if (activity.priority_invite) {
    // Build mode: 2-minute countdown before invites go out
    const inviteStartsAt = new Date(Date.now() + 2 * 60 * 1000).toISOString()
    await admin
      .from('whozin_activity')
      .update({ invite_starts_at: inviteStartsAt })
      .eq('id', activityId)
    return
  }

  // All-at-once mode: notify everyone immediately
  const { data: group } = await admin
    .from('whozin_groups')
    .select('name')
    .eq('id', activity.group_id)
    .single()

  await alertGroupMembers(activity.group_id, activity.creator_id, {
    type: 'activity_invite',
    title: `New activity: ${activity.activity_name}`,
    body: `${creatorFirstName} created "${activity.activity_name}" in ${group?.name ?? 'your group'}`,
    link: `/app/activities/${activityId}`,
  })

  const memberUserIds = groupMembers.map((m) => m.user_id)

  await admin
    .from('whozin_activity_member')
    .update({ status: 'waiting' })
    .eq('activity_id', activityId)
    .in('user_id', memberUserIds)

  const { data: memberUsers } = await admin
    .from('whozin_users')
    .select('id, phone, country_code')
    .in('id', memberUserIds)

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

  const spotsNeeded = activity.max_capacity ? activity.max_capacity - 1 : (memberUsers?.length ?? 1)
  const responseTimer = activity.response_timer_minutes ?? 5

  for (const member of (memberUsers ?? [])) {
    const phone = member.phone.startsWith('+') ? member.phone : `+${member.country_code}${member.phone}`
    let smsSid: string | null = null
    if (!(await hasReachablePush(member.id))) {
      const result = await sendFillInvite(
        phone,
        creatorFirstName,
        activity.activity_name,
        dateTimeStr || 'TBD',
        spotsNeeded,
        activity.image_url || undefined,
        activity.tournament_mode ? activity.tournament_format : null,
      )
      if (result.success) smsSid = result.sid ?? null
    }
    await admin.from('whozin_invite').insert({
      activity_id: activityId,
      user_id: member.id,
      batch_number: 1,
      status: 'pending',
      sms_sid: smsSid,
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (responseTimer * 60 * 1000)).toISOString(),
    })
  }
}
