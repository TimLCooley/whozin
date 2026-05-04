import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth'
import { getAllResolved } from '@/lib/sms-templates'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const templates = await getAllResolved()
  return NextResponse.json({ templates })
}
