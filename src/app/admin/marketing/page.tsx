'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Idea {
  id: string
  title: string
  hook: string | null
  hook_type: string | null
  framework: string | null
  channel: string
  why_it_might_work: string | null
  status: 'proposed' | 'drafting' | 'drafted' | 'rejected' | 'archived'
  content_item_id: string | null
  campaign_id: string | null
  source_prompt: string | null
  created_at: string
}

interface Brief {
  is_complete: boolean
  product_one_liner: string | null
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

const STARTERS = [
  'Give me 5 things to try this week',
  'Help me reach dads who stopped playing pickup sports',
  "I want to post on Reddit but don't know the angle",
  'Write me a LinkedIn post about building in public',
  "What's a hook for TikTok about group chat chaos?",
]

interface ContentItemStub {
  id: string
  status: string
}

export default function MarketingCMOPage() {
  const router = useRouter()
  const [brief, setBrief] = useState<Brief | null>(null)
  const [prompt, setPrompt] = useState('')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [contentItems, setContentItems] = useState<ContentItemStub[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [draftingId, setDraftingId] = useState<string | null>(null)
  const [draftingAll, setDraftingAll] = useState(false)
  const [draftProgress, setDraftProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadEverything = useCallback(async () => {
    setLoading(true)
    try {
      const [briefRes, ideasRes, itemsRes] = await Promise.all([
        fetch('/api/admin/marketing/brief'),
        fetch('/api/admin/marketing/ideas?limit=30'),
        fetch('/api/admin/marketing/content-items'),
      ])
      const briefData = await briefRes.json()
      const ideasData = await ideasRes.json()
      const itemsData = await itemsRes.json()
      setBrief(briefData.brief)
      setIdeas(ideasData.ideas ?? [])
      setContentItems(itemsData.items ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadEverything() }, [loadEverything])

  async function generateIdeas(overridePrompt?: string) {
    const p = (overridePrompt ?? prompt).trim()
    if (!p || generating) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/marketing/cmo-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Generation failed')
      } else {
        setIdeas((prev) => [...(data.ideas ?? []), ...prev])
        setPrompt('')
      }
    } catch {
      setError('Network error')
    }
    setGenerating(false)
  }

  async function draftIdea(ideaId: string) {
    setDraftingId(ideaId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/marketing/ideas/${ideaId}/draft`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Draft failed')
        setDraftingId(null)
        return
      }
      router.push(`/admin/marketing/${data.campaign_id}/content/${data.content_item.id}`)
    } catch {
      setError('Network error')
      setDraftingId(null)
    }
  }

  async function draftAllProposed() {
    const toDraft = ideas.filter((i) => i.status === 'proposed')
    if (toDraft.length === 0 || draftingAll) return
    setDraftingAll(true)
    setError(null)
    setDraftProgress({ done: 0, total: toDraft.length })
    let done = 0
    for (const idea of toDraft) {
      try {
        const res = await fetch(`/api/admin/marketing/ideas/${idea.id}/draft`, { method: 'POST' })
        if (!res.ok) {
          const data = await res.json()
          setError(`Draft failed on "${idea.title}": ${data.error || 'unknown error'}`)
        }
      } catch {
        setError(`Network error drafting "${idea.title}"`)
      }
      done += 1
      setDraftProgress({ done, total: toDraft.length })
    }
    setDraftingAll(false)
    setDraftProgress(null)
    await loadEverything()
  }

  async function rejectIdea(ideaId: string) {
    await fetch(`/api/admin/marketing/ideas/${ideaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    })
    setIdeas((prev) => prev.filter((i) => i.id !== ideaId))
  }

  const proposedIdeas = ideas.filter((i) => i.status === 'proposed')

  // Map content_item_id → current status so we show LIVE state, not stale idea state.
  const itemStatusById = new Map<string, string>()
  for (const ci of contentItems) itemStatusById.set(ci.id, ci.status)

  // Drafted ideas whose content item is still in-flight (draft/review/scheduled/approved).
  // Anything already posted/archived drops off this list — it lives in the Live tab now.
  const draftedIdeas = ideas
    .filter((i) => i.status === 'drafted' && i.content_item_id)
    .map((i) => ({
      ...i,
      liveStatus: itemStatusById.get(i.content_item_id!) ?? 'draft',
    }))
    .filter((i) => i.liveStatus !== 'posted' && i.liveStatus !== 'archived')

  if (loading) {
    return (
      <div className="max-w-4xl">
        <div className="h-10 w-64 bg-surface rounded animate-pulse mb-4" />
        <div className="h-32 bg-surface rounded-2xl animate-pulse" />
      </div>
    )
  }

  // First-time setup gate
  if (!brief || !brief.is_complete) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold mb-2">Meet your CMO</h2>
        <p className="text-sm text-muted mb-6">
          Before your CMO can help you, it needs to learn about Whozin. Takes 10 minutes.
          You answer ~8 questions about your product, users, and what you&apos;ve tried.
          Every suggestion after that is shaped by this brief.
        </p>
        <div className="bg-background border border-border/50 rounded-2xl p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-primary" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">One-time product brief</h3>
              <p className="text-sm text-muted mb-4">
                Your CMO will ask questions like &quot;who&apos;s your sharpest user?&quot; and
                &quot;what&apos;s worked and what flopped?&quot;. Be specific. Fuzzy answers
                = fuzzy suggestions.
              </p>
              <Link
                href="/admin/marketing/brief"
                className="inline-block px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold"
              >
                Start intake →
              </Link>
            </div>
          </div>
        </div>

      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">What&apos;s next?</h2>
        <p className="text-sm text-muted mt-1">
          Ask your CMO for ideas, hooks, or angles. It knows Whozin.
        </p>
      </div>

      {/* Prompt box */}
      <div className="bg-background border border-border/50 rounded-2xl p-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
              e.preventDefault()
              generateIdeas()
            }
          }}
          placeholder="Describe what you want to try, or just say 'give me 5 things to try this week'"
          rows={3}
          disabled={generating}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none resize-none"
          autoFocus
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-muted">⌘/Ctrl + Enter to send</span>
          <button
            onClick={() => generateIdeas()}
            disabled={generating || !prompt.trim()}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            {generating ? 'Thinking...' : '✨ Get ideas'}
          </button>
        </div>
      </div>

