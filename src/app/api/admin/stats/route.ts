import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = getAdminClient()

  const [users, groups, activities, messages, active, invites] = await Promise.all([
    admin.from('whozin_users').select('id', { count: 'exact', head: true }),
    admin.from('whozin_groups').select('id', { count: 'exact', head: true }),
    admin.from('whozin_activity').select('id', { count: 'exact', head: true }),
    admin.from('whozin_message').select('id', { count: 'exact', head: true }),
    admin.from('whozin_users').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('whozin_invite').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return NextResponse.json({
    users: users.count ?? 0,
    groups: groups.count ?? 0,
    activities: activities.count ?? 0,
    messages: messages.count ?? 0,
    activeUsers: active.count ?? 0,
    invitesPending: invites.count ?? 0,
  })
}
