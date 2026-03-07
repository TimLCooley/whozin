'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { BottomNav } from '@/components/app/bottom-nav'

type Filter = 'all' | 'my' | 'other'

interface GroupItem {
  id: string
  name: string
  creator_id: string
  chat_enabled: boolean
  member_count: number
  is_owner: boolean
  created_at: string
}

export default function GroupsListPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<GroupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('my')
  const [creating, setCreating] = useState(false)

  const loadGroups = useCallback(async () => {
    const res = await fetch('/api/groups')
    if (res.ok) {
      const data = await res.json()
      setGroups(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  const filtered = groups.filter((g) => {
    if (filter === 'my') return g.is_owner
    if (filter === 'other') return !g.is_owner
    return true
  })

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Group', chat_enabled: false }),
      })
      const data = await res.json()
      if (res.ok && data.id) {
        router.push(`/app/groups/${data.id}`)
      } else {
        console.error('Create group failed:', data)
        alert(data.error || 'Failed to create group')
      }
    } catch (err) {
      console.error('Create group error:', err)
      alert('Failed to create group. Check console for details.')
    }
    setCreating(false)
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All Groups' },
    { key: 'my', label: 'My Groups' },
    { key: 'other', label: 'Other Groups' },
  ]

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <AppHeader />

      <div className="flex-1 pb-20 px-4">
        {/* Create Group button */}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="btn-primary w-full py-3 mt-4 mb-3 text-[14px] disabled:opacity-60"
        >
          {creating ? 'Creating...' : '+ Create Group'}
        </button>

        {/* Filter tabs */}
        <div className="flex relative mb-4 bg-background rounded-xl border border-border/50 overflow-hidden">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 py-2.5 text-[12px] font-semibold text-center transition-colors relative z-10 ${
                filter === f.key ? 'text-primary' : 'text-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
          {/* Active indicator */}
          <div
            className="absolute top-0 bottom-0 bg-primary/8 border-b-2 border-primary transition-all duration-300 z-0"
            style={{
              width: `${100 / 3}%`,
              left: `${filters.findIndex((f) => f.key === filter) * (100 / 3)}%`,
            }}
          />
        </div>

        {/* Groups list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-background border border-border/50 rounded-xl p-4 h-16 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c0c6d6" strokeWidth={1.5} className="mx-auto mb-3">
              <circle cx="9" cy="7" r="3" />
              <circle cx="17" cy="9" r="2.5" />
              <path d="M2 21v-1a5 5 0 0110 0v1M14 21v-1a4 4 0 018 0v1" />
            </svg>
            <p className="text-[14px] text-muted">
              {filter === 'my' ? 'You haven\'t created any groups yet.' :
               filter === 'other' ? 'You\'re not in any other groups.' :
               'No groups yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((group, i) => (
              <button
                key={group.id}
                onClick={() => router.push(`/app/groups/${group.id}`)}
                className="w-full bg-background border border-primary/20 rounded-xl p-4 flex items-center gap-3 active:bg-surface transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.04)] animate-enter"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                {/* Group avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2}>
                    <circle cx="9" cy="7" r="3" />
                    <circle cx="17" cy="9" r="2.5" />
                    <path d="M2 21v-1a5 5 0 0110 0v1M14 21v-1a4 4 0 018 0v1" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[14px] font-semibold text-foreground truncate">{group.name}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {group.chat_enabled && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#4285F4" stroke="none">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  )}
                  <div className="flex items-center gap-1 text-muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                    </svg>
                    <span className="text-[12px] font-medium">
                      {group.member_count} {group.member_count === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
