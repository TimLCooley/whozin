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
  scheduled_at: string | null
  posted_at: string | null
  post_url: string | null
  click_count: number
  created_at: string
}

interface IdeaStub {
  id: string
  content_item_id: string | null
  hook: string | null
  title: string | null
}

// Title fallback chain: content item title → linked CMO idea's hook → idea's internal
// title → first line of body → a warning label. Handles empty strings, not just nulls.
function displayTitle(item: ContentItem, idea: IdeaStub | undefined): string {
  if (item.title?.trim()) return item.title.trim()
  if (idea?.hook?.trim()) return idea.hook.trim()
  if (idea?.title?.trim()) return idea.title.trim()
  const firstBodyLine = item.body_text?.split('\n').find((l) => l.trim())?.trim()
  if (firstBodyLine) return firstBodyLine.slice(0, 80)
  return '⚠ Empty draft — needs re-generation'
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

type TabKey = 'review' | 'scheduled' | 'posted'

const TAB_DEFS: { key: TabKey; label: string; description: string; statuses: string[] }[] = [
  { key: 'review', label: 'Ready for review', description: 'Written, waiting for your approval', statuses: ['draft', 'review'] },
  { key: 'scheduled', label: 'Scheduled', description: 'Approved and queued to post', statuses: ['approved', 'scheduled'] },
  { key: 'posted', label: 'Posted', description: 'Live in the world', statuses: ['posted'] },
]

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Unscheduled'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function DraftsPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [ideas, setIdeas] = useState<IdeaStub[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('review')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, ideasRes] = await Promise.all([
        fetch('/api/admin/marketing/content-items'),
        fetch('/api/admin/marketing/ideas?limit=100'),
      ])
      const itemsData = await itemsRes.json()
      const ideasData = await ideasRes.json()
      if (itemsRes.ok) setItems(itemsData.items ?? [])
      if (ideasRes.ok) setIdeas(ideasData.ideas ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Compute counts + filtered lists per tab
  const byTab = useMemo(() => {
    const map: Record<TabKey, ContentItem[]> = { review: [], scheduled: [], posted: [] }
    for (const item of items) {
      for (const tab of TAB_DEFS) {
        if (tab.statuses.includes(item.status)) {
          map[tab.key].push(item)
          break
        }
      }
    }
    // Sort review + scheduled by next-up first; posted by most-recent first
    map.review.sort((a, b) => {
      const aT = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity
      const bT = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity
      return aT - bT
    })
    map.scheduled.sort((a, b) => {
      const aT = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity
      const bT = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity
      return aT - bT
    })
    map.posted.sort((a, b) => {
      const aT = a.posted_at ? new Date(a.posted_at).getTime() : 0
      const bT = b.posted_at ? new Date(b.posted_at).getTime() : 0
      return bT - aT
    })
    return map
  }, [items])

  const currentTabItems = byTab[activeTab]
  const activeTabDef = TAB_DEFS.find((t) => t.key === activeTab)!

  // content_item_id → idea map for fallback title/hook
  const ideaByItemId = useMemo(() => {
    const m = new Map<string, IdeaStub>()
    for (const idea of ideas) {
      if (idea.content_item_id) m.set(idea.content_item_id, idea)
    }
    return m
  }, [ideas])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Drafts</h2>
        <p className="text-sm text-muted mt-1">
          Everything you&apos;re working on, scheduled to ship, and already out there.
        </p>
      </div>

      {/* Internal tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border/50">
        {TAB_DEFS.map((tab) => {
          const count = byTab[tab.key].length
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-primary/15 text-primary' : 'bg-surface text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-muted mb-4">{activeTabDef.description}</p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface rounded-xl animate-pulse" />
          ))}
        </div>
      ) : currentTabItems.length === 0 ? (
        <div className="bg-background border border-dashed border-border rounded-2xl p-10 text-center">
          {activeTab === 'review' && (
            <>
              <p className="text-sm text-muted mb-3">Nothing waiting for review.</p>
              <Link
                href="/admin/marketing"
                className="inline-block px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold"
              >
                ✨ Ask the CMO for ideas
              </Link>
            </>
          )}
          {activeTab === 'scheduled' && (
            <p className="text-sm text-muted">Nothing scheduled yet. Approve items in Ready for review to queue them up.</p>
          )}
          {activeTab === 'posted' && (
            <p className="text-sm text-muted">Nothing posted yet. Once you mark a scheduled item as posted, it&apos;ll show up here with click counts.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {currentTabItems.map((item) => {
            const when =
              activeTab === 'posted' ? item.posted_at :
              activeTab === 'scheduled' ? item.scheduled_at :
              item.scheduled_at
            const linkedIdea = ideaByItemId.get(item.id)
            const shownTitle = displayTitle(item, linkedIdea)
            const isEmpty = !item.body_text?.trim() && !item.title?.trim()
            return (
              <Link
                key={item.id}
                href={`/admin/marketing/${item.campaign_id}/content/${item.id}`}
                className={`block bg-background border rounded-xl p-4 transition-all ${
                  isEmpty
                    ? 'border-yellow-500/40 hover:border-yellow-500/60'
                    : 'border-border/50 hover:border-primary/40 hover:shadow-[0_1px_4px_rgba(66,133,244,0.08)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {item.image_urls?.[0] ? (
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface flex-shrink-0">
                      <img src={item.image_urls[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
                      <span className="text-xl opacity-30">📝</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${CHANNEL_COLORS[item.channel] ?? CHANNEL_COLORS.other}`}>
                        {item.channel}
                      </span>
                      {when && (
                        <span className="text-[11px] text-primary font-semibold">
                          {activeTab === 'posted' ? `Posted ${formatDate(when)}` : `→ ${formatDateTime(when)}`}
                        </span>
                      )}
                      {isEmpty && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-700">
                          Empty
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-semibold truncate ${isEmpty ? 'text-muted italic' : 'text-foreground'}`}>
                      {shownTitle}
                    </p>
                    {item.body_text?.trim() && item.title?.trim() && (
                      <p className="text-xs text-muted truncate mt-0.5">{item.body_text}</p>
                    )}
                  </div>
                  {activeTab === 'posted' ? (
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-foreground">{item.click_count ?? 0}</p>
                      <p className="text-[10px] text-muted uppercase tracking-wide">clicks</p>
                    </div>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-muted/50 flex-shrink-0 mt-1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Summary footer for Posted tab */}
      {!loading && activeTab === 'posted' && currentTabItems.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              <span className="font-semibold text-foreground">{currentTabItems.length}</span> posts ·{' '}
              <span className="font-semibold text-foreground">
                {currentTabItems.reduce((n, i) => n + (i.click_count ?? 0), 0)}
              </span> total clicks
            </span>
            <Link href="/admin/marketing/live" className="text-xs text-primary font-semibold hover:underline">
              See detailed analytics →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
