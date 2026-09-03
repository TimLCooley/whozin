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
    // anchor frames: continuous re-snap cycles from ⚓ Anchor mode — seeded
    // with the current pins, prefixed 'anc' so the deck can filter them out
    const anchor = body?.anchor === true
    const seed = Array.isArray(body?.seed) && body.seed.length === 4 ? body.seed : null
    const id = `${anchor ? 'anc' : ''}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const { error } = await admin.storage.from(BUCKET).upload(`${id}.jpg`, buf, { contentType: 'image/jpeg' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const zoom = ['0.5', '0.7', '1'].includes(String(body?.zoom)) ? String(body.zoom) : null
    await writeMeta(admin, id, {
      status: 'pending', created: Date.now(), user: user.id, zoom,
      ...(anchor ? { anchor: true, seed_pins: seed } : {}),
    })
    return NextResponse.json({ id })
  }
  if (action === 'clip') {
    // rally clip bound to a saved calibration — the ball pipeline's input
    const b64 = String(body?.data ?? '').split(',').pop() ?? ''
    const buf = Buffer.from(b64, 'base64')
    if (buf.length < 10_000 || buf.length > 45_000_000) {
      return NextResponse.json({ error: 'clip too small/large (keep it under ~15s)' }, { status: 400 })
    }
    const calib = String(body?.calib ?? '').replace(/[^a-z0-9]/gi, '')
    if (!calib) return NextResponse.json({ error: 'no calibration bound' }, { status: 400 })
    const id = `clip${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const { error } = await admin.storage.from(BUCKET).upload(`${id}.mp4`, buf, { contentType: 'video/mp4' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await writeMeta(admin, id, { type: 'clip', calib, status: 'pending', created: Date.now(), user: user.id })
    return NextResponse.json({ id })
  }
  if (action === 'clip_url') {
    // big videos skip the JSON-body path: signed direct upload to the bucket.
    // Multi-GB videos ship as ~38MB parts (per-object storage limit) that the
    // Mac reassembles byte-for-byte: pass id+part for parts 1..n-1.
    const calib = String(body?.calib ?? '').replace(/[^a-z0-9]/gi, '')
    if (!calib) return NextResponse.json({ error: 'no calibration bound' }, { status: 400 })
    const givenId = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const id = givenId || `clip${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const part = Number.isInteger(body?.part) && body.part >= 0 && body.part < 400 ? body.part : null
    const path = part !== null ? `${id}.part${part}` : `${id}.mp4`
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'no url' }, { status: 500 })
    return NextResponse.json({ id, token: data.token, path })
  }
  if (action === 'clip_meta') {
    // client finished the direct upload: activate the clip for the watcher
    const id = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const calib = String(body?.calib ?? '').replace(/[^a-z0-9]/gi, '')
    if (!id || !calib) return NextResponse.json({ error: 'missing id/calib' }, { status: 400 })
    const parts = Number.isInteger(body?.parts) && body.parts > 0 && body.parts < 400 ? body.parts : null
    await writeMeta(admin, id, { type: 'clip', calib, status: 'pending', created: Date.now(), user: user.id,
                                 ...(parts ? { parts } : {}) })
    return NextResponse.json({ ok: true })
  }
  if (action === 'comment') {
    // review-page comments: appended to <id>_comments.json, timestamped so the
    // Mac-side analysis can read Tim's notes next session
    const id = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const t = Number(body?.t)
    const text = String(body?.text ?? '').slice(0, 2000)
    if (!id || !Number.isFinite(t) || !text.trim()) return NextResponse.json({ error: 'missing id/t/text' }, { status: 400 })
    const cur = (await readMeta(admin, `${id}_comments`)) ?? { comments: [] }
    cur.comments = [...(cur.comments ?? []), { t: Math.round(t * 10) / 10, text: text.trim(), at: Date.now() }]
    await writeMeta(admin, `${id}_comments`, cur)
    return NextResponse.json({ ok: true, n: cur.comments.length })
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
  const review = String(req.nextUrl.searchParams.get('review') ?? '').replace(/[^a-z0-9]/gi, '')
  if (review) {
    // review bundle: streamable video + the analysis log + Tim's comments
    const { data: v } = await admin.storage.from(BUCKET).createSignedUrl(`${review}_review.mp4`, 43200)
    const log = await readMeta(admin, `${review}_log`)
    const comments = await readMeta(admin, `${review}_comments`)
    return NextResponse.json({ id: review, video_url: v?.signedUrl ?? null,
                               log: log ?? null, comments: comments?.comments ?? [] })
  }
  const id = String(req.nextUrl.searchParams.get('id') ?? '').replace(/[^a-z0-9]/gi, '')
  if (id) {
    const meta = await readMeta(admin, id)
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(`${id}.jpg`, 3600)
    let trackUrl: string | null = null
    if (meta?.type === 'clip' && meta?.status === 'done') {
      const { data: t } = await admin.storage.from(BUCKET).createSignedUrl(`${id}_track.jpg`, 3600)
      trackUrl = t?.signedUrl ?? null
    }
    return NextResponse.json({ id, meta, url: signed?.signedUrl ?? null, track_url: trackUrl })
  }
  // list recent captures, newest first
  const { data } = await admin.storage.from(BUCKET).list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
  const ids = (data ?? []).filter((o) => o.name.endsWith('.jpg')).map((o) => o.name.replace('.jpg', ''))
  return NextResponse.json({ ids })
}
