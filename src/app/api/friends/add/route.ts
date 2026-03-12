import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// POST — add a friend by their whozin_users id (bidirectional)
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friend_id, group_id } = await req.json()
  if (!friend_id) return NextResponse.json({ error: 'Missing friend_id' }, { status: 400 })

  const admin = getAdminClient()

  // Get current user's whozin_users id
  const { data: me } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (me.id === friend_id) {
    return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })
  }

  // Verify friend exists
  const { data: friend } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name')
    .eq('id', friend_id)
    .single()

  if (!friend) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Bidirectional friend upsert
  await admin.from('whozin_friends').upsert([
    { user_id: me.id, friend_id: friend.id },
    { user_id: friend.id, friend_id: me.id },
  ], { onConflict: 'user_id,friend_id' })

  // If group_id provided, also add to group
  if (group_id) {
    // Verify user owns this group
    const { data: group } = await admin
      .from('whozin_groups')
      .select('id')
      .eq('id', group_id)
      .eq('created_by', me.id)
      .single()

    if (group) {
      await admin.from('whozin_group_members').upsert({
        group_id: group.id,
        user_id: friend.id,
        priority_order: 999,
      }, { onConflict: 'group_id,user_id' })
    }
  }

  return NextResponse.json({ success: true, friend })
}
