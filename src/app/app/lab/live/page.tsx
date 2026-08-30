'use client'

// Live Sim — courtside calibration loop (production-safe).
// Shoot -> upload (Supabase relay) -> place corner pins (Ts derive) -> the Mac's
// watcher runs the CV reader and its pins appear as cyan -> save truth -> new shot.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth'
import { isNative, getPlatform } from '@/lib/capacitor'
import { COURT_CORNERS, COURT_ALL_LINES } from '@/lib/pickleball-court'
import { homographyFromCorners, applyHomography } from '@/lib/homography'

type Pt = { x: number; y: number }
const DEFAULT_GUESS: Pt[] = [{ x: 0.30, y: 0.34 }, { x: 0.70, y: 0.34 }, { x: 0.90, y: 0.80 }, { x: 0.10, y: 0.80 }]
const T_MARKS = [
  { x: 0, y: 15 }, { x: 20, y: 15 }, { x: 0, y: 29 }, { x: 20, y: 29 },
  { x: 10, y: 0 }, { x: 10, y: 44 }, { x: 10, y: 15 }, { x: 10, y: 29 },
]
const ALL_MARKS = [...COURT_CORNERS, ...T_MARKS]

function courtPath(corners: Pt[], a: number): string {
  const H = homographyFromCorners(COURT_CORNERS, corners)
  if (!H) return ''
  const N = 12
  return COURT_ALL_LINES.map(([x1, y1, x2, y2]) => {
    let d = ''
    for (let s = 0; s <= N; s++) {
      const t = s / N
      const sp = applyHomography(H, { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t })
      d += `${s ? 'L' : 'M'} ${sp.x * 100},${sp.y * 100} `
    }
    return d
  }).join(' ')
}

function markerErr(mineC: Pt[], tims: Pt[], nw: number, nh: number): { avg: number; max: number } | null {
  const Hm = homographyFromCorners(COURT_CORNERS, mineC)
  if (!Hm) return null
  // pin NUMBERING must never matter: try all 8 quad orderings of Tim's pins
  // (4 rotations x 2 directions) and score the best correspondence
  const orders: number[][] = []
  for (let r = 0; r < 4; r++) {
    orders.push([0, 1, 2, 3].map((k) => (k + r) % 4))
    orders.push([0, 3, 2, 1].map((k) => (k + r) % 4))
  }
  let best: { avg: number; max: number } | null = null
  for (const ord of orders) {
    const Ht = homographyFromCorners(COURT_CORNERS, ord.map((k) => tims[k]))
    if (!Ht) continue
    const ds: number[] = []
    for (const m of ALL_MARKS) {
      const pt = applyHomography(Ht, m)
      if (pt.x < -0.02 || pt.x > 1.02 || pt.y < -0.02 || pt.y > 1.02) continue
      const pm = applyHomography(Hm, m)
      ds.push(Math.hypot((pt.x - pm.x) * nw, (pt.y - pm.y) * nh))
    }
    if (ds.length < 4) continue
    const avg = ds.reduce((s, d) => s + d, 0) / ds.length
    if (!best || avg < best.avg) best = { avg: Math.round(avg * 10) / 10, max: Math.round(Math.max(...ds) * 10) / 10 }
  }
  return best
}

