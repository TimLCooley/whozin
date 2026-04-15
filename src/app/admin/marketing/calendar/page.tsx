'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'

interface Campaign {
  id: string
  title: string
}

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

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface text-muted',
  review: 'bg-yellow-500/15 text-yellow-700',
  approved: 'bg-green-500/15 text-green-700',
  scheduled: 'bg-blue-500/15 text-blue-700',
  posted: 'bg-primary/15 text-primary',
  archived: 'bg-surface/50 text-muted/60',
}

type ViewMode = 'calendar' | 'tile' | 'list'

function startOfMonthGrid(year: number, month: number): Date {
  const first = new Date(year, month, 1)
  const d = new Date(first)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function MarketingCalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [view, setView] = useState<ViewMode>('calendar')
  const [items, setItems] = useState<ContentItem[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, campaignsRes] = await Promise.all([
        fetch('/api/admin/marketing/content-items'),
        fetch('/api/admin/marketing/campaigns'),
      ])
      const itemsData = await itemsRes.json()
      const campaignsData = await campaignsRes.json()
      if (itemsRes.ok) setItems(itemsData.items ?? [])
      if (campaignsRes.ok) setCampaigns(campaignsData.campaigns ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const days = useMemo(() => {
    const start = startOfMonthGrid(year, month)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [year, month])

  const filtered = items.filter((item) => {
    if (campaignFilter !== 'all' && item.campaign_id !== campaignFilter) return false
    if (channelFilter !== 'all' && item.channel !== channelFilter) return false
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    return true
  })

  const itemsByDay = new Map<string, ContentItem[]>()
  for (const item of filtered) {
    const dateSource = item.scheduled_at || item.posted_at
    if (!dateSource) continue
    const d = new Date(dateSource)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!itemsByDay.has(key)) itemsByDay.set(key, [])
    itemsByDay.get(key)!.push(item)
  }

  const unscheduled = filtered.filter((i) => !i.scheduled_at && !i.posted_at)

  // Sorted versions for tile + list views (scheduled first asc, then unscheduled)
  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aTime = a.scheduled_at || a.posted_at
      const bTime = b.scheduled_at || b.posted_at
      if (aTime && bTime) return new Date(aTime).getTime() - new Date(bTime).getTime()
      if (aTime) return -1
      if (bTime) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [filtered])

  function prev() {
    if (month === 0) { setYear(year - 1); setMonth(11) } else setMonth(month - 1)
  }
  function next() {
    if (month === 11) { setYear(year + 1); setMonth(0) } else setMonth(month + 1)
  }
  function today() {
    setYear(now.getFullYear()); setMonth(now.getMonth())
  }

  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <Link href="/admin/marketing" className="text-xs text-primary font-medium hover:underline">
            ← Back to Marketing
          </Link>
          <h2 className="text-2xl font-bold mt-1">Content</h2>
          <p className="text-sm text-muted mt-0.5">{filtered.length} items</p>
        </div>

        {/* View switcher */}
        <div className="inline-flex items-center bg-surface border border-border rounded-xl p-1 gap-1">
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              view === 'calendar' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 10h18M8 2v4M16 2v4" />
            </svg>
            Calendar
          </button>
          <button
            onClick={() => setView('tile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              view === 'tile' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Tile
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              view === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted hover:text-foreground'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <circle cx="4" cy="6" r="1" />
              <circle cx="4" cy="12" r="1" />
              <circle cx="4" cy="18" r="1" />
            </svg>
            List
          </button>
        </div>
      </div>

      {/* Filters — shared across all views */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="px-3 h-9 rounded-lg border border-border bg-background text-xs font-semibold"
        >
          <option value="all">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="px-3 h-9 rounded-lg border border-border bg-background text-xs font-semibold capitalize"
        >
          <option value="all">All channels</option>
          {Object.keys(CHANNEL_COLORS).map((c) => (
            <option key={c} value={c} className="capitalize">{c}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 h-9 rounded-lg border border-border bg-background text-xs font-semibold capitalize"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="scheduled">Scheduled</option>
          <option value="posted">Posted</option>
        </select>

        {/* Calendar navigation only shown in calendar view */}
        {view === 'calendar' && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={prev} className="w-8 h-8 rounded-lg border border-border text-muted hover:text-foreground">←</button>
            <button onClick={today} className="px-3 h-8 rounded-lg border border-border text-xs font-semibold text-muted hover:text-foreground">Today</button>
            <button onClick={next} className="w-8 h-8 rounded-lg border border-border text-muted hover:text-foreground">→</button>
            <span className="ml-2 text-sm font-semibold text-foreground min-w-[140px]">{monthName}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-96 bg-surface rounded-2xl animate-pulse" />
      ) : view === 'calendar' ? (
        <>
          <div className="bg-background border border-border/50 rounded-2xl overflow-hidden">
            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-border/50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="px-2 py-2 text-[10px] font-bold text-muted uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7">
              {days.map((d, i) => {
                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
                const dayItems = itemsByDay.get(key) ?? []
                const isCurrentMonth = d.getMonth() === month
                const isToday = sameDay(d, now)
                return (
                  <div
                    key={i}
                    className={`min-h-[96px] border-r border-b border-border/30 p-1.5 ${
                      !isCurrentMonth ? 'bg-surface/30' : ''
                    }`}
                  >
                    <div
                      className={`text-[11px] font-semibold mb-1 ${
                        isToday
                          ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white'
                          : isCurrentMonth ? 'text-foreground' : 'text-muted/50'
                      }`}
                    >
                      {d.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayItems.slice(0, 3).map((item) => (
                        <Link
                          key={item.id}
                          href={`/admin/marketing/${item.campaign_id}/content/${item.id}`}
                          className={`block px-1.5 py-0.5 rounded text-[10px] font-medium border truncate ${
                            CHANNEL_COLORS[item.channel] ?? CHANNEL_COLORS.other
                          }`}
                          title={item.title ?? item.body_text ?? ''}
                        >
                          {item.title ?? item.body_text?.slice(0, 20) ?? '(no title)'}
                        </Link>
                      ))}
                      {dayItems.length > 3 && (
                        <p className="text-[10px] text-muted px-1.5">+{dayItems.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {unscheduled.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Unscheduled ({unscheduled.length})
              </h3>
              <div className="space-y-1.5">
                {unscheduled.map((item) => (
                  <Link
                    key={item.id}
                    href={`/admin/marketing/${item.campaign_id}/content/${item.id}`}
                    className="block bg-background border border-border/50 rounded-lg px-3 py-2 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${CHANNEL_COLORS[item.channel] ?? CHANNEL_COLORS.other}`}>
                        {item.channel}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{item.status}</span>
                      <span className="text-xs font-medium text-foreground truncate">
                        {item.title ?? item.body_text?.slice(0, 60) ?? '(untitled)'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      ) : view === 'tile' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedFiltered.length === 0 ? (
            <p className="text-sm text-muted col-span-full text-center py-10">No content items match these filters.</p>
          ) : sortedFiltered.map((item) => {
            const firstImage = item.image_urls?.[0]
            const when = item.scheduled_at ?? item.posted_at
            return (
              <Link
                key={item.id}
                href={`/admin/marketing/${item.campaign_id}/content/${item.id}`}
                className="group bg-background border border-border/50 rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-[0_2px_8px_rgba(66,133,244,0.08)] transition-all flex flex-col"
              >
                <div className={`relative aspect-square ${firstImage ? '' : 'bg-surface'}`}>
                  {firstImage ? (
                    <img src={firstImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl opacity-20">📝</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border backdrop-blur-sm ${CHANNEL_COLORS[item.channel] ?? CHANNEL_COLORS.other}`}>
                      {item.channel}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full backdrop-blur-sm ${STATUS_STYLES[item.status] ?? STATUS_STYLES.draft}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <p className="text-sm font-semibold text-foreground line-clamp-2 mb-1">
                    {item.title ?? item.body_text?.slice(0, 60) ?? '(untitled)'}
                  </p>
                  {item.body_text && item.title && (
                    <p className="text-xs text-muted line-clamp-2 mb-2">{item.body_text}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between text-[11px] text-muted pt-2">
                    <span>{when ? formatDateTime(when) : 'Unscheduled'}</span>
                    {item.click_count > 0 && <span>{item.click_count} clicks</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        // List view
        <div className="bg-background border border-border/50 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface/50 border-b border-border/50">
              <tr>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-muted uppercase tracking-wide">When</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-muted uppercase tracking-wide">Channel</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-muted uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-muted uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-bold text-muted uppercase tracking-wide">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-10 text-sm">
                    No content items match these filters.
                  </td>
                </tr>
              ) : sortedFiltered.map((item) => {
                const when = item.scheduled_at ?? item.posted_at
                return (
                  <tr
                    key={item.id}
                    className="border-b border-border/30 last:border-b-0 hover:bg-surface/30 cursor-pointer"
                    onClick={() => {
                      window.location.href = `/admin/marketing/${item.campaign_id}/content/${item.id}`
                    }}
                  >
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {when ? formatDate(when) : <span className="italic">Unscheduled</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${CHANNEL_COLORS[item.channel] ?? CHANNEL_COLORS.other}`}>
                        {item.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground truncate max-w-md">
                      {item.title ?? item.body_text?.slice(0, 80) ?? '(untitled)'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLES[item.status] ?? STATUS_STYLES.draft}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted">
                      {item.click_count > 0 ? item.click_count : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
