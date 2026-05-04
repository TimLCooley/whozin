'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { ResolvedEvent, NotifCategory, ChannelId } from '@/lib/notification-templates'

const CATEGORY_ORDER: NotifCategory[] = ['Auth', 'Onboarding', 'Groups', 'Activities', 'Spots', 'Chat']

const CATEGORY_ACCENT: Record<NotifCategory, string> = {
  Auth: 'text-amber-700 bg-amber-50',
  Onboarding: 'text-blue-700 bg-blue-50',
  Groups: 'text-cyan-700 bg-cyan-50',
  Activities: 'text-violet-700 bg-violet-50',
  Spots: 'text-emerald-700 bg-emerald-50',
  Chat: 'text-pink-700 bg-pink-50',
}

const CHANNEL_ORDER: ChannelId[] = ['sms', 'push']

const CHANNEL_LABELS: Record<ChannelId, string> = { sms: 'SMS', push: 'Push' }

function defaultChannel(event: ResolvedEvent): ChannelId {
  return CHANNEL_ORDER.find((c) => event.channels[c]) ?? 'sms'
}

export default function TemplatesEventsPage() {
  const [events, setEvents] = useState<ResolvedEvent[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showCustomizedOnly, setShowCustomizedOnly] = useState(false)
  const [channelFilter, setChannelFilter] = useState<'all' | ChannelId>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    fetch('/api/admin/templates/events')
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setError('Failed to load templates.'))
  }, [])

  const filtered = useMemo(() => {
    if (!events) return null
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      if (channelFilter !== 'all' && !e.channels[channelFilter]) return false
      if (showCustomizedOnly && !Object.values(e.channels).some((c) => c?.is_customized)) return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.trigger.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        Object.values(e.channels).some((c) => c?.body.toLowerCase().includes(q) || c?.title?.toLowerCase().includes(q))
      )
    })
  }, [events, query, showCustomizedOnly, channelFilter])

  const grouped = useMemo(() => {
    if (!filtered) return null
    const map = new Map<NotifCategory, ResolvedEvent[]>()
    for (const e of filtered) {
      const list = map.get(e.category) ?? []
      list.push(e)
      map.set(e.category, list)
    }
    return CATEGORY_ORDER
      .map((cat) => ({ category: cat, events: map.get(cat) ?? [] }))
      .filter((g) => g.events.length > 0)
  }, [filtered])

  const totalCustomized = events?.filter((e) => Object.values(e.channels).some((c) => c?.is_customized)).length ?? 0

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">System Templates</h2>
        <p className="text-sm text-muted mt-1">
          {events ? (
            <>
              {events.length} events • {totalCustomized > 0
                ? <span className="text-foreground font-medium">{totalCustomized} customized</span>
                : 'all using defaults'}
            </>
          ) : (
            'Loading…'
          )}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, triggers, or message body…"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm
                       placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                       focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-border">
          {(['all', 'sms', 'push'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChannelFilter(c)}
              className={`h-9 px-3 rounded-lg text-xs font-semibold transition-colors capitalize ${
                channelFilter === c ? 'bg-background shadow-sm text-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              {c === 'all' ? 'All' : c.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCustomizedOnly((v) => !v)}
          className={`h-11 px-4 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${
            showCustomizedOnly
              ? 'bg-primary text-white border-primary'
              : 'bg-background border-border text-foreground hover:bg-surface'
          }`}
        >
          {showCustomizedOnly ? 'Showing customized' : 'Customized only'}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-danger/10 text-danger text-sm">{error}</div>
      )}

      {!events && !error && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {grouped && grouped.length === 0 && (
        <div className="text-center py-16 text-muted text-sm">
          No events match your filters.
        </div>
      )}

      {grouped && grouped.map((group) => (
        <div key={group.category} className="mb-8">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">
            {group.category}
          </h3>
          <div className="space-y-2">
            {group.events.map((event) => {
              const channels = CHANNEL_ORDER.filter((c) => event.channels[c])
              const customized = channels.filter((c) => event.channels[c]?.is_customized)
              const target = defaultChannel(event)
              const previewBody = event.channels[target]?.body ?? ''
              const isExpanded = expanded.has(event.id)
              return (
                <div
                  key={event.id}
                  className="rounded-2xl border border-border bg-background hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <Link
                    href={`/admin/templates/${event.id}/${target}`}
                    className="block p-4 group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-sm font-semibold text-foreground">{event.name}</h4>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${CATEGORY_ACCENT[event.category]}`}>
                            {event.category}
                          </span>
                          {channels.map((c) => {
                            const isCustomized = event.channels[c]?.is_customized
                            return (
                              <span
                                key={c}
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                  isCustomized
                                    ? 'text-primary bg-primary/10'
                                    : 'text-foreground/60 bg-surface'
                                }`}
                              >
                                {CHANNEL_LABELS[c]}
                                {isCustomized && <Dot />}
                              </span>
                            )
                          })}
                        </div>
                        <p className="text-xs text-muted">{event.trigger}</p>
                      </div>
                      <svg
                        width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                        className="text-muted flex-shrink-0 transition-transform group-hover:translate-x-0.5 mt-0.5"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                    {!isExpanded && (
                      <p className="text-[13px] text-foreground/80 font-mono leading-snug whitespace-pre-wrap line-clamp-2 bg-surface rounded-lg px-3 py-2 mt-2">
                        {previewBody}
                      </p>
                    )}
                  </Link>

                  {isExpanded && (
                    <div className="px-4 pb-2 -mt-1 space-y-3">
                      {channels.map((c) => {
                        const ch = event.channels[c]!
                        return (
                          <div key={c} className="rounded-xl bg-surface border border-border/60 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-background/50">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">
                                  {CHANNEL_LABELS[c]}
                                </span>
                                {ch.is_customized ? (
                                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded text-primary bg-primary/10">
                                    Customized
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted">Default</span>
                                )}
                              </div>
                              <Link
                                href={`/admin/templates/${event.id}/${c}`}
                                className="text-[11px] font-semibold text-primary hover:underline"
                              >
                                Edit →
                              </Link>
                            </div>
                            {c === 'push' && ch.title && (
                              <div className="px-3 pt-2.5 pb-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-0.5">Title</p>
                                <p className="text-[13px] font-semibold text-foreground leading-snug whitespace-pre-wrap break-words font-mono">
                                  {ch.title}
                                </p>
                              </div>
                            )}
                            <div className="px-3 pt-2.5 pb-3">
                              {c === 'push' && (
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-0.5">Body</p>
                              )}
                              <p className="text-[13px] text-foreground/85 leading-snug whitespace-pre-wrap break-words font-mono">
                                {ch.body}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between px-4 pb-3 pt-1">
                    <span className="text-[11px] text-muted">
                      {customized.length > 0
                        ? `${customized.length} channel${customized.length === 1 ? '' : 's'} customized`
                        : 'Using defaults'}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(event.id)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Collapse' : 'Expand to see messages'}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-foreground transition-colors px-2 py-1 -mr-1 rounded-md hover:bg-surface"
                    >
                      {isExpanded ? 'Collapse' : 'Show messages'}
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                        className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Dot() {
  return <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
}