export default function LiveSim() {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [mounted, setMounted] = useState(false)
  const [ids, setIds] = useState<string[]>([])
  const [cur, setCur] = useState<string | null>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [yours, setYours] = useState<Pt[]>(DEFAULT_GUESS)
  const [claude, setClaude] = useState<Pt[] | null>(null)
  const [status, setStatus] = useState('Take a shot to start')
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'reading' | 'ready' | 'manual' | 'saved'>('idle')
  const [label, setLabel] = useState<'good' | 'unusable' | null>(null)
  const [recRetake, setRecRetake] = useState(false)
  const [pollNonce, setPollNonce] = useState(0)
  const [busy, setBusy] = useState(false)
  const [natural, setNatural] = useState({ w: 1280, h: 720 })
  const [loupe, setLoupe] = useState<Pt | null>(null)
  const dragRef = useRef<{ i: number; dx: number; dy: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [areaEl, setAreaEl] = useState<HTMLDivElement | null>(null)
  const [avail, setAvail] = useState({ w: 900, h: 520 })

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await createClient().auth.getUser()
        const ok = user?.email ? isSuperAdmin(user.email) : false
        if (cancelled) return
        setAllowed(ok)
        if (!ok) router.replace('/app')
      } catch { if (!cancelled) { setAllowed(false); router.replace('/app') } }
    })()
    return () => { cancelled = true }
  }, [router])
  useEffect(() => {
    if (!areaEl) return
    const ro = new ResizeObserver(() => setAvail({ w: areaEl.clientWidth, h: areaEl.clientHeight }))
    ro.observe(areaEl)
    return () => ro.disconnect()
  }, [areaEl])

  // poll the current capture for the Mac's read
  useEffect(() => {
    if (!cur) return
    let stop = false
    const tick = async () => {
      try {
        const r = await fetch(`/api/lab/live?id=${cur}`).then((x) => x.json())
        if (stop) return
        if (r?.url && !imgUrl) setImgUrl(r.url)
        const cp = r?.meta?.claude_pins
        if (Array.isArray(cp) && cp.length === 4) {
          const read = cp.map((p: number[]) => ({ x: p[0], y: p[1] }))
          setClaude(read)
          // the read IS the starting point: green pins adopt it (clamped into
          // reach), then Tim moves them — auto-proposes, human corrects
          setYours(read.map((pt: Pt) => ({ x: Math.min(1.12, Math.max(-0.12, pt.x)), y: Math.min(1.06, Math.max(-0.06, pt.y)) })))
          const off = read.some((pt: Pt) => pt.x < -0.05 || pt.x > 1.05 || pt.y < -0.05 || pt.y > 1.05)
          setRecRetake(off)
          setPhase('ready')
          setStatus(off
            ? '⚠ My corners run OFF-SCREEN — I recommend 🚫 Retake (confirm, or fix pins to overrule me)'
            : 'Read arrived — green pins set to my read; fix & Save')
          return // stop polling
        }
        if (r?.meta?.status === 'error') {
          setPhase('manual')
          setStatus('No auto read — place pins manually (or Re-read)')
          return // stop polling; Re-read restarts it
        }
        setPhase('reading')
        setStatus('Mac is reading the court…')
      } catch { /* retry */ }
      if (!stop) setTimeout(tick, 3000)
    }
    tick()
    return () => { stop = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, pollNonce])

  async function uploadDataUrl(dataUrl: string) {
    setBusy(true); setPhase('uploading'); setStatus('Uploading…')
    try {
      const r = await fetch('/api/lab/live', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'upload', data: dataUrl }),
      }).then((x) => x.json())
      if (r?.id) {
        setIds((s) => [r.id, ...s])
        setCur(r.id); setImgUrl(null); setClaude(null); setYours(DEFAULT_GUESS); setLabel(null); setRecRetake(false)
        setPhase('reading'); setStatus('Mac is reading the court…')
      } else { setPhase('manual'); setStatus(`Upload failed: ${r?.error ?? '?'}`) }
    } catch (err) { setPhase('manual'); setStatus(`Upload failed: ${err}`) } finally { setBusy(false) }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || busy) return
    try {
      const bmp = await createImageBitmap(f)
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
      const cw = Math.round(bmp.width * scale), ch = Math.round(bmp.height * scale)
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch
      cv.getContext('2d')!.drawImage(bmp, 0, 0, cw, ch)
      await uploadDataUrl(cv.toDataURL('image/jpeg', 0.9))
    } catch (err) { setPhase('manual'); setStatus(`Capture failed: ${err}`) }
  }

  // In-page camera (HTTPS): live viewfinder + shutter — the OS picker was
  // hijacking the capture-input on Tim's phone. Falls back to the file input.
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camOn, setCamOn] = useState(false)
  const camBlockedRef = useRef(false)
  async function openCam() {
    if (busy) return
    // In the native app, use the NATIVE camera (same lesson as the QR scanner:
    // Android WebView getUserMedia is unreliable). Requires a build that
    // bundles @capacitor/camera — older builds fall through to the web paths.
    if (isNative() && getPlatform() === 'android') {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
        const shot = await Camera.getPhoto({
          source: CameraSource.Camera, resultType: CameraResultType.DataUrl,
          quality: 88, width: 1600, correctOrientation: true,
        })
        if (shot?.dataUrl) { await uploadDataUrl(shot.dataUrl); return }
        return
      } catch (err) {
        const msg = String(err)
        if (!/not implemented|not available|plugin/i.test(msg)) {
          setStatus(`Native camera: ${msg}`); setPhase('manual'); return
        }
        // plugin missing in this app build -> fall through to web camera/picker
      }
    }
    if (camBlockedRef.current) { fileRef.current?.click(); return } // known blocked: go straight to picker
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
      })
      streamRef.current = stream
      setCamOn(true)
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) } }, 50)
    } catch (err) {
      const name = (err as DOMException)?.name ?? ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        camBlockedRef.current = true
        setStatus('Camera blocked for this site — using photo picker (in Safari: aA → Website Settings → Camera → Allow to get the viewfinder)')
        fileRef.current?.click()
      } else {
        setStatus(`No camera available (${name || err}) — using photo picker`)
        fileRef.current?.click()
      }
    }
  }
  function closeCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamOn(false)
  }
  async function shutter() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const scale = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight))
    const cw = Math.round(v.videoWidth * scale), ch = Math.round(v.videoHeight * scale)
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch
    cv.getContext('2d')!.drawImage(v, 0, 0, cw, ch)
    closeCam()
    await uploadDataUrl(cv.toDataURL('image/jpeg', 0.9))
  }

  async function save() {
    if (!cur) return
    const metric = claude ? markerErr(claude, yours, natural.w, natural.h) : null
    setBusy(true)
    try {
      await fetch('/api/lab/live', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'pins', id: cur, pins: yours.map((p) => [p.x, p.y]), metric }),
      })
      setPhase('saved')
      setStatus(metric ? `Saved ✓ · markers avg ${metric.avg}px · worst ${metric.max}px` : 'Saved ✓')
    } catch { setStatus('Save failed') } finally { setBusy(false) }
  }

  async function setQuality(l: 'good' | 'unusable') {
    if (!cur) return
    setLabel(l)
    await fetch('/api/lab/live', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'label', id: cur, label: l }) }).catch(() => {})
    if (l === 'unusable') setStatus('Marked UNUSABLE — production would ask for a new photo. Next shot!')
  }
  function clearPins() { setYours(DEFAULT_GUESS); if (phase === 'saved') setPhase(claude ? 'ready' : 'manual') }
  async function reread() {
    if (!cur || busy) return
    setBusy(true)
    try {
      const moved = JSON.stringify(yours) !== JSON.stringify(DEFAULT_GUESS)
      await fetch('/api/lab/live', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'retry', id: cur, seed: moved ? yours.map((pt) => [pt.x, pt.y]) : null }),
      })
      setClaude(null); setPhase('reading'); setRecRetake(false)
      setStatus(moved ? 'Snapping from YOUR pins…' : 'Mac is re-reading the court…')
      setPollNonce((n) => n + 1)
    } finally { setBusy(false) }
  }

  function ptFrom(e: React.PointerEvent) {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  const lastPtRef = useRef<{ x: number; y: number; t: number } | null>(null)
  function onDown(e: React.PointerEvent) {
    dragRef.current = null
    if (!imgUrl) return
    const r = boxRef.current!.getBoundingClientRect()
    const px = e.clientX - r.left, py = e.clientY - r.top
    let hit = -1, best = 34
    yours.forEach((c, i) => { const d = Math.hypot(px - c.x * r.width, py - c.y * r.height); if (d < best) { best = d; hit = i } })
    if (hit >= 0) {
      const p = ptFrom(e)
      dragRef.current = { i: hit, dx: 0, dy: 0 }
      lastPtRef.current = { ...p, t: performance.now() }
      setLoupe({ x: yours[hit].x, y: yours[hit].y })
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }
  function onMove(e: React.PointerEvent) {
    const d = dragRef.current
    const last = lastPtRef.current
    if (d == null || last == null) return
    const p = ptFrom(e)
    const r = boxRef.current!.getBoundingClientRect()
    const now = performance.now()
    // adaptive precision (Tim's ask): slow finger -> ~20% speed for pixel-level
    // placement; fast finger -> full speed for coarse moves. Speed IS the mode.
    const distPx = Math.hypot((p.x - last.x) * r.width, (p.y - last.y) * r.height)
    const speed = distPx / Math.max(1, now - last.t) // px per ms
    const gain = Math.min(1, 0.2 + speed * 0.5)
    lastPtRef.current = { ...p, t: now }
    setYours((cs) => cs.map((c, i) => {
      if (i !== d.i) return c
      const np = { x: c.x + (p.x - last.x) * gain, y: c.y + (p.y - last.y) * gain }
      setLoupe(np)
      return np
    }))
  }
  function onUp() { dragRef.current = null; lastPtRef.current = null; setLoupe(null) }

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

  const metric = claude ? markerErr(claude, yours, natural.w, natural.h) : null
  const idxIn = cur ? ids.indexOf(cur) : -1

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-surface overflow-hidden" style={{ overscrollBehavior: 'none' }}>
      <AppHeader showBack />
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full whitespace-nowrap">Live Sim · courtside</span>
        <span className="px-3 py-1 rounded-full text-[12px] font-bold text-white truncate"
          style={{ background: phase === 'reading' || phase === 'uploading' ? '#f59e0b' : phase === 'ready' ? '#0891b2' : phase === 'manual' ? '#ef4444' : phase === 'saved' ? '#00C853' : '#64748b' }}>
          {(phase === 'reading' || phase === 'uploading') ? '⏳ ' : ''}{status}</span>
        {metric && (
          <span className="px-3 py-1 rounded-full text-white text-[12px] font-bold whitespace-nowrap"
            style={{ background: metric.avg <= 5 ? '#00C853' : metric.avg <= 15 ? '#f59e0b' : '#ef4444' }}>
            avg {metric.avg}px · worst {metric.max}px
          </span>
        )}
      </div>

      <div ref={setAreaEl} className="flex-1 min-h-0 relative flex items-center justify-center touch-none" style={{ overflow: 'visible' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div ref={boxRef} className="relative" style={{ overflow: 'visible' }}>
          {imgUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={imgUrl} alt="court" className="block rounded-lg pointer-events-none"
              style={{ maxWidth: Math.max(240, Math.round(avail.w * 0.76)), maxHeight: Math.max(180, Math.round(avail.h * 0.86)) }}
              onLoad={(e) => { const im = e.currentTarget; setNatural({ w: im.naturalWidth, h: im.naturalHeight }) }} />
          ) : (
            <div className="text-muted text-[14px] px-8 text-center">📷 Tap <span className="font-bold">New shot</span>, photograph the court from your mount, and calibrate it live.</div>
          )}
          {imgUrl && (phase === 'uploading' || phase === 'reading') && (
            <div className="absolute inset-0 rounded-lg bg-black/45 flex flex-col items-center justify-center z-20 pointer-events-none">
              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-white text-[14px] font-bold mt-3">Claude is reading the court…</p>
            </div>
          )}
          {imgUrl && phase !== 'uploading' && phase !== 'reading' && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
              <path d={courtPath(yours, 1)} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              <path d={courtPath(yours, 1)} fill="none" stroke="#39FF14" strokeWidth="2.3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              {claude && <path d={courtPath(claude, 1)} fill="none" stroke="#22d3ee" strokeWidth="2.3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeDasharray="4 3" />}
            </svg>
          )}
          {imgUrl && phase !== 'uploading' && phase !== 'reading' && yours.map((c, i) => (
            <div key={i} className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border-2 border-white shadow text-white text-[11px] font-bold flex items-center justify-center pointer-events-none"
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}>{i + 1}</div>
          ))}
          {imgUrl && phase !== 'uploading' && phase !== 'reading' && (() => {
            const Ht = homographyFromCorners(COURT_CORNERS, yours)
            if (!Ht) return null
            return T_MARKS.map((m, i) => {
              const p = applyHomography(Ht, m)
              return <div key={`t${i}`} className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black/50 shadow pointer-events-none" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, background: '#facc15' }} />
            })
          })()}
          {imgUrl && claude && phase !== 'uploading' && phase !== 'reading' && (() => {
            const Hm = homographyFromCorners(COURT_CORNERS, claude)
            if (!Hm) return null
            return ALL_MARKS.map((m, i) => {
              const p = applyHomography(Hm, m)
              return <div key={`m${i}`} className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#22d3ee] pointer-events-none" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />
            })
          })()}
        </div>
        {loupe && imgUrl && (
          <div className="fixed right-2 rounded-2xl border-[3px] border-white shadow-xl pointer-events-none overflow-hidden z-50"
            style={{ top: 56, width: 150, height: 150, backgroundImage: `url(${imgUrl})`, backgroundRepeat: 'no-repeat', backgroundColor: '#000', backgroundSize: `${natural.w * 4}px ${natural.h * 4}px`, backgroundPosition: `${-loupe.x * natural.w * 4 + 75}px ${-loupe.y * natural.h * 4 + 75}px` }}>
            <div className="absolute left-1/2 top-0 w-px h-full bg-red-500/80" />
            <div className="absolute top-1/2 left-0 h-px w-full bg-red-500/80" />
          </div>
        )}
        <div style={{ display: 'none' }} />
      </div>

      <div className="px-3 pb-3 pt-1 flex items-center justify-center gap-2 flex-wrap">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        <button type="button" onClick={openCam} disabled={busy}
          className="px-4 py-2.5 rounded-xl bg-violet-500 text-white text-[14px] font-bold active:opacity-80 disabled:opacity-50">📷 New shot</button>
        <button type="button" onClick={() => setQuality('good')} disabled={!cur}
          className="px-3 py-2.5 rounded-xl text-[13px] font-bold border-2 disabled:opacity-40"
          style={label === 'good' ? { background: '#00C853', borderColor: '#00C853', color: '#fff' } : { borderColor: '#00C853', color: '#00C853' }}>👍 Usable</button>
        <button type="button" onClick={() => setQuality('unusable')} disabled={!cur}
          className={`px-3 py-2.5 rounded-xl text-[13px] font-bold border-2 disabled:opacity-40${recRetake && !label ? ' animate-pulse ring-2 ring-red-400' : ''}`}
          style={label === 'unusable' ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff' } : { borderColor: '#ef4444', color: '#ef4444' }}>🚫 Retake</button>
        <button type="button" onClick={clearPins} disabled={!cur}
          className="px-3 py-2.5 rounded-xl bg-surface border border-border/50 text-[13px] font-bold disabled:opacity-40">↺ Clear</button>
        <button type="button" onClick={reread} disabled={busy || !cur}
          className="px-3 py-2.5 rounded-xl bg-[#f59e0b] text-white text-[13px] font-bold active:opacity-80 disabled:opacity-40">🔁 Re-read</button>
        <button type="button" onClick={save} disabled={busy || !cur}
          className="px-4 py-2.5 rounded-xl bg-[#00C853] text-white text-[14px] font-bold active:opacity-80 disabled:opacity-50">💾 Save</button>
        <button type="button" disabled={idxIn < 0 || idxIn >= ids.length - 1}
          onClick={() => { const n = ids[idxIn + 1]; setCur(n); setImgUrl(null); setClaude(null); setYours(DEFAULT_GUESS) }}
          className="px-3 py-2.5 rounded-xl bg-surface border border-border/50 text-[13px] font-bold disabled:opacity-40">← Older</button>
        <button type="button" disabled={idxIn <= 0}
          onClick={() => { const n = ids[idxIn - 1]; setCur(n); setImgUrl(null); setClaude(null); setYours(DEFAULT_GUESS) }}
          className="px-3 py-2.5 rounded-xl bg-surface border border-border/50 text-[13px] font-bold disabled:opacity-40">Newer →</button>
      </div>
      {camOn && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} playsInline muted className="flex-1 min-h-0 object-contain" />
          <div className="flex items-center justify-center gap-6 py-4 bg-black">
            <button type="button" onClick={closeCam} className="px-5 py-3 rounded-xl bg-white/15 text-white text-[14px] font-bold">Cancel</button>
            <button type="button" onClick={shutter} className="w-18 h-18 px-6 py-6 rounded-full bg-white border-4 border-white/40 shadow-xl" aria-label="Take photo" />
            <button type="button" onClick={() => fileRef.current?.click()} className="px-5 py-3 rounded-xl bg-white/15 text-white text-[14px] font-bold">Library</button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
