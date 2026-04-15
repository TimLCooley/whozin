import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('whozin_marketing_brief')
    .select('*')
    .eq('singleton', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ brief: data })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const admin = getAdminClient()

  const allowed = [
    'product_one_liner', 'ideal_customer', 'customer_pain', 'why_we_win',
    'what_worked', 'what_flopped', 'forbidden_tactics', 'voice_rules',
    'intake_conversation', 'is_complete',
  ] as const
  const patch: Record<string, unknown> = { singleton: true }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { data, error } = await admin
    .from('whozin_marketing_brief')
    .upsert(patch, { onConflict: 'singleton' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ brief: data })
}
