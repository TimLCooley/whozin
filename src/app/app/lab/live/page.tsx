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
import { homographyFromCorners, homographyLeastSquares, applyHomography } from '@/lib/homography'

type Pt = { x: number; y: number }
type P12 = Pt[]
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
  const [zoomSel, setZoomSel] = useState<'0.5' | '0.7' | '1'>('1')
  const [clipId, setClipId] = useState<string | null>(null)
  const [clipStatus, setClipStatus] = useState<string>('')
  const [trackUrl, setTrackUrl] = useState<string | null>(null)
  const clipInputRef = useRef<HTMLInputElement>(null)
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
  // load existing captures so server-added frames (e.g. broadcast stills) and
  // past sessions appear in the deck
  useEffect(() => {
    if (allowed !== true) return
    fetch('/api/lab/live').then((x) => x.json()).then((r) => {
      if (Array.isArray(r?.ids) && r.ids.length) {
        const deck = r.ids.filter((i: string) => !i.startsWith('anc')) // anchor cycles aren't captures
        setIds(deck)
        setCur((c) => c ?? deck[0] ?? null)
      }
    }).catch(() => {})
  }, [allowed])
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
        // a SAVED calibration survives reloads: restore it and unlock Play
        const tp = r?.meta?.tim_pins
        if (Array.isArray(tp) && tp.length === 4) {
          setYours(tp.map((p: number[]) => ({ x: p[0], y: p[1] })))
          const cps = r?.meta?.claude_pins
          if (Array.isArray(cps) && cps.length === 4) setClaude(cps.map((p: number[]) => ({ x: p[0], y: p[1] })))
          setPhase('saved')
          setStatus('Saved calibration loaded ✓ — ready to play')
          return // stop polling
        }
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
        body: JSON.stringify({ action: 'upload', data: dataUrl, zoom: zoomSel }),
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
      let video: MediaTrackConstraints = { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      if (zoomSel !== '1') {
        // best effort: pick the ultra-wide back camera when 0.5x/0.7x chosen
        try {
          const devs = await navigator.mediaDevices.enumerateDevices()
          const uw = devs.find((dv) => dv.kind === 'videoinput' && /ultra|wide/i.test(dv.label) && !/front/i.test(dv.label))
          if (uw) video = { deviceId: { exact: uw.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        } catch { /* fall through to default lens */ }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false })
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
  async function onClipFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !cur || busy) return
    if (f.size > 45_000_000) { setClipStatus('Clip too big — keep it under ~15s'); return }
    setBusy(true); setClipStatus('Uploading clip…'); setTrackUrl(null)
    try {
      const buf = await f.arrayBuffer()
      let bin = ''
      const bytes = new Uint8Array(buf)
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
      const r = await fetch('/api/lab/live', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'clip', calib: cur, data: btoa(bin) }),
      }).then((x) => x.json())
      if (r?.id) {
        setClipId(r.id)
        setClipStatus('Mac is tracking the ball…')
        pollClip(r.id)
      } else setClipStatus(`Clip upload failed: ${r?.error ?? '?'}`)
    } catch (err) { setClipStatus(`Clip failed: ${err}`) } finally { setBusy(false) }
  }
  function pollClip(id: string) {
    const tick = async () => {
      try {
        const r = await fetch(`/api/lab/live?id=${id}`).then((x) => x.json())
        if (r?.meta?.status === 'done') {
          setClipStatus(`Tracked ${r.meta.track_len ?? '?'} ball points over ${r.meta.frames ?? '?'} frames`)
          setTrackUrl(r.track_url ?? null)
          return
        }
        if (r?.meta?.status === 'error') { setClipStatus(`Tracking failed: ${r.meta.claude_error ?? '?'}`); return }
      } catch { /* retry */ }
      setTimeout(tick, 4000)
    }
    tick()
  }

  // Camera permission handling: a site can't open Chrome's settings, but it
  // CAN trigger the official ask-dialog from a button tap (if not hard-blocked)
  // and it can KNOW which state it's in via the Permissions API.
  const [camPerm, setCamPerm] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown')
  const [permDismissed, setPermDismissed] = useState(false)
  useEffect(() => {
    if (allowed !== true) return
    let ps: PermissionStatus | null = null
    ;(async () => {
      try {
        ps = await navigator.permissions.query({ name: 'camera' as PermissionName })
        setCamPerm(ps.state)
        ps.onchange = () => { if (ps) setCamPerm(ps.state) }
      } catch { setCamPerm('unknown') }
    })()
    return () => { if (ps) ps.onchange = null }
  }, [allowed])
  async function grantCam() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      s.getTracks().forEach((t) => t.stop())
      camBlockedRef.current = false
      setCamPerm('granted')
      setStatus('🎥 Camera enabled ✓ — all camera features unlocked')
    } catch (err) {
      const name = (err as DOMException)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') setCamPerm('denied')
      // show the RAW error too — we've been guessing at Chrome's reason
      setStatus(`${camErrMsg(err)} [${name}: ${(err as DOMException)?.message || 'no detail'}]`)
    }
  }

  // Shared camera opener for Anchor/Live/Record: try the ideal constraints,
  // then fall back progressively — a too-strict constraint set must never be
  // the reason a feature "needs Chrome" when we're already on Chrome.
  async function getCamStream(): Promise<MediaStream> {
    const attempts: MediaTrackConstraints[] = []
    if (zoomSel !== '1') {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices()
        const uw = devs.find((dv) => dv.kind === 'videoinput' && /ultra|wide/i.test(dv.label) && !/front/i.test(dv.label))
        if (uw) attempts.push({ deviceId: { exact: uw.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } })
      } catch { /* labels hidden until permission granted */ }
    }
    attempts.push({ facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } })
    attempts.push({ facingMode: 'environment' })
    attempts.push(true as unknown as MediaTrackConstraints)
    let lastErr: unknown = null
    for (const video of attempts) {
      try { return await navigator.mediaDevices.getUserMedia({ video, audio: false }) } catch (err) {
        lastErr = err
        // permission denials won't change on retry — stop and explain
        const name = (err as DOMException)?.name
        if (name === 'NotAllowedError' || name === 'SecurityError') break
      }
    }
    throw lastErr
  }
  function camErrMsg(err: unknown): string {
    const name = (err as DOMException)?.name ?? String(err)
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'Camera is BLOCKED for whozin.io — in Chrome tap the icon left of the address bar → Permissions → Camera → Allow, then reload'
    }
    if (name === 'NotReadableError') return 'Camera is busy — close other camera apps/tabs and retry'
    return `Camera failed: ${name}`
  }

  // ⚓ Anchor — the AR design's runtime half, buildable today: live viewfinder
  // with the calibration's court lines projected on it; a background loop
  // re-snaps the lines to the paint every cycle (bump the tripod -> it
  // re-locks). Confidence gate: a wild read (>80px drift) is REJECTED, not
  // adopted — never let one bad snap trash a good calibration.
  const anchorVideoRef = useRef<HTMLVideoElement>(null)
  const anchorStreamRef = useRef<MediaStream | null>(null)
  const anchorRunRef = useRef(false)
  const anchorPinsRef = useRef<Pt[]>(DEFAULT_GUESS)
  const anchorLockedRef = useRef(false)   // false until a first fix exists
  const lastAnchorIdRef = useRef<string | null>(null)
  const [anchorOn, setAnchorOn] = useState(false)
  const [anchorHasFix, setAnchorHasFix] = useState(false)
  const [anchorPins, setAnchorPins] = useState<Pt[]>(DEFAULT_GUESS)
  const [anchorMsg, setAnchorMsg] = useState('')
  const [anchorVid, setAnchorVid] = useState({ w: 16, h: 9 })

  async function openAnchor() {
    if (busy) return
    try {
      const stream = await getCamStream()
      anchorStreamRef.current = stream
      // starting point: a calibration in hand seeds the snap; from scratch the
      // first cycle runs FULL AUTO and the first fix is adopted unconditionally
      const seeded = phase === 'saved' || phase === 'ready'
      anchorLockedRef.current = seeded
      setAnchorHasFix(seeded)
      anchorPinsRef.current = yours
      setAnchorPins(yours)
      setAnchorMsg(seeded ? '⚓ anchoring — hold the mount steady…' : '⚓ acquiring the court (full auto)…')
      setAnchorOn(true)
      anchorRunRef.current = true
      setTimeout(() => {
        const v = anchorVideoRef.current
        if (v) {
          v.srcObject = stream
          v.onloadedmetadata = () => setAnchorVid({ w: v.videoWidth || 16, h: v.videoHeight || 9 })
          v.play().catch(() => {})
        }
        setTimeout(anchorCycle, 1500) // let exposure settle before the first snap
      }, 50)
    } catch (err) {
      setStatus(`⚓ ${camErrMsg(err)}`)
    }
  }

  async function anchorCycle() {
    if (!anchorRunRef.current) return
    const v = anchorVideoRef.current
    if (!v || !v.videoWidth) { setTimeout(anchorCycle, 1000); return }
    try {
      const scale = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight))
      const cw = Math.round(v.videoWidth * scale), ch = Math.round(v.videoHeight * scale)
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch
      cv.getContext('2d')!.drawImage(v, 0, 0, cw, ch)
      const r = await fetch('/api/lab/live', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'upload', anchor: true, zoom: zoomSel,
          data: cv.toDataURL('image/jpeg', 0.85),
          seed: anchorLockedRef.current ? anchorPinsRef.current.map((p) => [p.x, p.y]) : null }),
      }).then((x) => x.json())
      if (!r?.id) { setAnchorMsg(`⚠ upload failed: ${r?.error ?? '?'}`); setTimeout(anchorCycle, 4000); return }
      lastAnchorIdRef.current = r.id
      setAnchorMsg(anchorLockedRef.current ? '⚓ snapping to the paint…' : '⚓ reading the court from scratch…')
      const started = Date.now()
      const poll = async () => {
        if (!anchorRunRef.current) return
        try {
          const g = await fetch(`/api/lab/live?id=${r.id}`).then((x) => x.json())
          const cp = g?.meta?.claude_pins
          if (Array.isArray(cp) && cp.length === 4) {
            const read: Pt[] = cp.map((p: number[]) => ({ x: p[0], y: p[1] }))
            if (!anchorLockedRef.current) {
              // first fix from scratch: adopt it, gate from here on
              anchorLockedRef.current = true
              anchorPinsRef.current = read
              setAnchorPins(read); setAnchorHasFix(true)
              setAnchorMsg('⚓ court acquired — refining…')
            } else {
              const drift = markerErr(anchorPinsRef.current, read, cw, ch)
              if (drift && drift.avg < 80) {
                anchorPinsRef.current = read
                setAnchorPins(read)
                setAnchorMsg(drift.avg <= 4 ? `🔒 LOCKED · drift ${drift.avg}px` : `⚓ re-anchored · moved ${drift.avg}px`)
              } else {
                setAnchorMsg(`⚠ read rejected (${drift ? `${drift.avg}px off` : 'no fit'}) — keeping current lines`)
              }
            }
            setTimeout(anchorCycle, 2000)
            return
          }
          if (g?.meta?.status === 'error') { setAnchorMsg('⚠ snap failed this cycle — retrying'); setTimeout(anchorCycle, 2000); return }
        } catch { /* retry */ }
        if (Date.now() - started > 45000) { setAnchorMsg('⚠ Mac not responding — is the watcher up?'); setTimeout(anchorCycle, 5000); return }
        setTimeout(poll, 2500)
      }
      poll()
    } catch (err) { setAnchorMsg(`⚠ ${err}`); setTimeout(anchorCycle, 4000) }
  }

  function closeAnchor() {
    anchorRunRef.current = false
    anchorStreamRef.current?.getTracks().forEach((t) => t.stop())
    anchorStreamRef.current = null
    setAnchorOn(false)
    if (!anchorLockedRef.current) { setStatus('Anchor closed — no fix acquired'); return }
    // the anchored pins ARE the freshest calibration — adopt them
    setYours(anchorPinsRef.current.map((p) => ({ ...p })))
    if (!cur && lastAnchorIdRef.current) {
      // anchor WAS the calibration flow: promote its last frame to the deck
      setCur(lastAnchorIdRef.current)
      setImgUrl(null); setClaude(null); setLabel(null)
    }
    setPhase('ready')
    setStatus('⚓ Anchor locked — check the pins, then 💾 Save to unlock Play')
  }

  // 🔴 Live — the delayed ref: continuous recording in ~15s segments, each
  // relayed through the clip-call pipeline; an OUT verdict fires the cue stack
  // (loud "OUT!" + beeps + torch blink toward the court + red screen). Honest
  // latency: ~20-40s behind reality (relay round trip) until on-device lands.
  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const liveStreamRef = useRef<MediaStream | null>(null)
  const liveRunRef = useRef(false)
  const liveRecRef = useRef<MediaRecorder | null>(null)
  const liveSegRef = useRef(0)
  const [liveOn, setLiveOn] = useState(false)
  const [liveMsg, setLiveMsg] = useState('')
  const [liveCalls, setLiveCalls] = useState<string[]>([])
  const [liveAlert, setLiveAlert] = useState<string | null>(null)
  const [liveVid, setLiveVid] = useState({ w: 16, h: 9 })
  const torchRef = useRef<MediaStreamTrack | null>(null)

  function beep(freq: number, ms: number, when = 0) {
    try {
      type AudioWin = Window & { webkitAudioContext?: typeof AudioContext }
      const Ctor = window.AudioContext ?? (window as AudioWin).webkitAudioContext
      if (!Ctor) return
      const ctx = new Ctor()
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.frequency.value = freq; o.connect(g); g.connect(ctx.destination)
      g.gain.value = 0.6
      o.start(ctx.currentTime + when / 1000); o.stop(ctx.currentTime + (when + ms) / 1000)
      setTimeout(() => ctx.close().catch(() => {}), when + ms + 300)
    } catch { /* no audio */ }
  }
  async function torchBlink(times: number) {
    const t = torchRef.current
    if (!t) return
    type TorchConstraints = MediaTrackConstraintSet & { torch?: boolean }
    for (let i = 0; i < times; i++) {
      try {
        await t.applyConstraints({ advanced: [{ torch: true } as TorchConstraints] })
        await new Promise((r) => setTimeout(r, 260))
        await t.applyConstraints({ advanced: [{ torch: false } as TorchConstraints] })
        await new Promise((r) => setTimeout(r, 200))
      } catch { return }
    }
  }
  function cueOut(text: string) {
    beep(1400, 140); beep(1400, 140, 220)                 // whistle-whistle…
    try {
      const u = new SpeechSynthesisUtterance('Out!')
      u.rate = 0.9; u.pitch = 0.8; u.volume = 1
      setTimeout(() => speechSynthesis.speak(u), 500)     // …then the call
    } catch { /* no speech */ }
    torchBlink(3)                                          // court-facing cue
    setLiveAlert(text)                                     // your-side cue
    setTimeout(() => setLiveAlert(null), 4000)
  }

  async function openLive() {
    if (busy || !cur) return
    try {
      const stream = await getCamStream()
      liveStreamRef.current = stream
      const track = stream.getVideoTracks()[0]
      type TorchCaps = MediaTrackCapabilities & { torch?: boolean }
      torchRef.current = track && (track.getCapabilities?.() as TorchCaps)?.torch ? track : null
      liveSegRef.current = 0
      setLiveCalls([]); setLiveMsg('🔴 LIVE — recording segment 1…'); setLiveOn(true)
      liveRunRef.current = true
      beep(900, 80) // audio unlock on the user gesture — later cues can then play
      setTimeout(() => {
        const v = liveVideoRef.current
        if (v) {
          v.srcObject = stream
          v.onloadedmetadata = () => setLiveVid({ w: v.videoWidth || 16, h: v.videoHeight || 9 })
          v.play().catch(() => {})
        }
        recordSegment()
      }, 60)
    } catch (err) {
      setStatus(`🔴 ${camErrMsg(err)}`)
    }
  }

  function recordSegment() {
    if (!liveRunRef.current || !liveStreamRef.current) return
    const seg = ++liveSegRef.current
    let rec: MediaRecorder
    try {
      const mime = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm']
        .find((m) => MediaRecorder.isTypeSupported(m))
      rec = new MediaRecorder(liveStreamRef.current, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
    } catch (err) { setLiveMsg(`⚠ recorder: ${err}`); return }
    liveRecRef.current = rec
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType })
      if (blob.size > 20_000) shipSegment(seg, blob)
      if (liveRunRef.current) recordSegment() // roll straight into the next one
    }
    rec.start()
    setLiveMsg(`🔴 LIVE — recording segment ${seg}…`)
    setTimeout(() => { if (rec.state !== 'inactive') rec.stop() }, 15_000)
  }

  async function shipSegment(seg: number, blob: Blob) {
    try {
      const buf = await blob.arrayBuffer()
      let bin = ''
      const bytes = new Uint8Array(buf)
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      const r = await fetch('/api/lab/live', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'clip', calib: cur, data: btoa(bin) }),
      }).then((x) => x.json())
      if (!r?.id) { setLiveCalls((s) => [`seg ${seg}: upload failed (${r?.error ?? '?'})`, ...s].slice(0, 12)); return }
      const started = Date.now()
      const poll = async () => {
        try {
          const g = await fetch(`/api/lab/live?id=${r.id}`).then((x) => x.json())
          if (g?.meta?.status === 'done') {
            const verdict: string = g.meta.verdict ?? 'no bounce'
            const nOut = (g.meta.calls ?? []).filter((c: { verdict?: string }) => c.verdict?.startsWith('OUT')).length
            setLiveCalls((s) => [`seg ${seg}: ${verdict}${nOut > 1 ? ` (+${nOut - 1} more out)` : ''}`, ...s].slice(0, 12))
            if (verdict.startsWith('OUT') || nOut > 0) cueOut(verdict)
            return
          }
          if (g?.meta?.status === 'error') { setLiveCalls((s) => [`seg ${seg}: error`, ...s].slice(0, 12)); return }
        } catch { /* retry */ }
        if (Date.now() - started < 120_000) setTimeout(poll, 4000)
      }
      poll()
    } catch (err) { setLiveCalls((s) => [`seg ${seg}: ${err}`, ...s].slice(0, 12)) }
  }

  function closeLive() {
    liveRunRef.current = false
    if (liveRecRef.current?.state !== 'inactive') liveRecRef.current?.stop()
    liveStreamRef.current?.getTracks().forEach((t) => t.stop())
    liveStreamRef.current = null; torchRef.current = null
    setLiveOn(false)
    setStatus('Live session ended — verdicts stay in the feed above')
  }

  // ⏺ Record — manual take: start recording in-page, hit stop, the clip ships
  // through the clip-call pipeline and the verdict overlay comes back. The
  // recorder auto-stops at 50s to stay under the 45MB relay cap.
  const recVideoRef = useRef<HTMLVideoElement>(null)
  const recStreamRef = useRef<MediaStream | null>(null)
  const recRecRef = useRef<MediaRecorder | null>(null)
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [recOn, setRecOn] = useState(false)
  const [recElapsed, setRecElapsed] = useState(0)
  const [recVid, setRecVid] = useState({ w: 16, h: 9 })

  async function openRecord() {
    if (busy || !cur) return
    try {
      const stream = await getCamStream()
      recStreamRef.current = stream
      setRecElapsed(0); setRecOn(true)
      setTimeout(() => {
        const v = recVideoRef.current
        if (v) {
          v.srcObject = stream
          v.onloadedmetadata = () => setRecVid({ w: v.videoWidth || 16, h: v.videoHeight || 9 })
          v.play().catch(() => {})
        }
        const mime = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m))
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
        recRecRef.current = rec
        const chunks: Blob[] = []
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: rec.mimeType })
          stopRecordUi()
          if (blob.size > 20_000) shipRecording(blob)
          else setClipStatus('Recording too short — try again')
        }
        rec.start()
        recTimerRef.current = setInterval(() => setRecElapsed((s) => {
          if (s + 1 >= 50 && rec.state !== 'inactive') rec.stop() // relay size cap
          return s + 1
        }), 1000)
      }, 60)
    } catch (err) {
      // browser camera unavailable -> the phone's own camcorder still works:
      // the capture input opens the native video recorder and ships on OK
      setStatus('⏺ Using the phone’s camcorder — record, then hit OK')
      clipInputRef.current?.click()
    }
  }
  function stopRecordUi() {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }
    recStreamRef.current?.getTracks().forEach((t) => t.stop())
    recStreamRef.current = null
    setRecOn(false)
  }
  function stopRecord() {
    const rec = recRecRef.current
    if (rec && rec.state !== 'inactive') rec.stop() // onstop ships the clip
    else stopRecordUi()
  }
  async function shipRecording(blob: Blob) {
    setBusy(true); setClipStatus('Uploading recording…'); setTrackUrl(null)
    try {
      const buf = await blob.arrayBuffer()
      let bin = ''
      const bytes = new Uint8Array(buf)
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      const r = await fetch('/api/lab/live', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'clip', calib: cur, data: btoa(bin) }),
      }).then((x) => x.json())
      if (r?.id) { setClipId(r.id); setClipStatus('Mac is calling the rally…'); pollClip(r.id) }
      else setClipStatus(`Upload failed: ${r?.error ?? '?'}`)
    } catch (err) { setClipStatus(`Recording failed: ${err}`) } finally { setBusy(false) }
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
  // all 12 marker positions derived from the current corners
  function markerPositions(): P12 {
    const Ht = homographyFromCorners(COURT_CORNERS, yours)
    if (!Ht) return yours.map((c) => ({ ...c }))
    return ALL_MARKS.map((m) => applyHomography(Ht, m))
  }
  function onDown(e: React.PointerEvent) {
    dragRef.current = null
    if (!imgUrl) return
    const r = boxRef.current!.getBoundingClientRect()
    const px = e.clientX - r.left, py = e.clientY - r.top
    const marks = markerPositions()
    // grab ANY marker (Tim: no numbers needed — it's a point you can grab).
    // corners win ties (slightly larger radius)
    let hit = -1, best = 34
    marks.forEach((c, i) => {
      const rad = i < 4 ? 34 : 26
      const d = Math.hypot(px - c.x * r.width, py - c.y * r.height)
      if (d < Math.min(best, rad)) { best = d; hit = i }
    })
    if (hit >= 0) {
      const p = ptFrom(e)
      dragRef.current = { i: hit, dx: 0, dy: 0 }
      lastPtRef.current = { ...p, t: performance.now() }
      setLoupe({ x: marks[hit].x, y: marks[hit].y })
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
    if (d.i < 4) {
      // corners: hard handles, direct move
      setYours((cs) => cs.map((c, i) => {
        if (i !== d.i) return c
        const np = { x: c.x + (p.x - last.x) * gain, y: c.y + (p.y - last.y) * gain }
        setLoupe(np)
        return np
      }))
    } else {
      // Ts: flex handles — pin the dragged marker (weighted), re-solve the
      // homography so the whole court follows minimally, corners re-derive
      setYours((cs) => {
        const Ht = homographyFromCorners(COURT_CORNERS, cs)
        if (!Ht) return cs
        const marks = ALL_MARKS.map((m) => applyHomography(Ht, m))
        const target = { x: marks[d.i].x + (p.x - last.x) * gain, y: marks[d.i].y + (p.y - last.y) * gain }
        const src = [...ALL_MARKS]
        const dst = marks.map((m, i) => (i === d.i ? target : m))
        for (let k = 0; k < 24; k++) { src.push(ALL_MARKS[d.i]); dst.push(target) } // weight the pinned marker
        const H2 = homographyLeastSquares(src, dst)
        if (!H2) return cs
        setLoupe(target)
        return COURT_CORNERS.map((m) => applyHomography(H2, m))
      })
    }
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
        {clipStatus && (
          <span className="px-3 py-1 rounded-full text-[12px] font-bold text-white bg-emerald-600 truncate">{clipStatus}</span>
        )}
        {metric && (phase === 'ready' || phase === 'manual') && (
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
              return <div key={`t${i}`} className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black/50 shadow pointer-events-none" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, background: '#facc15' }} />
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

      {/* Staged controls — the flow reads top to bottom: 1 Calibrate ->
          2 Fix & Save -> 3 Play. Only the live stage's row shows big. */}
      <div className="px-3 pb-3 pt-1 flex flex-col gap-1.5">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        <input ref={clipInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={onClipFile} />

        {/* camera note — compact and dismissible; the native camcorder path
            covers Record either way, so this never needs to scream */}
        {camPerm !== 'granted' && !permDismissed && (
          <div className="flex items-center gap-2 flex-wrap rounded-lg px-2.5 py-1.5 bg-surface border border-border/40">
            <span className="text-[11px] text-muted">
              {camPerm === 'denied'
                ? '🎥 Browser camera blocked — Record uses the phone’s camcorder instead. Anchor/Live need it unblocked.'
                : '🎥 Camera permission not granted yet.'}
            </span>
            <button type="button" onClick={grantCam}
              className="px-2.5 py-1 rounded-lg bg-cyan-600 text-white text-[11px] font-bold active:opacity-80">
              {camPerm === 'denied' ? '↻ Retry' : 'Enable'}</button>
            <button type="button" onClick={() => setPermDismissed(true)}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-muted">✕</button>
          </div>
        )}

        {/* 1 · CALIBRATE — always the way in */}
        <div className="flex items-center gap-2 flex-wrap" style={{ opacity: phase === 'saved' ? 0.55 : 1 }}>
          <span className="text-[11px] font-black text-muted w-20 shrink-0">1 · CALIBRATE</span>
          <div className="flex items-center gap-1">
            {(['0.5', '0.7', '1'] as const).map((z) => (
              <button key={z} type="button" onClick={() => setZoomSel(z)}
                className="px-2.5 py-1.5 rounded-full text-[12px] font-bold border-2"
                style={zoomSel === z ? { background: '#7c3aed', borderColor: '#7c3aed', color: '#fff' } : { borderColor: '#7c3aed', color: '#7c3aed' }}>{z}x</button>
            ))}
          </div>
          <button type="button" onClick={openCam} disabled={busy}
            className="px-4 py-2.5 rounded-xl bg-violet-500 text-white text-[14px] font-bold active:opacity-80 disabled:opacity-50">📷 New shot</button>
          <button type="button" onClick={openAnchor} disabled={busy}
            title="Live viewfinder: auto-acquire the court and keep it snapped to the paint"
            className="px-4 py-2.5 rounded-xl bg-cyan-600 text-white text-[14px] font-bold active:opacity-80 disabled:opacity-50">⚓ Anchor</button>
          <span className="flex-1" />
          <button type="button" disabled={idxIn < 0 || idxIn >= ids.length - 1}
            onClick={() => { const n = ids[idxIn + 1]; setCur(n); setImgUrl(null); setClaude(null); setYours(DEFAULT_GUESS); setLabel(null); setPhase('idle') }}
            className="px-2.5 py-1.5 rounded-lg bg-surface border border-border/50 text-[12px] font-bold disabled:opacity-40">←</button>
          <button type="button" disabled={idxIn <= 0}
            onClick={() => { const n = ids[idxIn - 1]; setCur(n); setImgUrl(null); setClaude(null); setYours(DEFAULT_GUESS); setLabel(null); setPhase('idle') }}
            className="px-2.5 py-1.5 rounded-lg bg-surface border border-border/50 text-[12px] font-bold disabled:opacity-40">→</button>
        </div>

        {/* 2 · FIX & SAVE — once a capture is in hand */}
        {cur && phase !== 'idle' && phase !== 'uploading' && (
          <div className="flex items-center gap-2 flex-wrap" style={{ opacity: phase === 'saved' ? 0.55 : 1 }}>
            <span className="text-[11px] font-black text-muted w-20 shrink-0">2 · FIX &amp; SAVE</span>
            <button type="button" onClick={clearPins}
              className="px-3 py-2.5 rounded-xl bg-surface border border-border/50 text-[13px] font-bold">↺ Clear</button>
            <button type="button" onClick={reread} disabled={busy}
              className="px-3 py-2.5 rounded-xl bg-[#f59e0b] text-white text-[13px] font-bold active:opacity-80 disabled:opacity-40">🔁 Re-read</button>
            <button type="button" onClick={() => setQuality('good')}
              className="px-3 py-2.5 rounded-xl text-[13px] font-bold border-2"
              style={label === 'good' ? { background: '#00C853', borderColor: '#00C853', color: '#fff' } : { borderColor: '#00C853', color: '#00C853' }}>👍</button>
            <button type="button" onClick={() => setQuality('unusable')}
              className={`px-3 py-2.5 rounded-xl text-[13px] font-bold border-2${recRetake && !label ? ' animate-pulse ring-2 ring-red-400' : ''}`}
              style={label === 'unusable' ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff' } : { borderColor: '#ef4444', color: '#ef4444' }}>🚫</button>
            <button type="button" onClick={save} disabled={busy || phase === 'saved'}
              className="px-5 py-2.5 rounded-xl bg-[#00C853] text-white text-[14px] font-black active:opacity-80 disabled:opacity-50">💾 Save</button>
          </div>
        )}

        {/* 3 · PLAY — unlocked by Save */}
        {phase === 'saved' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-emerald-600 w-20 shrink-0">3 · PLAY</span>
            <button type="button" onClick={openRecord} disabled={busy}
              title="Record a take in-page; Stop ships it for calls"
              className="px-5 py-3 rounded-xl bg-rose-500 text-white text-[15px] font-black active:opacity-80 disabled:opacity-40">⏺ Record</button>
            <button type="button" onClick={openLive} disabled={busy}
              title="Delayed ref: rolling 15s segments, shouts OUT ~30s behind reality"
              className="px-5 py-3 rounded-xl bg-red-600 text-white text-[15px] font-black active:opacity-80 disabled:opacity-40">🔴 Live</button>
            <button type="button" onClick={() => clipInputRef.current?.click()} disabled={busy}
              title="Upload an existing clip from this mount"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-[14px] font-bold active:opacity-80 disabled:opacity-40">🎾 Upload clip</button>
          </div>
        )}
      </div>
      {trackUrl && (
        <div className="fixed inset-0 z-[190] bg-black/90 flex flex-col" onClick={() => setTrackUrl(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={trackUrl} alt="ball track" className="flex-1 min-h-0 object-contain" />
          <p className="text-white/80 text-center text-[13px] py-3">🎾 {clipStatus} — tap to close</p>
        </div>
      )}
      {recOn && (
        <div className="fixed inset-0 z-[230] bg-black flex flex-col">
          <div className="flex-1 min-h-0 relative flex items-center justify-center">
            <div className="relative" style={{ aspectRatio: `${recVid.w}/${recVid.h}`, maxWidth: '100%', maxHeight: '100%', width: '100%' }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={recVideoRef} playsInline muted className="absolute inset-0 w-full h-full" />
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                <path d={courtPath(yours, 1)} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                <path d={courtPath(yours, 1)} fill="none" stroke="#39FF14" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="absolute left-3 top-3 px-3 py-1.5 rounded-full text-[13px] font-bold text-white bg-rose-600 animate-pulse">
              ⏺ REC {Math.floor(recElapsed / 60)}:{String(recElapsed % 60).padStart(2, '0')}{recElapsed >= 40 ? ' · auto-stop at 0:50' : ''}</span>
          </div>
          <div className="flex items-center justify-center py-4 bg-black">
            <button type="button" onClick={stopRecord}
              className="px-8 py-3.5 rounded-2xl bg-rose-600 text-white text-[16px] font-black active:opacity-80">⏹ Stop &amp; get the call</button>
          </div>
        </div>
      )}
      {liveOn && (
        <div className="fixed inset-0 z-[220] bg-black flex flex-col">
          <div className="flex-1 min-h-0 relative flex items-center justify-center">
            <div className="relative" style={{ aspectRatio: `${liveVid.w}/${liveVid.h}`, maxWidth: '100%', maxHeight: '100%', width: '100%' }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={liveVideoRef} playsInline muted className="absolute inset-0 w-full h-full" />
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                <path d={courtPath(yours, 1)} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                <path d={courtPath(yours, 1)} fill="none" stroke="#39FF14" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </svg>
            </div>
            {/* the verdict feed — newest first, readable from your side */}
            <div className="absolute left-2 top-2 max-w-[70%] flex flex-col gap-1 pointer-events-none">
              {liveCalls.slice(0, 6).map((c, i) => (
                <span key={i} className="px-2 py-1 rounded-lg text-[12px] font-bold text-white truncate"
                  style={{ background: c.includes('OUT') ? 'rgba(220,38,38,0.9)' : c.includes('IN ') ? 'rgba(22,163,74,0.85)' : 'rgba(0,0,0,0.55)', opacity: i === 0 ? 1 : 0.7 }}>
                  {c}</span>
              ))}
            </div>
            {liveAlert && (
              <div className="absolute inset-0 bg-red-600/80 flex items-center justify-center pointer-events-none animate-pulse">
                <span className="text-white font-black text-[13vw] leading-none drop-shadow-lg">OUT</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black">
            <span className="px-3 py-1.5 rounded-full text-[13px] font-bold text-white bg-red-600 truncate">{liveMsg}</span>
            <button type="button" onClick={closeLive} className="px-5 py-2.5 rounded-xl bg-white/15 text-white text-[14px] font-bold shrink-0">⏹ Stop</button>
          </div>
        </div>
      )}
      {anchorOn && (
        <div className="fixed inset-0 z-[210] bg-black flex flex-col">
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="relative" style={{ aspectRatio: `${anchorVid.w}/${anchorVid.h}`, maxWidth: '100%', maxHeight: '100%', width: '100%' }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={anchorVideoRef} playsInline muted className="absolute inset-0 w-full h-full" />
              {anchorHasFix && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                  <path d={courtPath(anchorPins, 1)} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="4.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                  <path d={courtPath(anchorPins, 1)} fill="none" stroke="#39FF14" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black">
            <span className="px-3 py-1.5 rounded-full text-[13px] font-bold text-white truncate"
              style={{ background: anchorMsg.startsWith('🔒') ? '#00C853' : anchorMsg.startsWith('⚠') ? '#ef4444' : '#0891b2' }}>
              {anchorMsg || '⚓ anchoring…'}</span>
            <button type="button" onClick={closeAnchor} className="px-5 py-2.5 rounded-xl bg-white/15 text-white text-[14px] font-bold shrink-0">Done</button>
          </div>
        </div>
      )}
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
