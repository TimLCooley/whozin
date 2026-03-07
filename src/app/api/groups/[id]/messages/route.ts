import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { alertGroupMembers } from '@/lib/alerts'

// GET messages for a group
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()

  // Verify user is a member of this group
  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: membership } = await admin
    .from('whozin_group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', whozinUser.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  // Get messages with sender info
  const cursor = req.nextUrl.searchParams.get('before')
  const limit = 50

  let query = admin
    .from('whozin_message')
    .select('id, body, created_at, sender_id, whozin_users!whozin_message_sender_id_fkey(id, first_name, last_name, avatar_url)')
    .eq('context_type', 'group')
    .eq('context_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: messages, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reverse so oldest first
  const formatted = (messages ?? []).reverse().map((m) => ({
    id: m.id,
    body: m.body,
    created_at: m.created_at,
    sender_id: m.sender_id,
    sender: m.whozin_users,
  }))

  return NextResponse.json(formatted)
}

// POST send a message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
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

  // Verify membership
  const { data: membership } = await admin
    .from('whozin_group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', whozinUser.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  // Verify group has chat enabled and creator is Pro
  const { data: group } = await admin
    .from('whozin_groups')
    .select('chat_enabled, creator_id')
    .eq('id', groupId)
    .single()

  if (!group?.chat_enabled) {
    return NextResponse.json({ error: 'Chat is not enabled for this group' }, { status: 403 })
  }

  const { data: creator } = await admin
    .from('whozin_users')
    .select('membership_tier')
    .eq('id', group.creator_id)
    .single()

  if (creator?.membership_tier !== 'pro') {
    return NextResponse.json({ error: 'Group owner must have Pro membership' }, { status: 403 })
  }

  const body = await req.json()
  const text = body.body?.trim()
  if (!text) return NextResponse.json({ error: 'Message body is required' }, { status: 400 })

  const { data: message, error } = await admin
    .from('whozin_message')
    .insert({
      context_type: 'group',
      context_id: groupId,
      sender_id: whozinUser.id,
      body: text,
    })
    .select('id, body, created_at, sender_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get sender name and group name for alerts
  const { data: sender } = await admin.from('whozin_users').select('first_name, last_name').eq('id', whozinUser.id).single()
  const { data: groupInfo } = await admin.from('whozin_groups').select('name').eq('id', groupId).single()
  const senderName = sender ? `${sender.first_name} ${sender.last_name}`.trim() : 'Someone'
  const groupName = groupInfo?.name || 'a group'

  // Alert other group members about the new message
  await alertGroupMembers(groupId, whozinUser.id, {
    type: 'chat_message',
    title: `New message in ${groupName}`,
    body: `${senderName}: ${text.length > 80 ? text.slice(0, 80) + '...' : text}`,
    link: `/app/groups/${groupId}`,
  })

  return NextResponse.json({
    ...message,
    sender: { id: whozinUser.id },
  })
}
