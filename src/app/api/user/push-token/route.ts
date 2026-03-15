import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// POST — save push notification token for current user
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { token, platform } = await req.json()
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { error } = await admin
    .from('whozin_users')
    .update({
      push_token: token.trim(),
      push_platform: platform || 'android',
      push_notifications_enabled: true,
    })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE — remove push token (unregister)
export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  await admin
    .from('whozin_users')
    .update({ push_token: null })
    .eq('id', user.id)

  return NextResponse.json({ success: true })
}
