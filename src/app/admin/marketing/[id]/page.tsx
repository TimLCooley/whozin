'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Campaign {
  id: string
  slug: string
  title: string
  topic: string | null
  angle: string | null
  goal_type: 'app_downloads' | 'custom'
  goal_target: number | null
  status: 'draft' | 'active' | 'completed' | 'archived'
  starts_at: string | null
  ends_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface ContentItem {
  id: string
  channel: string
  content_type: string
  title: string | null
  body_text: string | null
  status: string
  click_count: number
  created_at: string
  scheduled_at: string | null
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${id}`)
      const data = await res.json()
      if (res.ok) {
        setCampaign(data.campaign)
        setItems(data.items ?? [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function updateStatus(status: Campaign['status']) {
    if (!campaign) return
    setSaving(true)
    const res = await fetch(`/api/admin/marketing/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const data = await res.json()
      setCampaign(data.campaign)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this campaign? All content items will be removed too.')) return
    const res = await fetch(`/api/admin/marketing/campaigns/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/admin/marketing')
  }

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="h-8 w-48 bg-surface rounded animate-pulse mb-4" />
        <div className="h-32 bg-surface rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="max-w-3xl">
        <Link href="/admin/marketing" className="text-xs text-primary font-medium hover:underline">
          ← Back to Marketing
        </Link>
        <p className="text-muted mt-4">Campaign not found.</p>
      </div>
    )
  }

  const progressPct = campaign.goal_target
    ? Math.min(100, Math.round((0 / campaign.goal_target) * 100))
    : 0

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/marketing" className="text-xs text-primary font-medium hover:underline">
          ← Back to Marketing
        </Link>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold truncate">{campaign.title}</h2>
            {campaign.topic && <p className="text-sm text-muted mt-1">{campaign.topic}</p>}
          </div>
          <select
            value={campaign.status}
            onChange={(e) => updateStatus(e.target.value as Campaign['status'])}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold capitalize"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Goal progress */}
      <div className="bg-background border border-border/50 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">
            Goal: {campaign.goal_type.replace(/_/g, ' ')}
          </span>
          {campaign.goal_target && (
            <span className="text-xs text-muted">
              0 / {campaign.goal_target.toLocaleString()}
            </span>
          )}
        </div>
        {campaign.goal_target ? (
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        ) : (
          <p className="text-xs text-muted">No target set</p>
        )}
      </div>

      {/* Angle */}
      {campaign.angle && (
        <div className="bg-background border border-border/50 rounded-2xl p-5 mb-6">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Angle</h3>
          <p className="text-sm text-foreground whitespace-pre-wrap">{campaign.angle}</p>
        </div>
      )}

      {/* Content items */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Content</h3>
          <Link
            href={`/admin/marketing/${id}/content/new`}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold"
          >
            + New Content
          </Link>
        </div>
        {items.length === 0 ? (
          <div className="bg-background border border-dashed border-border rounded-2xl p-8 text-center">
            <p className="text-sm text-muted mb-3">No content items yet.</p>
            <Link
              href={`/admin/marketing/${id}/content/new`}
              className="inline-block px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold"
            >
              Draft your first post
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/admin/marketing/${id}/content/${item.id}`}
                className="block bg-background border border-border/50 rounded-xl p-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-surface text-muted">
                    {item.channel}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    {item.status}
                  </span>
                  <span className="text-xs text-muted ml-auto">{item.click_count} clicks</span>
                </div>
                {item.title && <p className="text-sm font-semibold mt-1">{item.title}</p>}
                {!item.title && item.body_text && (
                  <p className="text-sm text-muted mt-1 line-clamp-1">{item.body_text}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {campaign.notes && (
        <div className="bg-background border border-border/50 rounded-2xl p-5 mb-6">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Notes</h3>
          <p className="text-sm text-foreground whitespace-pre-wrap">{campaign.notes}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted space-y-1 mb-6">
        <p>Slug: <code className="bg-surface px-1.5 py-0.5 rounded">{campaign.slug}</code></p>
        <p>Created: {new Date(campaign.created_at).toLocaleString()}</p>
        {campaign.starts_at && <p>Starts: {new Date(campaign.starts_at).toLocaleDateString()}</p>}
        {campaign.ends_at && <p>Ends: {new Date(campaign.ends_at).toLocaleDateString()}</p>}
      </div>

      <button
        onClick={handleDelete}
        className="text-xs text-danger font-medium hover:underline"
      >
        Delete campaign
      </button>
    </div>
  )
}
