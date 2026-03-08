import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = getAdminClient()

  const { data: groupData, error } = await admin
    .from('whozin_groups')
    .select(`
      id, name, chat_enabled, created_at, creator_id,
      whozin_users!whozin_groups_creator_id_fkey (
        first_name, last_name, phone
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!groupData) {
    return NextResponse.json([])
  }

  const groups = await Promise.all(
    groupData.map(async (group) => {
      const [members, activities] = await Promise.all([
        admin
          .from('whozin_group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', group.id),
        admin
          .from('whozin_activity')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', group.id),
      ])

      const creator = Array.isArray(group.whozin_users) ? group.whozin_users[0] : group.whozin_users

      return {
        id: group.id,
        name: group.name,
        chat_enabled: group.chat_enabled,
        created_at: group.created_at,
        creator: creator ?? null,
        member_count: members.count ?? 0,
        activity_count: activities.count ?? 0,
      }
    })
  )

  return NextResponse.json(groups)
}
