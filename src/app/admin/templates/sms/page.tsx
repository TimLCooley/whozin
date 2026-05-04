'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { ResolvedTemplate, SmsCategory } from '@/lib/sms-templates'
import { smsSegmentInfo } from '@/lib/sms-templates'

const CATEGORY_ORDER: SmsCategory[] = ['Auth', 'Onboarding', 'Activities', 'Spots & Waitlist', 'Chat']

const CATEGORY_ACCENT: Record<SmsCategory, string> = {
  'Auth': 'text-amber-700 bg-amber-50',
  'Onboarding': 'text-blue-700 bg-blue-50',
  'Activities': 'text-violet-700 bg-violet-50',
  'Spots & Waitlist': 'text-emerald-700 bg-emerald-50',
  'Chat': 'text-pink-700 bg-pink-50',
}

export default function SmsTemplatesListPage() {
  const [templates, setTemplates] = useState<ResolvedTemplate[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showCustomizedOnly, setShowCustomizedOnly] = useState(false)

  useEffect(() => {
    fetch('/api/admin/templates/sms')
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => setError('Failed to load templates.'))
  }, [])

  const filtered = useMemo(() => {
    if (!templates) return null
    const q = query.trim().toLowerCase()
    return templates.filter((t) => {
      if (showCustomizedOnly && !t.is_customized) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.trigger.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      )
    })
  }, [templates, query, showCustomizedOnly])

  const grouped = useMemo(() => {
    if (!filtered) return null
    const map = new Map<SmsCategory, ResolvedTemplate[]>()
    for (const t of filtered) {
      const list = map.get(t.category) ?? []
      list.push(t)
      map.set(t.category, list)
    }
    return CATEGORY_ORDER
      .map((cat) => ({ category: cat, templates: map.get(cat) ?? [] }))
      .filter((g) => g.templates.length > 0)
  }, [filtered])

  const totalCustomized = templates?.filter((t) => t.is_customized).length ?? 0

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb + heading */}
      <div className="mb-6">
        <nav className="flex items-center gap-1.5 text-xs text-muted mb-2">
          <Link href="/admin/templates" className="hover:text-foreground transition-colors">
            System Templates
          </Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-foreground font-medium">SMS</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">SMS Templates</h2>
            <p className="text-sm text-muted mt-1">
              {templates ? (
                <>
                  {templates.length} templates • {totalCustomized > 0 ? (
                    <span className="text-foreground font-medium">{totalCustomized} customized</span>
                  ) : (
                    'all using defaults'
                  )}
                </>
              ) : (
                'Loading…'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Search + filter */}
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
            placeholder="Search templates, triggers, or message body…"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm
                       placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                       focus:border-primary"
          />
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

      {!templates && !error && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {grouped && grouped.length === 0 && (
        <div className="text-center py-16 text-muted text-sm">
          No templates match your filters.
        </div>
      )}

      {/* Grouped list */}
      {grouped && grouped.map((group) => (
        <div key={group.category} className="mb-8">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">
            {group.category}
          </h3>
          <div className="space-y-2">
            {group.templates.map((t) => {
              const seg = smsSegmentInfo(t.body)
              return (
                <Link
                  key={t.id}
                  href={`/admin/templates/sms/${t.id}`}
                  className="block rounded-2xl border border-border bg-background p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-sm font-semibold text-foreground">{t.name}</h4>
                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${CATEGORY_ACCENT[t.category]}`}>
                          {t.category.split(' ')[0]}
                        </span>
                        {t.is_customized && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded text-primary bg-primary/10">
                            Customized
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted">{t.trigger}</p>
                    </div>
                    <svg
                      width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                      className="text-muted flex-shrink-0 transition-transform group-hover:translate-x-0.5 mt-0.5"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                  <p className="text-[13px] text-foreground/80 font-mono leading-snug whitespace-pre-wrap line-clamp-2 bg-surface rounded-lg px-3 py-2 mt-2">
                    {t.body}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
                    <span>{seg.length} chars</span>
                    <span>•</span>
                    <span>
                      {seg.segments} segment{seg.segments === 1 ? '' : 's'}
                    </span>
                    <span>•</span>
                    <span>{seg.encoding}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
