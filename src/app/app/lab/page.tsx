'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth'
import { COURT, COURT_POINTS, COURT_ALL_LINES, NVZ_BACK, NVZ_FRONT, CENTER_X } from '@/lib/pickleball-court'
import { homographyLeastSquares, applyHomography, type Homography } from '@/lib/homography'

type Pt = { x: number; y: number } // normalized 0..1 in the video frame
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const MIN_POINTS = 4 // a flat court in perspective is fixed by 4 points

// --- Lens distortion (division model, radial about the frame center) ---
// Phone wide lenses bow straight lines; k corrects it. We work in an
// aspect-corrected space so the radial term is round in real pixels.
function undistort(p: Pt, k: number, aspect: number): Pt {
  if (!k) return p
  const u = (p.x - 0.5) * aspect
  const v = p.y - 0.5
  const f = 1 + k * (u * u + v * v)
  return { x: (u / f) / aspect + 0.5, y: v / f + 0.5 }
}
function distort(p: Pt, k: number, aspect: number): Pt {
  if (!k) return p
  const u = (p.x - 0.5) * aspect
  const v = p.y - 0.5
  const ru = Math.hypot(u, v)
  if (ru < 1e-9) return p
  const disc = 1 - 4 * k * ru * ru
  const rd = disc < 0 ? ru : (1 - Math.sqrt(disc)) / (2 * k * ru)
  const s = rd / ru
  return { x: (u * s) / aspect + 0.5, y: v * s + 0.5 }
}

// The grab handle sits offset from the true point so a thumb doesn't cover it.
// Handle goes above the point, except near the top of frame where it goes below.
const HANDLE_OFFSET = 0.12
const handleOffset = (y: number) => (y < 0.28 ? HANDLE_OFFSET : -HANDLE_OFFSET)
const handlePos = (p: Pt): Pt => ({ x: p.x, y: p.y + handleOffset(p.y) })

