import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// POST — fork a shareable group into one the caller owns. The caller must be a
// member of the source group and the source must be shareable (owners can copy
// their own group regardless). Copies the name (+ " (Copy)") and the member
// roster; the caller becomes the owner of the new group.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: source } = await admin
    .from('whozin_groups')
    .select('id, name, creator_id, chat_enabled, shareable')
    .eq('id', id)
    .single()
  if (!source) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  const isOwner = source.creator_id === whozinUser.id

  // Membership check (owners are implicitly members).
  let isMember = isOwner
  if (!isMember) {
    const { data: membership } = await admin
      .from('whozin_group_members')
      .select('id')
      .eq('group_id', id)
      .eq('user_id', whozinUser.id)
      .maybeSingle()
    isMember = !!membership
  }

  if (!isMember) {
    return NextResponse.json({ error: 'You\u2019re not in this group' }, { status: 403 })
  }
  if (!isOwner && !source.shareable) {
    return NextResponse.json({ error: 'This group can\u2019t be copied' }, { status: 403 })
  }

  // Create the fork, owned by the caller. Copies stay private (not shareable)
  // unless the new owner opts in later.
  const { data: newGroup, error } = await admin
    .from('whozin_groups')
    .insert({
      name: `${source.name} (Copy)`,
      creator_id: whozinUser.id,
      chat_enabled: source.chat_enabled ?? false,
      shareable: false,
    })
    .select('id')
    .single()
  if (error || !newGroup) {
    return NextResponse.json({ error: error?.message ?? 'Failed to copy group' }, { status: 500 })
  }

  // Copy the source roster. The copier must sit at priority_order 0 — the
  // group detail UI treats the first member (index 0) as the owner, so the
  // new owner has to lead the roster. Everyone else follows in their original
  // order, shifted down by one.
  const { data: sourceMembers } = await admin
    .from('whozin_group_members')
    .select('user_id, priority_order')
    .eq('group_id', id)
    .order('priority_order', { ascending: true })

  const others = (sourceMembers ?? [])
    .filter((m) => m.user_id !== whozinUser.id)
    .sort((a, b) => a.priority_order - b.priority_order)

  const inserts = [
    { group_id: newGroup.id, user_id: whozinUser.id, priority_order: 0 },
    ...others.map((m, i) => ({ group_id: newGroup.id, user_id: m.user_id, priority_order: i + 1 })),
  ]
  await admin.from('whozin_group_members').insert(inserts)

  return NextResponse.json({ id: newGroup.id })
}
