'use client'

// THE FILM ROOM — training-annotation studio for match video.
// Tim's grammar: a match is serve -> play -> an OUT happens -> next serve.
// NET is an out with a different cause; "IN" is only a close-ball annotation.
// Everything on screen is an editable EVENT (move / edit / confirm / delete),
// machine suggestions included. Marker strip on the video = tap-to-jump
// bookmarks; transcript pane syncs with playback; court calibration on the
// video projects every landing tap to court feet.
import { useEffect, useRef, useState, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth'
import { COURT_CORNERS, COURT_ALL_LINES } from '@/lib/pickleball-court'
import { homographyFromCorners, applyHomography } from '@/lib/homography'

type Pt = { x: number; y: number }
type Ev = { eid: string; t: number; type: string; cause?: string; x?: number; y?: number;
  a?: number; b?: number; srv?: number; text?: string; src: string; at?: number }
type Utter = { t0: number; t1: number; text: string }

const EV_STYLE: Record<string, { bg: string; label: string }> = {
  out: { bg: '#dc2626', label: 'OUT' },
  in: { bg: '#16a34a', label: 'CLOSE-IN' },
  serve: { bg: '#0891b2', label: 'SERVE' },
  score: { bg: '#d97706', label: 'SCORE' },
  bookmark: { bg: '#9333ea', label: '🔖' },
  note: { bg: '#334155', label: 'NOTE' },
  ball: { bg: '#eab308', label: '🎾' },
}
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

function courtPath(corners: Pt[]): string {
  const H = homographyFromCorners(COURT_CORNERS, corners)
  if (!H) return ''
  return COURT_ALL_LINES.map(([x1, y1, x2, y2]) => {
    let d = ''
    for (let s = 0; s <= 12; s++) {
      const p = applyHomography(H, { x: x1 + (x2 - x1) * s / 12, y: y1 + (y2 - y1) * s / 12 })
      d += `${s ? 'L' : 'M'} ${p.x * 100},${p.y * 100} `
    }
    return d
  }).join(' ')
}
function toCourtFt(calib: Pt[], p: Pt): Pt | null {
  const H = homographyFromCorners(calib, COURT_CORNERS) // image -> feet
  return H ? applyHomography(H, p) : null
}
function spotDesc(calib: Pt[] | null, x?: number, y?: number): string {
  if (!calib || x == null || y == null) return ''
  const c = toCourtFt(calib, { x, y })
  if (!c) return ''
  const dx = Math.min(c.x, 20 - c.x), dy = Math.min(c.y, 44 - c.y)
  const inside = dx >= 0 && dy >= 0
  const d = inside ? Math.min(dx, dy) : -Math.hypot(Math.min(dx, 0), Math.min(dy, 0))
  return ` · (${c.x.toFixed(1)},${c.y.toFixed(1)})ft ${inside ? 'IN' : 'OUT'} by ${Math.abs(d * 12).toFixed(0)}″`
}

function FilmRoom() {
  const router = useRouter()
  const params = useSearchParams()
  const id = (params.get('id') ?? 'match1').replace(/[^a-z0-9]/gi, '')
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [mounted, setMounted] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [events, setEvents] = useState<Ev[]>([])
  const [transcript, setTranscript] = useState<Utter[]>([])
  const [showMachine, setShowMachine] = useState(false)
  const [machineEvs, setMachineEvs] = useState<Ev[]>([])
  const [calib, setCalib] = useState<Pt[] | null>(null)
  const [calibrating, setCalibrating] = useState(false)
  const [calDraft, setCalDraft] = useState<Pt[]>([{ x: 0.3, y: 0.35 }, { x: 0.7, y: 0.35 }, { x: 0.85, y: 0.7 }, { x: 0.15, y: 0.7 }])
  const [showCourt, setShowCourt] = useState(true)
  const [pending, setPending] = useState<'out' | 'in' | 'ball' | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [now, setNow] = useState(0)
  const [dur, setDur] = useState(3282)
  const [rate, setRate] = useState(1)
  const [voiceOff, setVoiceOff] = useState<number>(() => {
    try { return Number(localStorage.getItem('reviewVoiceOff') ?? 0) || 0 } catch { return 0 }
  })
  const [score, setScore] = useState({ a: 0, b: 0, srv: 1 })
  const [showTalk, setShowTalk] = useState(true)
  const [editEid, setEditEid] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const laneRef = useRef<HTMLDivElement>(null)
  const dragCal = useRef<number | null>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supa = createClient()
        let { data: { session } } = await supa.auth.getSession()
        if (!session) session = (await supa.auth.refreshSession().catch(() => null))?.data?.session ?? null
        const ok = session?.user?.email ? isSuperAdmin(session.user.email) : false
        if (cancelled) return
        setAllowed(ok)
        if (!ok) router.replace('/app')
      } catch { if (!cancelled) { setAllowed(false); router.replace('/app') } }
    })()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    if (allowed !== true) return
    fetch(`/api/lab/live?review=${id}`).then((x) => x.json()).then((r) => {
      setVideoUrl(r?.video_url ?? null)
      setEvents((r?.events ?? []).filter((e: Ev) => e.src !== 'machine'))
      if (Array.isArray(r?.calib)) setCalib(r.calib.map((p: number[]) => ({ x: p[0], y: p[1] })))
      // machine suggestions + transcript come from the log
      const entries = r?.log?.entries ?? []
      type LogEntry = { t: number; kind: string; text: string }
      setMachineEvs((entries as LogEntry[])
        .filter((e) => (e.kind === 'out' || e.kind === 'in' || e.kind === 'rally') && e.text.startsWith('machine') || e.kind === 'rally')
        .map((e, i) => ({ eid: `mach${i}`, t: e.t, type: e.kind === 'rally' ? 'serve' : e.kind,
                          text: e.text, src: 'machine' })))
      setTranscript((entries as LogEntry[]).filter((e) => e.kind === 'voice' || e.kind === 'score')
        .map((e) => ({ t0: e.t, t1: e.t + 3, text: e.text })))
    }).catch(() => {})
  }, [allowed, id])

  // --- event CRUD ---
  async function putEvent(ev: Partial<Ev> & { t: number; type: string }) {
    const eid = ev.eid ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const full = { ...ev, eid, src: ev.src ?? 'tim' } as Ev
    setEvents((s) => [...s.filter((e) => e.eid !== eid), full].sort((a, b) => a.t - b.t))
    await fetch('/api/lab/live', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'event_put', id, event: full }),
    }).catch(() => {})
    return eid
  }
  async function delEvent(eid: string) {
    setEvents((s) => s.filter((e) => e.eid !== eid))
    await fetch('/api/lab/live', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'event_del', id, eid }),
    }).catch(() => {})
  }

  // --- video helpers ---
  const v = () => videoRef.current
  function seek(t: number) { const vd = v(); if (vd) { vd.currentTime = Math.max(0, t); vd.play().catch(() => {}) } }
  function step(frames: number) { const vd = v(); if (vd) { vd.pause(); vd.currentTime = Math.max(0, vd.currentTime + frames / 30) } }
  function setRateAll(r: number) { setRate(r); const vd = v(); if (vd) vd.playbackRate = r }
  const tNow = () => Math.round((v()?.currentTime ?? 0) * 100) / 100

  // --- labeling ---
  function startSpot(kind: 'out' | 'in' | 'ball') { v()?.pause(); setPending(kind) }
  async function commitSpot(x: number | null, y: number | null) {
    if (!pending) return
    const kind = pending
    await putEvent({ t: tNow(), type: kind, ...(kind === 'out' ? { cause: 'line' } : {}),
                     ...(x != null ? { x, y: y ?? undefined } : {}) })
    if (kind === 'ball') return // ball tracer stays armed: step + tap again
    setPending(null)
    v()?.play().catch(() => {})
  }
  function onVideoTap(e: React.MouseEvent<HTMLDivElement>) {
    if (calibrating || !pending) return
    const r = e.currentTarget.getBoundingClientRect()
    commitSpot((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
  }
  async function markNet() { await putEvent({ t: tNow(), type: 'out', cause: 'net' }) }
  async function markServe() { await putEvent({ t: tNow(), type: 'serve' }) }
  async function markBookmark() { await putEvent({ t: tNow(), type: 'bookmark' }) }
  async function logScore(next: { a: number; b: number; srv: number }) {
    setScore(next)
    await putEvent({ t: tNow(), type: 'score', a: next.a, b: next.b, srv: next.srv })
  }

  // --- calibration drag ---
  function calDown(e: React.PointerEvent, i: number) {
    dragCal.current = i
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function calMove(e: React.PointerEvent) {
    if (dragCal.current == null) return
    const box = (e.currentTarget as HTMLElement).closest('[data-vbox]')?.getBoundingClientRect()
    if (!box) return
    const p = { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height }
    setCalDraft((c) => c.map((q, k) => (k === dragCal.current ? p : q)))
  }
  async function saveCalib() {
    setCalib(calDraft.map((p) => ({ ...p })))
    setCalibrating(false)
    await fetch('/api/lab/live', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'review_calib', id, pins: calDraft.map((p) => [p.x, p.y]) }),
    }).catch(() => {})
  }

  // --- derived ---
  const visible = showMachine ? [...events, ...machineEvs].sort((a, b) => a.t - b.t) : events
  const structural = visible.filter((e) => e.type !== 'ball')
  const outs = structural.filter((e) => e.type === 'out').map((e) => e.t)
  function jumpOut(dir: 1 | -1) {
    if (!outs.length) return
    const t = dir === 1 ? (outs.find((x) => x > now + 2.5) ?? outs[0])
                        : ([...outs].reverse().find((x) => x < now - 2.5) ?? outs[outs.length - 1])
    seek(Math.max(0, t - 3))
  }
  // rallies derive from grammar: serve -> next out
  const rallyOf = (e: Ev) => {
    if (e.type !== 'serve') return null
    const end = structural.find((o) => o.type === 'out' && o.t > e.t)
    return end ? `${(end.t - e.t).toFixed(0)}s rally` : 'rally open'
  }
  const curLine = transcript.findIndex((u) => now >= u.t0 + voiceOff && now < u.t1 + voiceOff + 2)

  // auto-scroll the transcript pane
  const talkRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (curLine < 0 || !talkRef.current) return
    const el = talkRef.current.children[curLine] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [curLine])

  function nudgeVoice(d: number) {
    const nv = Math.round((voiceOff + d) * 10) / 10
    setVoiceOff(nv)
    try { localStorage.setItem('reviewVoiceOff', String(nv)) } catch { /* private mode */ }
  }

  if (!mounted) return null
  if (!allowed) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>, document.body)
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-surface overflow-hidden">
      <AppHeader showBack />
      {/* top bar */}
      <div className="px-3 py-1 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">🎬 Film Room</span>
        <button type="button" onClick={() => jumpOut(-1)} className="px-2.5 py-1 rounded-full text-[11px] font-black bg-red-600 text-white">⏮ OUT</button>
        <button type="button" onClick={() => jumpOut(1)} className="px-2.5 py-1 rounded-full text-[11px] font-black bg-red-600 text-white">OUT ⏭</button>
        {[1, 1.5, 2].map((r) => (
          <button key={r} type="button" onClick={() => setRateAll(r)}
            className="px-2 py-1 rounded-full text-[11px] font-bold border"
            style={rate === r ? { background: '#7c3aed', borderColor: '#7c3aed', color: '#fff' } : { borderColor: '#7c3aed', color: '#7c3aed' }}>{r}×</button>
        ))}
        <span className="flex-1" />
        <button type="button" onClick={() => setShowMachine((s) => !s)}
          className="px-2.5 py-1 rounded-full text-[11px] font-bold border"
          style={showMachine ? { background: '#334155', color: '#fff', borderColor: '#334155' } : { borderColor: '#334155', color: '#334155' }}>🤖 machine</button>
        <button type="button" onClick={() => { setCalibrating((c) => !c); v()?.pause() }}
          className="px-2.5 py-1 rounded-full text-[11px] font-bold border"
          style={calibrating ? { background: '#06b6d4', color: '#fff', borderColor: '#06b6d4' } : { borderColor: '#06b6d4', color: '#0891b2' }}>📐 calibrate</button>
        {calib && (
          <button type="button" onClick={() => setShowCourt((s) => !s)}
            className="px-2.5 py-1 rounded-full text-[11px] font-bold border"
            style={showCourt ? { background: '#16a34a', color: '#fff', borderColor: '#16a34a' } : { borderColor: '#16a34a', color: '#16a34a' }}>lines</button>
        )}
      </div>

      {/* video + marker strip */}
      <div className="shrink-0 bg-black flex justify-center">
        {videoUrl ? (
          <div data-vbox className="relative w-full touch-none" style={{ maxHeight: '38vh', aspectRatio: '16/9', maxWidth: 'calc(38vh * 16 / 9)' }}
            onClick={onVideoTap} onPointerMove={calibrating ? calMove : undefined} onPointerUp={() => { dragCal.current = null }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} src={videoUrl} controls={!pending && !calibrating} playsInline preload="metadata"
              className="absolute inset-0 w-full h-full"
              onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 3282)} />
            {calib && showCourt && !calibrating && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d={courtPath(calib)} fill="none" stroke="rgba(57,255,20,0.7)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
            {calibrating && (
              <>
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d={courtPath(calDraft)} fill="none" stroke="#39FF14" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
                {calDraft.map((p, i) => (
                  <div key={i} onPointerDown={(e) => calDown(e, i)}
                    className="absolute w-9 h-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/90 border-2 border-white text-white text-[12px] font-black flex items-center justify-center"
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, touchAction: 'none' }}>{i + 1}</div>
                ))}
                <button type="button" onClick={saveCalib}
                  className="absolute bottom-2 right-2 px-4 py-2 rounded-xl bg-cyan-600 text-white text-[13px] font-black">✓ Save calibration</button>
              </>
            )}
            {visible.filter((m) => m.x != null && Math.abs(now - m.t) < (m.type === 'ball' ? 0.12 : 1.5)).map((m, i) => (
              <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] pointer-events-none"
                style={{ left: `${(m.x ?? 0) * 100}%`, top: `${(m.y ?? 0) * 100}%`,
                         width: m.type === 'ball' ? 14 : 24, height: m.type === 'ball' ? 14 : 24,
                         borderColor: EV_STYLE[m.type]?.bg ?? '#fff' }} />
            ))}
            {pending && (
              <div className="absolute inset-x-0 top-1 flex justify-center pointer-events-none">
                <span className="px-3 py-1.5 rounded-full text-[13px] font-black text-white" style={{ background: EV_STYLE[pending].bg }}>
                  🎯 Tap where the ball {pending === 'ball' ? 'is' : 'landed'}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-white/70 text-[13px] p-6 text-center">Loading video…</div>
        )}
      </div>
      {/* marker strip: every event is a tick — tap to jump */}
      <div className="shrink-0 relative h-6 mx-2 mt-1 rounded bg-black/10 cursor-pointer"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * dur) }}>
        <div className="absolute top-0 bottom-0 w-0.5 bg-black/60" style={{ left: `${(now / dur) * 100}%` }} />
        {structural.map((m) => (
          <div key={m.eid} className="absolute top-0.5 bottom-0.5 w-1 rounded-full"
            style={{ left: `${(m.t / dur) * 100}%`, background: EV_STYLE[m.type]?.bg ?? '#888', opacity: m.src === 'machine' ? 0.35 : 1 }} />
        ))}
      </div>

      {/* label bar */}
      <div className="shrink-0 px-3 py-1.5 flex items-center gap-1.5 flex-wrap bg-surface border-b border-border/30">
        <button type="button" onClick={() => startSpot('out')} className="px-4 py-2 rounded-xl bg-red-600 text-white text-[14px] font-black active:opacity-80">🔴 OUT</button>
        <button type="button" onClick={markNet} className="px-3 py-2 rounded-xl bg-red-400 text-white text-[13px] font-black active:opacity-80">🥅 net-out</button>
        <button type="button" onClick={markServe} className="px-3 py-2 rounded-xl bg-cyan-600 text-white text-[13px] font-black active:opacity-80">▶ serve</button>
        <button type="button" onClick={() => startSpot('in')} className="px-3 py-2 rounded-xl bg-green-600 text-white text-[13px] font-bold active:opacity-80">👀 close-in</button>
        <button type="button" onClick={markBookmark} className="px-3 py-2 rounded-xl bg-purple-600 text-white text-[13px] font-black active:opacity-80">🔖</button>
        {pending && pending !== 'ball' && (
          <button type="button" onClick={() => commitSpot(null, null)} className="px-2.5 py-2 rounded-xl bg-surface border border-border/50 text-[12px] font-bold">Skip spot</button>
        )}
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => step(-30)} className="px-1.5 py-2 rounded-lg bg-surface border border-border/50 text-[11px] font-bold">−1s</button>
          <button type="button" onClick={() => step(-1)} className="px-1.5 py-2 rounded-lg bg-surface border border-border/50 text-[11px] font-bold">‹f</button>
          <button type="button" onClick={() => step(1)} className="px-1.5 py-2 rounded-lg bg-surface border border-border/50 text-[11px] font-bold">f›</button>
          <button type="button" onClick={() => step(30)} className="px-1.5 py-2 rounded-lg bg-surface border border-border/50 text-[11px] font-bold">+1s</button>
        </div>
        <span className="flex-1" />
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => logScore({ ...score, a: score.a + 1 })} className="px-2.5 py-2 rounded-xl bg-blue-600 text-white text-[13px] font-black">Us {score.a}</button>
          <button type="button" onClick={() => logScore({ ...score, a: Math.max(0, score.a - 1) })} className="px-1 py-2 text-[12px] font-bold text-blue-600">−</button>
          <button type="button" onClick={() => logScore({ ...score, b: score.b + 1 })} className="px-2.5 py-2 rounded-xl bg-amber-600 text-white text-[13px] font-black">Them {score.b}</button>
          <button type="button" onClick={() => logScore({ ...score, b: Math.max(0, score.b - 1) })} className="px-1 py-2 text-[12px] font-bold text-amber-600">−</button>
          <button type="button" onClick={() => logScore({ ...score, srv: score.srv === 1 ? 2 : 1 })} className="px-2 py-2 rounded-xl bg-surface border border-border/50 text-[11px] font-bold">srv {score.srv}</button>
        </div>
        <button type="button" onClick={() => setAdvanced((a) => !a)} className="px-2 py-2 rounded-lg text-[11px] font-bold text-muted border border-border/40">⚙</button>
        {advanced && (
          <button type="button" onClick={() => (pending === 'ball' ? (setPending(null), v()?.play().catch(() => {})) : startSpot('ball'))}
            className="px-2.5 py-2 rounded-xl text-[12px] font-black"
            style={pending === 'ball' ? { background: '#eab308', color: '#000' } : { background: '#fef08a', color: '#713f12' }}>
            {pending === 'ball' ? '🎾 done' : '🎾 ball tracer'}</button>
        )}
      </div>

      {/* panes: transcript (left / toggle) + event lane */}
      <div className="flex-1 min-h-0 flex">
        {showTalk && (
          <div ref={talkRef} className="w-[44%] min-w-[180px] max-w-[420px] overflow-y-auto border-r border-border/30 px-2 py-1">
            {transcript.map((u, i) => (
              <button key={i} type="button" onClick={() => seek(Math.max(0, u.t0 + voiceOff - 1))}
                className="block w-full text-left rounded px-1.5 py-1 text-[12px] leading-snug"
                style={i === curLine ? { background: 'rgba(124,58,237,0.14)', fontWeight: 700 } : {}}>
                <span className="text-muted tabular-nums mr-1">{fmt(u.t0 + voiceOff)}</span>{u.text}
              </button>
            ))}
          </div>
        )}
        <div ref={laneRef} className="flex-1 min-w-0 overflow-y-auto px-2 py-1 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowTalk((s) => !s)} className="px-2 py-1 rounded-lg text-[11px] font-bold border border-border/40">{showTalk ? '⇤ hide talk' : '⇥ talk'}</button>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => nudgeVoice(-1)} className="px-1.5 py-1 rounded-lg text-[10px] font-bold bg-surface border border-border/50">🎤−1s</button>
              <span className="text-[10px] text-muted tabular-nums w-7 text-center">{voiceOff > 0 ? '+' : ''}{voiceOff}s</span>
              <button type="button" onClick={() => nudgeVoice(1)} className="px-1.5 py-1 rounded-lg text-[10px] font-bold bg-surface border border-border/50">🎤+1s</button>
            </div>
            <span className="text-[11px] text-muted">{events.filter((e) => e.type === 'out').length} outs · {events.filter((e) => e.type === 'serve').length} serves labeled</span>
          </div>
          {structural.length === 0 && (
            <p className="text-muted text-[12px] text-center py-6">No events yet — label as you watch: ▶ serve … 🔴 OUT. Rallies build themselves.</p>
          )}
          {structural.map((e) => {
            const st = EV_STYLE[e.type] ?? EV_STYLE.note
            const active = Math.abs(now - e.t) < 3
            const desc = e.type === 'score' ? `${e.a}–${e.b}–${e.srv}`
              : e.type === 'out' ? `${e.cause === 'net' ? 'net' : 'out of bounds'}${spotDesc(calib, e.x, e.y)}`
              : e.type === 'serve' ? (rallyOf(e) ?? '')
              : e.type === 'in' ? `close ball stayed in${spotDesc(calib, e.x, e.y)}`
              : e.text ?? ''
            return (
              <div key={e.eid} className="rounded-lg px-1.5 py-1" style={{ background: active ? 'rgba(124,58,237,0.10)' : 'transparent' }}>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => seek(Math.max(0, e.t - 2))}
                    className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-black text-white tabular-nums"
                    style={{ background: st.bg, opacity: e.src === 'machine' ? 0.55 : 1 }}>{fmt(e.t)}</button>
                  <span className="shrink-0 text-[10px] font-black" style={{ color: st.bg }}>{st.label}{e.src === 'machine' ? ' 🤖' : ''}</span>
                  <span className="text-[12px] truncate">{desc}</span>
                  <span className="flex-1" />
                  {editEid === e.eid ? (
                    <>
                      <button type="button" onClick={() => { putEvent({ ...e, t: tNow() }); setEditEid(null) }}
                        className="px-2 py-1 rounded-lg bg-violet-600 text-white text-[11px] font-bold">⏱ set to now</button>
                      {e.src === 'machine' && (
                        <button type="button" onClick={() => { putEvent({ ...e, eid: undefined as unknown as string, src: 'tim' }); setEditEid(null) }}
                          className="px-2 py-1 rounded-lg bg-green-600 text-white text-[11px] font-bold">✓ adopt</button>
                      )}
                      {e.src !== 'machine' && (
                        <button type="button" onClick={() => { delEvent(e.eid); setEditEid(null) }}
                          className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold">✗ delete</button>
                      )}
                      <button type="button" onClick={() => setEditEid(null)} className="px-1.5 py-1 text-[11px] text-muted">esc</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setEditEid(e.eid)} className="px-1.5 py-1 text-[12px] opacity-50">✏️</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Review() {
  return <Suspense fallback={null}><FilmRoom /></Suspense>
}
