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

  return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const { id, membership_tier } = await req.json()
  if (!id || !membership_tier) {
    return NextResponse.json({ error: 'Missing id or membership_tier' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { error } = await admin
    .from('whozin_users')
    .update({ membership_tier })
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
