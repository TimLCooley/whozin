import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET public profile by whozin_users id — no auth required
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('whozin_users')
    .select('id, first_name, last_name, avatar_url')
    .eq('id', id)
    .single()

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json(profile)
}
