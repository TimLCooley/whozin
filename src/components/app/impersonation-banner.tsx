'use client'

import { useEffect, useState } from 'react'

export function ImpersonationBanner() {
  const [name, setName] = useState<string | null>(null)
  const [stopping, setStopping] = useState(false)

  useEffect(() => {
    fetch('/api/admin/impersonate')
      .then((r) => r.json())
      .then((data) => {
        if (data.impersonating) setName(data.target?.name ?? 'user')
      })
      .catch(() => {})
  }, [])

  async function handleStop() {
    setStopping(true)
    await fetch('/api/admin/impersonate', { method: 'DELETE' })
    window.location.href = '/admin/users'
  }

  if (!name) return null

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-[13px] font-medium">
      <span className="truncate">Viewing as <strong>{name}</strong></span>
      <button
        type="button"
        onClick={handleStop}
        disabled={stopping}
        className="flex-shrink-0 bg-white/20 hover:bg-white/30 active:bg-white/40 px-3 py-1 rounded-lg disabled:opacity-50"
      >
        {stopping ? 'Stopping...' : 'Stop'}
      </button>
    </div>
  )
}
