'use client'

import { useEffect, useRef, useState } from 'react'
import { AppHeader } from '@/components/app/header'
import { COURT_CORNERS, COURT_ALL_LINES } from '@/lib/pickleball-court'
import { homographyFromCorners, applyHomography } from '@/lib/homography'

type Pt = { x: number; y: number } // normalized to the image (may be <0 or >1 — no restrictions)
// 06/07 removed; 11/12 added round 3; 13–24 = Tim's real 1-camera photos (wet court, round 4)
const IMAGES = ['01', '02', '03', '04', '05', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'].map((n) => `/sim/court${n}.jpg`)
const DEFAULT_GUESS: Pt[] = [{ x: 0.30, y: 0.34 }, { x: 0.70, y: 0.34 }, { x: 0.90, y: 0.80 }, { x: 0.10, y: 0.80 }]
const STORE = 'sim-game-v1'

type Court = { c: Pt[]; kx: number; ky: number }
// Claude's court reads — round 3, each iterated against the pixels (render → inspect → correct)
// until the projected lines sit on the paint. Off-frame corners are derived via homography.
const CLAUDE: Record<string, Court> = {
  // white painted lines (NOT the blue pad edge — flagged to Tim as an open judgment call)
  '/sim/court01.jpg': { c: [{ x: 0.088, y: 0.454 }, { x: 0.565, y: 0.425 }, { x: 0.975, y: 0.625 }, { x: 0.525, y: 0.952 }], kx: 0, ky: 0 },
  // verified corner V at (0.600,0.855); far corners derived (off-frame in the trees)
  '/sim/court02.jpg': { c: [{ x: -0.271, y: 0.492 }, { x: 0.176, y: 0.478 }, { x: 0.847, y: 0.667 }, { x: 0.600, y: 0.855 }], kx: 0, ky: 0 },
  // aerial diamond: bottom, left, top, right vertices of the green court
  '/sim/court03.jpg': { c: [{ x: 0.462, y: 0.733 }, { x: 0.232, y: 0.492 }, { x: 0.598, y: 0.203 }, { x: 0.782, y: 0.282 }], kx: 0, ky: 0 },
  // heavy wide-angle; near baseline bows (ky)
  '/sim/court04.jpg': { c: [{ x: 0.618, y: 0.345 }, { x: 0.855, y: 0.350 }, { x: 0.452, y: 0.858 }, { x: 0.050, y: 0.468 }], kx: 0, ky: 0.10 },
  '/sim/court05.jpg': { c: [{ x: 0.114, y: 0.448 }, { x: 0.315, y: 0.388 }, { x: 0.838, y: 0.525 }, { x: 0.645, y: 0.684 }], kx: 0, ky: 0 },
  // broadcast angle: near corners off-frame below, mild fisheye
  '/sim/court08.jpg': { c: [{ x: 0.325, y: 0.224 }, { x: 0.638, y: 0.221 }, { x: 1.090, y: 0.984 }, { x: -0.084, y: 1.034 }], kx: -0.07, ky: 0 },
  '/sim/court09.jpg': { c: [{ x: 0.608, y: 0.519 }, { x: 0.928, y: 0.549 }, { x: 0.779, y: 0.787 }, { x: 0.130, y: 0.657 }], kx: 0, ky: 0 },
  '/sim/court10.jpg': { c: [{ x: 0.783, y: 0.382 }, { x: 1.183, y: 0.506 }, { x: -0.117, y: 1.342 }, { x: -0.107, y: 0.561 }], kx: 0, ky: 0 },
  // fresh courts — my reads, iterated blind against the pixels (6 and 4 rounds respectively)
  '/sim/court11.jpg': { c: [{ x: 0.212, y: 0.383 }, { x: 0.448, y: 0.383 }, { x: 0.641, y: 0.870 }, { x: 0.028, y: 0.848 }], kx: 0, ky: 0 },
  '/sim/court12.jpg': { c: [{ x: 0.548, y: 0.535 }, { x: 0.908, y: 0.576 }, { x: 0.985, y: 0.762 }, { x: 0.335, y: 0.848 }], kx: 0, ky: 0 },
  // 13–24: Tim's real wet-court photos. c15 = full-auto CV lock (zero-touch!); c17 tap+snap;
  // the rest are honest best-efforts — the wet-surface reflections defeated several reads.
  '/sim/court13.jpg': { c: [{ x: 0.1019, y: 0.8530 }, { x: 0.0592, y: 0.4280 }, { x: 0.6254, y: 0.3993 }, { x: 0.7313, y: 0.7196 }], kx: 0, ky: 0 },
  '/sim/court14.jpg': { c: [{ x: -0.0381, y: 1.0654 }, { x: 0.3817, y: 0.2978 }, { x: 0.6480, y: 0.3017 }, { x: 1.0121, y: 0.7794 }], kx: 0, ky: 0 },
  '/sim/court15.jpg': { c: [{ x: 0.3791, y: 0.3338 }, { x: 0.6365, y: 0.3494 }, { x: 0.9449, y: 0.9674 }, { x: -0.2155, y: 0.8455 }], kx: 0, ky: 0 },
  '/sim/court16.jpg': { c: [{ x: 0.0070, y: 0.8444 }, { x: 0.3643, y: 0.2714 }, { x: 0.6434, y: 0.2892 }, { x: 0.9690, y: 0.7969 }], kx: 0, ky: 0 },
  '/sim/court17.jpg': { c: [{ x: -0.1029, y: 0.9186 }, { x: 0.3239, y: 0.2997 }, { x: 0.6292, y: 0.3219 }, { x: 1.0627, y: 0.8519 }], kx: 0, ky: 0 },
  '/sim/court18.jpg': { c: [{ x: 0.4372, y: 0.3079 }, { x: 0.7880, y: 0.3271 }, { x: 0.8132, y: 0.8885 }, { x: -0.0209, y: 0.6122 }], kx: 0, ky: 0 },
  '/sim/court19.jpg': { c: [{ x: -0.0852, y: 0.6063 }, { x: 0.4148, y: 0.3107 }, { x: 0.8002, y: 0.3401 }, { x: 0.9474, y: 0.9596 }], kx: 0, ky: 0 },
  '/sim/court20.jpg': { c: [{ x: 0.3173, y: 0.3709 }, { x: 0.7440, y: 0.4099 }, { x: 0.7013, y: 1.0665 }, { x: -0.1094, y: 0.5379 }], kx: 0, ky: 0 },
  '/sim/court21.jpg': { c: [{ x: 0.3024, y: 0.3534 }, { x: 0.7780, y: 0.4360 }, { x: 0.6442, y: 1.0513 }, { x: -0.1396, y: 0.5221 }], kx: 0, ky: 0 },
  '/sim/court22.jpg': { c: [{ x: 0.3599, y: 0.3400 }, { x: 0.7999, y: 0.4198 }, { x: 0.7500, y: 1.0500 }, { x: -0.1000, y: 0.5199 }], kx: 0, ky: 0 },
  '/sim/court23.jpg': { c: [{ x: 0.0733, y: 0.4490 }, { x: 0.4472, y: 0.4175 }, { x: 0.9560, y: 0.5278 }, { x: 0.0483, y: 0.6176 }], kx: 0, ky: 0 },
  '/sim/court24.jpg': { c: [{ x: 0.2765, y: 0.3200 }, { x: 0.6995, y: 0.3628 }, { x: 0.8375, y: 0.7235 }, { x: 0.0195, y: 0.5286 }], kx: 0, ky: 0 },
}

// Two-axis lens distortion (division model, aspect-corrected, independent per axis).
// kx bows the left-right curvature, ky the top-down curvature.
function invAxis(ui: number, k: number): number {
  if (!k) return ui
  if (Math.abs(ui) < 1e-12) return 0
  const disc = 1 - 4 * k * ui * ui
  if (disc < 0) return ui
  return (1 - Math.sqrt(disc)) / (2 * k * ui)
}
function undistort(p: Pt, kx: number, ky: number, a: number): Pt {
  const u = (p.x - 0.5) * a, v = p.y - 0.5
  return { x: (u / (1 + kx * u * u)) / a + 0.5, y: v / (1 + ky * v * v) + 0.5 }
}
function distort(p: Pt, kx: number, ky: number, a: number): Pt {
  const u = (p.x - 0.5) * a, v = p.y - 0.5
  return { x: invAxis(u, kx) / a + 0.5, y: invAxis(v, ky) + 0.5 }
}
function courtPath(corners: Pt[], kx: number, ky: number, a: number): string {
  const cu = corners.map((c) => undistort(c, kx, ky, a))
  const H = homographyFromCorners(COURT_CORNERS, cu)
  if (!H) return ''
  const proj = (X: number, Y: number) => distort(applyHomography(H, { x: X, y: Y }), kx, ky, a)
  const N = 16
  return COURT_ALL_LINES.map(([x1, y1, x2, y2]) => {
    let d = ''
    for (let s = 0; s <= N; s++) {
      const t = s / N
      const sp = proj(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
      d += `${s ? 'L' : 'M'} ${sp.x * 100},${sp.y * 100} `
    }
    return d
  }).join(' ')
}

type Res = { score: number; errPx: number; yours: Pt[]; kx: number; ky: number }

export default function SimGame() {
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'place' | 'result'>('place')
  const [yours, setYours] = useState<Pt[]>(DEFAULT_GUESS)
  const [kx, setKx] = useState(0)
  const [ky, setKy] = useState(0)
  const [aspect, setAspect] = useState(16 / 9)
  const [natural, setNatural] = useState({ w: 1280, h: 720 })
  const [store, setStore] = useState<Record<string, Res>>({})
  const [loupe, setLoupe] = useState<Pt | null>(null)
  const dragRef = useRef<number | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const r = localStorage.getItem(STORE)
      if (r) {
        const data = JSON.parse(r) as Record<string, Res>
        // purge rounds for removed courts so the stats reflect the live set
        const filtered: Record<string, Res> = {}
        for (const k of Object.keys(data)) if (IMAGES.includes(k)) filtered[k] = data[k]
        setStore(filtered)
        localStorage.setItem(STORE, JSON.stringify(filtered))
        // flush to disk so Claude can read them
        fetch('/api/dev/sim-data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(filtered) }).catch(() => {})
      }
    } catch { /* ignore */ }
  }, [])
  useEffect(() => { setPhase('place'); setYours(DEFAULT_GUESS); setKx(0); setKy(0); setLoupe(null) }, [idx])

  const url = IMAGES[idx]
  const mine = CLAUDE[url] ?? { c: DEFAULT_GUESS, kx: 0, ky: 0 }

  function ptFrom(e: React.PointerEvent) {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  function onDown(e: React.PointerEvent) {
    if (phase !== 'place') return
    const r = boxRef.current!.getBoundingClientRect()
    const px = e.clientX - r.left, py = e.clientY - r.top
    let hit = -1, best = 34
    yours.forEach((c, i) => { const d = Math.hypot(px - c.x * r.width, py - c.y * r.height); if (d < best) { best = d; hit = i } })
    if (hit >= 0) { dragRef.current = hit; setLoupe(ptFrom(e)); (e.target as Element).setPointerCapture(e.pointerId) }
  }
  function onMove(e: React.PointerEvent) {
    if (dragRef.current == null) return
    const p = ptFrom(e); setYours((cs) => cs.map((c, i) => (i === dragRef.current ? p : c))); setLoupe(p)
  }
  function onUp() { dragRef.current = null; setLoupe(null) }

  // All court-line points that land INSIDE the visible frame for a placement.
  function visiblePoints(court: Pt[], ckx: number, cky: number): Pt[] {
    const cu = court.map((c) => undistort(c, ckx, cky, aspect))
    const H = homographyFromCorners(COURT_CORNERS, cu)
    if (!H) return []
    const pts: Pt[] = []
    const N = 20
    for (const [x1, y1, x2, y2] of COURT_ALL_LINES) {
      for (let s = 0; s <= N; s++) {
        const t = s / N
        const p = distort(applyHomography(H, { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t }), ckx, cky, aspect)
        if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) pts.push(p)
      }
    }
    return pts
  }

  function compare() {
    // Score = how well the two drawn courts agree WHERE THEY ARE VISIBLE
    // (symmetric chamfer between the projected line points inside the frame).
    // Off-frame corners are extrapolations — they never count against you.
    // Also inherently label-invariant: it compares the drawn lines, not corner #s.
    const A = visiblePoints(yours, kx, ky)
    const B = visiblePoints(mine.c, mine.kx, mine.ky)
    const dir = (P: Pt[], Q: Pt[]) => {
      let s = 0
      for (const p of P) {
        let m = Infinity
        for (const q of Q) { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < m) m = d }
        s += m
      }
      return s / P.length
    }
    const errNorm = A.length && B.length ? (dir(A, B) + dir(B, A)) / 2 : 1
    const errPx = Math.round(errNorm * Math.hypot(natural.w, natural.h))
    const score = Math.max(0, Math.min(100, Math.round(100 - errNorm * 800)))
    const next = { ...store, [url]: { score, errPx, yours, kx, ky } }
    setStore(next); try { localStorage.setItem(STORE, JSON.stringify(next)) } catch { /* ignore */ }
    // auto-save to disk so Claude reads your answers directly — no export needed
    fetch('/api/dev/sim-data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {})
    setPhase('result')
  }
  function exportData() {
    const json = JSON.stringify(store, null, 2)
    navigator.clipboard?.writeText(json).then(() => alert(`Copied ${Object.keys(store).length} rounds to clipboard.`), () => window.prompt('Copy the training data:', json))
  }

  const res = store[url]
  const scores = Object.values(store).map((r) => r.score)
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const tier = res ? (res.score >= 95 ? 'PASS' : res.score >= 70 ? 'PARTIAL' : 'REJECT') : null
  const tierColor = tier === 'PASS' ? '#00C853' : tier === 'PARTIAL' ? '#f59e0b' : '#ef4444'

  return (
    <div className="h-full flex flex-col bg-surface overflow-auto" style={{ overscrollBehavior: 'none' }}>
      <AppHeader showBack />
      <div className="w-full px-6 py-5 space-y-4 pb-12">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-block text-[11px] font-bold uppercase tracking-wide text-red-600 bg-red-100 px-2 py-0.5 rounded-full mb-2">Dev · Claude vs You</span>
            <h1 className="text-2xl font-bold text-foreground">Calibration match</h1>
            <p className="text-[13px] text-muted mt-1 leading-relaxed max-w-2xl">Place the court, then Compare. If your lines and mine <span className="font-semibold">agree</span>, we&apos;re confident. Disagreement = reject (still teaches us). Corners can go anywhere — even far off-screen. Use the two fisheye sliders for distorted shots.</p>
          </div>
          <div className="flex items-stretch gap-2">
            <Stat label="Court" value={`${idx + 1} / ${IMAGES.length}`} />
            <Stat label="Played" value={`${scores.length}`} />
            <Stat label="Avg agree" value={avg == null ? '—' : `${avg}`} />
            <Stat label="Passes" value={`${scores.filter((s) => s >= 95).length}`} />
            <button type="button" onClick={exportData} disabled={!scores.length}
              className="rounded-xl bg-background border border-border/50 px-3 text-[12px] font-bold text-foreground active:opacity-70 transition-opacity disabled:opacity-40">Export</button>
          </div>
        </div>

        <div className="relative w-full flex justify-center bg-surface touch-none" style={{ padding: '96px 16%', overflow: 'visible' }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div ref={boxRef} className="relative w-full" style={{ overflow: 'visible' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="court" className="w-full block rounded-lg pointer-events-none"
              onLoad={(e) => { const im = e.currentTarget; setNatural({ w: im.naturalWidth, h: im.naturalHeight }); if (im.naturalHeight) setAspect(im.naturalWidth / im.naturalHeight) }} />
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
              <path d={courtPath(yours, kx, ky, aspect)} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              <path d={courtPath(yours, kx, ky, aspect)} fill="none" stroke="#39FF14" strokeWidth="2.3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              {phase === 'result' && (
                <path d={courtPath(mine.c, mine.kx, mine.ky, aspect)} fill="none" stroke="#22d3ee" strokeWidth="2.3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeDasharray="4 3" />
              )}
            </svg>
            {phase === 'place' && yours.map((c, i) => (
              <div key={i} className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border-2 border-white shadow text-white text-[10px] font-bold flex items-center justify-center"
                style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}>{i + 1}</div>
            ))}
            {loupe && (
              <div className="absolute w-36 h-36 rounded-full border-[3px] border-white shadow-xl pointer-events-none overflow-hidden z-10"
                style={{ left: `calc(${loupe.x * 100}% - 72px)`, top: `calc(${loupe.y * 100}% - 180px)`, backgroundImage: `url(${url})`, backgroundRepeat: 'no-repeat', backgroundColor: '#000', backgroundSize: `${natural.w * 5}px ${natural.h * 5}px`, backgroundPosition: `${-loupe.x * natural.w * 5 + 72}px ${-loupe.y * natural.h * 5 + 72}px` }}>
                <div className="absolute left-1/2 top-0 w-px h-full bg-red-500/80" />
                <div className="absolute top-1/2 left-0 h-px w-full bg-red-500/80" />
              </div>
            )}
            {phase === 'result' && res && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-white text-[16px] font-bold shadow-lg z-10" style={{ background: tierColor }}>{tier} · {res.score}/100</div>
            )}
            {phase === 'result' && (
              <div className="absolute bottom-2 left-2 flex gap-3 text-[12px] font-bold z-10">
                <span className="text-[#39FF14] drop-shadow">■ You</span><span className="text-[#22d3ee] drop-shadow">▦ Claude</span>
              </div>
            )}
          </div>
        </div>

        {phase === 'place' && (
          <div className="max-w-xl mx-auto space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted w-24 flex-shrink-0">Fisheye ↔</span>
              <input type="range" min={-0.6} max={0.6} step={0.01} value={kx} onChange={(e) => setKx(parseFloat(e.target.value))} className="flex-1" />
              <span className="text-[11px] font-bold text-muted tabular-nums w-10 text-right">{kx.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted w-24 flex-shrink-0">Fisheye ↕</span>
              <input type="range" min={-0.6} max={0.6} step={0.01} value={ky} onChange={(e) => setKy(parseFloat(e.target.value))} className="flex-1" />
              <span className="text-[11px] font-bold text-muted tabular-nums w-10 text-right">{ky.toFixed(2)}</span>
              <button type="button" onClick={() => { setKx(0); setKy(0) }} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface text-muted border border-border/50 active:opacity-70 transition-opacity">Reset</button>
            </div>
          </div>
        )}

        <div className="flex gap-2 max-w-xl mx-auto">
          <button type="button" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
            className="px-4 py-3 rounded-xl bg-surface text-foreground border border-border/50 text-[14px] font-bold active:opacity-80 transition-opacity disabled:opacity-40">← Prev</button>
          {phase === 'place' ? (
            <button type="button" onClick={compare} className="flex-1 py-3 rounded-xl bg-primary text-white text-[15px] font-bold active:opacity-80 transition-opacity">Compare with Claude →</button>
          ) : (
            <button type="button" onClick={() => setIdx(Math.min(IMAGES.length - 1, idx + 1))}
              className="flex-1 py-3 rounded-xl bg-[#00C853] text-white text-[15px] font-bold active:opacity-80 transition-opacity">Next court →</button>
          )}
        </div>
        {phase === 'result' && res && (
          <p className="text-[12px] text-muted text-center">
            {tier === 'PASS' ? 'We agree — this would auto-accept.' : tier === 'PARTIAL' ? 'Close, but not confident — tighten it up.' : 'We disagree — one of us is off. Reject (still useful data).'}
            {' '}Visible-line gap: {res.errPx}px.
          </p>
        )}

        {scores.length >= IMAGES.length && (
          <div className="max-w-xl mx-auto rounded-xl bg-[#00C853]/10 border border-[#00C853]/30 px-4 py-3 text-center">
            <p className="text-[14px] font-bold text-green-700">🏁 All {IMAGES.length} courts played — results auto-sent to Claude</p>
            <p className="text-[12px] text-muted mt-0.5">Avg agreement {avg} · {scores.filter((s) => s >= 95).length} passes. Tell Claude to analyze the round.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background border border-border/50 px-3 py-2 text-center min-w-[64px]">
      <p className="text-[9px] uppercase tracking-wide text-muted font-bold">{label}</p>
      <p className="text-[15px] font-bold text-foreground tabular-nums">{value}</p>
    </div>
  )
}
