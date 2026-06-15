import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { nextFutureDate, type RepeatInterval } from '@/lib/recurring'

// POST — host skips a queued recurring occurrence. Advances the draft's date
// by one interval so this cycle is skipped and the occurrence re-presents
// itself at the next interval (e.g. a weekly event "comes back next week").
// Scoped to drafts: an open occurrence already has invites out, so skipping
// it would strand the people who were invited.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .select('creator_id, status, activity_date, repeat_interval')
    .eq('id', id)
    .single()
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  if (activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Only the host can skip' }, { status: 403 })
  }
  if (activity.status !== 'draft') {
    return NextResponse.json({ error: 'Only a queued (draft) occurrence can be skipped' }, { status: 400 })
  }
  if (activity.repeat_interval === 'none' || !activity.repeat_interval) {
    return NextResponse.json({ error: 'This activity does not repeat' }, { status: 400 })
  }
  if (!activity.activity_date) {
    return NextResponse.json({ error: 'No date to skip' }, { status: 400 })
  }

  const todayUtc = new Date().toISOString().split('T')[0]
  const next = nextFutureDate(activity.activity_date, activity.repeat_interval as RepeatInterval, todayUtc)
  if (!next) return NextResponse.json({ error: 'Could not compute the next date' }, { status: 400 })

  await admin
    .from('whozin_activity')
    .update({ activity_date: next })
    .eq('id', id)

  return NextResponse.json({ success: true, activity_date: next })
}
