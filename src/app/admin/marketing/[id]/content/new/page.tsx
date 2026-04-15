'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const CHANNELS = ['tiktok', 'linkedin', 'reddit', 'facebook', 'instagram', 'newsletter', 'other'] as const
const CONTENT_TYPES = ['text', 'carousel', 'image', 'video', 'link'] as const

export default function NewContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = use(params)
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    channel: 'tiktok' as typeof CHANNELS[number],
    content_type: 'carousel' as typeof CONTENT_TYPES[number],
    title: '',
    body_text: '',
    destination_url: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/marketing/content-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaignId,
          channel: form.channel,
          content_type: form.content_type,
          title: form.title.trim() || null,
          body_text: form.body_text.trim() || null,
          destination_url: form.destination_url.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create content item')
        setSaving(false)
        return
      }
      router.push(`/admin/marketing/${campaignId}/content/${data.item.id}`)
    } catch {
      setError('Network error')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href={`/admin/marketing/${campaignId}`} className="text-xs text-primary font-medium hover:underline">
          ← Back to Campaign
        </Link>
        <h2 className="text-2xl font-bold mt-2">New Content Item</h2>
        <p className="text-sm text-muted mt-1">
          Pick a channel and type. You can draft with AI or write manually on the next screen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Channel *</label>
            <select
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value as typeof CHANNELS[number] })}
              className="input-field capitalize"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Content Type</label>
            <select
              value={form.content_type}
              onChange={(e) => setForm({ ...form, content_type: e.target.value as typeof CONTENT_TYPES[number] })}
              className="input-field capitalize"
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">Title / Headline</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Optional — leave blank to generate"
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">Body Text</label>
          <textarea
            value={form.body_text}
            onChange={(e) => setForm({ ...form, body_text: e.target.value })}
            placeholder="Optional — leave blank to generate with AI on the next screen"
            rows={4}
            className="input-field resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">Destination URL</label>
          <input
            type="url"
            value={form.destination_url}
            onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
            placeholder="https://whozin.io/dl — where clicks land"
            className="input-field"
          />
          <p className="text-[11px] text-muted mt-1">Where the short link redirects. UTMs will be appended automatically.</p>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-xl bg-danger/10 text-danger text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href={`/admin/marketing/${campaignId}`}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create & Edit'}
          </button>
        </div>
      </form>
    </div>
  )
}
