import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createAlert } from '@/lib/alerts'

// POST — the current host hands off to another confirmed member. Body:
//   { new_host_id, leaving?: boolean, spot_handling?: 'defer'|'auto'|'open_invite' }
// "Host" is just activity.creator_id, so reassigning it moves every host power
// at once. If the old host is also leaving, their spot is freed and handled per
// spot_handling (waitlist is always drained first — that's what it's for).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name')
    .eq('auth_user_id', user.id)
    .single()
  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: activity } = await admin
    .from('whozin_activity')
    .select('id, creator_id, status, max_capacity, waitlist_enabled, auto_emergency_fill, activity_name')
    .eq('id', id)
    .single()
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  if (activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Only the host can transfer hosting' }, { status: 403 })
  }

  const { new_host_id, leaving = false, spot_handling = 'defer' } = await req.json()
  if (!new_host_id) return NextResponse.json({ error: 'new_host_id is required' }, { status: 400 })
  if (new_host_id === whozinUser.id) {
    return NextResponse.json({ error: 'You are already the host' }, { status: 400 })
  }

  // The new host must be a confirmed (In) member — you can't hand off to
  // someone who isn't even attending.
  const { data: target } = await admin
    .from('whozin_activity_member')
    .select('status')
    .eq('activity_id', id)
    .eq('user_id', new_host_id)
    .single()
  if (target?.status !== 'confirmed') {
    return NextResponse.json({ error: 'The new host must be marked In first' }, { status: 400 })
  }

  // ── Reassign hosting ──────────────────────────────────────────────────────
  await admin.from('whozin_activity').update({ creator_id: new_host_id }).eq('id', id)
  // Keep the "host is first" ordering convention.
  await admin
    .from('whozin_activity_member')
    .update({ priority_order: 0 })
    .eq('activity_id', id)
    .eq('user_id', new_host_id)

  const oldHostName = `${whozinUser.first_name ?? ''} ${whozinUser.last_name ?? ''}`.trim() || 'The previous host'

  await createAlert({
    user_id: new_host_id,
    type: 'activity_invite',
    title: `You're now hosting ${activity.activity_name}`,
    body: `${oldHostName} made you the host. You can invite people, manage the roster, and edit settings.`,
    link: `/app/activities/${id}`,
  }).catch(() => {})

  // ── Old host leaving (optional) ───────────────────────────────────────────
  if (leaving) {
    const wasFull = activity.status === 'full'

    await admin
      .from('whozin_activity_member')
      .update({ status: 'out', responded_at: new Date().toISOString() })
      .eq('activity_id', id)
      .eq('user_id', whozinUser.id)

    // Recompute capacity/status now that the old host is out.
    const { count: confirmedCount } = await admin
      .from('whozin_activity_member')
      .select('id', { count: 'exact', head: true })
      .eq('activity_id', id)
      .eq('status', 'confirmed')
    const confirmed = confirmedCount ?? 0
    let full = activity.max_capacity ? confirmed >= activity.max_capacity : false
    await admin
      .from('whozin_activity')
      .update({ capacity_current: confirmed, status: full ? 'full' : 'open' })
      .eq('id', id)

    // Always drain the wait list first — those people opted in to wait.
    if (!full && activity.waitlist_enabled) {
      const { promoteFromWaitlist } = await import('@/lib/waitlist')
      while (await promoteFromWaitlist(id)) {
        const { data: refreshed } = await admin
          .from('whozin_activity')
          .select('status')
          .eq('id', id)
          .single()
        if (refreshed?.status === 'full') { full = true; break }
      }
    }

    // Still a spot open → do what the leaving host chose.
    if (!full) {
      if (spot_handling === 'open_invite') {
        await admin.from('whozin_activity').update({ open_invite: true }).eq('id', id)
      } else if (spot_handling === 'auto') {
        // Fill it now, mirroring the normal drop-out flow: auto-blast if that's
        // the setting, else advance the invite queue and notify the new host.
        if (wasFull && activity.auto_emergency_fill) {
          const { sendEmergencyFill } = await import('@/lib/emergency-fill')
          await sendEmergencyFill(id)
        } else {
          const { processActivityInvites } = await import('@/lib/invite-processor')
          await processActivityInvites(id)
          const { notifyHostOfDropout } = await import('@/lib/emergency-fill')
          await notifyHostOfDropout(id, oldHostName) // reads creator_id → new host
        }
      } else {
        // 'defer' — let the new host decide. Just flag the open spot to them.
        await createAlert({
          user_id: new_host_id,
          type: 'activity_invite',
          title: `${activity.activity_name}: a spot just opened`,
          body: `${oldHostName} stepped out. You're hosting now — invite whoever you like, or turn on Open Invite.`,
          link: `/app/activities/${id}`,
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ success: true })
}
