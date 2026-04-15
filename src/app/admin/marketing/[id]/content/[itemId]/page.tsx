'use client'

import { useEffect, useState, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ContentItem {
  id: string
  campaign_id: string
  parent_id: string | null
  channel: string
  content_type: string
  title: string | null
  body_text: string | null
  image_urls: string[]
  short_code: string | null
  destination_url: string | null
  status: 'draft' | 'review' | 'approved' | 'scheduled' | 'posted' | 'archived'
  scheduled_at: string | null
  posted_at: string | null
  post_url: string | null
  click_count: number
  created_at: string
}

interface OriginalIdea {
  id: string
  title: string | null
  hook: string | null
  hook_type: string | null
  framework: string | null
  why_it_might_work: string | null
  source_prompt: string | null
}

// Workflow is draft → review → scheduled → posted.
// 'approved' is kept as a valid DB state for backward compat but hidden from the UI —
// it was redundant with 'scheduled' (if you're scheduling it, you've approved it).
const STATUS_FLOW: ContentItem['status'][] = ['draft', 'review', 'scheduled', 'posted']

const NEXT_ACTION: Record<string, { next: ContentItem['status']; label: string } | null> = {
  draft: { next: 'review', label: 'Send to review' },
  review: { next: 'scheduled', label: 'Schedule it' },
  approved: { next: 'scheduled', label: 'Schedule it' },
  scheduled: { next: 'posted', label: 'Mark as posted' },
  posted: null,
  archived: null,
}

const CHANNELS = ['tiktok', 'linkedin', 'reddit', 'facebook', 'instagram', 'newsletter', 'other'] as const

const CHANNEL_COLORS: Record<string, string> = {
  tiktok: 'bg-pink-500/15 text-pink-600 border-pink-500/40',
  linkedin: 'bg-blue-500/15 text-blue-600 border-blue-500/40',
  reddit: 'bg-orange-500/15 text-orange-600 border-orange-500/40',
  facebook: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/40',
  instagram: 'bg-purple-500/15 text-purple-600 border-purple-500/40',
  newsletter: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40',
  other: 'bg-surface text-muted border-border',
}

export default function ContentItemEditPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id: campaignId, itemId } = use(params)
  const router = useRouter()
  const [item, setItem] = useState<ContentItem | null>(null)
  const [originalIdea, setOriginalIdea] = useState<OriginalIdea | null>(null)
  const [loading, setLoading] = useState(true)
  const [advancingStatus, setAdvancingStatus] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [suggestingSchedule, setSuggestingSchedule] = useState(false)
  const [scheduleReason, setScheduleReason] = useState<string | null>(null)
  const [imagePrompt, setImagePrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle')
  const [showPostUrlPrompt, setShowPostUrlPrompt] = useState(false)
  const [pendingPostUrl, setPendingPostUrl] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemRef = useRef<ContentItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/marketing/content-items/${itemId}`)
      const data = await res.json()
      if (res.ok) {
        const loaded: ContentItem = data.item
        const idea: OriginalIdea | null = data.idea ?? null

        // Silent backfills for content items created before defaults existed.
        const backfillPatch: Record<string, string> = {}

        // Title from linked CMO idea
        if (idea && (!loaded.title || !loaded.title.trim())) {
          const firstBodyLine = loaded.body_text?.split('\n').find((l) => l.trim())?.trim().slice(0, 80) ?? null
          const backfilled =
            (idea.hook && idea.hook.trim().slice(0, 80)) ||
            (idea.title && idea.title.trim()) ||
            firstBodyLine ||
            null
          if (backfilled) {
            loaded.title = backfilled
            backfillPatch.title = backfilled
          }
        }

        // Destination URL default
        if (!loaded.destination_url || !loaded.destination_url.trim()) {
          loaded.destination_url = 'https://whozin.io/dl'
          backfillPatch.destination_url = 'https://whozin.io/dl'
        }

        if (Object.keys(backfillPatch).length > 0) {
          fetch(`/api/admin/marketing/content-items/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backfillPatch),
          }).catch(() => {})
        }

        setItem(loaded)
        setOriginalIdea(idea)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [itemId])

  useEffect(() => { load() }, [load])

  function patch<K extends keyof ContentItem>(key: K, value: ContentItem[K]) {
    setItem((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      itemRef.current = next
      return next
    })
    setDirty(true)
    setAutoSaveState('pending')
  }

  // Keep itemRef in sync whenever item changes from any source (load, save, etc.)
  useEffect(() => {
    itemRef.current = item
  }, [item])

  const autosave = useCallback(async () => {
    const current = itemRef.current
    if (!current) return
    setAutoSaveState('saving')
    setError(null)
    try {
      const res = await fetch(`/api/admin/marketing/content-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: current.title,
          body_text: current.body_text,
          destination_url: current.destination_url,
          channel: current.channel,
          content_type: current.content_type,
          scheduled_at: current.scheduled_at,
          post_url: current.post_url,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Save failed')
        setAutoSaveState('idle')
      } else {
        setDirty(false)
        setAutoSaveState('saved')
        if (savedFlashRef.current) clearTimeout(savedFlashRef.current)
        savedFlashRef.current = setTimeout(() => setAutoSaveState('idle'), 1500)
      }
    } catch {
      setError('Network error')
      setAutoSaveState('idle')
    }
  }, [itemRef, itemId])

  // Debounced autosave: every patch() schedules a save ~800ms after the last edit
  useEffect(() => {
    if (!dirty || autoSaveState !== 'pending') return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      autosave()
    }, 800)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [dirty, autoSaveState, autosave])

  // Flush on unmount if there are pending edits
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedFlashRef.current) clearTimeout(savedFlashRef.current)
      if (dirty && itemRef.current) {
        // Fire-and-forget final save on navigation away
        fetch(`/api/admin/marketing/content-items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: itemRef.current.title,
            body_text: itemRef.current.body_text,
            destination_url: itemRef.current.destination_url,
            channel: itemRef.current.channel,
            content_type: itemRef.current.content_type,
            scheduled_at: itemRef.current.scheduled_at,
            post_url: itemRef.current.post_url,
          }),
        }).catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function updateStatus(status: ContentItem['status'], extra?: Partial<ContentItem>) {
    setAdvancingStatus(true)
    const res = await fetch(`/api/admin/marketing/content-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...(extra ?? {}) }),
    })
    if (res.ok) {
      const data = await res.json()
      setItem(data.item)
      setDirty(false)
    }
    setAdvancingStatus(false)
  }

  // Per-transition readiness check. Returns a list of human-readable field labels
  // that are still missing. Empty list = ready to advance.
  function getMissingFieldsForNext(): string[] {
    if (!item) return []
    const next = NEXT_ACTION[item.status]
    if (!next) return []

    const missing: string[] = []
    const needsImages = item.content_type === 'carousel' || item.content_type === 'image' || item.content_type === 'video'

    if (next.next === 'review') {
      if (!item.body_text?.trim()) missing.push('body text')
    }

    if (next.next === 'scheduled') {
      if (!item.body_text?.trim()) missing.push('body text')
      if (!item.title?.trim()) missing.push('title')
      if (!item.scheduled_at) missing.push('scheduled time')
      if (!item.destination_url?.trim()) missing.push('destination URL')
      if (needsImages && item.image_urls.length === 0) missing.push('images')
    }

    // scheduled → posted: post_url is handled via the modal prompt, so no blockers here.
    return missing
  }

  function advanceToNextStatus() {
    if (!item) return
    const next = NEXT_ACTION[item.status]
    if (!next) return
    const missing = getMissingFieldsForNext()
    if (missing.length > 0) return
    if (next.next === 'posted') {
      if (!item.post_url || !item.post_url.trim()) {
        setPendingPostUrl('')
        setShowPostUrlPrompt(true)
        return
      }
    }
    updateStatus(next.next)
  }

  function confirmPosted() {
    const url = pendingPostUrl.trim()
    setShowPostUrlPrompt(false)
    updateStatus('posted', { post_url: url || null })
  }

  async function generateText() {
    if (!item) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/marketing/generate-variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaignId,
          parent_content_item_id: item.parent_id,
          target_channel: item.channel,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Generation failed')
      } else {
        setItem((prev) => prev ? { ...prev, title: data.title, body_text: data.body_text } : prev)
        setDirty(true)
      }
    } catch {
      setError('Network error')
    }
    setGenerating(false)
  }

  async function generateImages() {
    if (!item) return
    const prompt = imagePrompt.trim() || `Marketing carousel image for: ${item.title || item.body_text?.slice(0, 100) || 'Whozin app'}. Friend group coordinating plans. Warm, inviting, photographic.`
    setGeneratingImages(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/marketing/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          count: item.content_type === 'carousel' ? 3 : 1,
          content_item_id: itemId,
          aspect: item.channel === 'tiktok' || item.channel === 'instagram' ? 'portrait' : 'square',
          update_item: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Image generation failed')
      } else {
        setItem((prev) => prev ? { ...prev, image_urls: data.urls } : prev)
      }
    } catch {
      setError('Network error')
    }
    setGeneratingImages(false)
  }

  async function suggestSchedule() {
    setSuggestingSchedule(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/marketing/content-items/${itemId}/suggest-schedule`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Suggestion failed')
      } else {
        patch('scheduled_at', data.iso)
        setScheduleReason(data.reason)
      }
    } catch {
      setError('Network error')
    }
    setSuggestingSchedule(false)
  }

  async function copyToClipboard() {
    if (!item) return
    const parts = [item.title, item.body_text].filter(Boolean).join('\n\n')
    await navigator.clipboard.writeText(parts)
  }

  async function handleDelete() {
    if (!confirm('Delete this content item?')) return
    const res = await fetch(`/api/admin/marketing/content-items/${itemId}`, { method: 'DELETE' })
    if (res.ok) router.push(`/admin/marketing/${campaignId}`)
  }

  if (loading) {
    return (
      <div className="max-w-5xl">
        <div className="h-8 w-48 bg-surface rounded animate-pulse mb-4" />
        <div className="h-64 bg-surface rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="max-w-5xl">
        <Link href={`/admin/marketing/${campaignId}`} className="text-xs text-primary font-medium hover:underline">
          ← Back
        </Link>
        <p className="text-muted mt-4">Content item not found.</p>
      </div>
    )
  }

  const canPreviewCarousel = item.content_type === 'carousel' && item.image_urls.length > 0

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/admin/marketing/${campaignId}`} className="text-xs text-primary font-medium hover:underline">
          ← Back to Campaign
        </Link>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold truncate">
              {item.title || 'Untitled draft'}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted">
              <span className="capitalize">{item.content_type}</span>
              <span>·</span>
              <span className="uppercase font-semibold tracking-wide">{item.status}</span>
              {item.click_count > 0 && <><span>·</span><span>{item.click_count} clicks</span></>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            {autoSaveState === 'pending' && <span>Editing…</span>}
            {autoSaveState === 'saving' && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Saving…
              </span>
            )}
            {autoSaveState === 'saved' && (
              <span className="flex items-center gap-1.5 text-green-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Original CMO idea */}
      {originalIdea && (
        <div className="bg-gradient-to-br from-primary/5 to-primary/0 border border-primary/20 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-primary" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 00-7 7c0 2.8 1.6 5.2 4 6.3V18h6v-2.7c2.4-1.1 4-3.5 4-6.3a7 7 0 00-7-7z" />
              <path d="M9 21h6M10 18v3M14 18v3" />
            </svg>
            <p className="text-[10px] font-bold text-primary uppercase tracking-wide">The original CMO idea</p>
          </div>

          {originalIdea.hook && (
            <p className="text-base font-semibold text-foreground mb-3 leading-snug">
              &ldquo;{originalIdea.hook}&rdquo;
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 mb-3">
            {originalIdea.hook_type && (
              <span className="text-[10px] font-semibold text-muted bg-background px-2 py-0.5 rounded-full border border-border/50">
                Hook: {originalIdea.hook_type.replace(/_/g, ' ')}
              </span>
            )}
            {originalIdea.framework && (
              <span className="text-[10px] font-semibold text-muted bg-background px-2 py-0.5 rounded-full border border-border/50 uppercase">
                {originalIdea.framework}
              </span>
            )}
          </div>

          {originalIdea.why_it_might_work && (
            <p className="text-xs text-muted">
              <span className="font-semibold text-foreground">Why:</span> {originalIdea.why_it_might_work}
            </p>
          )}

          {originalIdea.source_prompt && (
            <p className="text-[11px] text-muted mt-2 italic">
              From your prompt: &ldquo;{originalIdea.source_prompt}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Status workflow */}
      {(() => {
        const nextAction = NEXT_ACTION[item.status]
        const missing = getMissingFieldsForNext()
        const ready = missing.length === 0
        return (
          <div className="bg-background border border-border/50 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-xs font-semibold text-muted uppercase tracking-wide">Workflow</div>
              {nextAction && (
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={advanceToNextStatus}
                    disabled={advancingStatus || !ready}
                    title={ready ? '' : `Missing: ${missing.join(', ')}`}
                    className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {advancingStatus ? 'Working…' : nextAction.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                  {!ready && (
                    <p className="text-[10px] text-muted">
                      Missing: {missing.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_FLOW.map((s, idx) => {
                const effectiveStatus = item.status === 'approved' ? 'scheduled' : item.status
                const currentIdx = STATUS_FLOW.indexOf(effectiveStatus)
                const isActive = effectiveStatus === s
                const isPast = currentIdx > idx
                return (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    disabled={advancingStatus}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : isPast
                          ? 'bg-primary/10 text-primary'
                          : 'bg-surface text-muted hover:bg-border/50'
                    }`}
                  >
                    {isPast && '✓ '}{s}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left: editor */}
        <div className="space-y-5">
          {/* Writing for — channel selector, positioned above Text */}
          <div className="bg-background border border-border/50 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wide mb-2">Writing for</p>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((c) => {
                const isActive = item.channel === c
                return (
                  <button
                    key={c}
                    onClick={() => patch('channel', c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-colors ${
                      isActive
                        ? CHANNEL_COLORS[c]
                        : 'bg-surface text-muted border-border/50 hover:text-foreground hover:border-foreground/30'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-background border border-border/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Text</h3>
              <button
                onClick={generateText}
                disabled={generating}
                className="px-3 py-1 rounded-lg border border-primary/40 text-primary text-[11px] font-semibold hover:bg-primary/5 disabled:opacity-60"
              >
                {generating ? 'Drafting...' : '✨ Draft with AI'}
              </button>
            </div>

            <label className="block text-xs font-medium text-muted mb-1">Title / Headline</label>
            <input
              type="text"
              value={item.title ?? ''}
              onChange={(e) => patch('title', e.target.value)}
              placeholder="Optional"
              className="input-field mb-3"
            />

            <label className="block text-xs font-medium text-muted mb-1">Body</label>
            <textarea
              value={item.body_text ?? ''}
              onChange={(e) => patch('body_text', e.target.value)}
              placeholder={`Write the ${item.channel} post, or click "Draft with AI"`}
              rows={8}
              className="input-field resize-none font-mono text-sm"
            />

            <button
              onClick={copyToClipboard}
              className="mt-3 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-foreground"
            >
              Copy text to clipboard
            </button>
          </div>

          <div className="bg-background border border-border/50 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Images</h3>

            <label className="block text-xs font-medium text-muted mb-1">Generation prompt</label>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Leave empty to auto-generate from title"
              rows={2}
              className="input-field resize-none text-sm mb-2"
            />
            <button
              onClick={generateImages}
              disabled={generatingImages}
              className="w-full px-3 py-2 rounded-lg border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/5 disabled:opacity-60 mb-3"
            >
              {generatingImages ? 'Generating images...' : `✨ Generate ${item.content_type === 'carousel' ? '3 carousel images' : '1 image'}`}
            </button>

            {item.image_urls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {item.image_urls.map((url, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={url} alt={`${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-background border border-border/50 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Links & Schedule</h3>

            <label className="block text-xs font-medium text-muted mb-1">Destination URL (where clicks go)</label>
            <input
              type="url"
              value={item.destination_url ?? ''}
              onChange={(e) => patch('destination_url', e.target.value)}
              placeholder="https://whozin.io/dl"
              className="input-field mb-3"
            />

            {item.short_code && (
              <div className="mb-3 p-3 bg-surface rounded-lg">
                <p className="text-[11px] text-muted mb-1">Short link</p>
                <code className="text-xs font-mono text-foreground break-all">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/track/{item.short_code}
                </code>
              </div>
            )}

            <label className="block text-xs font-medium text-muted mb-1">Scheduled for</label>
            <div className="flex gap-2 mb-1">
              <input
                type="datetime-local"
                value={item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : ''}
                onChange={(e) => {
                  patch('scheduled_at', e.target.value ? new Date(e.target.value).toISOString() : null)
                  setScheduleReason(null)
                }}
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={suggestSchedule}
                disabled={suggestingSchedule}
                title="Auto-pick the next optimal posting time for this channel"
                className="shrink-0 w-10 h-10 rounded-xl border border-primary/40 text-primary flex items-center justify-center hover:bg-primary/5 disabled:opacity-60"
              >
                {suggestingSchedule ? (
                  <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                )}
              </button>
            </div>
            {scheduleReason && (
              <p className="text-[11px] text-primary mb-3">✨ {scheduleReason}</p>
            )}
            {!scheduleReason && <div className="mb-3" />}

            <label className="block text-xs font-medium text-muted mb-1">Post URL (after posting)</label>
            <input
              type="url"
              value={item.post_url ?? ''}
              onChange={(e) => patch('post_url', e.target.value)}
              placeholder="https://tiktok.com/@you/video/..."
              className="input-field"
            />
          </div>
        </div>

        {/* Right: preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="bg-background border border-border/50 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Preview</h3>

            {item.channel === 'tiktok' && canPreviewCarousel ? (
              <div className="max-w-[280px] mx-auto">
                <div className="relative aspect-[9/16] bg-black rounded-[28px] overflow-hidden border-4 border-black shadow-xl">
                  <img
                    src={item.image_urls[0]}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-16 text-white">
                    <p className="text-xs font-bold mb-1">@whozin</p>
                    {item.body_text && (
                      <p className="text-[11px] line-clamp-3 leading-snug">{item.body_text}</p>
                    )}
                  </div>
                  <div className="absolute top-4 right-4 bg-black/50 rounded-full px-2 py-0.5">
                    <span className="text-[10px] text-white font-bold">1/{item.image_urls.length}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted text-center mt-2">TikTok carousel preview</p>
              </div>
            ) : item.image_urls.length > 0 ? (
              <div className="max-w-sm mx-auto">
                <div className="aspect-square rounded-xl overflow-hidden border border-border mb-3">
                  <img src={item.image_urls[0]} alt="Preview" className="w-full h-full object-cover" />
                </div>
                {item.title && <p className="text-sm font-semibold mb-1">{item.title}</p>}
                {item.body_text && (
                  <p className="text-xs text-muted whitespace-pre-wrap">{item.body_text}</p>
                )}
              </div>
            ) : (
              <div className="bg-surface rounded-xl p-6 text-center">
                {item.title && <p className="text-sm font-semibold mb-2">{item.title}</p>}
                {item.body_text ? (
                  <p className="text-xs text-muted whitespace-pre-wrap text-left">{item.body_text}</p>
                ) : (
                  <p className="text-xs text-muted italic">Draft text to preview</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-xl bg-danger/10 text-danger text-sm mb-4">{error}</div>
      )}

      <button
        onClick={handleDelete}
        className="text-xs text-danger font-medium hover:underline"
      >
        Delete content item
      </button>

      {/* Post URL prompt */}
      {showPostUrlPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowPostUrlPrompt(false)}
        >
          <div
            className="bg-background rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-1">Mark as posted</h3>
            <p className="text-sm text-muted mb-4">
              Paste the live URL of the post so we can track back from short links and attribution.
              (Optional — leave blank if you want to add it later.)
            </p>
            <input
              type="url"
              value={pendingPostUrl}
              onChange={(e) => setPendingPostUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmPosted() }}
              placeholder="https://tiktok.com/@whozin/video/..."
              className="input-field mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowPostUrlPrompt(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted"
              >
                Cancel
              </button>
              <button
                onClick={confirmPosted}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold"
              >
                Mark as posted
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
