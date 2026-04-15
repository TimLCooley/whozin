import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getNextScheduledSlot } from '@/lib/marketing/scheduling'

function randomShortCode(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('campaign_id')
  const channel = searchParams.get('channel')
  const status = searchParams.get('status')

  const admin = getAdminClient()
  let query = admin
    .from('whozin_marketing_content_items')
    .select('*')
    .order('created_at', { ascending: false })

  if (campaignId) query = query.eq('campaign_id', campaignId)
  if (channel) query = query.eq('channel', channel)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.campaign_id) {
    return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
  }
  if (!body.channel) {
    return NextResponse.json({ error: 'channel is required' }, { status: 400 })
  }

  const admin = getAdminClient()

  let shortCode: string | null = body.short_code ?? null
  if (!shortCode) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = randomShortCode()
      const { data: existing } = await admin
        .from('whozin_marketing_content_items')
        .select('id')
        .eq('short_code', candidate)
        .maybeSingle()
      if (!existing) {
        shortCode = candidate
        break
      }
    }
  }

  const scheduledAt = body.scheduled_at ?? await getNextScheduledSlot(admin, body.channel)

  const insert = {
    campaign_id: body.campaign_id,
    parent_id: body.parent_id ?? null,
    channel: body.channel,
    content_type: body.content_type ?? 'text',
    title: body.title ?? null,
    body_text: body.body_text ?? null,
    image_urls: Array.isArray(body.image_urls) ? body.image_urls : [],
    short_code: shortCode,
    destination_url: body.destination_url ?? 'https://whozin.io/dl',
    status: body.status ?? 'draft',
    scheduled_at: scheduledAt,
    post_url: body.post_url ?? null,
  }

  const { data, error } = await admin
    .from('whozin_marketing_content_items')
    .insert(insert)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}
