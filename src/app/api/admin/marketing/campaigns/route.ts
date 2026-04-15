import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('whozin_marketing_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const title = (body.title ?? '').trim()
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const slugBase = (body.slug ?? title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)

  const admin = getAdminClient()

  let slug = slugBase || 'campaign'
  let attempt = 0
  while (attempt < 5) {
    const { data: existing } = await admin
      .from('whozin_marketing_campaigns')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!existing) break
    attempt += 1
    slug = `${slugBase}-${attempt + 1}`
  }

  const insert = {
    title,
    slug,
    topic: body.topic ?? null,
    angle: body.angle ?? null,
    goal_type: body.goal_type ?? 'app_downloads',
    goal_target: body.goal_target ?? null,
    status: body.status ?? 'draft',
    starts_at: body.starts_at ?? null,
    ends_at: body.ends_at ?? null,
    notes: body.notes ?? null,
  }

  const { data, error } = await admin
    .from('whozin_marketing_campaigns')
    .insert(insert)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: data })
}
