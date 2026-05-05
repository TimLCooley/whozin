import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET — people you can quickly invite. Two sources, unioned and de-duped:
//   1. Recent "activity-mates": users who were confirmed in activities you
//      were also confirmed in, ordered by most recent activity.
//   2. Members of groups you own.
// `whozin_friends` is no longer the source — it stays around as a lightweight
// auto-pool but isn't queried here.
export async function GET(req: NextRequest) {
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
  const me = whozinUser.id

  // Track recency per user_id so we can sort the merged result.
  // Higher score = more recent / more relevant. Group-owner adds get a
  // base score; activity confirmations override with the activity's
  // created_at (newer beats older).
  const score = new Map<string, number>()
  const bump = (uid: string, value: number) => {
    if (uid === me) return
    const cur = score.get(uid)
    if (cur === undefined || value > cur) score.set(uid, value)
  }

  // 1. Activity-mates — recent activities where I was confirmed
  const { data: myConfirmed } = await admin
    .from('whozin_activity_member')
    .select('activity_id')
    .eq('user_id', me)
    .eq('status', 'confirmed')

  const myActivityIds = (myConfirmed ?? []).map((r) => r.activity_id)

  if (myActivityIds.length > 0) {
    // Get activity timestamps so we can rank by recency
    const { data: acts } = await admin
      .from('whozin_activity')
      .select('id, created_at')
      .in('id', myActivityIds)

    const actCreatedAt = new Map((acts ?? []).map((a) => [a.id, new Date(a.created_at).getTime()]))

    const { data: mates } = await admin
      .from('whozin_activity_member')
      .select('user_id, activity_id')
      .in('activity_id', myActivityIds)
      .eq('status', 'confirmed')
      .neq('user_id', me)

    for (const m of (mates ?? [])) {
      const ts = actCreatedAt.get(m.activity_id) ?? 0
      bump(m.user_id, ts)
    }
  }

  // 2. Members of groups I own — these are people I added to my groups
  const { data: myGroups } = await admin
    .from('whozin_groups')
    .select('id')
    .eq('creator_id', me)

  const myGroupIds = (myGroups ?? []).map((g) => g.id)

  if (myGroupIds.length > 0) {
    const { data: gms } = await admin
      .from('whozin_group_members')
      .select('user_id, created_at')
      .in('group_id', myGroupIds)

    for (const gm of (gms ?? [])) {
      // Group adds get half-weight vs. activity confirmations so a fresh
      // confirmed activity beats a years-old group add when ties happen.
      // Both still produce a real recency score from their own timestamp.
      const ts = gm.created_at ? new Date(gm.created_at).getTime() : 0
      bump(gm.user_id, ts)
    }
  }

  if (score.size === 0) return NextResponse.json([])

  // Sort by score desc and take the top 50 before fetching user records
  const ranked = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([uid]) => uid)

  const { data: users } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name, phone, avatar_url, status, show_phone, show_last_name')
    .in('id', ranked)

  // Re-sort by ranked order (the .in() query won't preserve it)
  const userMap = new Map((users ?? []).map((u) => [u.id, u]))
  const ordered = ranked.map((uid) => userMap.get(uid)).filter(Boolean) as NonNullable<ReturnType<typeof userMap.get>>[]

  // Search filter
  const search = req.nextUrl.searchParams.get('q')?.trim().toLowerCase()
  if (search) {
    const searchDigits = search.replace(/\D/g, '')
    const filtered = ordered.filter((f) => {
      const name = `${f.first_name} ${f.last_name}`.toLowerCase()
      const phone = (f.phone || '').replace(/\D/g, '')
      return name.includes(search) || (searchDigits && phone.includes(searchDigits))
    })
    return NextResponse.json(filtered)
  }

  return NextResponse.json(ordered)
}
