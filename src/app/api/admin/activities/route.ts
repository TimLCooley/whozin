import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('whozin_activity')
    .select(`
      id, activity_name, activity_type, activity_date, status,
      max_capacity, capacity_current, created_at, creator_id, group_id,
      whozin_users!whozin_activity_creator_id_fkey ( first_name, last_name ),
      whozin_groups!whozin_activity_group_id_fkey ( name )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json([])
  }

  const activities = await Promise.all(
    data.map(async (a) => {
      const { count } = await admin
        .from('whozin_activity_member')
        .select('id', { count: 'exact', head: true })
        .eq('activity_id', a.id)

      const creator = Array.isArray(a.whozin_users) ? a.whozin_users[0] : a.whozin_users
      const group = Array.isArray(a.whozin_groups) ? a.whozin_groups[0] : a.whozin_groups

      return {
        id: a.id,
        activity_name: a.activity_name,
        activity_type: a.activity_type,
        activity_date: a.activity_date,
        status: a.status,
        max_capacity: a.max_capacity,
        capacity_current: a.capacity_current,
        created_at: a.created_at,
        creator: creator ?? null,
        group: group ?? null,
        member_count: count ?? 0,
      }
    })
  )

  return NextResponse.json(activities)
}
