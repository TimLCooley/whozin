import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = getAdminClient()

  const { data: orgData, error } = await admin
    .from('whozin_organizations')
    .select(`
      id, name, created_at, owner_id,
      whozin_users!whozin_organizations_owner_id_fkey (
        first_name, last_name, phone, email
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!orgData) {
    return NextResponse.json([])
  }

  const orgs = await Promise.all(
    orgData.map(async (org) => {
      const [members, groups, activities] = await Promise.all([
        admin
          .from('whozin_organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id),
        admin
          .from('whozin_groups')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id),
        admin
          .from('whozin_activity')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', org.id),
      ])

      const ownerData = Array.isArray(org.whozin_users) ? org.whozin_users[0] : org.whozin_users

      return {
        id: org.id,
        name: org.name,
        created_at: org.created_at,
        owner: ownerData ?? null,
        member_count: members.count ?? 0,
        group_count: groups.count ?? 0,
        activity_count: activities.count ?? 0,
      }
    })
  )

  return NextResponse.json(orgs)
}
