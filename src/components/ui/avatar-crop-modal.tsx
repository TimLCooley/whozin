'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface AvatarCropModalProps {
  file: File
  onCancel: () => void
  onConfirm: (blob: Blob) => void | Promise<void>
}

const BOX = 280 // crop window size (px)
const OUTPUT = 512 // output image size (px)

export function AvatarCropModal({ file, onCancel, onConfirm }: AvatarCropModalProps) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)

  const boxRef = useRef<HTMLDivElement>(null)
  // Use refs so touch handlers always read fresh values without re-registering
  const stateRef = useRef({ scale: 1, minScale: 1, offset: { x: 0, y: 0 }, imgSize: null as { w: number; h: number } | null })
  stateRef.current = { scale, minScale, offset, imgSize }
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      setImgSize({ w, h })
      // Fit the image so its shortest side fills the crop box
      const base = Math.max(BOX / w, BOX / h)
      setScale(base)
      setMinScale(base)
      setOffset({ x: 0, y: 0 })
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const clampOffset = useCallback(
    (ox: number, oy: number, s: number) => {
      if (!imgSize) return { x: 0, y: 0 }
      const halfW = (imgSize.w * s) / 2
      const halfH = (imgSize.h * s) / 2
      const maxX = Math.max(0, halfW - BOX / 2)
      const maxY = Math.max(0, halfH - BOX / 2)
      return {
        x: Math.max(-maxX, Math.min(maxX, ox)),
        y: Math.max(-maxY, Math.min(maxY, oy)),
      }
    },
    [imgSize]
  )

  function clampWith(ox: number, oy: number, s: number, size: { w: number; h: number } | null) {
    if (!size) return { x: 0, y: 0 }
    const halfW = (size.w * s) / 2
    const halfH = (size.h * s) / 2
    const maxX = Math.max(0, halfW - BOX / 2)
    const maxY = Math.max(0, halfH - BOX / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    }
  }

  // Register touch handlers as non-passive so preventDefault works on iOS Safari
  useEffect(() => {
    const el = boxRef.current
    if (!el) return

    let touchDrag: { x: number; y: number; ox: number; oy: number } | null = null

    function handleTouchStart(e: TouchEvent) {
      const s = stateRef.current
      if (e.touches.length === 2) {
        e.preventDefault()
        const [a, b] = [e.touches[0], e.touches[1]]
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
        pinchRef.current = { dist, scale: s.scale }
        touchDrag = null
      } else if (e.touches.length === 1) {
        e.preventDefault()
        touchDrag = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: s.offset.x, oy: s.offset.y }
      }
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault()
      const s = stateRef.current
      if (e.touches.length === 2 && pinchRef.current) {
        const [a, b] = [e.touches[0], e.touches[1]]
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
        const next = Math.max(s.minScale, Math.min(s.minScale * 6, pinchRef.current.scale * (dist / pinchRef.current.dist)))
        setScale(next)
        setOffset((o) => clampWith(o.x, o.y, next, s.imgSize))
      } else if (e.touches.length === 1 && touchDrag) {
        const dx = e.touches[0].clientX - touchDrag.x
        const dy = e.touches[0].clientY - touchDrag.y
        setOffset(clampWith(touchDrag.ox + dx, touchDrag.oy + dy, s.scale, s.imgSize))
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinchRef.current = null
      if (e.touches.length === 0) touchDrag = null
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: false })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mouse-only handlers (desktop)
  function onMouseDown(e: React.MouseEvent) {
    if (!imgSize) return
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    const moveHandler = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.x
      const dy = ev.clientY - dragRef.current.y
      setOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy, scale))
    }
    const upHandler = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', moveHandler)
      window.removeEventListener('mouseup', upHandler)
    }
    window.addEventListener('mousemove', moveHandler)
    window.addEventListener('mouseup', upHandler)
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const next = Math.max(minScale, Math.min(minScale * 6, scale * (e.deltaY < 0 ? 1.08 : 0.92)))
    setScale(next)
    setOffset((o) => clampOffset(o.x, o.y, next))
  }

  async function handleConfirm() {
    if (!imgSize || !imgUrl || saving) return
    setSaving(true)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('load failed'))
        img.src = imgUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT
      canvas.height = OUTPUT
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no canvas ctx')

      // The preview draws the image centered at BOX/2 + offset, scaled by `scale`.
      // We need to map the crop window (BOX x BOX centered on box center) back to
      // source pixels: the box center corresponds to source point (imgSize/2 - offset/scale).
      const srcSize = BOX / scale
      const srcCx = imgSize.w / 2 - offset.x / scale
      const srcCy = imgSize.h / 2 - offset.y / scale
      const sx = srcCx - srcSize / 2
      const sy = srcCy - srcSize / 2

      ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT)

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/webp', 0.9)
      )
      if (!blob) throw new Error('blob failed')
      await onConfirm(blob)
    } finally {
      setSaving(false)
    }
  }

  const imgStyle: React.CSSProperties = imgSize
    ? {
        width: imgSize.w,
        height: imgSize.h,
        maxWidth: 'none',
        maxHeight: 'none',
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        transformOrigin: 'center center',
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: 'none',
      }
    : {}

  return (
    <div className="fixed inset-0 z-[2147483640] bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-background rounded-2xl p-5 w-full max-w-sm flex flex-col items-center">
        <h2 className="text-[16px] font-semibold mb-3 text-foreground">Crop your photo</h2>

        <div
          ref={boxRef}
          className="relative overflow-hidden bg-black rounded-xl"
          style={{ width: BOX, height: BOX, touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onWheel={onWheel}
        >
          {imgUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={imgUrl}
                alt="Crop"
                draggable={false}
                style={imgStyle}
              />
            </div>
          )}
          {/* Circle mask overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle at center, transparent ${BOX / 2 - 1}px, rgba(0,0,0,0.55) ${BOX / 2}px)`,
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80"
            style={{ margin: 'auto', width: BOX, height: BOX, boxSizing: 'border-box' }}
          />
        </div>

        <div className="w-full mt-4">
          <label className="block text-[11px] text-muted mb-1">Zoom</label>
          <input
            type="range"
            min={minScale}
            max={minScale * 6}
            step={0.001}
            value={scale}
            onChange={(e) => {
              const s = parseFloat(e.target.value)
              setScale(s)
              setOffset((o) => clampOffset(o.x, o.y, s))
            }}
            className="w-full"
          />
        </div>

        <div className="flex gap-2 w-full mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-border text-[14px] font-semibold text-foreground disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !imgSize}
            className="flex-1 btn-primary py-2.5 text-[14px] disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
