import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth'
import { getResolved, saveOverride } from '@/lib/sms-templates'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await ctx.params
  const tpl = await getResolved(id)
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(tpl)
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await ctx.params
  const tpl = await getResolved(id)
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { body } = (await req.json()) as { body?: string }
  if (typeof body !== 'string') {
    return NextResponse.json({ error: 'body must be a string' }, { status: 400 })
  }
  if (body.length > 1600) {
    return NextResponse.json({ error: 'Template too long (max 1600 chars)' }, { status: 400 })
  }

  await saveOverride(id, body === tpl.default_body ? null : body)
  const updated = await getResolved(id)
  return NextResponse.json(updated)
}

/** Reset to default by deleting the override. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await ctx.params
  const tpl = await getResolved(id)
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await saveOverride(id, null)
  const updated = await getResolved(id)
  return NextResponse.json(updated)
}