      {/* Starter prompts */}
      {proposedIdeas.length === 0 && !generating && (
        <div className="mb-6">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => { setPrompt(s); generateIdeas(s) }}
                className="px-3 py-1.5 rounded-full bg-surface text-muted text-xs font-medium hover:text-foreground hover:bg-primary/10"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded-xl bg-danger/10 text-danger text-sm mb-4">{error}</div>
      )}

      {/* Proposed ideas */}
      {proposedIdeas.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">
              Proposed ({proposedIdeas.length})
            </h3>
            <button
              onClick={draftAllProposed}
              disabled={draftingAll}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50"
            >
              {draftingAll && draftProgress
                ? `Drafting ${draftProgress.done}/${draftProgress.total}...`
                : `✨ Draft all ${proposedIdeas.length}`}
            </button>
          </div>
          <div className="space-y-3">
            {proposedIdeas.map((idea) => (
              <div
                key={idea.id}
                className="bg-background border border-border/50 rounded-2xl p-5 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                      CHANNEL_COLORS[idea.channel] ?? CHANNEL_COLORS.other
                    }`}
                  >
                    {idea.channel}
                  </span>
                  {idea.hook_type && (
                    <span className="text-[10px] font-semibold text-muted bg-surface px-2 py-0.5 rounded-full">
                      {idea.hook_type.replace(/_/g, ' ')}
                    </span>
                  )}
                  {idea.framework && (
                    <span className="text-[10px] font-semibold text-muted bg-surface px-2 py-0.5 rounded-full uppercase">
                      {idea.framework}
                    </span>
                  )}
                </div>

                {idea.hook && (
                  <p className="text-base font-semibold text-foreground mb-2 leading-snug">
                    &ldquo;{idea.hook}&rdquo;
                  </p>
                )}

                {idea.why_it_might_work && (
                  <p className="text-xs text-muted mb-4">
                    <span className="font-semibold text-foreground">Why:</span> {idea.why_it_might_work}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => draftIdea(idea.id)}
                    disabled={draftingId === idea.id}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {draftingId === idea.id ? 'Drafting full post...' : '✨ Draft this'}
                  </button>
                  <button
                    onClick={() => rejectIdea(idea.id)}
                    className="px-3 py-1.5 rounded-lg border border-border text-muted text-xs font-semibold hover:text-danger hover:border-danger/40"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* In-flight drafts (live status from content_items, not frozen idea status) */}
      {draftedIdeas.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Your drafts ({draftedIdeas.length})</h3>
            <Link href="/admin/marketing/drafts" className="text-[11px] text-primary font-semibold hover:underline">
              See all →
            </Link>
          </div>
          <div className="space-y-2">
            {draftedIdeas.slice(0, 10).map((idea) => {
              const liveStatusStyle =
                idea.liveStatus === 'scheduled' ? 'bg-blue-500/15 text-blue-700' :
                idea.liveStatus === 'review' ? 'bg-yellow-500/15 text-yellow-700' :
                idea.liveStatus === 'approved' ? 'bg-green-500/15 text-green-700' :
                'bg-surface text-muted'
              return (
                <button
                  key={idea.id}
                  onClick={() => {
                    if (idea.content_item_id && idea.campaign_id) {
                      router.push(`/admin/marketing/${idea.campaign_id}/content/${idea.content_item_id}`)
                    }
                  }}
                  className="w-full text-left bg-background border border-border/50 rounded-xl p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${CHANNEL_COLORS[idea.channel] ?? CHANNEL_COLORS.other}`}>
                      {idea.channel}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${liveStatusStyle}`}>
                      {idea.liveStatus}
                    </span>
                    <span className="text-xs font-medium text-foreground truncate">
                      {idea.hook ?? idea.title}
                    </span>
                    <span className="text-[10px] text-muted ml-auto whitespace-nowrap">
                      {new Date(idea.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
