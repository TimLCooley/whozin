import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET current user profile
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name, email, phone, avatar_url, membership_tier, push_notifications_enabled, text_notifications_enabled, hide_from_invites, push_token')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  return NextResponse.json(profile)
}

// PUT update user profile
export async function PUT(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const body = await req.json()

  // Only allow updating specific fields
  const allowed: Record<string, unknown> = {}
  const fields = ['first_name', 'last_name', 'email', 'membership_tier', 'push_notifications_enabled', 'text_notifications_enabled', 'hide_from_invites']
  for (const field of fields) {
    if (body[field] !== undefined) allowed[field] = body[field]
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await admin
    .from('whozin_users')
    .update(allowed)
    .eq('auth_user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
