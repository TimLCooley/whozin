import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

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

  // Recurring sweep: spawn drafts for past repeating activities; clean up
  // stale drafts (event date passed without approval). Scoped to this user
  // so we only do work that affects their view.
  if (tab === 'upcoming') {
    const todayUtcForCleanup = new Date().toISOString().split('T')[0]
    const { cleanupStaleDrafts, spawnNextDraft } = await import('@/lib/recurring')
    await cleanupStaleDrafts(whozinUser.id, todayUtcForCleanup)

    const { data: repeatingPast } = await admin
      .from('whozin_activity')
      .select('id, activity_date, activity_time, duration_hours, timezone')
      .eq('creator_id', whozinUser.id)
      .neq('repeat_interval', 'none')
      .in('status', ['open', 'full', 'past'])
      .not('activity_date', 'is', null)
      .lte('activity_date', todayUtcForCleanup)

    if (repeatingPast && repeatingPast.length > 0) {
      const nowMsForSpawn = Date.now()
      for (const a of repeatingPast) {
        // Only spawn once the activity has actually ended (date + time + duration)
        const time = a.activity_time ?? '23:59:00'
        const duration = a.activity_time ? (a.duration_hours ?? 2) : 0
        const startMs = Date.parse(`${a.activity_date}T${time}Z`)
        if (isNaN(startMs)) continue
        const endMs = startMs + duration * 60 * 60 * 1000
        if (endMs < nowMsForSpawn) {
          await spawnNextDraft(a.id)
        }
      }
    }
  }

  // Get activities where user is a member (already invited) OR creator
  // Exclude 'tbd' — those members haven't been invited yet
  const { data: memberActivities } = await admin
    .from('whozin_activity_member')
    .select('activity_id')
    .eq('user_id', whozinUser.id)
    .neq('status', 'tbd')

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

  const nowMs = Date.now()
  const todayUtc = new Date(nowMs).toISOString().split('T')[0]
  const yesterdayUtc = new Date(nowMs - 86400000).toISOString().split('T')[0]

  if (tab === 'upcoming') {
    // Yesterday-in-UTC catches long-running activities that end today.
    // 'draft' surfaces here for the creator (non-creators have no member row).
    query = query
      .in('status', ['draft', 'open', 'full'])
      .or(`activity_date.gte.${yesterdayUtc},activity_date.is.null`)
      .order('activity_date', { ascending: true, nullsFirst: false })
  } else {
    query = query
      .or(`status.in.(past,cancelled),and(status.in.(open,full),activity_date.lte.${todayUtc})`)
      .order('activity_date', { ascending: false })
  }

  const { data: activities } = await query

  // Precise upcoming/past split based on end timestamp (date + time + duration),
  // interpreted in the activity's stored timezone (set to the creator's local
  // tz when the activity was created). Falls back to UTC if no timezone.
  function localDateTimeToUtcMs(date: string, time: string, tz: string): number {
    const naiveMs = Date.parse(`${date}T${time}Z`)
    if (isNaN(naiveMs)) return NaN
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(naiveMs))
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
    const hour = get('hour') === '24' ? '00' : get('hour')
    const tzAsUtcMs = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}Z`)
    if (isNaN(tzAsUtcMs)) return NaN
    return naiveMs - (tzAsUtcMs - naiveMs)
  }

  function endTimestampMs(a: { activity_date: string | null; activity_time: string | null; duration_hours: number | null; timezone: string | null }): number | null {
    if (!a.activity_date) return null
    const time = a.activity_time ?? '23:59:00'
    const duration = a.activity_time ? (a.duration_hours ?? 2) : 0
    const tz = a.timezone || 'UTC'
    const startMs = localDateTimeToUtcMs(a.activity_date, time, tz)
    if (isNaN(startMs)) return null
    return startMs + duration * 60 * 60 * 1000
  }

  const dateFilteredActivities = (activities ?? []).filter((a) => {
    if (a.status === 'past' || a.status === 'cancelled') return tab === 'past'
    // Drafts always belong to the upcoming tab regardless of timing.
    if (a.status === 'draft') return tab === 'upcoming'
    const endMs = endTimestampMs(a)
    if (endMs === null) return tab === 'upcoming'
    return tab === 'upcoming' ? endMs >= nowMs : endMs < nowMs
  })

  // Get user's response status for each activity
  const { data: myStatuses } = await admin
    .from('whozin_activity_member')
    .select('activity_id, status')
    .eq('user_id', whozinUser.id)
    .in('activity_id', Array.from(activityIds))

  const statusMap = new Map((myStatuses ?? []).map((s) => [s.activity_id, s.status]))

  // 'waiting' and 'missed' users never locked in a spot. Once the activity
  // is full or its date has passed, there's nothing they can do with it — hide
  // the card. Exception: if waitlist is enabled, missed users can still join.
  // Past tab is always hidden for both statuses.
  const visibleActivities = dateFilteredActivities.filter((a) => {
    const myStatus = statusMap.get(a.id)
    if (myStatus !== 'waiting' && myStatus !== 'missed') return true
    if (tab === 'past') return false
    if (a.status === 'full' && !(a.waitlist_enabled && myStatus === 'missed')) return false
    const endMs = endTimestampMs(a)
    if (endMs !== null && endMs < nowMs) return false
    return true
  })

  // Get confirmed counts per activity
  const { data: allMemberStatuses } = await admin
    .from('whozin_activity_member')
    .select('activity_id, status')
    .in('activity_id', Array.from(activityIds))

  const confirmedCountMap = new Map<string, number>()
  for (const m of (allMemberStatuses ?? [])) {
    if (m.status === 'confirmed') {
      confirmedCountMap.set(m.activity_id, (confirmedCountMap.get(m.activity_id) ?? 0) + 1)
    }
  }

  // Get creator names
  const creatorIds = [...new Set(visibleActivities.map((a) => a.creator_id))]
  const { data: creators } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name')
    .in('id', creatorIds)

  const creatorMap = new Map((creators ?? []).map((c) => [c.id, c]))

  // Get group names
  const groupIds = [...new Set(visibleActivities.map((a) => a.group_id))]
  const { data: groups } = await admin
    .from('whozin_groups')
    .select('id, name')
    .in('id', groupIds)

  const groupMap = new Map((groups ?? []).map((g) => [g.id, g]))

  const result = visibleActivities.map((a) => {
    const creator = creatorMap.get(a.creator_id)
    const group = groupMap.get(a.group_id)
    return {
      id: a.id,
      activity_type: a.activity_type,
      activity_name: a.activity_name,
      activity_date: a.activity_date,
      activity_time: a.activity_time,
      duration_hours: a.duration_hours,
      location: a.location,
      address: a.address ?? null,
      cost: a.cost,
      cost_type: a.cost_type ?? 'free',
      max_capacity: a.max_capacity,
      member_count: a.whozin_activity_member?.[0]?.count ?? 0,
      status: a.status,
      chat_enabled: a.chat_enabled,
      reminder_enabled: a.reminder_enabled,
      waitlist_enabled: a.waitlist_enabled ?? false,
      open_invite: a.open_invite ?? false,
      tournament_mode: a.tournament_mode ?? false,
      tournament_format: a.tournament_format ?? null,
      repeat_interval: a.repeat_interval ?? 'none',
      timezone: a.timezone,
      image_url: a.image_url,
      note: a.note,
      creator_id: a.creator_id,
      is_creator: a.creator_id === whozinUser.id,
      my_status: statusMap.get(a.id) ?? null,
      confirmed_count: confirmedCountMap.get(a.id) ?? 0,
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
    .select('id, membership_tier, first_name, phone')
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
    duration_hours,
    location,
    address,
    note,
    cost_type,
    cost,
    max_capacity,
    response_timer_minutes,
    priority_invite,
    invite_batch_size,
    invite_priority_mode,
    chat_enabled,
    reminder_enabled,
    image_url,
    auto_emergency_fill,
    waitlist_enabled,
    open_invite,
    tournament_mode,
    tournament_format,
    tournament_track_scores,
    tournament_doubles,
    repeat_interval,
    timezone,
  } = body

  if (!group_id) return NextResponse.json({ error: 'Group is required' }, { status: 400 })
  if (!activity_name?.trim()) return NextResponse.json({ error: 'Activity name is required' }, { status: 400 })

  const isPro = whozinUser.membership_tier === 'pro'
  const isTestUser = whozinUser.phone?.includes('999')

  // Validate Pro features
  const finalChatEnabled = isPro ? (chat_enabled ?? false) : false
  const finalReminderEnabled = isPro ? (reminder_enabled ?? false) : false
  const finalMaxCapacity = max_capacity === 'all' ? null : (max_capacity ?? null)
  const finalResponseTimer = (isPro || isTestUser)
    ? (response_timer_minutes ?? 5)
    : 5
  const finalInviteBatchSize = isPro ? (invite_batch_size ?? null) : null
  const finalInvitePriorityMode = isPro && invite_priority_mode === 'random' ? 'random' : 'top_down'

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
      duration_hours: activity_time ? (duration_hours ?? 2) : null,
      location: location?.trim() || null,
      address: address?.trim() || null,
      note: note?.trim() || null,
      cost_type: cost_type ?? 'free',
      cost: cost_type !== 'free' ? (cost ?? null) : null,
      max_capacity: finalMaxCapacity,
      response_timer_minutes: finalResponseTimer,
      priority_invite: priority_invite ?? true,
      invite_batch_size: finalInviteBatchSize,
      invite_priority_mode: finalInvitePriorityMode,
      chat_enabled: finalChatEnabled,
      reminder_enabled: finalReminderEnabled,
      image_url: image_url || null,
      auto_emergency_fill: auto_emergency_fill ?? false,
      waitlist_enabled: isPro ? (waitlist_enabled ?? false) : false,
      open_invite: open_invite ?? false,
      tournament_mode: isPro && !!tournament_mode,
      tournament_format: isPro && tournament_mode && (tournament_format === 'assigned' || tournament_format === 'round_robin')
        ? tournament_format
        : null,
      tournament_track_scores: isPro && tournament_mode && !!tournament_track_scores,
      tournament_doubles: isPro && tournament_mode && !!tournament_doubles,
      repeat_interval: isPro && ['weekly', 'biweekly', 'monthly'].includes(repeat_interval) ? repeat_interval : 'none',
      timezone: timezone || null,
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

  const { fanOutActivityInvites } = await import('@/lib/activity-fanout')
  await fanOutActivityInvites(activity.id)

  return NextResponse.json(activity)
}
