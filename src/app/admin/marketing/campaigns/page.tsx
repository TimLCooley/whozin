'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Campaign {
  id: string
  slug: string
  title: string
  topic: string | null
  goal_type: 'app_downloads' | 'custom'
  goal_target: number | null
  status: 'draft' | 'active' | 'completed' | 'archived'
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

const STATUS_STYLES: Record<Campaign['status'], string> = {
  draft: 'bg-surface text-muted border-border',
  active: 'bg-green-500/10 text-green-600 border-green-500/30',
  completed: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  archived: 'bg-surface/50 text-muted/60 border-border/50',
}

export default function CampaignsListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | Campaign['status']>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/marketing/campaigns')
      const data = await res.json()
      if (res.ok) setCampaigns(data.campaigns ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? campaigns : campaigns.filter((c) => c.status === filter)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <Link href="/admin/marketing" className="text-xs text-primary font-medium hover:underline">
            ← Back to CMO
          </Link>
          <h2 className="text-2xl font-bold mt-1">All Campaigns</h2>
          <p className="text-sm text-muted mt-1">{campaigns.length} total</p>
        </div>
        <Link
          href="/admin/marketing/new"
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold"
        >
          + New Campaign
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {(['all', 'draft', 'active', 'completed', 'archived'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${
              filter === s
                ? 'bg-primary text-white'
                : 'bg-surface text-muted hover:text-foreground border border-border/50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-background border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-background border border-border/50 rounded-2xl p-10 text-center">
          <p className="text-sm text-muted">No campaigns.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/admin/marketing/${c.id}`}
              className="block bg-background border border-border/50 rounded-xl p-4 hover:border-primary/40 transition-all"
            >
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground truncate">{c.title}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${STATUS_STYLES[c.status]}`}>
                  {c.status}
                </span>
              </div>
              {c.topic && <p className="text-xs text-muted truncate mb-1">{c.topic}</p>}
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <span>Goal: {c.goal_type.replace(/_/g, ' ')}</span>
                {c.goal_target && <span>Target: {c.goal_target.toLocaleString()}</span>}
                <span>·</span>
                <span>{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
