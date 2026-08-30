import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth'

// Live Sim relay (production-safe): the phone at the park uploads captures and
// pins here; the Mac at home watches the bucket, runs the CV reader, and writes
// claude_pins back. Storage bucket 'lab-live' is the whole datastore:
// <id>.jpg (the capture) + <id>.json (pins/status/metadata).
const BUCKET = 'lab-live'

async function authed() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) return null
  return user
}

async function readMeta(_admin: ReturnType<typeof getAdminClient>, id: string) {
  // direct fetch with cache-buster — the storage CDN serves stale JSON otherwise
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
  try {
    const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${id}.json?cb=${Date.now()}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

async function writeMeta(admin: ReturnType<typeof getAdminClient>, id: string, meta: object) {
  await admin.storage.from(BUCKET).upload(`${id}.json`, JSON.stringify(meta), {
    contentType: 'application/json', upsert: true, cacheControl: '0',
  })
}

export async function POST(req: NextRequest) {
  const user = await authed()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = getAdminClient()
  const body = await req.json()
  const action = body?.action
  if (action === 'upload') {
    const b64 = String(body?.data ?? '').split(',').pop() ?? ''
    const buf = Buffer.from(b64, 'base64')
    if (buf.length < 1000 || buf.length > 8_000_000) {
      return NextResponse.json({ error: 'bad image size' }, { status: 400 })
    }
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const { error } = await admin.storage.from(BUCKET).upload(`${id}.jpg`, buf, { contentType: 'image/jpeg' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await writeMeta(admin, id, { status: 'pending', created: Date.now(), user: user.id })
    return NextResponse.json({ id })
  }
  if (action === 'retry') {
    // re-queue the capture for the Mac's reader (keeps any saved pins)
    const id = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const meta = (await readMeta(admin, id)) ?? {}
    const seed = Array.isArray(body?.seed) && body.seed.length === 4 ? body.seed : null
    await writeMeta(admin, id, { ...meta, status: 'pending', claude_pins: null, seed_pins: seed, retried_at: Date.now() })
    return NextResponse.json({ ok: true })
  }
  if (action === 'label') {
    // data-quality verdict: 'good' (usable view) or 'unusable' (production
    // would ask for a retake) — unusable captures train the reject gate
    const id = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const label = body?.label === 'unusable' ? 'unusable' : 'good'
    const meta = (await readMeta(admin, id)) ?? {}
    await writeMeta(admin, id, { ...meta, label, labeled_at: Date.now() })
    return NextResponse.json({ ok: true })
  }
  if (action === 'pins') {
    const id = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const meta = (await readMeta(admin, id)) ?? {}
    await writeMeta(admin, id, { ...meta, tim_pins: body?.pins, kx: body?.kx ?? 0, ky: body?.ky ?? 0, metric: body?.metric ?? null, pinned_at: Date.now() })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}

export async function GET(req: NextRequest) {
  const user = await authed()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = getAdminClient()
  const id = String(req.nextUrl.searchParams.get('id') ?? '').replace(/[^a-z0-9]/gi, '')
  if (id) {
    const meta = await readMeta(admin, id)
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(`${id}.jpg`, 3600)
    return NextResponse.json({ id, meta, url: signed?.signedUrl ?? null })
  }
  // list recent captures, newest first
  const { data } = await admin.storage.from(BUCKET).list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
  const ids = (data ?? []).filter((o) => o.name.endsWith('.jpg')).map((o) => o.name.replace('.jpg', ''))
  return NextResponse.json({ ids })
}
