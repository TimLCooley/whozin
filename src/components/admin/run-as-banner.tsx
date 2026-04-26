'use client'

import { useEffect, useState } from 'react'

interface ActiveCookie {
  target_name: string
  target_id: string
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  if (!match) return null
  return decodeURIComponent(match.slice(name.length + 1))
}

export default function RunAsBanner() {
  const [active, setActive] = useState<ActiveCookie | null>(null)
  const [stopping, setStopping] = useState(false)

  useEffect(() => {
    const raw = readCookie('whozin_run_as_active')
    if (!raw) return
    try {
      setActive(JSON.parse(raw))
    } catch {
      // ignore — bad cookie shape
    }
  }, [])

  if (!active) return null

  async function handleStop() {
    setStopping(true)
    try {
      const res = await fetch('/api/admin/users/run-as', { method: 'DELETE' })
      if (res.ok) {
        window.location.href = '/admin/users'
        return
      }
    } catch {
      // fall through
    }
    setStopping(false)
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white px-4 py-2 shadow-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span className="truncate">
            <span className="font-semibold">Acting as {active.target_name}</span>
            <span className="opacity-80 ml-2 hidden sm:inline">— super admin session paused</span>
          </span>
        </div>
        <button
          onClick={handleStop}
          disabled={stopping}
          className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-white text-red-700 hover:bg-red-50 active:opacity-80 transition-opacity disabled:opacity-50"
        >
          {stopping ? 'Stopping…' : 'Stop'}
        </button>
      </div>
    </div>
  )
}
