import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// POST — host marks an On Deck member as confirmed
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // Verify they're the creator
  const { data: activity } = await admin
    .from('whozin_activity')
    .select('creator_id')
    .eq('id', id)
    .single()

  if (!activity || activity.creator_id !== whozinUser.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { user_id: targetUserId } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })

  // Allow confirming any non-confirmed member (host override)
  const { data: member } = await admin
    .from('whozin_activity_member')
    .select('id, status')
    .eq('activity_id', id)
    .eq('user_id', targetUserId)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.status === 'confirmed') return NextResponse.json({ error: 'Already confirmed' }, { status: 400 })

  await admin
    .from('whozin_activity_member')
    .update({ status: 'confirmed', responded_at: new Date().toISOString() })
    .eq('id', member.id)

  // Update capacity count
  const { count } = await admin
    .from('whozin_activity_member')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', id)
    .eq('status', 'confirmed')

  await admin
    .from('whozin_activity')
    .update({ capacity_current: count ?? 0 })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
