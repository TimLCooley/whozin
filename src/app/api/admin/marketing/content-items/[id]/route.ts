import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('whozin_marketing_content_items')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Load the original CMO idea (if this content item was drafted from one)
  const { data: idea } = await admin
    .from('whozin_marketing_ideas')
    .select('id, hook, hook_type, framework, why_it_might_work, source_prompt, title')
    .eq('content_item_id', id)
    .maybeSingle()

  return NextResponse.json({ item: data, idea })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const admin = getAdminClient()

  const allowed = [
    'title', 'body_text', 'image_urls', 'destination_url', 'channel',
    'content_type', 'status', 'scheduled_at', 'posted_at', 'post_url',
    'parent_id',
  ] as const
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (body.status === 'posted' && !('posted_at' in body)) {
    patch.posted_at = new Date().toISOString()
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('whozin_marketing_content_items')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = getAdminClient()
  const { error } = await admin
    .from('whozin_marketing_content_items')
    .delete()
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
