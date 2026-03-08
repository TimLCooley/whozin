'use client'

import { useState, useRef } from 'react'

interface ImageUploadProps {
  settingKey: string
  currentUrl: string
  label: string
  hint?: string
  onUploaded: (url: string) => void
}

export default function ImageUpload({ settingKey, currentUrl, label, hint, onUploaded }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
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
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {hint && <p className="text-xs text-muted mb-2">{hint}</p>}

      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="w-20 h-20 rounded-xl border border-border flex items-center justify-center overflow-hidden shrink-0" style={{ background: currentUrl ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' : undefined }}>
          {currentUrl ? (
            <img src={currentUrl} alt={label} className="w-full h-full object-contain p-1" />
          ) : (
            <span className="text-xs text-muted">No image</span>
          )}
        </div>

        <div className="flex-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
            onChange={handleFile}
            className="hidden"
            id={`upload-${settingKey}`}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-surface
                       transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : currentUrl ? 'Replace' : 'Upload'}
          </button>
          {error && <p className="text-xs text-danger mt-1">{error}</p>}
        </div>
      </div>
    </div>
  )
}