// Dev-only line-calling lab. Where the cross-platform in/out caller gets built.
export default function LabPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  const [view, setView] = useState<'home' | 'clip' | 'calibrate'>('home')
  const [clipUrl, setClipUrl] = useState<string | null>(null)
  const [clipName, setClipName] = useState('')
  const [clipMeta, setClipMeta] = useState('')

  // One image point per known court landmark (null = not marked yet).
  const [points, setPoints] = useState<(Pt | null)[]>(() => COURT_POINTS.map(() => null))
  const [activeLm, setActiveLm] = useState(0) // landmark we're about to place
  const [off, setOff] = useState<Set<number>>(() => new Set()) // landmarks turned off (won't use)
  const [showModel, setShowModel] = useState(true)
  const [distortion, setDistortion] = useState(0) // lens straighten (radial k)
  const [aspect, setAspect] = useState(16 / 9)
  const [mapRot, setMapRot] = useState(0) // reference-map rotation in degrees (viewing aid)
  const [duration, setDuration] = useState(0)
  const [seek, setSeek] = useState(0)

  const recordRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const calVideoRef = useRef<HTMLVideoElement>(null)
  const dragRef = useRef<number | null>(null) // landmark index being dragged
  const placedRef = useRef<number | null>(null) // landmark freshly placed this gesture

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await createClient().auth.getUser()
        let ok = user?.email ? isSuperAdmin(user.email) : false
        if (!ok) {
          const p = await fetch('/api/user/profile').then((r) => (r.ok ? r.json() : null)).catch(() => null)
          const digits = (p?.phone || '').replace(/\D/g, '')
          ok = digits.startsWith('1') ? digits.slice(1, 4) === '999' : digits.slice(0, 3) === '999'
        }
        if (cancelled) return
        setAllowed(ok)
        if (!ok) router.replace('/app')
      } catch {
        if (!cancelled) { setAllowed(false); router.replace('/app') }
      }
    })()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => () => { if (clipUrl) URL.revokeObjectURL(clipUrl) }, [clipUrl])

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (clipUrl) URL.revokeObjectURL(clipUrl)
    setClipUrl(URL.createObjectURL(f))
    setClipName(f.name)
    setClipMeta(`${(f.size / 1_000_000).toFixed(1)} MB`)
    resetCalibration()
    setView('clip')
  }

  function resetCalibration() {
    setPoints(COURT_POINTS.map(() => null))
    setActiveLm(0)
    setOff(new Set())
    setDistortion(0)
    setShowModel(true)
  }

  // Pick a landmark to place/adjust (turning it back on if it was off).
  function pickLm(i: number) {
    setOff((prev) => { if (!prev.has(i)) return prev; const s = new Set(prev); s.delete(i); return s })
    setActiveLm(i)
  }

  // Skip the current landmark: mark it off and advance to the next usable one.
  function skipActive() {
    setOff((prev) => { const s = new Set(prev); s.add(activeLm); return s })
    setActiveLm(nextUnplaced(activeLm))
  }

  function startCalibrate() {
    resetCalibration()
    setSeek(0)
    setView('calibrate')
  }

  // Rough seed: drop the 4 corners as a default trapezoid so you can drag them
  // into place (and watch the green court follow) instead of tapping cold.
  // Real court-line detection replaces this guess later.
  function autoAlign() {
    setPoints((arr) => arr.map((p, i) => {
      if (i === 0) return { x: 0.30, y: 0.32 } // back-left
      if (i === 1) return { x: 0.70, y: 0.32 } // back-right
      if (i === 2) return { x: 0.90, y: 0.82 } // front-right
      if (i === 3) return { x: 0.10, y: 0.82 } // front-left
      return p
    }))
    setActiveLm(0)
  }

  function applySeek(t: number) {
    setSeek(t)
    if (calVideoRef.current) calVideoRef.current.currentTime = t
  }

  // Fit the rigid court to every marked point. We undistort each tapped point
  // first (removing lens curvature) so the straight-line homography fits clean.
  // 4 is exact; more just refines.
  function computeH(): Homography | null {
    const src: { x: number; y: number }[] = []
    const dst: Pt[] = []
    points.forEach((p, i) => { if (p) { src.push(COURT_POINTS[i].court); dst.push(undistort(p, distortion, aspect)) } })
    return src.length >= MIN_POINTS ? homographyLeastSquares(src, dst) : null
  }

  // Next usable landmark after `from` (unmarked and not turned off), wrapping.
  function nextUnplaced(from: number) {
    const n = COURT_POINTS.length
    for (let s = 1; s <= n; s++) {
      const i = (from + s) % n
      if (!points[i] && !off.has(i)) return i
    }
    return from
  }

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    // grab an existing marked point if we're near one
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      if (!p) continue
      if (Math.hypot(px - p.x * rect.width, py - p.y * rect.height) <= 22) {
        dragRef.current = i
        placedRef.current = null
        setActiveLm(i)
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }
    // otherwise drop the active landmark here (and clear its "off" state)
    const np = { x: clamp01(px / rect.width), y: clamp01(py / rect.height) }
    setPoints((arr) => arr.map((p, j) => (j === activeLm ? np : p)))
    setOff((prev) => { if (!prev.has(activeLm)) return prev; const s = new Set(prev); s.delete(activeLm); return s })
    dragRef.current = activeLm
    placedRef.current = activeLm
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (d == null) return
    const rect = e.currentTarget.getBoundingClientRect()
    setPoints((arr) => arr.map((p, j) => (j === d
      ? { x: clamp01((e.clientX - rect.left) / rect.width), y: clamp01((e.clientY - rect.top) / rect.height) }
      : p)))
  }

  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    if (placedRef.current != null) setActiveLm(nextUnplaced(placedRef.current))
    dragRef.current = null
    placedRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  function clearPoint(i: number) {
    setPoints((arr) => arr.map((p, j) => (j === i ? null : p)))
    setActiveLm(i)
  }

  // Dev: grab the frozen frame at full resolution so it can be handed to Claude
  // for auto-detection / point-placement. Downloads a PNG named with the time.
  function saveFrame() {
    const v = calVideoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0, c.width, c.height)
    c.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `court-frame-${Math.round((calVideoRef.current?.currentTime ?? 0) * 1000)}ms.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  if (!allowed) {
    return (
      <div className="h-full flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface overflow-y-auto">
      <AppHeader showBack />
      <input ref={recordRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={uploadRef} type="file" accept="video/*" className="hidden" onChange={onFile} />

      <div className="px-4 py-5 space-y-4 pb-10">
        <div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wide text-red-600 bg-red-100 px-2 py-0.5 rounded-full mb-2">Dev only</span>
          <h1 className="text-2xl font-bold text-foreground">Line-calling lab</h1>
          <p className="text-[14px] text-muted mt-1 leading-relaxed">Record or upload a rally, calibrate the court, and get the in/out call.</p>
        </div>

        {view === 'home' && (
          <div className="space-y-3">
            <ModeCard onClick={() => recordRef.current?.click()} accent="red" title="Record" desc="Capture a rally with your camera."
              icon={<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill="#ef4444" stroke="none" /></>} />
            <ModeCard onClick={() => uploadRef.current?.click()} accent="blue" title="Upload" desc="Analyze a clip you already have."
              icon={<><path d="M12 15V3M8 7l4-4 4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></>} />
            <ModeCard accent="muted" title="Live" badge="Soon" desc="Real-time calls with an on-court overlay." disabled
              icon={<><circle cx="12" cy="12" r="3" /><path d="M16.2 7.8a6 6 0 010 8.4M7.8 16.2a6 6 0 010-8.4M19 5a10 10 0 010 14M5 19A10 10 0 015 5" /></>} />

            <div className="bg-background border border-border/50 rounded-2xl p-4 space-y-1.5 mt-2">
              <p className="text-[12px] font-bold uppercase tracking-wide text-muted mb-1">Progress</p>
              <p className="text-[13px] text-foreground">✅ Phone → Claude clip transfer (Remote Control)</p>
              <p className="text-[13px] text-foreground">✅ CV toolchain installed (OpenCV + ffmpeg)</p>
              <p className="text-[13px] text-foreground">✅ Court model + perspective calibration</p>
              <p className="text-[13px] text-muted">⏳ Ball tracking → bounce → in/out</p>
            </div>
          </div>
        )}

        {view === 'clip' && (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={clipUrl ?? undefined} controls playsInline className="w-full max-h-[60vh]"
                onLoadedMetadata={(e) => {
                  const { videoWidth, videoHeight, duration: d } = e.currentTarget
                  setClipMeta((m) => (m.includes('×') ? m : `${videoWidth}×${videoHeight} · ${d.toFixed(1)}s · ${m}`))
                }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-foreground truncate">{clipName}</p>
              <p className="text-[12px] text-muted">{clipMeta}</p>
            </div>
            <button type="button" onClick={startCalibrate}
              className="w-full py-3.5 rounded-xl bg-primary text-white text-[15px] font-bold active:opacity-80 transition-opacity flex items-center justify-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h18v18H3zM3 9h18M9 3v18" />
              </svg>
              Calibrate the court
            </button>
            <button type="button" onClick={() => setView('home')}
              className="w-full py-3 rounded-xl bg-surface text-foreground border border-border/50 text-[14px] font-bold active:opacity-80 transition-opacity">
              Pick a different clip
            </button>
          </div>
        )}

        {view === 'calibrate' && (() => {
          const placedCount = points.filter(Boolean).length
          const H = computeH()
          const active = COURT_POINTS[activeLm]
          const activePlaced = !!points[activeLm]
          // court → ideal image (homography) → back into the lens-distorted frame
          const proj = (cp: { x: number; y: number }) => distort(applyHomography(H!, cp), distortion, aspect)
          const target = H && !activePlaced ? proj(active.court) : null

          let modelPath = ''
          if (H) {
            const N = 14 // sample each line so it can curve with the lens
            modelPath = COURT_ALL_LINES.map(([x1, y1, x2, y2]) => {
              let d = ''
              for (let s = 0; s <= N; s++) {
                const t = s / N
                const sp = proj({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t })
                d += `${s ? 'L' : 'M'} ${sp.x * 100},${sp.y * 100} `
              }
              return d
            }).join(' ')
          }
          return (
          <div className="space-y-3">
            <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] text-foreground font-semibold flex-1">
                  {activePlaced ? `${active.label} ✓ — drag to fine-tune` : `Tap where the ${active.label} is`}
                </p>
                <button type="button" onClick={skipActive}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface text-muted border border-border/50 flex-shrink-0 active:opacity-70 transition-opacity">
                  Can&apos;t see it — skip →
                </button>
              </div>
              <p className="text-[11px] text-muted mt-0.5">
                {placedCount < MIN_POINTS
                  ? `${placedCount}/${MIN_POINTS} points — mark any ${MIN_POINTS} you can clearly see and the whole court snaps in.`
                  : `${placedCount} points locked. Add more (net, kitchen T's) to tighten the fit.`}
              </p>
            </div>

            {/* Court map — tap a point here to choose which one to mark next */}
            <CourtMap points={points} activeLm={activeLm} off={off} rot={mapRot}
              onPick={pickLm} onRotate={() => setMapRot((r) => (r + 90) % 360)} />

            <button type="button" onClick={autoAlign}
              className="w-full py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-[12px] font-bold active:opacity-70 transition-opacity">
              ✦ Auto-align corners (rough start — then drag)
            </button>

            {/* Frozen frame + tap surface (video is paused, no controls — it can't play) */}
            <div className="relative rounded-2xl overflow-hidden bg-black select-none">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={calVideoRef} src={clipUrl ?? undefined} playsInline muted preload="metadata"
                className="w-full max-h-[60vh] pointer-events-none block"
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration)
                  if (e.currentTarget.videoHeight) setAspect(e.currentTarget.videoWidth / e.currentTarget.videoHeight)
                  e.currentTarget.pause()
                }} />
              <div className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                {showModel && modelPath && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* dark halo underneath for contrast, then the bright line */}
                    <path d={modelPath} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    <path d={modelPath} fill="none" stroke="#39FF14" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                )}
                {/* predicted spot for the point you're about to place */}
                {target && (
                  <div className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#39FF14] animate-pulse"
                    style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }} />
                )}
                {/* marked points */}
                {points.map((p, i) => {
                  if (!p) return null
                  const isActive = i === activeLm
                  return (
                    <div key={i} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center border-2 border-white shadow text-white font-bold ${isActive ? 'w-7 h-7 text-[10px] bg-primary' : 'w-5 h-5 text-[8px] bg-primary/80'}`}
                      style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
                      {COURT_POINTS[i].short}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Model overlay toggle */}
            {H && (
              <div className="flex items-center gap-2 rounded-xl bg-[#39FF14]/5 border border-[#39FF14]/30 px-3 py-2">
                <span className="w-4 h-1 bg-[#39FF14] rounded flex-shrink-0" />
                <p className="text-[11px] text-foreground flex-1 leading-snug">Green = the court warped to your points. It should sit on the painted lines — if not, drag a point or mark another.</p>
                <button type="button" onClick={() => setShowModel((s) => !s)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex-shrink-0 transition-opacity active:opacity-70 ${showModel ? 'bg-[#39FF14]/15 text-green-700 border-[#39FF14]/40' : 'bg-surface text-muted border-border/50'}`}>
                  {showModel ? 'On' : 'Off'}
                </button>
              </div>
            )}

            {/* Lens straighten — bends the green lines to match phone-lens curvature */}
            {H && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted w-24 flex-shrink-0">Lens straighten</span>
                <input type="range" min={-0.6} max={0.6} step={0.01} value={distortion}
                  onChange={(e) => setDistortion(parseFloat(e.target.value))} className="flex-1" />
                <button type="button" onClick={() => setDistortion(0)}
                  className="text-[11px] font-bold text-muted tabular-nums w-10 text-right active:opacity-70">{distortion.toFixed(2)}</button>
              </div>
            )}

            {/* Scrub to a clean frame */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted tabular-nums w-10">{seek.toFixed(1)}s</span>
              <input type="range" min={0} max={duration || 0} step={0.05} value={seek}
                onChange={(e) => applySeek(parseFloat(e.target.value))} className="flex-1" />
              <span className="text-[11px] text-muted tabular-nums w-10 text-right">{duration.toFixed(1)}s</span>
            </div>

            {/* Marked-points list */}
            {placedCount > 0 && (
              <div className="rounded-xl bg-background border border-border/50 divide-y divide-border/40">
                {points.map((p, i) => (p ? (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-6 h-5 rounded bg-primary/90 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{COURT_POINTS[i].short}</span>
                    <span className="text-[13px] text-foreground flex-1">{COURT_POINTS[i].label}</span>
                    <button type="button" onClick={() => clearPoint(i)} aria-label={`Remove ${COURT_POINTS[i].label}`}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-muted active:opacity-60 transition-opacity">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                ) : null))}
              </div>
            )}

            <button type="button" onClick={saveFrame}
              className="w-full py-2 rounded-xl bg-surface text-muted border border-border/50 text-[12px] font-bold active:opacity-70 transition-opacity">
              ⤓ Save this frame (for auto-detect tuning)
            </button>

            <div className="flex gap-2">
              <button type="button" onClick={resetCalibration} disabled={placedCount === 0}
                className="flex-1 py-2.5 rounded-xl bg-surface text-foreground border border-border/50 text-[13px] font-bold active:opacity-80 transition-opacity disabled:opacity-40">
                Reset
              </button>
              <button type="button" onClick={() => setView('clip')}
                className="flex-1 py-2.5 rounded-xl bg-surface text-muted border border-border/50 text-[13px] font-bold active:opacity-80 transition-opacity">
                Back
              </button>
            </div>

            {H && (
              <button type="button"
                onClick={() => alert(`Court locked from ${placedCount} points.\n\nNext build: ball track → bounce → in/out.`)}
                className="w-full py-3.5 rounded-xl bg-[#00C853] text-white text-[15px] font-bold active:opacity-80 transition-opacity">
                Analyze rally →
              </button>
            )}
          </div>
          )
        })()}
      </div>
    </div>
  )
}

