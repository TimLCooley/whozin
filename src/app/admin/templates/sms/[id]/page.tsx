'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { ResolvedTemplate } from '@/lib/sms-templates'
import { renderSmsBody, smsSegmentInfo } from '@/lib/sms-templates'

export default function SmsTemplateEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id as string

  const [tpl, setTpl] = useState<ResolvedTemplate | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/admin/templates/sms/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Not found')
        return r.json() as Promise<ResolvedTemplate>
      })
      .then((data) => {
        setTpl(data)
        setDraft(data.body)
      })
      .catch((err) => setError((err as Error).message))
  }, [id])

  const isDirty = useMemo(() => tpl ? draft !== tpl.body : false, [tpl, draft])
  const isCustomized = useMemo(() => tpl ? draft !== tpl.default_body : false, [tpl, draft])

  const segInfo = useMemo(() => smsSegmentInfo(draft), [draft])

  const sampleVars = useMemo(() => {
    if (!tpl) return {}
    return Object.fromEntries(tpl.variables.map((v) => [v.key, v.example]))
  }, [tpl])

  const preview = useMemo(() => renderSmsBody(draft, sampleVars), [draft, sampleVars])
  const previewSeg = useMemo(() => smsSegmentInfo(preview), [preview])

  function insertVariable(key: string) {
    const ta = textareaRef.current
    if (!ta) return
    const before = draft.slice(0, ta.selectionStart)
    const after = draft.slice(ta.selectionEnd)
    const insertion = `{{${key}}}`
    const next = before + insertion + after
    setDraft(next)
    requestAnimationFrame(() => {
      ta.focus()
      const cursor = before.length + insertion.length
      ta.setSelectionRange(cursor, cursor)
    })
  }

  async function handleSave() {
    if (!tpl) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/templates/sms/${tpl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save')
      } else {
        setTpl(data)
        setDraft(data.body)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch {
      setError('Failed to save template.')
    }
    setSaving(false)
  }

  async function handleReset() {
    if (!tpl) return
    if (!confirm('Reset this template to the default body? Any customizations will be discarded.')) return
    setResetting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/templates/sms/${tpl.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to reset')
      } else {
        setTpl(data)
        setDraft(data.body)
      }
    } catch {
      setError('Failed to reset template.')
    }
    setResetting(false)
  }

  if (error && !tpl) {
    return (
      <div className="max-w-2xl">
        <Link href="/admin/templates/sms" className="text-sm text-primary hover:underline">
          ← Back to SMS templates
        </Link>
        <div className="mt-4 px-4 py-3 rounded-xl bg-danger/10 text-danger text-sm">{error}</div>
      </div>
    )
  }

  if (!tpl) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl pb-32">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted mb-2">
        <Link href="/admin/templates" className="hover:text-foreground transition-colors">
          System Templates
        </Link>
        <Chev />
        <Link href="/admin/templates/sms" className="hover:text-foreground transition-colors">
          SMS
        </Link>
        <Chev />
        <span className="text-foreground font-medium">{tpl.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-2xl font-bold">{tpl.name}</h2>
            {isCustomized && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded text-primary bg-primary/10">
                Customized
              </span>
            )}
          </div>
          <p className="text-sm text-muted">{tpl.trigger}</p>
        </div>
      </div>

      {/* Trigger / call sites card */}
      <div className="rounded-2xl border border-border bg-surface/50 p-4 mb-6">
        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <Meta label="Template ID" value={<code className="font-mono text-foreground">{tpl.id}</code>} />
          <Meta label="Category" value={tpl.category} />
          <Meta
            label="Last edited"
            value={tpl.updated_at ? new Date(tpl.updated_at).toLocaleString() : 'Never (default)'}
          />
        </div>
        {tpl.call_sites.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
              Sent from
            </p>
            <ul className="space-y-1">
              {tpl.call_sites.map((site) => (
                <li key={site} className="text-xs font-mono text-foreground/80">{site}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Editor + preview grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold">Message Body</label>
            <SegmentBadge segInfo={segInfo} />
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            className="w-full p-4 rounded-2xl border border-border bg-background text-sm font-mono leading-relaxed
                       placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                       focus:border-primary resize-y"
            placeholder="Type the SMS body. Use {{variable}} for dynamic values."
          />

          {/* Variables */}
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
              Insert variable
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tpl.variables.map((v) => (
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
            <SegmentBadge segInfo={previewSeg} />
          </div>
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
                {preview || <span className="text-slate-400 italic">Empty message</span>}
              </p>
            </div>
          </div>

          {/* Sample values */}
          <div className="mt-3 rounded-xl border border-border bg-background p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
              Preview values
            </p>
            <dl className="space-y-1">
              {tpl.variables.map((v) => (
                <div key={v.key} className="flex items-baseline justify-between gap-3 text-xs">
                  <dt className="font-mono text-muted">{v.key}</dt>
                  <dd className="text-foreground/80 truncate text-right">{v.example || <span className="italic text-muted">(empty)</span>}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Default reference */}
      {isCustomized && (
        <details className="mt-6 rounded-2xl border border-border bg-surface/50 p-4">
          <summary className="text-sm font-semibold cursor-pointer select-none">
            Show default body
          </summary>
          <pre className="mt-3 p-3 rounded-xl bg-background border border-border text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
            {tpl.default_body}
          </pre>
        </details>
      )}

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="px-4 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/admin/templates/sms')}
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              ← Back
            </button>
            {error && (
              <span className="text-xs text-danger truncate">{error}</span>
            )}
            {saved && (
              <span className="text-xs font-medium text-success">Saved</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tpl.is_customized && (
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
