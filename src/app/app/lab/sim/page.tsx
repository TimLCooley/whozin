'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth'
import { COURT_CORNERS, COURT_ALL_LINES } from '@/lib/pickleball-court'
import { homographyFromCorners, applyHomography } from '@/lib/homography'

type Pt = { x: number; y: number } // normalized to the image (may be <0 or >1 — no restrictions)
// 06/07 removed; 11/12 added round 3; 13–24 = Tim's real 1-camera photos (wet court).
// 18/19/21 removed round 5: shot at 0.5x ultra-wide — the product requires 1x zoom.
const IMAGES = ['01', '02', '03', '04', '05', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '20', '22', '23', '24'].map((n) => `/sim/court${n}.jpg`)
const DEFAULT_GUESS: Pt[] = [{ x: 0.30, y: 0.34 }, { x: 0.70, y: 0.34 }, { x: 0.90, y: 0.80 }, { x: 0.10, y: 0.80 }]
const STORE = 'sim-game-v3' // v2 wiped for round 6 (live-auto flow); archives in .dev-sim/

type Court = { c: Pt[]; kx: number; ky: number }
// Claude's court reads, round 5.
// 01–12: adopted from Tim's round-4 corrections (referee-confirmed on the paint) — settled.
// 13–24: Claude's honest reads stand from round 4; the round-5 auto pipelines (multi-
// hypothesis + line-assignment enumeration) only beat them on c15 — wet-surface decoys
// game every selection signal (referee/coverage/IoU/line-agreement). Use SNAP instead.
const CLAUDE: Record<string, Court> = {
  '/sim/court01.jpg': { c: [{ x: 0.0299, y: 0.4709 }, { x: 0.3282, y: 0.4226 }, { x: 0.9750, y: 0.6250 }, { x: 0.5070, y: 0.9703 }], kx: 0, ky: 0 },
  '/sim/court02.jpg': { c: [{ x: -0.0238, y: 0.5918 }, { x: 0.2651, y: 0.5728 }, { x: 0.8470, y: 0.6670 }, { x: 0.6000, y: 0.8550 }], kx: 0, ky: 0 },
  '/sim/court03.jpg': { c: [{ x: 0.4620, y: 0.7330 }, { x: 0.2320, y: 0.4920 }, { x: 0.5980, y: 0.2030 }, { x: 0.7820, y: 0.2820 }], kx: 0, ky: 0 },
  '/sim/court04.jpg': { c: [{ x: 0.6180, y: 0.3450 }, { x: 0.8550, y: 0.3500 }, { x: 0.4520, y: 0.8580 }, { x: 0.0500, y: 0.4680 }], kx: 0, ky: 0.1 },
  '/sim/court05.jpg': { c: [{ x: 0.1140, y: 0.4480 }, { x: 0.3150, y: 0.3880 }, { x: 0.8380, y: 0.5250 }, { x: 0.6450, y: 0.6840 }], kx: 0, ky: 0 },
  '/sim/court08.jpg': { c: [{ x: 0.3250, y: 0.2240 }, { x: 0.6380, y: 0.2210 }, { x: 1.0900, y: 0.9840 }, { x: -0.0840, y: 1.0340 }], kx: -0.07, ky: 0 },
  '/sim/court09.jpg': { c: [{ x: 0.6080, y: 0.5190 }, { x: 0.9280, y: 0.5490 }, { x: 0.7790, y: 0.7870 }, { x: 0.1300, y: 0.6570 }], kx: 0, ky: 0 },
  '/sim/court10.jpg': { c: [{ x: 0.7791, y: 0.3757 }, { x: 1.1830, y: 0.5060 }, { x: -0.1170, y: 1.3420 }, { x: -0.1070, y: 0.5610 }], kx: 0, ky: 0 },
  '/sim/court11.jpg': { c: [{ x: 0.1402, y: 0.5272 }, { x: 0.3928, y: 0.5058 }, { x: 0.8807, y: 0.7168 }, { x: 0.0215, y: 0.9519 }], kx: 0, ky: 0 },
  '/sim/court12.jpg': { c: [{ x: 0.7137, y: 0.5719 }, { x: 1.0133, y: 0.5982 }, { x: 0.4303, y: 0.8635 }, { x: 0.0322, y: 0.6858 }], kx: 0, ky: 0 },
  // c13 updated from Tim's round-5 feedback: multi-restart polish ranked by
  // detected-line agreement (41px → 32px vs truth; identification still open)
  '/sim/court13.jpg': { c: [{ x: 0.0883, y: 0.8856 }, { x: 0.0081, y: 0.4699 }, { x: 0.6754, y: 0.4758 }, { x: 0.6905, y: 0.6629 }], kx: 0, ky: 0 },
  '/sim/court14.jpg': { c: [{ x: -0.0381, y: 1.0654 }, { x: 0.3817, y: 0.2978 }, { x: 0.6480, y: 0.3017 }, { x: 1.0121, y: 0.7794 }], kx: 0, ky: 0 },
  '/sim/court15.jpg': { c: [{ x: 0.3791, y: 0.3338 }, { x: 0.6365, y: 0.3494 }, { x: 0.9449, y: 0.9674 }, { x: -0.2155, y: 0.8455 }], kx: 0, ky: 0 },
  '/sim/court16.jpg': { c: [{ x: 0.0070, y: 0.8444 }, { x: 0.3643, y: 0.2714 }, { x: 0.6434, y: 0.2892 }, { x: 0.9690, y: 0.7969 }], kx: 0, ky: 0 },
  '/sim/court17.jpg': { c: [{ x: -0.1029, y: 0.9186 }, { x: 0.3239, y: 0.2997 }, { x: 0.6292, y: 0.3219 }, { x: 1.0627, y: 0.8519 }], kx: 0, ky: 0 },
  '/sim/court20.jpg': { c: [{ x: 0.3173, y: 0.3709 }, { x: 0.7440, y: 0.4099 }, { x: 0.7013, y: 1.0665 }, { x: -0.1094, y: 0.5379 }], kx: 0, ky: 0 },
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

type Verdict = 'ACCEPT' | 'PARTIAL' | 'REJECT'
// Training mode. Tim assigns the true lines (step 1), then both grade CLAUDE'S read
// against them (step 2): cv = machine verdict (coverage of Claude's lines vs Tim's,
// gate: 100 ACCEPT / 98-100 PARTIAL / <98 REJECT), tim = Tim's eyeball verdict of the
// same read. Misalignment = the gate (thresholds/tolerance) needs fixing.
// claude = the frozen output of setup calibration for this court (full-auto, or
// tap+snap when auto punts) — the thing being graded. Round 6 flow: blank court →
// Snap runs Claude's algo live → Tim corrects the green lines into truth → verdict.
type Res = { score: number; errPx: number; yours: Pt[]; kx: number; ky: number; tim?: Verdict; claude?: Court; cv?: { verdict: Verdict; coverage: number; medIn?: number; algo?: string } }

// Machine verdict on CLAUDE'S read vs Tim's lines, in PIXELS at native resolution:
// perpendicular distance from each visible point of Claude's line to Tim's SAME
// line. Pixels, not inches, because acceptance means "on the paint as well as the
// sensor allows" — one far-baseline pixel is already inches of depth, and no
// calibration can beat the sensor. Inches come back at the CALL layer as honest
// per-zone margins ("too close to call" widens with distance).
// Gate v5, FITTED to Tim's 13 round-5 verdicts (8/13 aligned; misses were rough
// truth lines or charity PARTIALs on garbage): tol 4px · ≥95% ACCEPT · ≥90% PARTIAL.
// Version history: v1 = 10px image gate · v2 = global court-inch (1") · v3 = +auto
// re-judge on load · v4 = perpendicular local-inch · v5 = perpendicular px, fitted.
const ALGO_VERSION = 'v5'
const TOL_PX = 4 // px at native resolution
const ACCEPT_COV = 95
const PARTIAL_COV = 90
function judgeRead(mine: Court, tims: Pt[], tkx: number, tky: number, a: number, nw: number, nh: number): Res['cv'] {
  const Hm = homographyFromCorners(COURT_CORNERS, mine.c.map((c) => undistort(c, mine.kx, mine.ky, a)))
  const Ht = homographyFromCorners(COURT_CORNERS, tims.map((c) => undistort(c, tkx, tky, a)))
  if (!Hm || !Ht) return undefined
  const offs: number[] = []
  const N = 20, M = 60
  for (const [x1, y1, x2, y2] of COURT_ALL_LINES) {
    const timLine: Pt[] = []
    for (let s = 0; s <= M; s++) {
      const t = s / M
      timLine.push(distort(applyHomography(Ht, { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t }), tkx, tky, a))
    }
    for (let s = 0; s <= N; s++) {
      const t = s / N
      const img = distort(applyHomography(Hm, { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t }), mine.kx, mine.ky, a)
      if (img.x < 0 || img.x > 1 || img.y < 0 || img.y > 1) continue
      let best = Infinity
      for (const q of timLine) {
        const d = Math.hypot((img.x - q.x) * nw, (img.y - q.y) * nh)
        if (d < best) best = d
      }
      if (best < Infinity) offs.push(best)
    }
  }
  if (offs.length < 20) return undefined
  const coverage = (100 * offs.filter((o) => o <= TOL_PX).length) / offs.length
  const medPx = [...offs].sort((x, y) => x - y)[Math.floor(offs.length / 2)]
  const verdict: Verdict = coverage >= ACCEPT_COV ? 'ACCEPT' : coverage >= PARTIAL_COV ? 'PARTIAL' : 'REJECT'
  return { verdict, coverage: Math.round(coverage * 10) / 10, medIn: Math.round(medPx * 10) / 10, algo: ALGO_VERSION }
}

// Re-judge every stored round with the CURRENT algorithm (aspect ratios come from
// loading each image). Keeps the Aligned stat honest whenever the gate changes.
async function rejudgeAll(data: Record<string, Res>): Promise<Record<string, Res>> {
  const out: Record<string, Res> = { ...data }
  await Promise.all(Object.keys(out).map((u) => new Promise<void>((resolve) => {
    const m = out[u].claude ?? CLAUDE[u]
    if (!m) { resolve(); return }
    const im = new window.Image()
    im.onload = () => {
      const a = im.naturalHeight ? im.naturalWidth / im.naturalHeight : 16 / 9
      const r = out[u]
      const cv = judgeRead(m, r.yours, r.kx, r.ky, a, im.naturalWidth || 1280, im.naturalHeight || 720)
      out[u] = { ...r, cv: cv ?? r.cv }
      resolve()
    }
    im.onerror = () => resolve()
    im.src = u
  })))
  return out
}

export default function SimGame() {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [idx, setIdx] = useState(0)
  const [yours, setYours] = useState<Pt[]>(DEFAULT_GUESS)
  const [kx, setKx] = useState(0)
  const [ky, setKy] = useState(0)
  const [aspect, setAspect] = useState(16 / 9)
  const [natural, setNatural] = useState({ w: 1280, h: 720 })
  const [store, setStore] = useState<Record<string, Res>>({})
  const [loupe, setLoupe] = useState<Pt | null>(null)
  const [snapping, setSnapping] = useState(false)
  // Portaled to <body>: the app layout's phone frame (md:max-w-[480px] + transform)
  // traps even position:fixed children, and this tool needs the whole screen.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  // Size the court image from the MEASURED space between the bars (not a viewport
  // guess) so the bottom row with Compare/verdict buttons is never clipped.
  const [areaEl, setAreaEl] = useState<HTMLDivElement | null>(null)
  const [avail, setAvail] = useState({ w: 900, h: 520 })
  useEffect(() => {
    if (!areaEl) return
    const ro = new ResizeObserver(() => setAvail({ w: areaEl.clientWidth, h: areaEl.clientHeight }))
    ro.observe(areaEl)
    return () => ro.disconnect()
  }, [areaEl])
  const dragRef = useRef<number | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    try {
      const r = localStorage.getItem(STORE)
      if (r) {
        const data = JSON.parse(r) as Record<string, Res>
        // purge rounds for removed courts so the stats reflect the live set
        const filtered: Record<string, Res> = {}
        for (const k of Object.keys(data)) if (IMAGES.includes(k)) filtered[k] = data[k]
        setStore(filtered)
        // re-judge every stored round with the current algorithm, then flush to disk
        rejudgeAll(filtered).then((next) => {
          setStore(next)
          try { localStorage.setItem(STORE, JSON.stringify(next)) } catch { /* ignore */ }
          fetch('/api/dev/sim-data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {})
        })
      }
    } catch { /* ignore */ }
  }, [])
  // Start from Claude's read (the real-world flow: auto-calibration proposes, you correct it).
  useEffect(() => {
    // Round 6: courts start blank; a court already played restores its saved state.
    const r = store[IMAGES[idx]]
    setYours(r?.yours ?? DEFAULT_GUESS)
    setKx(r?.kx ?? 0)
    setKy(r?.ky ?? 0)
    setLoupe(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const url = IMAGES[idx]
  const mine: Court | null = store[url]?.claude ?? null

  function ptFrom(e: React.PointerEvent) {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  function onDown(e: React.PointerEvent) {
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

  // Setup calibration, exactly like the product: on an untouched court Snap runs
  // the FULL-AUTO reader (no seed); if auto can't find the court, the user drags
  // rough corners and Snap polishes them (tap+snap). Either way the result is
  // frozen as "Claude's read" — the thing Tim's corrections then grade.
  async function snap() {
    if (snapping) return
    setSnapping(true)
    try {
      const court = url.replace('/sim/', '').replace('.jpg', '')
      const untouched = yours.every((p, i) => Math.abs(p.x - DEFAULT_GUESS[i].x) < 1e-9 && Math.abs(p.y - DEFAULT_GUESS[i].y) < 1e-9)
      const endpoint = untouched ? '/api/dev/sim-auto' : '/api/dev/sim-snap'
      const r = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ court, corners: yours.map((p) => [p.x, p.y]) }),
      }).then((x) => x.json())
      if (Array.isArray(r?.corners) && r.corners.length === 4) {
        const pts: Pt[] = r.corners.map(([x, y]: [number, number]) => ({ x, y }))
        const read: Court = { c: pts, kx, ky }
        setYours(pts)
        const prev = store[url]
        persist({ ...store, [url]: { score: 0, errPx: 0, yours: pts, kx, ky, tim: prev?.tim, claude: read, cv: undefined } })
      } else if (r?.error) {
        alert(untouched
          ? `Auto-calibration: ${r.error}\n\nDrag the corners roughly onto the court, then press Snap again to finish setup.`
          : `Snap: ${r.error}`)
      }
    } catch {
      alert('Snap failed (dev server only)')
    } finally {
      setSnapping(false)
    }
  }

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

  function persist(next: Record<string, Res>) {
    setStore(next); try { localStorage.setItem(STORE, JSON.stringify(next)) } catch { /* ignore */ }
    // auto-save to disk so Claude reads the training data directly — no export needed
    fetch('/api/dev/sim-data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {})
  }

  // Wrapper for the current court; the pure math lives in judgeRead (module scope)
  // so stored rounds can be re-judged on load whenever the algorithm changes.
  function judgeClaude(): Res['cv'] | undefined {
    if (!mine) return undefined
    return judgeRead(mine, yours, kx, ky, aspect, natural.w, natural.h)
  }

  // Side stat: symmetric chamfer between Claude's read and Tim's lines, in px.
  function buildRes(): Res {
    if (!mine) return { score: 0, errPx: 0, yours, kx, ky, tim: store[url]?.tim, claude: undefined, cv: undefined }
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
    return { score, errPx, yours, kx, ky, tim: store[url]?.tim, claude: store[url]?.claude, cv: store[url]?.cv }
  }

  // Step 2a (optional peek): machine grades Claude's read vs Tim's lines.
  function judge() {
    if (!mine) { alert('Snap first — there is no Claude read to grade yet.'); return }
    persist({ ...store, [url]: { ...buildRes(), cv: judgeClaude() } })
  }
  // Step 2b: Tim's verdict on Claude's read — the machine's is computed alongside
  // silently, so every rated court adds an alignment data point.
  function rate(v: Verdict) {
    persist({ ...store, [url]: { ...buildRes(), tim: v, cv: judgeClaude() } })
  }

  const res = store[url]
  const scores = Object.values(store).map((r) => r.score)
  const rated = Object.values(store).filter((r) => r.cv && r.tim)
  const aligned = rated.filter((r) => r.cv!.verdict === r.tim).length

  if (!mounted) return null

  if (!allowed) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-surface overflow-hidden" style={{ overscrollBehavior: 'none' }}>
      <AppHeader showBack />
      {/* Single-screen layout: compact top bar / court fills the middle / one-row bottom bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-1.5 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">Dev · Claude vs You</span>
          <h1 className="text-[16px] font-bold text-foreground whitespace-nowrap">Calibration match</h1>
          <span className="text-[10px] font-bold uppercase tracking-wide text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded-full whitespace-nowrap" title={`Judge gate ${ALGO_VERSION} · perpendicular px vs your lines · tol ${TOL_PX}px · ≥${ACCEPT_COV} accept / ≥${PARTIAL_COV} partial`}>algo {ALGO_VERSION} · {TOL_PX}px</span>
          <p className="text-[11px] text-muted truncate hidden xl:block"><span className="font-semibold text-[#0891b2]">⚡ Snap</span> = setup: my algo reads the blank court live (drag rough corners first if it punts) and freezes <span className="text-[#22d3ee] font-semibold">my read</span> · fix the green into truth · verdict · gate: {TOL_PX}px, ≥{ACCEPT_COV} accept / ≥{PARTIAL_COV} partial</p>
        </div>
        <div className="flex items-stretch gap-1.5">
          <Stat label="Court" value={`${idx + 1} / ${IMAGES.length}`} />
          <Stat label="Played" value={`${scores.length}`} />
          <Stat label="Aligned" value={rated.length ? `${aligned}/${rated.length}` : '—'} />
        </div>
      </div>

      <div ref={setAreaEl} className="flex-1 min-h-0 relative flex items-center justify-center touch-none" style={{ overflow: 'visible' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div ref={boxRef} className="relative" style={{ overflow: 'visible' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="court" className="block rounded-lg pointer-events-none"
            style={{ maxWidth: Math.max(240, Math.round(avail.w * 0.8)), maxHeight: Math.max(200, Math.round(avail.h * 0.94)) }}
            onLoad={(e) => { const im = e.currentTarget; setNatural({ w: im.naturalWidth, h: im.naturalHeight }); if (im.naturalHeight) setAspect(im.naturalWidth / im.naturalHeight) }} />
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
              <path d={courtPath(yours, kx, ky, aspect)} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              <path d={courtPath(yours, kx, ky, aspect)} fill="none" stroke="#39FF14" strokeWidth="2.3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              {mine && (
                <path d={courtPath(mine.c, mine.kx, mine.ky, aspect)} fill="none" stroke="#22d3ee" strokeWidth="2.3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeDasharray="4 3" />
              )}
            </svg>
            {yours.map((c, i) => (
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
            {res?.cv && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-white text-[14px] font-bold shadow-lg z-10"
                style={{ background: res.tim ? (res.tim === res.cv.verdict ? '#00C853' : '#ef4444') : '#64748b' }}>
                CV: {res.cv.verdict} ({res.cv.coverage}% ≤{TOL_PX}px{res.cv.medIn != null ? ` · med ${res.cv.medIn}px` : ''}){res.tim ? ` · You: ${res.tim} · ${res.tim === res.cv.verdict ? 'ALIGNED ✓' : 'MISALIGNED ✗'}` : ''}
              </div>
            )}
            <div className="absolute bottom-2 left-2 flex gap-3 text-[12px] font-bold z-10">
              <span className="text-[#39FF14] drop-shadow">■ Your lines (truth)</span><span className="text-[#22d3ee] drop-shadow">▦ Claude&apos;s read</span>
            </div>
          </div>
        </div>

      <div className="px-4 pb-3 pt-1 flex items-center justify-center gap-2 flex-wrap">
        <button type="button" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
          className="px-3 py-2 rounded-xl bg-surface text-foreground border border-border/50 text-[13px] font-bold active:opacity-80 transition-opacity disabled:opacity-40">← Prev</button>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted">↔</span>
          <input type="range" min={-0.6} max={0.6} step={0.01} value={kx} onChange={(e) => setKx(parseFloat(e.target.value))} className="w-24" />
          <span className="text-[11px] text-muted">↕</span>
          <input type="range" min={-0.6} max={0.6} step={0.01} value={ky} onChange={(e) => setKy(parseFloat(e.target.value))} className="w-24" />
          <button type="button" onClick={() => { setKx(0); setKy(0) }} className="text-[11px] font-bold px-2 py-1 rounded-full bg-surface text-muted border border-border/50 active:opacity-70 transition-opacity">Reset</button>
        </div>
        <button type="button" onClick={snap} disabled={snapping}
          className="px-4 py-2 rounded-xl bg-[#22d3ee] text-white text-[13px] font-bold active:opacity-80 transition-opacity disabled:opacity-50">
          {snapping ? 'Snapping…' : '⚡ Snap'}
        </button>
        <button type="button" onClick={judge} className="px-4 py-2 rounded-xl bg-primary text-white text-[13px] font-bold active:opacity-80 transition-opacity">⚖ Judge</button>
        <span className="text-[12px] font-bold text-muted ml-1">My read is:</span>
        {(['ACCEPT', 'PARTIAL', 'REJECT'] as Verdict[]).map((v) => {
          const on = res?.tim === v
          const color = v === 'ACCEPT' ? '#00C853' : v === 'PARTIAL' ? '#f59e0b' : '#ef4444'
          return (
            <button key={v} type="button" onClick={() => rate(v)}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border-2 transition-all active:opacity-80"
              style={on ? { background: color, borderColor: color, color: '#fff' } : { borderColor: color, color, background: 'transparent' }}>
              {v}
            </button>
          )
        })}
        <button type="button" onClick={() => setIdx(Math.min(IMAGES.length - 1, idx + 1))} disabled={idx === IMAGES.length - 1}
          className="px-5 py-2 rounded-xl bg-[#00C853] text-white text-[14px] font-bold active:opacity-80 transition-opacity disabled:opacity-40">Next →</button>
        {scores.length >= IMAGES.length && (
          <span className="text-[12px] font-bold text-green-700 bg-[#00C853]/10 border border-[#00C853]/30 rounded-full px-3 py-1.5">
            🏁 All {IMAGES.length} played · CV aligned with you on {aligned}/{rated.length} — tell Claude to analyze
          </span>
        )}
      </div>
    </div>,
    document.body
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background border border-border/50 px-2.5 py-1 text-center min-w-[56px]">
      <p className="text-[8px] uppercase tracking-wide text-muted font-bold">{label}</p>
      <p className="text-[13px] font-bold text-foreground tabular-nums">{value}</p>
    </div>
  )
}
