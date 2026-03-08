import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET messages for an activity
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: activityId } = await params
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

  // Only confirmed members can read chat
  const { data: membership } = await admin
    .from('whozin_activity_member')
    .select('id, status')
    .eq('activity_id', activityId)
    .eq('user_id', whozinUser.id)
    .single()

  if (!membership || membership.status !== 'confirmed') {
    return NextResponse.json({ error: 'Only confirmed members can access chat' }, { status: 403 })
  }

  // Verify activity has chat enabled
  const { data: activity } = await admin
    .from('whozin_activity')
    .select('chat_enabled')
    .eq('id', activityId)
    .single()

  if (!activity?.chat_enabled) {
    return NextResponse.json({ error: 'Chat is not enabled for this activity' }, { status: 403 })
  }

  const cursor = req.nextUrl.searchParams.get('before')
  const limit = 50

  let query = admin
    .from('whozin_message')
    .select('id, body, created_at, sender_id, whozin_users!whozin_message_sender_id_fkey(id, first_name, last_name, avatar_url)')
    .eq('context_type', 'activity')
    .eq('context_id', activityId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: messages, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const formatted = (messages ?? []).reverse().map((m) => ({
    id: m.id,
    body: m.body,
    created_at: m.created_at,
    sender_id: m.sender_id,
    sender: m.whozin_users,
  }))

  return NextResponse.json(formatted)
}

// POST send a message to activity chat
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: activityId } = await params
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

  // Only confirmed members can send messages
  const { data: membership } = await admin
    .from('whozin_activity_member')
    .select('id, status')
    .eq('activity_id', activityId)
    .eq('user_id', whozinUser.id)
    .single()

  if (!membership || membership.status !== 'confirmed') {
    return NextResponse.json({ error: 'Only confirmed members can send messages' }, { status: 403 })
  }

  // Verify activity has chat enabled and creator is Pro
  const { data: activity } = await admin
    .from('whozin_activity')
    .select('chat_enabled, creator_id, activity_name')
    .eq('id', activityId)
    .single()

  if (!activity?.chat_enabled) {
    return NextResponse.json({ error: 'Chat is not enabled for this activity' }, { status: 403 })
  }

  const { data: creator } = await admin
    .from('whozin_users')
    .select('membership_tier')
    .eq('id', activity.creator_id)
    .single()

  if (creator?.membership_tier !== 'pro') {
    return NextResponse.json({ error: 'Activity creator must have Pro membership' }, { status: 403 })
  }

  const body = await req.json()
  const text = body.body?.trim()
  if (!text) return NextResponse.json({ error: 'Message body is required' }, { status: 400 })

  const { data: message, error } = await admin
    .from('whozin_message')
    .insert({
      context_type: 'activity',
      context_id: activityId,
      sender_id: whozinUser.id,
      body: text,
    })
    .select('id, body, created_at, sender_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Alert other confirmed members
  const { data: sender } = await admin.from('whozin_users').select('first_name, last_name').eq('id', whozinUser.id).single()
  const senderName = sender ? `${sender.first_name} ${sender.last_name}`.trim() : 'Someone'

  // Get all confirmed members except sender
  const { data: confirmedMembers } = await admin
    .from('whozin_activity_member')
    .select('user_id')
    .eq('activity_id', activityId)
    .eq('status', 'confirmed')
    .neq('user_id', whozinUser.id)

  if (confirmedMembers && confirmedMembers.length > 0) {
    const { createAlert } = await import('@/lib/alerts')
    for (const member of confirmedMembers) {
      await createAlert({
        user_id: member.user_id,
        type: 'chat_message',
        title: `New message in ${activity.activity_name}`,
        body: `${senderName}: ${text.length > 80 ? text.slice(0, 80) + '...' : text}`,
        link: `/app/activities/${activityId}`,
      })
    }
  }

  return NextResponse.json({
    ...message,
    sender: { id: whozinUser.id },
  })
}
