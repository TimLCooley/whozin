import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = getAdminClient()

  const { data: campaign, error } = await admin
    .from('whozin_marketing_campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: items } = await admin
    .from('whozin_marketing_content_items')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ campaign, items: items ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const admin = getAdminClient()

  const allowed = [
    'title', 'topic', 'angle', 'goal_type', 'goal_target',
    'status', 'starts_at', 'ends_at', 'notes',
  ] as const
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('whozin_marketing_campaigns')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = getAdminClient()
  const { error } = await admin
    .from('whozin_marketing_campaigns')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
