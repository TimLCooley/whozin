import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET all users from all of the current user's groups (for "Add from groups" feature)
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

  const { data: memberships } = await admin
    .from('whozin_group_members')
    .select('group_id')
    .eq('user_id', whozinUser.id)

  const groupIds = memberships?.map((m) => m.group_id) ?? []

  if (groupIds.length === 0) {
    return NextResponse.json([])
  }

  const { data: groupMembers } = await admin
    .from('whozin_group_members')
    .select('user_id, whozin_users(id, first_name, last_name, phone, avatar_url, status, show_phone)')
    .in('group_id', groupIds)
    .neq('user_id', whozinUser.id)

  // Deduplicate by user_id
  const seen = new Set<string>()
  const contacts = (groupMembers ?? [])
    .filter((m) => {
      if (seen.has(m.user_id)) return false
      seen.add(m.user_id)
      return true
    })
    .map((m) => m.whozin_users)
    .filter(Boolean)

  return NextResponse.json(contacts)
}
