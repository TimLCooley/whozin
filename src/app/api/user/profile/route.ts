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
    .select('id, first_name, last_name, email, phone, avatar_url, membership_tier, push_notifications_enabled, text_notifications_enabled, hide_from_invites, show_phone, show_last_name, push_token, pickleball_rating, golf_handicap')
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
  const fields = ['first_name', 'last_name', 'email', 'push_notifications_enabled', 'text_notifications_enabled', 'hide_from_invites', 'show_phone', 'show_last_name']
  for (const field of fields) {
    if (body[field] !== undefined) allowed[field] = body[field]
  }

  // Sport ratings: clamp to sane ranges, allow null to clear.
  if (body.pickleball_rating !== undefined) {
    const v = body.pickleball_rating
    allowed.pickleball_rating = v === null || v === '' ? null : Math.min(8, Math.max(1, Number(v)))
  }
  if (body.golf_handicap !== undefined) {
    const v = body.golf_handicap
    allowed.golf_handicap = v === null || v === '' ? null : Math.min(54, Math.max(-10, Number(v)))
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
