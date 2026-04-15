'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewCampaignPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    topic: '',
    angle: '',
    goal_type: 'app_downloads' as 'app_downloads' | 'custom',
    goal_target: '',
    starts_at: '',
    ends_at: '',
    notes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          topic: form.topic.trim() || null,
          angle: form.angle.trim() || null,
          goal_type: form.goal_type,
          goal_target: form.goal_target ? Number(form.goal_target) : null,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
          notes: form.notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create campaign')
        setSaving(false)
        return
      }
      router.push(`/admin/marketing/${data.campaign.id}`)
    } catch {
      setError('Network error')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/admin/marketing" className="text-xs text-primary font-medium hover:underline">
          ← Back to Marketing
        </Link>
        <h2 className="text-2xl font-bold mt-2">New Campaign</h2>
        <p className="text-sm text-muted mt-1">
          Define the topic, angle, and goal. Content items come next.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Title *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Fall Golf League Launch"
            className="input-field"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">Topic</label>
          <input
            type="text"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="What this campaign is about"
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">Angle</label>
          <textarea
            value={form.angle}
            onChange={(e) => setForm({ ...form, angle: e.target.value })}
            placeholder="The story or hook. What makes this interesting?"
            rows={3}
            className="input-field resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Goal Type</label>
            <select
              value={form.goal_type}
              onChange={(e) => setForm({ ...form, goal_type: e.target.value as 'app_downloads' | 'custom' })}
              className="input-field"
            >
              <option value="app_downloads">App Downloads</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Goal Target</label>
            <input
              type="number"
              min="0"
              value={form.goal_target}
              onChange={(e) => setForm({ ...form, goal_target: e.target.value })}
              placeholder="e.g. 500"
              className="input-field"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Start Date</label>
            <input
              type="date"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-muted">End Date</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const base = form.starts_at ? new Date(form.starts_at) : new Date()
                    const d = new Date(base)
                    d.setMonth(d.getMonth() + 1)
                    setForm({ ...form, ends_at: d.toISOString().slice(0, 10) })
                  }}
                  className="px-2 py-0.5 rounded-md bg-surface text-muted text-[10px] font-semibold hover:bg-primary/10 hover:text-primary"
                >
                  +1 mo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const base = form.starts_at ? new Date(form.starts_at) : new Date()
                    const d = new Date(base)
                    d.setMonth(d.getMonth() + 3)
                    setForm({ ...form, ends_at: d.toISOString().slice(0, 10) })
                  }}
                  className="px-2 py-0.5 rounded-md bg-surface text-muted text-[10px] font-semibold hover:bg-primary/10 hover:text-primary"
                >
                  +3 mo
                </button>
              </div>
            </div>
            <input
              type="date"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Internal notes, context, links..."
            rows={3}
            className="input-field resize-none"
          />
        </div>

        {error && (
          <div className="px-3 py-2 rounded-xl bg-danger/10 text-danger text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href="/admin/marketing"
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !form.title.trim()}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  )
}
