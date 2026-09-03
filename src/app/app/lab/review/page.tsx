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

const KIND_STYLE: Record<string, { bg: string; label: string }> = {
  call: { bg: '#7c3aed', label: 'CALL' },
  out: { bg: '#dc2626', label: 'OUT' },
  in: { bg: '#16a34a', label: 'IN' },
  rally: { bg: '#0891b2', label: 'RALLY' },
  score: { bg: '#d97706', label: 'SCORE' },
  voice: { bg: '#64748b', label: '🎤' },
  note: { bg: '#334155', label: 'NOTE' },
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
    }).catch(() => {})
  }, [allowed, id])

  function seek(t: number) {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, t - 2)
    v.play().catch(() => {})
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

  const shown = entries.filter((e) =>
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
      <div className="shrink-0 bg-black">
        {videoUrl ? (
          /* eslint-disable-next-line jsx-a11y/media-has-caption */
          <video ref={videoRef} src={videoUrl} controls playsInline preload="metadata"
            className="w-full max-h-[42vh] object-contain"
            onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} />
        ) : (
          <div className="text-white/70 text-[13px] p-6 text-center">Video still uploading — the log below works meanwhile</div>
        )}
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
