'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface CropUploadProps {
  settingKey: string
  currentUrl: string
  targetWidth: number
  targetHeight: number
  label: string
  onUploaded: (url: string) => void
}

interface CropState {
  scale: number
  offsetX: number
  offsetY: number
}

function CropModal({
  image,
  targetWidth,
  targetHeight,
  onCrop,
  onCancel,
}: {
  image: string
  targetWidth: number
  targetHeight: number
  onCrop: (blob: Blob) => void
  onCancel: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [crop, setCrop] = useState<CropState>({ scale: 1, offsetX: 0, offsetY: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })

  // Preview dimensions — fit within 400x400 max
  const aspect = targetWidth / targetHeight
  let previewW: number, previewH: number
  if (aspect >= 1) {
    previewW = Math.min(400, targetWidth)
    previewH = Math.round(previewW / aspect)
  } else {
    previewH = Math.min(400, targetHeight)
    previewW = Math.round(previewH * aspect)
  }

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      // Calculate initial scale to cover the target area
      const scaleX = targetWidth / img.width
      const scaleY = targetHeight / img.height
      const scale = Math.max(scaleX, scaleY)
      setCrop({ scale, offsetX: 0, offsetY: 0 })
      setLoaded(true)
    }
    img.src = image
  }, [image, targetWidth, targetHeight])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    canvas.width = previewW
    canvas.height = previewH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, previewW, previewH)

    // Scale factor from target to preview
    const pScale = previewW / targetWidth

    // Draw image centered with current crop offset and scale
    const drawW = img.width * crop.scale * pScale
    const drawH = img.height * crop.scale * pScale
    const drawX = (previewW - drawW) / 2 + crop.offsetX * pScale
    const drawY = (previewH - drawH) / 2 + crop.offsetY * pScale

    ctx.drawImage(img, drawX, drawY, drawW, drawH)

    // Draw border to show crop bounds
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(1, 1, previewW - 2, previewH - 2)
    ctx.setLineDash([])

    // Draw rule-of-thirds grid
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 1
    for (let i = 1; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo((previewW * i) / 3, 0)
      ctx.lineTo((previewW * i) / 3, previewH)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, (previewH * i) / 3)
      ctx.lineTo(previewW, (previewH * i) / 3)
      ctx.stroke()
    }
  }, [crop, previewW, previewH, targetWidth])

  useEffect(() => {
    if (loaded) draw()
  }, [loaded, draw])

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const img = imgRef.current
    if (!img) return

    const delta = e.deltaY > 0 ? 0.95 : 1.05
    const minScale = Math.max(targetWidth / img.width, targetHeight / img.height)
    const newScale = Math.max(minScale, Math.min(crop.scale * delta, minScale * 5))
    setCrop((prev) => ({ ...prev, scale: newScale }))
  }

  function handlePointerDown(e: React.PointerEvent) {
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: crop.offsetX, oy: crop.offsetY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return
    const img = imgRef.current
    if (!img) return

    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y

    // Convert preview px to target px
    const pScale = previewW / targetWidth
    const newOX = dragStart.current.ox + dx / pScale
    const newOY = dragStart.current.oy + dy / pScale

    // Clamp so image covers the target area
    const imgW = img.width * crop.scale
    const imgH = img.height * crop.scale
    const maxOX = Math.max(0, (imgW - targetWidth) / 2)
    const maxOY = Math.max(0, (imgH - targetHeight) / 2)

    setCrop((prev) => ({
      ...prev,
      offsetX: Math.max(-maxOX, Math.min(maxOX, newOX)),
      offsetY: Math.max(-maxOY, Math.min(maxOY, newOY)),
    }))
  }

  function handlePointerUp() {
    setDragging(false)
  }

  function handleScaleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const img = imgRef.current
    if (!img) return
    const minScale = Math.max(targetWidth / img.width, targetHeight / img.height)
    const val = parseFloat(e.target.value)
    setCrop((prev) => ({ ...prev, scale: minScale + val * (minScale * 4) }))
  }

  function getSliderValue() {
    const img = imgRef.current
    if (!img) return 0
    const minScale = Math.max(targetWidth / img.width, targetHeight / img.height)
    return (crop.scale - minScale) / (minScale * 4)
  }

  async function handleCrop() {
    const img = imgRef.current
    if (!img) return

    // Render at full target dimensions
    const offscreen = document.createElement('canvas')
    offscreen.width = targetWidth
    offscreen.height = targetHeight
    const ctx = offscreen.getContext('2d')
    if (!ctx) return

    const drawW = img.width * crop.scale
    const drawH = img.height * crop.scale
    const drawX = (targetWidth - drawW) / 2 + crop.offsetX
    const drawY = (targetHeight - drawH) / 2 + crop.offsetY

    ctx.drawImage(img, drawX, drawY, drawW, drawH)

    offscreen.toBlob((blob) => {
      if (blob) onCrop(blob)
    }, 'image/png')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40">
          <h3 className="text-[15px] font-bold text-foreground">Crop & Resize</h3>
          <p className="text-[12px] text-muted mt-0.5">
            Output: <span className="font-mono font-bold text-primary">{targetWidth} × {targetHeight}</span> px.
            Drag to position, scroll to zoom.
          </p>
        </div>

        {/* Canvas */}
        <div className="flex justify-center p-5 bg-[#1a1a2e]" ref={containerRef}>
          <canvas
            ref={canvasRef}
            width={previewW}
            height={previewH}
            className="cursor-grab active:cursor-grabbing rounded-lg"
            style={{ width: previewW, height: previewH, touchAction: 'none' }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 flex items-center gap-3 border-t border-border/30 bg-surface/30">
          <span className="text-[11px] text-muted font-medium">Zoom</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={getSliderValue()}
            onChange={handleScaleSlider}
            className="flex-1 h-1.5 accent-primary"
          />
          <span className="text-[11px] font-mono text-muted w-12 text-right">
            {Math.round(crop.scale * 100)}%
          </span>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-border/40 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[13px] font-semibold text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            disabled={!loaded}
            className="px-5 py-2.5 text-[13px] font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Crop & Upload
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CropUpload({ settingKey, currentUrl, targetWidth, targetHeight, label, onUploaded }: CropUploadProps) {
  const [showCrop, setShowCrop] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setShowCrop(true)
    }
    reader.readAsDataURL(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleCropped(blob: Blob) {
    setShowCrop(false)
    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', blob, `${settingKey}.png`)
    formData.append('key', settingKey)

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
      } else {
        onUploaded(data.url)
      }
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
        className="hidden"
        id={`crop-${settingKey}`}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="px-4 py-2 text-[12px] font-semibold rounded-xl border border-border hover:bg-surface transition-colors disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : currentUrl ? 'Replace' : 'Upload & Crop'}
      </button>
      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}

      {showCrop && imageSrc && (
        <CropModal
          image={imageSrc}
          targetWidth={targetWidth}
          targetHeight={targetHeight}
          onCrop={handleCropped}
          onCancel={() => setShowCrop(false)}
        />
      )}
    </div>
  )
}
