'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { ChannelId, ResolvedEvent, ResolvedChannel } from '@/lib/notification-templates'
import { renderBody, smsSegmentInfo } from '@/lib/notification-templates'

const CHANNEL_LABELS: Record<ChannelId, string> = { sms: 'SMS', push: 'Push' }

export default function TemplateEditorPage() {
  const params = useParams<{ id: string; channel: string }>()
  const router = useRouter()
  const eventId = params?.id as string
  const channel = params?.channel as ChannelId

  const [event, setEvent] = useState<ResolvedEvent | null>(null)
  const [template, setTemplate] = useState<ResolvedChannel | null>(null)
  const [draftBody, setDraftBody] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const lastFocusedRef = useRef<'title' | 'body'>('body')

  useEffect(() => {
    if (!eventId || !channel) return
    let cancelled = false
    fetch(`/api/admin/templates/events/${eventId}/${channel}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Not found')
        return r.json()
      })
      .then((data: { event: ResolvedEvent; template: ResolvedChannel }) => {
        if (cancelled) return
        setError('')
        setEvent(data.event)
        setTemplate(data.template)
        setDraftBody(data.template.body)
        setDraftTitle(data.template.title ?? '')
      })
      .catch((err) => { if (!cancelled) setError((err as Error).message) })
    return () => { cancelled = true }
  }, [eventId, channel])

  const isPush = channel === 'push'
  const availableChannels = useMemo<ChannelId[]>(() => {
    if (!event) return []
    return (['sms', 'push'] as ChannelId[]).filter((c) => event.channels[c])
  }, [event])

  const isDirty = useMemo(() => {
    if (!template) return false
    if (draftBody !== template.body) return true
    if (isPush && draftTitle !== (template.title ?? '')) return true
    return false
  }, [template, draftBody, draftTitle, isPush])

  const isCustomized = useMemo(() => {
    if (!template) return false
    if (draftBody !== template.default_body) return true
    if (isPush && draftTitle !== (template.default_title ?? '')) return true
    return false
  }, [template, draftBody, draftTitle, isPush])

  const sampleVars = useMemo(() => {
    if (!event) return {}
    return Object.fromEntries(event.variables.map((v) => [v.key, v.example]))
  }, [event])

  const previewBody = useMemo(() => renderBody(draftBody, sampleVars), [draftBody, sampleVars])
  const previewTitle = useMemo(() => renderBody(draftTitle, sampleVars), [draftTitle, sampleVars])
  const bodySeg = useMemo(() => smsSegmentInfo(draftBody), [draftBody])
  const previewBodySeg = useMemo(() => smsSegmentInfo(previewBody), [previewBody])

  function insertVariable(key: string) {
    const insertion = `{{${key}}}`
    if (lastFocusedRef.current === 'title' && isPush) {
      const el = titleRef.current
      if (!el) return
      const before = draftTitle.slice(0, el.selectionStart ?? draftTitle.length)
      const after = draftTitle.slice(el.selectionEnd ?? draftTitle.length)
      const next = before + insertion + after
      setDraftTitle(next)
      requestAnimationFrame(() => {
        el.focus()
        const cursor = before.length + insertion.length
        el.setSelectionRange(cursor, cursor)
      })
    } else {
      const el = bodyRef.current
      if (!el) return
      const before = draftBody.slice(0, el.selectionStart)
      const after = draftBody.slice(el.selectionEnd)
      const next = before + insertion + after
      setDraftBody(next)
      requestAnimationFrame(() => {
        el.focus()
        const cursor = before.length + insertion.length
        el.setSelectionRange(cursor, cursor)
      })
    }
  }

  async function handleSave() {
    if (!event || !template) return
    setSaving(true)
    setError('')
    try {
      const payload: { body: string; title?: string } = { body: draftBody }
      if (isPush) payload.title = draftTitle
      const res = await fetch(`/api/admin/templates/events/${event.id}/${channel}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save')
      } else {
        setEvent(data.event)
        setTemplate(data.template)
        setDraftBody(data.template.body)
        setDraftTitle(data.template.title ?? '')
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch {
      setError('Failed to save template.')
    }
    setSaving(false)
  }

  async function handleReset() {
    if (!event || !template) return
    if (!confirm('Reset this channel to defaults? Any customizations will be discarded.')) return
    setResetting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/templates/events/${event.id}/${channel}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to reset')
      } else {
        setEvent(data.event)
        setTemplate(data.template)
        setDraftBody(data.template.body)
        setDraftTitle(data.template.title ?? '')
      }
    } catch {
      setError('Failed to reset template.')
    }
    setResetting(false)
  }

  if (error && !event) {
    return (
      <div className="max-w-2xl">
        <Link href="/admin/templates" className="text-sm text-primary hover:underline">
          ← Back to templates
        </Link>
        <div className="mt-4 px-4 py-3 rounded-xl bg-danger/10 text-danger text-sm">{error}</div>
      </div>
    )
  }

  if (!event || !template) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl pb-32">
      <nav className="flex items-center gap-1.5 text-xs text-muted mb-2">
        <Link href="/admin/templates" className="hover:text-foreground transition-colors">
          System Templates
        </Link>
        <Chev />
        <span className="text-foreground font-medium">{event.name}</span>
      </nav>

      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold mb-1">{event.name}</h2>
          <p className="text-sm text-muted">{event.trigger}</p>
        </div>
      </div>

      {/* Channel tabs */}
      <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-border w-fit mb-6">
        {availableChannels.map((c) => {
          const isActive = c === channel
          const hasCustomization = event.channels[c]?.is_customized
          return (
            <Link
              key={c}
              href={`/admin/templates/${event.id}/${c}`}
              className={`h-9 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                isActive ? 'bg-background shadow-sm text-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              {CHANNEL_LABELS[c]}
              {hasCustomization && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </Link>
          )
        })}
      </div>

      {/* Meta card */}
      <div className="rounded-2xl border border-border bg-surface/50 p-4 mb-6">
        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <Meta label="Event ID" value={<code className="font-mono text-foreground">{event.id}</code>} />
          <Meta label="Channel" value={CHANNEL_LABELS[channel]} />
          <Meta
            label="Last edited"
            value={template.updated_at ? new Date(template.updated_at).toLocaleString() : 'Never (default)'}
          />
        </div>
        {template.call_sites.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
              Sent from
            </p>
            <ul className="space-y-1">
              {template.call_sites.map((site) => (
                <li key={site} className="text-xs font-mono text-foreground/80">{site}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Editor + preview */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          {isPush && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold">Title</label>
                <span className="text-[11px] text-muted">{draftTitle.length} chars</span>
              </div>
              <input
                ref={titleRef}
                type="text"
                value={draftTitle}
                onFocus={() => { lastFocusedRef.current = 'title' }}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm
                           placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                           focus:border-primary"
                placeholder="Push notification title"
              />
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold">{isPush ? 'Body' : 'Message Body'}</label>
            {!isPush && <SegmentBadge segInfo={bodySeg} />}
            {isPush && <span className="text-[11px] text-muted">{draftBody.length} chars</span>}
          </div>
          <textarea
            ref={bodyRef}
            value={draftBody}
            onFocus={() => { lastFocusedRef.current = 'body' }}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={isPush ? 6 : 10}
            className="w-full p-4 rounded-2xl border border-border bg-background text-sm font-mono leading-relaxed
                       placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                       focus:border-primary resize-y"
            placeholder="Use {{variable}} for dynamic values."
          />

          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
              Insert variable {isPush && '(into focused field)'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {event.variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  title={v.description}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono
                             bg-surface border border-border text-foreground/80
                             hover:bg-primary/5 hover:border-primary/30 hover:text-primary
                             active:scale-95 transition-all"
                >
                  <span className="text-muted">{'{{'}</span>
                  {v.key}
                  <span className="text-muted">{'}}'}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted mt-2">
              Click a chip to insert at the cursor. Hover for what each variable means.
            </p>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold">Live preview</label>
            {!isPush && <SegmentBadge segInfo={previewBodySeg} />}
          </div>
          {isPush ? <PushPreview title={previewTitle} body={previewBody} /> : <SmsPreview body={previewBody} />}

          <div className="mt-3 rounded-xl border border-border bg-background p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
              Preview values
            </p>
            <dl className="space-y-1">
              {event.variables.map((v) => (
                <div key={v.key} className="flex items-baseline justify-between gap-3 text-xs">
                  <dt className="font-mono text-muted">{v.key}</dt>
                  <dd className="text-foreground/80 truncate text-right">
                    {v.example || <span className="italic text-muted">(empty)</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {isCustomized && (
        <details className="mt-6 rounded-2xl border border-border bg-surface/50 p-4">
          <summary className="text-sm font-semibold cursor-pointer select-none">
            Show defaults
          </summary>
          {isPush && template.default_title && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mt-3 mb-1.5">
                Default title
              </p>
              <pre className="p-3 rounded-xl bg-background border border-border text-xs font-mono whitespace-pre-wrap break-words">
                {template.default_title}
              </pre>
            </>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mt-3 mb-1.5">
            Default body
          </p>
          <pre className="p-3 rounded-xl bg-background border border-border text-xs font-mono whitespace-pre-wrap break-words">
            {template.default_body}
          </pre>
        </details>
      )}

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="px-4 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/admin/templates')}
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              ← Back
            </button>
            {error && <span className="text-xs text-danger truncate">{error}</span>}
            {saved && <span className="text-xs font-medium text-success">Saved</span>}
          </div>
          <div className="flex items-center gap-2">
            {template.is_customized && (
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-2 rounded-xl border border-border text-foreground text-sm font-medium
                           hover:bg-surface active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {resetting ? 'Resetting…' : 'Reset to default'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-semibold
                         hover:bg-primary-dark active:scale-[0.98] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SmsPreview({ body }: { body: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 p-5">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 max-w-sm mx-auto">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900">Whozin</p>
            <p className="text-[10px] text-slate-500">Text Message • Now</p>
          </div>
        </div>
        <p className="text-[13px] text-slate-900 leading-relaxed whitespace-pre-wrap break-words">
          {body || <span className="text-slate-400 italic">Empty message</span>}
        </p>
      </div>
    </div>
  )
}

function PushPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200 p-5">
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-sm border border-white/50 p-3.5 max-w-sm mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <p className="text-[13px] font-semibold text-slate-900 truncate">
                {title || <span className="text-slate-400 italic">No title</span>}
              </p>
              <span className="text-[10px] text-slate-500 flex-shrink-0">now</span>
            </div>
            <p className="text-[13px] text-slate-700 leading-snug whitespace-pre-wrap break-words">
              {body || <span className="text-slate-400 italic">Empty body</span>}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  )
}

function Chev() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function SegmentBadge({ segInfo }: { segInfo: { length: number; segments: number; encoding: 'GSM-7' | 'UCS-2' } }) {
  const overLimit = segInfo.segments > 1
  return (
    <span className={`inline-flex items-center gap-2 text-[11px] font-medium tabular-nums ${overLimit ? 'text-amber-700' : 'text-muted'}`}>
      <span>{segInfo.length} chars</span>
      <span className="text-border">•</span>
      <span>{segInfo.segments} seg</span>
      <span className="text-border">•</span>
      <span>{segInfo.encoding}</span>
    </span>
  )
}
