'use client'

import { useEffect, useState } from 'react'

interface State {
  loading: boolean
  impersonating: boolean
  name: string | null
}

export function ImpersonationBanner() {
  const [state, setState] = useState<State>({ loading: true, impersonating: false, name: null })
  const [stopping, setStopping] = useState(false)

  useEffect(() => {
    fetch('/api/admin/impersonate')
      .then((r) => r.json())
      .then((data) => {
        setState({
          loading: false,
          impersonating: !!data.impersonating,
          name: data.target?.name ?? null,
        })
      })
      .catch(() => setState({ loading: false, impersonating: false, name: null }))
  }, [])

  async function handleStop() {
    setStopping(true)
    await fetch('/api/admin/impersonate', { method: 'DELETE' })
    window.location.href = '/admin/users'
  }

  if (state.loading || !state.impersonating) return null

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-[13px] font-medium">
      <span className="truncate">
        Viewing as <strong>{state.name}</strong>
      </span>
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
