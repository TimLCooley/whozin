import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name, phone, email, status, membership_tier, created_at, auth_user_id, push_token, push_platform, push_notifications_enabled')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Count activities created per user. Paginate so the tally can't be silently
  // capped at the default 1000 rows.
  const eventsByCreator = new Map<string, number>()
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data: batch } = await admin
      .from('whozin_activity')
      .select('creator_id')
      .range(from, from + pageSize - 1)
    if (!batch || batch.length === 0) break
    for (const a of batch) {
      if (a.creator_id) eventsByCreator.set(a.creator_id, (eventsByCreator.get(a.creator_id) ?? 0) + 1)
    }
    if (batch.length < pageSize) break
  }

  const withCounts = (data ?? []).map((u) => ({
    ...u,
    events_created: eventsByCreator.get(u.id) ?? 0,
  }))

  return NextResponse.json(withCounts)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id } = body
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const allowed = ['first_name', 'last_name', 'membership_tier'] as const
  const updates: Record<string, unknown> = {}
  for (const field of allowed) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { error } = await admin
    .from('whozin_users')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { id, auth_user_id } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Delete the whozin_users row (cascades to memberships, messages, etc.)
  const { error } = await admin.from('whozin_users').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If they had a Supabase auth account, delete that too
  if (auth_user_id) {
    await admin.auth.admin.deleteUser(auth_user_id)
  }

  return NextResponse.json({ success: true })
}
