'use client'

// Match Review — watch the session video with the machine's full log beside
// it: transcript lines, line calls, rally notes, score reads. Tap any entry
// to jump the video there; leave a comment on any timestamp — comments land
// in the relay bucket where the Mac-side analysis reads them next session.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { AppHeader } from '@/components/app/header'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth'

type Entry = { t: number; kind: string; text: string }
type Comment = { t: number; text: string; at: number }
type Verdict = 'OUT' | 'IN' | 'NET' | 'BALL'
type Mark = { t: number; verdict?: Verdict; x?: number | null; y?: number | null;
  kind?: string; a?: number; b?: number; srv?: number; at: number }

const KIND_STYLE: Record<string, { bg: string; label: string }> = {
  call: { bg: '#7c3aed', label: 'CALL' },
  out: { bg: '#dc2626', label: 'OUT' },
  in: { bg: '#16a34a', label: 'IN' },
  rally: { bg: '#0891b2', label: 'RALLY' },
  score: { bg: '#d97706', label: 'SCORE' },
  voice: { bg: '#64748b', label: '🎤' },
  note: { bg: '#334155', label: 'NOTE' },
  net: { bg: '#f97316', label: 'NET' },
}

function fmt(t: number) {
  const m = Math.floor(t / 60); const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function ReviewInner() {
  const router = useRouter()
  const params = useSearchParams()
  const id = (params.get('id') ?? 'match1').replace(/[^a-z0-9]/gi, '')
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [mounted, setMounted] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [marks, setMarks] = useState<Mark[]>([])
  const [pendingVerdict, setPendingVerdict] = useState<Verdict | null>(null)
  const [title, setTitle] = useState('Match Review')
  const [filter, setFilter] = useState<'all' | 'calls' | 'talk'>('all')
  const [now, setNow] = useState(0)
  const [draftAt, setDraftAt] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

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
      if (r?.log?.entries) setEntries(r.log.entries)
      if (r?.log?.title) setTitle(r.log.title)
      setComments(r?.comments ?? [])
      setMarks(r?.marks ?? [])
    }).catch(() => {})
  }, [allowed, id])

  function seek(t: number) {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, t - 2)
    v.play().catch(() => {})
  }
  // Label mode: tap OUT/IN while watching -> video pauses -> tap the landing
  // spot on the video (or Skip) -> resumes. Dense ground truth, fast.
  function startMark(verdict: Verdict) {
    const v = videoRef.current
    if (!v) return
    v.pause()
    setPendingVerdict(verdict)
  }
  // frame stepping: nail the exact contact frame before tapping the spot
  function step(frames: number) {
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = Math.max(0, v.currentTime + frames / 30)
  }
  async function commitMark(x: number | null, y: number | null) {
    const v = videoRef.current
    if (!v || !pendingVerdict) return
    const mark: Mark = { t: Math.round(v.currentTime * 100) / 100, verdict: pendingVerdict, x, y, at: Date.now() }
    setMarks((m) => [...m, mark])
    const wasBall = pendingVerdict === 'BALL'
    setPendingVerdict(null)
    if (wasBall) setPendingVerdict('BALL') // stay in ball mode: step frames, keep tapping
    else v.play().catch(() => {})
    await fetch('/api/lab/live', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'mark', id, t: mark.t, verdict: mark.verdict, x, y }),
    }).catch(() => {})
  }
  async function undoMark() {
    setMarks((m) => m.slice(0, -1))
    await fetch('/api/lab/live', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'mark_undo', id }),
    }).catch(() => {})
  }
  function onVideoTap(e: React.MouseEvent<HTMLDivElement>) {
    if (!pendingVerdict) return
    const r = e.currentTarget.getBoundingClientRect()
    commitMark((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
  }
  // scoreboard: tap a team to give them the point — logs the new score at the
  // current video time; the transcript's heard scores verify it later
  const [score, setScore] = useState({ a: 0, b: 0, srv: 1 })
  async function logScore(next: { a: number; b: number; srv: number }) {
    setScore(next)
    const v = videoRef.current
    const t = Math.round((v?.currentTime ?? 0) * 10) / 10
    setMarks((m) => [...m, { t, kind: 'score', a: next.a, b: next.b, srv: next.srv, at: Date.now() }])
    await fetch('/api/lab/live', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'score_mark', id, t, a: next.a, b: next.b, srv: next.srv }),
    }).catch(() => {})
  }
  async function sendComment() {
    if (draftAt == null || !draft.trim()) return
    const text = draft.trim()
    setComments((c) => [...c, { t: draftAt, text, at: Date.now() }])
    setDraft(''); setDraftAt(null)
    await fetch('/api/lab/live', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'comment', id, t: draftAt, text }),
    }).catch(() => {})
  }

  const markEntries: Entry[] = marks
    .filter((m) => m.verdict !== 'BALL') // ball-position marks are training data, not timeline events
    .map((m) => m.kind === 'score'
      ? { t: m.t, kind: 'score', text: `🏷 SCORE ${m.a}–${m.b}–${m.srv}` }
      : { t: m.t, kind: m.verdict === 'OUT' ? 'out' : m.verdict === 'IN' ? 'in' : 'net',
          text: `🏷 YOU labeled ${m.verdict}${m.x != null ? ' (spot marked)' : ''}` })
  const merged = [...entries, ...markEntries].sort((a, b) => a.t - b.t)
  const shown = merged.filter((e) =>
    filter === 'all' ? true :
    filter === 'calls' ? ['call', 'out', 'in', 'rally', 'score', 'note'].includes(e.kind) :
    e.kind === 'voice')

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
      <div className="px-3 py-1.5 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">{title}</span>
        <span className="flex-1" />
        {(['all', 'calls', 'talk'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className="px-2.5 py-1 rounded-full text-[11px] font-bold border-2"
            style={filter === f ? { background: '#7c3aed', borderColor: '#7c3aed', color: '#fff' } : { borderColor: '#7c3aed', color: '#7c3aed' }}>
            {f === 'all' ? 'Everything' : f === 'calls' ? 'Calls & notes' : 'Transcript'}</button>
        ))}
      </div>
      <div className="shrink-0 bg-black flex justify-center">
        {videoUrl ? (
          <div className="relative w-full" style={{ maxHeight: '40vh', aspectRatio: '16/9', maxWidth: 'calc(40vh * 16 / 9)' }}
            onClick={onVideoTap}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} src={videoUrl} controls={!pendingVerdict} playsInline preload="metadata"
              className="absolute inset-0 w-full h-full"
              onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} />
            {marks.filter((m) => m.x != null && Math.abs(now - m.t) < (m.verdict === 'BALL' ? 0.12 : 1.5)).map((m, i) => (
              <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] pointer-events-none"
                style={{ left: `${(m.x ?? 0) * 100}%`, top: `${(m.y ?? 0) * 100}%`,
                         width: m.verdict === 'BALL' ? 14 : 24, height: m.verdict === 'BALL' ? 14 : 24,
                         borderColor: m.verdict === 'OUT' ? '#ef4444' : m.verdict === 'IN' ? '#22c55e'
                                    : m.verdict === 'NET' ? '#f97316' : '#eab308' }} />
            ))}
            {pendingVerdict && (
              <div className="absolute inset-0 flex items-start justify-center pointer-events-none" style={{ cursor: 'crosshair' }}>
                <span className="mt-2 px-3 py-1.5 rounded-full text-[13px] font-black text-white"
                  style={{ background: pendingVerdict === 'OUT' ? '#ef4444' : '#16a34a' }}>
                  🎯 Tap where the ball landed</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-white/70 text-[13px] p-6 text-center">Video still uploading — the log below works meanwhile</div>
        )}
      </div>
      {/* Label mode: dense ground truth while you watch */}
      <div className="shrink-0 px-3 py-1.5 flex items-center gap-2 flex-wrap bg-surface border-b border-border/30">
        <button type="button" onClick={() => startMark('OUT')}
          className="px-5 py-2 rounded-xl bg-red-600 text-white text-[14px] font-black active:opacity-80">🔴 OUT</button>
        <button type="button" onClick={() => startMark('IN')}
          className="px-5 py-2 rounded-xl bg-green-600 text-white text-[14px] font-black active:opacity-80">🟢 IN</button>
        <button type="button" onClick={() => startMark('NET')}
          className="px-3 py-2 rounded-xl bg-orange-500 text-white text-[13px] font-black active:opacity-80">🥅 NET</button>
        <button type="button" onClick={() => (pendingVerdict === 'BALL' ? (setPendingVerdict(null), videoRef.current?.play().catch(() => {})) : startMark('BALL'))}
          className="px-3 py-2 rounded-xl text-[13px] font-black active:opacity-80"
          style={pendingVerdict === 'BALL' ? { background: '#eab308', color: '#000' } : { background: '#fef08a', color: '#713f12' }}>
          {pendingVerdict === 'BALL' ? '🎾 done' : '🎾 BALL'}</button>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => step(-30)} className="px-2 py-2 rounded-lg bg-surface border border-border/50 text-[12px] font-bold">−1s</button>
          <button type="button" onClick={() => step(-1)} className="px-2 py-2 rounded-lg bg-surface border border-border/50 text-[12px] font-bold">‹f</button>
          <button type="button" onClick={() => step(1)} className="px-2 py-2 rounded-lg bg-surface border border-border/50 text-[12px] font-bold">f›</button>
          <button type="button" onClick={() => step(30)} className="px-2 py-2 rounded-lg bg-surface border border-border/50 text-[12px] font-bold">+1s</button>
        </div>
        {pendingVerdict && pendingVerdict !== 'BALL' && (
          <button type="button" onClick={() => commitMark(null, null)}
            className="px-3 py-2 rounded-xl bg-surface border border-border/50 text-[13px] font-bold">Skip spot</button>
        )}
        <span className="text-[11px] text-muted">{marks.length} labeled</span>
        <span className="flex-1" />
        {/* scoreboard: tap a side when they score; − fixes mistakes */}
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => logScore({ ...score, a: score.a + 1 })}
            className="px-3 py-2 rounded-xl bg-blue-600 text-white text-[14px] font-black active:opacity-80">Us {score.a}</button>
          <button type="button" onClick={() => logScore({ ...score, a: Math.max(0, score.a - 1) })}
            className="px-1.5 py-2 rounded-lg text-[12px] font-bold text-blue-600">−</button>
          <button type="button" onClick={() => logScore({ ...score, b: score.b + 1 })}
            className="px-3 py-2 rounded-xl bg-amber-600 text-white text-[14px] font-black active:opacity-80">Them {score.b}</button>
          <button type="button" onClick={() => logScore({ ...score, b: Math.max(0, score.b - 1) })}
            className="px-1.5 py-2 rounded-lg text-[12px] font-bold text-amber-600">−</button>
          <button type="button" onClick={() => logScore({ ...score, srv: score.srv === 1 ? 2 : 1 })}
            className="px-2.5 py-2 rounded-xl bg-surface border border-border/50 text-[12px] font-bold">srv {score.srv}</button>
        </div>
        <button type="button" onClick={undoMark} disabled={!marks.length}
          className="px-3 py-2 rounded-xl bg-surface border border-border/50 text-[13px] font-bold disabled:opacity-40">↩ Undo</button>
      </div>
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-1">
        {shown.length === 0 && (
          <p className="text-muted text-[13px] text-center py-8">Log is being generated — check back shortly.</p>
        )}
        {shown.map((e, i) => {
          const st = KIND_STYLE[e.kind] ?? KIND_STYLE.note
          const active = Math.abs(now - e.t) < 4
          const cmts = comments.filter((c) => Math.abs(c.t - e.t) < 0.5)
          return (
            <div key={i} className="rounded-lg px-2 py-1.5" style={{ background: active ? 'rgba(124,58,237,0.10)' : 'transparent' }}>
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => seek(e.t)}
                  className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-black text-white tabular-nums"
                  style={{ background: st.bg }}>{fmt(e.t)}</button>
                <span className="shrink-0 text-[10px] font-black mt-0.5" style={{ color: st.bg }}>{st.label}</span>
                <span className={`text-[13px] leading-snug ${e.kind === 'voice' ? 'text-muted italic' : 'font-medium'}`}>{e.text}</span>
                <span className="flex-1" />
                <button type="button" onClick={() => { setDraftAt(e.t); setDraft('') }}
                  className="shrink-0 text-[12px] opacity-50">💬</button>
              </div>
              {cmts.map((c, j) => (
                <div key={j} className="ml-14 mt-1 text-[12px] bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  <span className="font-bold text-amber-700">Tim:</span> {c.text}
                </div>
              ))}
              {draftAt === e.t && (
                <div className="ml-14 mt-1 flex gap-1">
                  <input autoFocus value={draft} onChange={(ev) => setDraft(ev.target.value)}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') sendComment() }}
                    placeholder={`Comment at ${fmt(e.t)}…`}
                    className="flex-1 text-[13px] border border-border rounded-lg px-2 py-1 bg-surface" />
                  <button type="button" onClick={sendComment}
                    className="px-3 py-1 rounded-lg bg-[#00C853] text-white text-[12px] font-bold">Send</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>,
    document.body
  )
}

export default function Review() {
  return <Suspense fallback={null}><ReviewInner /></Suspense>
}
