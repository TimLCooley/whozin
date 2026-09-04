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
  if (action === 'event_put') {
    // Film Room events: the single editable truth stream. Upsert by eid.
    const id = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const ev = body?.event
    if (!id || !ev || !Number.isFinite(Number(ev.t))) return NextResponse.json({ error: 'missing id/event' }, { status: 400 })
    const type = ['serve', 'out', 'in', 'score', 'bookmark', 'ball', 'note', 'game'].includes(ev.type) ? ev.type : null
    if (!type) return NextResponse.json({ error: 'bad type' }, { status: 400 })
    const clean = {
      eid: String(ev.eid ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`).slice(0, 24),
      t: Math.round(Number(ev.t) * 100) / 100, type,
      cause: ['line', 'net', 'start', 'end'].includes(ev.cause) ? ev.cause : undefined,
      x: Number.isFinite(Number(ev.x)) ? Math.round(Number(ev.x) * 10000) / 10000 : undefined,
      y: Number.isFinite(Number(ev.y)) ? Math.round(Number(ev.y) * 10000) / 10000 : undefined,
      a: Number.isFinite(Number(ev.a)) ? Math.round(Number(ev.a)) : undefined,
      b: Number.isFinite(Number(ev.b)) ? Math.round(Number(ev.b)) : undefined,
      srv: ev.srv === 2 ? 2 : ev.srv === 1 ? 1 : undefined,
      text: typeof ev.text === 'string' ? ev.text.slice(0, 500) : undefined,
      src: ev.src === 'machine' ? 'machine' : 'tim',
      at: Date.now(),
    }
    const cur = (await readMeta(admin, `${id}_events`)) ?? { events: [] }
    const events = (cur.events ?? []).filter((e: { eid?: string }) => e.eid !== clean.eid)
    events.push(clean)
    events.sort((a: { t: number }, b: { t: number }) => a.t - b.t)
    await writeMeta(admin, `${id}_events`, { events })
    return NextResponse.json({ ok: true, eid: clean.eid, n: events.length })
  }
  if (action === 'review_calib') {
    // court pins placed on the review video itself — labels project to feet
    const id = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const pins = Array.isArray(body?.pins) && body.pins.length === 4 ? body.pins : null
    if (!id || !pins) return NextResponse.json({ error: 'missing id/pins' }, { status: 400 })
    await writeMeta(admin, `${id}_calib`, { pins, at: Date.now() })
    return NextResponse.json({ ok: true })
  }
  if (action === 'event_del') {
    const id = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const eid = String(body?.eid ?? '').slice(0, 24)
    if (!id || !eid) return NextResponse.json({ error: 'missing id/eid' }, { status: 400 })
    const cur = (await readMeta(admin, `${id}_events`)) ?? { events: [] }
    const events = (cur.events ?? []).filter((e: { eid?: string }) => e.eid !== eid)
    await writeMeta(admin, `${id}_events`, { events })
    return NextResponse.json({ ok: true, n: events.length })
  }
  if (action === 'mark') {
    // review-page ground-truth labels: verdict at a timestamp, optionally with
    // the tapped landing spot (normalized video coords) — training gold
    const id = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const t = Number(body?.t)
    const verdict = ['OUT', 'IN', 'NET', 'BALL'].includes(body?.verdict) ? body.verdict : null
    if (!id || !Number.isFinite(t) || !verdict) return NextResponse.json({ error: 'missing id/t/verdict' }, { status: 400 })
    const x = Number.isFinite(Number(body?.x)) ? Math.round(Number(body.x) * 10000) / 10000 : null
    const y = Number.isFinite(Number(body?.y)) ? Math.round(Number(body.y) * 10000) / 10000 : null
    const cur = (await readMeta(admin, `${id}_marks`)) ?? { marks: [] }
    cur.marks = [...(cur.marks ?? []), { t: Math.round(t * 10) / 10, verdict, x, y, at: Date.now() }]
    await writeMeta(admin, `${id}_marks`, cur)
    return NextResponse.json({ ok: true, n: cur.marks.length })
  }
  if (action === 'score_mark') {
    // scoreboard timeline: Tim confirms the score at a video timestamp
    const id = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const t = Number(body?.t)
    const a = Number(body?.a); const b = Number(body?.b); const srv = Number(body?.srv)
    if (!id || !Number.isFinite(t) || !Number.isFinite(a) || !Number.isFinite(b)) {
      return NextResponse.json({ error: 'missing id/t/score' }, { status: 400 })
    }
    const cur = (await readMeta(admin, `${id}_marks`)) ?? { marks: [] }
    cur.marks = [...(cur.marks ?? []), { t: Math.round(t * 10) / 10, kind: 'score',
      a: Math.max(0, Math.min(99, Math.round(a))), b: Math.max(0, Math.min(99, Math.round(b))),
      srv: srv === 2 ? 2 : 1, at: Date.now() }]
    await writeMeta(admin, `${id}_marks`, cur)
    return NextResponse.json({ ok: true, n: cur.marks.length })
  }
  if (action === 'mark_undo') {
    const id = String(body?.id ?? '').replace(/[^a-z0-9]/gi, '')
    const cur = (await readMeta(admin, `${id}_marks`)) ?? { marks: [] }
    cur.marks = (cur.marks ?? []).slice(0, -1)
    await writeMeta(admin, `${id}_marks`, cur)
    return NextResponse.json({ ok: true, n: cur.marks.length })
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
    let evfile = await readMeta(admin, `${review}_events`)
    if (!evfile) {
      // one-time migration: old marks become Film Room events (net = out/net,
      // Tim's grammar: rallies are serve->out spans, IN is a close-ball note)
      const marks = (await readMeta(admin, `${review}_marks`))?.marks ?? []
      type OldMark = { t: number; verdict?: string; kind?: string; x?: number; y?: number; a?: number; b?: number; srv?: number }
      const events = (marks as OldMark[]).map((m, i) => {
        const eid = `mig${i}`
        if (m.kind === 'score') return { eid, t: m.t, type: 'score', a: m.a, b: m.b, srv: m.srv, src: 'tim', at: Date.now() }
        if (m.verdict === 'OUT') return { eid, t: m.t, type: 'out', cause: 'line', x: m.x, y: m.y, src: 'tim', at: Date.now() }
        if (m.verdict === 'NET') return { eid, t: m.t, type: 'out', cause: 'net', x: m.x, y: m.y, src: 'tim', at: Date.now() }
        if (m.verdict === 'IN') return { eid, t: m.t, type: 'in', x: m.x, y: m.y, src: 'tim', at: Date.now() }
        return { eid, t: m.t, type: 'ball', x: m.x, y: m.y, src: 'tim', at: Date.now() }
      })
      evfile = { events }
      await writeMeta(admin, `${review}_events`, evfile)
    }
    const calib = await readMeta(admin, `${review}_calib`)
    return NextResponse.json({ id: review, video_url: v?.signedUrl ?? null,
                               log: log ?? null, comments: comments?.comments ?? [],
                               events: evfile?.events ?? [], calib: calib?.pins ?? null })
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
