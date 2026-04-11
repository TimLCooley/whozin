import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET single group with members
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: group, error } = await admin
    .from('whozin_groups')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  // Get creator's membership tier to determine Pro chat access
  const { data: creator } = await admin
    .from('whozin_users')
    .select('membership_tier')
    .eq('id', group.creator_id)
    .single()

  const isOwner = group.creator_id === whozinUser.id
  const membersVisible = group.members_visible ?? true

  const { data: members } = await admin
    .from('whozin_group_members')
    .select('id, user_id, priority_order, whozin_users(id, first_name, last_name, phone, avatar_url, status, show_phone, show_last_name)')
    .eq('group_id', id)
    .order('priority_order', { ascending: true })

  // When members aren't visible and the requester isn't the owner, only
  // return the requester's own membership so the client can still leave,
  // but can't enumerate anyone else.
  const visibleMembers = !isOwner && !membersVisible
    ? (members ?? []).filter((m) => m.user_id === whozinUser.id)
    : (members ?? [])

  return NextResponse.json({
    ...group,
    is_owner: isOwner,
    current_user_id: whozinUser.id,
    creator_is_pro: creator?.membership_tier === 'pro',
    members: visibleMembers.map((m) => {
      const u = m.whozin_users as unknown as Record<string, unknown>
      const isSelf = m.user_id === whozinUser.id
      const lastName = u.last_name as string || ''
      const showLast = (u.show_last_name as boolean) ?? true
      return {
        membership_id: m.id,
        user_id: m.user_id,
        priority_order: m.priority_order,
        ...u,
        last_name: isSelf || showLast ? lastName : (lastName ? `${lastName[0].toUpperCase()}${'*'.repeat(7)}` : ''),
      }
    }),
  })
}

// PUT update group
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const body = await req.json()

  const { error } = await admin
    .from('whozin_groups')
    .update({
      name: body.name,
      chat_enabled: body.chat_enabled,
      members_visible: body.members_visible,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE group
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  await admin.from('whozin_group_members').delete().eq('group_id', id)
  const { error } = await admin.from('whozin_groups').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
