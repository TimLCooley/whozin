import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth'
import { getPricingConfig, savePricingConfig, type PricingConfig } from '@/lib/pricing'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function GET() {
  const guard = await requireAdmin()
  if (guard) return guard
  const config = await getPricingConfig()
  return NextResponse.json(config)
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard) return guard

  const body = (await req.json()) as PricingConfig
  if (!body || !Array.isArray(body.plans)) {
    return NextResponse.json({ error: 'Invalid pricing config' }, { status: 400 })
  }

  for (const plan of body.plans) {
    if (typeof plan.amount_cents !== 'number' || plan.amount_cents < 0) {
      return NextResponse.json({ error: `Invalid amount for ${plan.id}` }, { status: 400 })
    }
  }

  await savePricingConfig(body)
  return NextResponse.json({ success: true })
}
