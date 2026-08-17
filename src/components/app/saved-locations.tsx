'use client'

import { useEffect, useState } from 'react'

interface SavedLoc {
  id: string
  name: string
  address: string | null
}

// Host-based saved locations: quick-pick chips + a "save this one" action,
// rendered inside the create flow's Location card.
export function SavedLocations({
  location,
  address,
  onPick,
}: {
  location: string
  address: string
  onPick: (name: string, address: string) => void
}) {
  const [saved, setSaved] = useState<SavedLoc[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/locations')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSaved(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const trimmed = location.trim()
  const alreadySaved = saved.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
  const canSave = trimmed.length > 0 && !alreadySaved

  async function save() {
    if (!canSave || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, address: address.trim() }),
      })
      if (res.ok) {
        const row: SavedLoc = await res.json()
        setSaved((prev) => [...prev.filter((s) => s.id !== row.id), row].sort((a, b) => a.name.localeCompare(b.name)))
      }
    } catch { /* ignore */ }
    setBusy(false)
  }

  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSaved((prev) => prev.filter((s) => s.id !== id)) // optimistic
    fetch('/api/locations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  if (saved.length === 0 && !canSave) return null

  return (
    <div className="mt-3">
      {saved.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">Saved places</p>
          <div className="flex flex-wrap gap-2">
            {saved.map((s) => (
              <span
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onPick(s.name, s.address ?? '')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(s.name, s.address ?? '') } }}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-surface border border-border/50 text-[13px] font-medium text-foreground active:bg-primary/5 cursor-pointer transition-colors"
                title={s.address || s.name}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                <span className="truncate max-w-[160px]">{s.name}</span>
                <button
                  type="button"
                  onClick={(e) => remove(s.id, e)}
                  aria-label={`Remove ${s.name}`}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-muted active:bg-border/60 transition-colors flex-shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </>
      )}
      {canSave && (
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="mt-2 inline-flex items-center gap-1.5 text-primary text-[12px] font-semibold active:opacity-70 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
          {busy ? 'Saving…' : `Save “${trimmed}” for next time`}
        </button>
      )}
    </div>
  )
}
