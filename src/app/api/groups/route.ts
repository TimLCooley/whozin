import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET all groups the current user is in (as creator or member)
export async function GET() {
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

  const userId = whozinUser.id

  const { data: memberships } = await admin
    .from('whozin_group_members')
    .select('group_id')
    .eq('user_id', userId)

  const groupIds = memberships?.map((m) => m.group_id) ?? []

  if (groupIds.length === 0) {
    return NextResponse.json([])
  }

  const { data: groups } = await admin
    .from('whozin_groups')
    .select('*, whozin_group_members(count)')
    .in('id', groupIds)
    .order('created_at', { ascending: false })

  // Get unread chat alerts per group for this user
  const { data: unreadAlerts } = await admin
    .from('whozin_alerts')
    .select('link')
    .eq('user_id', userId)
    .eq('type', 'chat_message')
    .eq('read', false)

  const unreadGroupIds = new Set(
    (unreadAlerts ?? [])
      .map((a) => {
        const match = a.link?.match(/\/app\/groups\/([^/]+)/)
        return match?.[1] ?? null
      })
      .filter(Boolean)
  )

  const result = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    creator_id: g.creator_id,
    chat_enabled: g.chat_enabled,
    member_count: g.whozin_group_members?.[0]?.count ?? 0,
    is_owner: g.creator_id === userId,
    has_unread_chat: unreadGroupIds.has(g.id),
    created_at: g.created_at,
  }))

  return NextResponse.json(result)
}

// POST create a new group
export async function POST(req: NextRequest) {
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

  const body = await req.json()
  const { name, chat_enabled } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
  }

  const { data: group, error } = await admin
    .from('whozin_groups')
    .insert({
      name: name.trim(),
      creator_id: whozinUser.id,
      chat_enabled: chat_enabled ?? false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await admin.from('whozin_group_members').insert({
    group_id: group.id,
    user_id: whozinUser.id,
    priority_order: 1,
  })

  return NextResponse.json(group)
}
