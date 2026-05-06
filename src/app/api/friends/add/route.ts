import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createAlert } from '@/lib/alerts'
import { renderTemplate } from '@/lib/notification-templates'

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
    .select('id, first_name, last_name')
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

  // If group_id provided, also add to that group.
  // The group must be owned by the OTHER party (the QR holder / friend),
  // not by `me` — `me` is the scanner being added in.
  if (group_id) {
    const { data: group } = await admin
      .from('whozin_groups')
      .select('id, name, creator_id')
      .eq('id', group_id)
      .single()

    if (group && group.creator_id === friend.id) {
      const { data: existing } = await admin
        .from('whozin_group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', me.id)
        .maybeSingle()

      if (!existing) {
        const { data: members } = await admin
          .from('whozin_group_members')
          .select('priority_order')
          .eq('group_id', group.id)
          .order('priority_order', { ascending: false })
          .limit(1)
        const nextOrder = (members?.[0]?.priority_order ?? 0) + 1

        await admin.from('whozin_group_members').insert({
          group_id: group.id,
          user_id: me.id,
          priority_order: nextOrder,
        })

        // Notify the group owner (alert log + push) that a new member joined
        const targetName = `${me.first_name ?? ''} ${me.last_name ?? ''}`.trim() || 'Someone'
        const tpl = await renderTemplate('member_joined_group', 'push', {
          group_name: group.name,
          target_name: targetName,
        })
        createAlert({
          user_id: friend.id,
          type: 'member_joined',
          title: tpl.title ?? `New member in ${group.name}`,
          body: tpl.body,
          link: `/app/groups/${group.id}`,
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ success: true, friend })
}
