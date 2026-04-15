'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'

interface ContentItem {
  id: string
  campaign_id: string
  channel: string
  content_type: string
  title: string | null
  body_text: string | null
  image_urls: string[]
  status: string
  posted_at: string | null
  post_url: string | null
  click_count: number
  created_at: string
}

const CHANNEL_COLORS: Record<string, string> = {
  tiktok: 'bg-pink-500/15 text-pink-600 border-pink-500/30',
  linkedin: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  reddit: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  facebook: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30',
  instagram: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  newsletter: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  other: 'bg-surface text-muted border-border',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function LivePage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/marketing/content-items?status=posted')
      const data = await res.json()
      if (res.ok) setItems(data.items ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const totalPosts = items.length
    const totalClicks = items.reduce((n, i) => n + (i.click_count ?? 0), 0)
    const clicksByChannel: Record<string, { posts: number; clicks: number }> = {}
    for (const item of items) {
      if (!clicksByChannel[item.channel]) clicksByChannel[item.channel] = { posts: 0, clicks: 0 }
      clicksByChannel[item.channel].posts += 1
      clicksByChannel[item.channel].clicks += item.click_count ?? 0
    }
    const topPost = items.reduce<ContentItem | null>((best, i) => {
      if (!best || (i.click_count ?? 0) > (best.click_count ?? 0)) return i
      return best
    }, null)
    const avgClicks = totalPosts > 0 ? Math.round(totalClicks / totalPosts) : 0
    return { totalPosts, totalClicks, clicksByChannel, topPost, avgClicks }
  }, [items])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (b.click_count ?? 0) - (a.click_count ?? 0))
  }, [items])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Live</h2>
        <p className="text-sm text-muted mt-1">
          Everything that&apos;s out in the world and its click performance.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-40 bg-surface rounded-2xl animate-pulse" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-background border border-dashed border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-muted mb-3">Nothing posted yet.</p>
          <p className="text-xs text-muted mb-4">
            Once you mark a content item as <span className="font-semibold text-foreground">posted</span>, it&apos;ll show up here with click counts.
          </p>
          <Link
            href="/admin/marketing/drafts"
            className="inline-block px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold"
          >
            View drafts →
          </Link>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total posts" value={stats.totalPosts} />
            <StatCard label="Total clicks" value={stats.totalClicks} accent="primary" />
            <StatCard label="Avg clicks / post" value={stats.avgClicks} />
            <StatCard
              label="Top post"
              value={stats.topPost?.click_count ?? 0}
              sublabel={stats.topPost?.title?.slice(0, 30) ?? stats.topPost?.body_text?.slice(0, 30) ?? '—'}
            />
          </div>

          {/* By-channel breakdown */}
          <div className="bg-background border border-border/50 rounded-2xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">By channel</h3>
            <div className="space-y-2">
              {Object.entries(stats.clicksByChannel)
                .sort((a, b) => b[1].clicks - a[1].clicks)
                .map(([channel, data]) => {
                  const maxClicks = Math.max(...Object.values(stats.clicksByChannel).map((d) => d.clicks), 1)
                  const pct = (data.clicks / maxClicks) * 100
                  return (
                    <div key={channel}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${CHANNEL_COLORS[channel] ?? CHANNEL_COLORS.other}`}>
                          {channel}
                        </span>
                        <span className="text-muted">
                          <span className="font-semibold text-foreground">{data.clicks}</span> clicks · {data.posts} post{data.posts !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Posted items */}
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
              All posts ({items.length})
            </h3>
            <div className="space-y-2">
              {sortedItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/marketing/${item.campaign_id}/content/${item.id}`}
                  className="block bg-background border border-border/50 rounded-xl p-4 hover:border-primary/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {item.image_urls?.[0] && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface flex-shrink-0">
                        <img src={item.image_urls[0]} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${CHANNEL_COLORS[item.channel] ?? CHANNEL_COLORS.other}`}>
                          {item.channel}
                        </span>
                        <span className="text-[11px] text-muted">{formatDate(item.posted_at)}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate">
                        {item.title ?? item.body_text?.slice(0, 80) ?? '(untitled)'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-foreground">{item.click_count ?? 0}</p>
                      <p className="text-[10px] text-muted uppercase tracking-wide">clicks</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, sublabel, accent }: { label: string; value: number; sublabel?: string; accent?: 'primary' }) {
  return (
    <div className="bg-background border border-border/50 rounded-xl p-4">
      <p className="text-[10px] font-bold text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent === 'primary' ? 'text-primary' : 'text-foreground'}`}>
        {value.toLocaleString()}
      </p>
      {sublabel && <p className="text-[11px] text-muted truncate mt-0.5">{sublabel}</p>}
    </div>
  )
}
