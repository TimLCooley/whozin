import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// POST — host removes an On Deck member from the activity
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

  // Only allow removing 'tbd' members
  const { data: member } = await admin
    .from('whozin_activity_member')
    .select('id, status')
    .eq('activity_id', id)
    .eq('user_id', targetUserId)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.status !== 'tbd') return NextResponse.json({ error: 'Member is not on deck' }, { status: 400 })

  await admin
    .from('whozin_activity_member')
    .delete()
    .eq('id', member.id)

  return NextResponse.json({ success: true })
}