// Top-down reference map. Tap a dot to select which landmark to mark next.
// Dots are tri-state: locked (placed, green), off (skipped, grey), or on
// (available). Rotate the map so it matches how the court sits in your video.
function CourtMap({ points, activeLm, off, rot, onPick, onRotate }: {
  points: (Pt | null)[]; activeLm: number; off: Set<number>; rot: number
  onPick: (i: number) => void; onRotate: () => void
}) {
  // Court length (44) horizontal, width (20) vertical; square viewBox so it
  // still fits when rotated 90°.
  const W = COURT.length
  const Hd = COURT.width
  const cx = W / 2
  const cy = Hd / 2
  const dx = (court: { x: number; y: number }) => court.y // 0..44
  const dy = (court: { x: number; y: number }) => court.x // 0..20
  return (
    <div className="rounded-xl bg-background border border-border/50 p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Court map</span>
        <button type="button" onClick={onRotate}
          className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface text-muted border border-border/50 active:opacity-70 transition-opacity flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
          Rotate
        </button>
      </div>
      <svg viewBox={`${cx - 26} ${cy - 26} 52 52`} className="w-full" style={{ maxHeight: 170 }}>
        <g transform={`rotate(${rot} ${cx} ${cy})`}>
          {/* court lines */}
          <g fill="none" stroke="#9ca3af" strokeWidth="0.35">
            <rect x={0} y={0} width={W} height={Hd} />
            <line x1={COURT.netY} y1={0} x2={COURT.netY} y2={Hd} stroke="#4285F4" strokeWidth="0.5" />
            <line x1={NVZ_BACK} y1={0} x2={NVZ_BACK} y2={Hd} />
            <line x1={NVZ_FRONT} y1={0} x2={NVZ_FRONT} y2={Hd} />
            <line x1={0} y1={CENTER_X} x2={NVZ_BACK} y2={CENTER_X} />
            <line x1={NVZ_FRONT} y1={CENTER_X} x2={W} y2={CENTER_X} />
          </g>
          {/* landmark dots */}
          {COURT_POINTS.map((lm, i) => {
            const placed = !!points[i]
            const isOff = off.has(i)
            const isActive = i === activeLm
            const fill = placed ? '#00C853' : isOff ? '#e5e7eb' : isActive ? '#4285F4' : '#ffffff'
            const stroke = placed ? '#00C853' : isOff ? '#d1d5db' : isActive ? '#4285F4' : '#9ca3af'
            return (
              <g key={lm.id} onClick={() => onPick(i)} style={{ cursor: 'pointer' }}>
                <circle cx={dx(lm.court)} cy={dy(lm.court)} r={2.6} fill="transparent" />
                <circle cx={dx(lm.court)} cy={dy(lm.court)} r={isActive ? 1.7 : 1.2}
                  fill={fill} stroke={stroke} strokeWidth={isActive ? 0.6 : 0.4} />
              </g>
            )
          })}
        </g>
      </svg>
      <p className="text-[10px] text-muted text-center mt-0.5">
        <span className="inline-block w-2 h-2 rounded-full bg-[#00C853] align-middle mr-1" />locked&nbsp;&nbsp;
        <span className="inline-block w-2 h-2 rounded-full bg-white border border-gray-400 align-middle mr-1" />on&nbsp;&nbsp;
        <span className="inline-block w-2 h-2 rounded-full bg-gray-200 align-middle mr-1" />off&nbsp;·&nbsp;
        <span className="text-primary font-semibold">{COURT_POINTS[activeLm].label}</span>
      </p>
    </div>
  )
}

function ModeCard({
  title, desc, icon, accent, badge, disabled, onClick,
}: {
  title: string; desc: string; icon: React.ReactNode
  accent: 'red' | 'blue' | 'muted'; badge?: string; disabled?: boolean; onClick?: () => void
}) {
  const stroke = accent === 'red' ? '#ef4444' : accent === 'blue' ? '#4285F4' : '#8892a7'
  const bg = accent === 'red' ? 'bg-red-500/10' : accent === 'blue' ? 'bg-primary/10' : 'bg-surface'
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full flex items-center gap-3.5 p-4 rounded-2xl bg-background border border-border/50 text-left transition-opacity ${disabled ? 'opacity-55' : 'active:opacity-80'}`}>
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[16px] font-bold text-foreground">{title}</p>
          {badge && <span className="text-[10px] font-bold uppercase tracking-wide text-muted bg-surface border border-border/50 px-1.5 py-0.5 rounded-full">{badge}</span>}
        </div>
        <p className="text-[13px] text-muted mt-0.5 leading-snug">{desc}</p>
      </div>
      {!disabled && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </button>
  )
}
