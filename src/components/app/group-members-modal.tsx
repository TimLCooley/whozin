'use client'

import { useEffect, useState } from 'react'
import { AvatarImg } from '@/components/ui/avatar-img'

interface GroupMember {
  user_id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  status: string | null
}

// A scrollable modal listing a group's members, so the host can confirm they
// picked the right group (helpful when a few groups have similar names).
export function GroupMembersModal({
  groupId,
  groupName,
  onClose,
}: {
  groupId: string
  groupName: string
  onClose: () => void
}) {
  const [members, setMembers] = useState<GroupMember[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setMembers(null)
    setError(false)
    fetch(`/api/groups/${groupId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((d) => { if (!cancelled) setMembers(d.members ?? []) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [groupId])

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-background rounded-2xl w-full max-w-sm shadow-xl animate-enter flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border/40 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Group</p>
              <h3 className="text-[17px] font-bold text-foreground truncate">{groupName}</h3>
              {members && (
                <p className="text-[12px] text-muted mt-0.5">
                  {members.length} {members.length === 1 ? 'person' : 'people'}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-surface flex items-center justify-center text-muted active:opacity-70 transition-opacity"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable member list */}
        <div className="overflow-y-auto px-2 py-2">
          {error ? (
            <p className="text-center text-[13px] text-muted py-10">Couldn’t load members.</p>
          ) : !members ? (
            <p className="text-center text-[13px] text-muted py-10">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-center text-[13px] text-muted py-10">No members in this group yet.</p>
          ) : (
            members.map((m) => {
              const name = [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || 'Unnamed'
              return (
                <div key={m.user_id} className="flex items-center gap-3 px-3 py-2 rounded-xl">
                  <AvatarImg size="md" src={m.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-foreground truncate">{name}</p>
                  </div>
                  {m.status === 'invited' && (
                    <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Invited
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
