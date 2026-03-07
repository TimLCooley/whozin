import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET friends list with optional search (name + phone)
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

  // Get friend IDs
  const { data: friendRows } = await admin
    .from('whozin_friends')
    .select('friend_id')
    .eq('user_id', whozinUser.id)

  const friendIds = (friendRows ?? []).map((r) => r.friend_id)
  if (friendIds.length === 0) return NextResponse.json([])

  // Fetch friend user records
  const { data: friends } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name, phone, avatar_url, status')
    .in('id', friendIds)

  const allFriends = friends ?? []

  // Apply search filter
  const search = req.nextUrl.searchParams.get('q')?.trim().toLowerCase()
  if (search) {
    const searchDigits = search.replace(/\D/g, '')
    const filtered = allFriends.filter((f) => {
      const name = `${f.first_name} ${f.last_name}`.toLowerCase()
      const phone = (f.phone || '').replace(/\D/g, '')
      return name.includes(search) || (searchDigits && phone.includes(searchDigits))
    })
    return NextResponse.json(filtered)
  }

  return NextResponse.json(allFriends)
}
