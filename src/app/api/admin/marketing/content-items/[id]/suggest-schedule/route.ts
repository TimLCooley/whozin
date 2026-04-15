import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { suggestOptimalSchedule } from '@/lib/marketing/optimal-times'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = getAdminClient()

  const { data: item, error: itemErr } = await admin
    .from('whozin_marketing_content_items')
    .select('channel')
    .eq('id', id)
    .single()
  if (itemErr || !item) {
    return NextResponse.json({ error: 'Content item not found' }, { status: 404 })
  }

  const nowIso = new Date().toISOString()
  const { data: queue } = await admin
    .from('whozin_marketing_content_items')
    .select('scheduled_at')
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', nowIso)
    .neq('id', id) // exclude the current item so moving it doesn't collide with itself

  const existingISOs = (queue ?? [])
    .map((r) => r.scheduled_at as string | null)
    .filter((s): s is string => !!s)

  const suggestion = suggestOptimalSchedule(item.channel, existingISOs)
  return NextResponse.json(suggestion)
}
