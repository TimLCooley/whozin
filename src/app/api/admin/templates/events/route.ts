import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth'
import { getAllResolvedEvents } from '@/lib/notification-templates'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const events = await getAllResolvedEvents()
  return NextResponse.json({ events })
}
