'use client'

import { useEffect, useState } from 'react'

interface SavedLoc {
  id: string
  name: string
  address: string | null
}

// Manage saved places (add + delete). Rendered inside a Settings Section, which
// provides the collapsible card wrapper.
export function SavedLocationsManager() {
  const [saved, setSaved] = useState<SavedLoc[]>([])
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/locations')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setSaved(Array.isArray(d) ? d : []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  async function add() {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), address: address.trim() }),
      })
      if (res.ok) {
        const row: SavedLoc = await res.json()
        setSaved((prev) => [...prev.filter((s) => s.id !== row.id), row].sort((a, b) => a.name.localeCompare(b.name)))
        setName('')
        setAddress('')
      }
    } catch { /* ignore */ }
    setBusy(false)
  }

  function remove(id: string) {
    setSaved((prev) => prev.filter((s) => s.id !== id)) // optimistic
    fetch('/api/locations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted leading-relaxed">Your reusable venues. Pick them fast when creating or editing an activity.</p>

      {/* Add a place */}
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Tim’s House)"
          className="input-field"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address (optional)"
            className="input-field flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || !name.trim()}
            className="px-4 rounded-xl bg-primary text-white text-[14px] font-bold active:opacity-80 transition-opacity disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* List */}
      {saved.length > 0 ? (
        <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden">
          {saved.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground truncate">{s.name}</p>
                {s.address && <p className="text-[12px] text-muted truncate">{s.address}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label={`Remove ${s.name}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-danger/70 active:bg-danger/10 transition-colors flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        loaded && <p className="text-[13px] text-muted text-center py-2">No saved places yet.</p>
      )}
    </div>
  )
}
