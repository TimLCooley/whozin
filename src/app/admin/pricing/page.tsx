'use client'

import { useEffect, useState } from 'react'
import type { PricingConfig, PricingPlan, PricingPlanId } from '@/lib/pricing'

export default function PricingPage() {
  const [config, setConfig] = useState<PricingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState<PricingPlanId | null>(null)

  function flashSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  useEffect(() => {
    fetch('/api/admin/pricing')
      .then((r) => r.json())
      .then((data) => {
        setConfig(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load pricing.')
        setLoading(false)
      })
  }, [])

  function updatePlan(id: PricingPlanId, patch: Partial<PricingPlan>) {
    if (!config) return
    setConfig({
      ...config,
      plans: config.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })
    setSaved(false)
  }

  async function handleSave() {
    if (!config) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save')
      } else {
        flashSaved()
      }
    } catch {
      setError('Failed to save pricing.')
    }
    setSaving(false)
  }

  async function handleSyncStripe(planId: PricingPlanId) {
    setSyncing(planId)
    setError('')
    try {
      // Save first so Stripe gets the latest amount
      const saveRes = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!saveRes.ok) {
        const data = await saveRes.json()
        setError(data.error || 'Save before sync failed')
        setSyncing(null)
        return
      }

      const res = await fetch('/api/admin/pricing/sync-stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Stripe sync failed')
      } else {
        // Reload to pick up new IDs
        const fresh = await fetch('/api/admin/pricing').then((r) => r.json())
        setConfig(fresh)
        flashSaved()
      }
    } catch (err) {
      setError(`Stripe sync failed: ${(err as Error).message}`)
    }
    setSyncing(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!config) {
    return <div className="text-danger">Failed to load pricing config.</div>
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Pricing</h2>
          <p className="text-sm text-muted mt-1">
            Source of truth for displayed prices and Stripe checkout. Native store prices
            must be updated separately in App Store Connect / Google Play.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-success font-medium">Saved!</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold
                       hover:bg-primary-dark active:scale-[0.98] transition-all
                       disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-danger/10 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-background p-4 lg:p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Currency</h3>
        <div className="max-w-xs">
          <label className="block text-sm font-medium mb-1.5">ISO Currency Code</label>
          <input
            value={config.currency}
            onChange={(e) => {
              setConfig({ ...config, currency: e.target.value.toUpperCase() })
              setSaved(false)
            }}
            maxLength={3}
            className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm uppercase
                       focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <p className="text-xs text-muted mt-1.5">e.g. USD, EUR, GBP</p>
        </div>
      </div>

      <div className="space-y-6">
        {config.plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onChange={(patch) => updatePlan(plan.id, patch)}
            onSyncStripe={() => handleSyncStripe(plan.id)}
            syncing={syncing === plan.id}
          />
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-4 lg:p-6 text-sm">
        <h3 className="font-semibold mb-2">Native store updates</h3>
        <p className="text-muted mb-3">
          Apple and Google control product pricing in their consoles. After changing
          a price here, update the matching product in:
        </p>
        <ul className="space-y-1.5">
          <li>
            <a
              href="https://appstoreconnect.apple.com/apps"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              App Store Connect → My Apps → Whozin → Subscriptions / In-App Purchases
            </a>
          </li>
          <li>
            <a
              href="https://play.google.com/console/"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Google Play Console → Whozin → Monetize → Products
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  onChange,
  onSyncStripe,
  syncing,
}: {
  plan: PricingPlan
  onChange: (patch: Partial<PricingPlan>) => void
  onSyncStripe: () => void
  syncing: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{plan.label}</h3>
          <p className="text-xs text-muted">id: {plan.id}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={plan.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="h-4 w-4"
          />
          Enabled
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Display label">
          <input
            value={plan.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className={fieldClass}
          />
        </Field>
        <Field label="Amount (cents)" hint={`Currently displayed as ${plan.display_price}`}>
          <input
            type="number"
            min={0}
            value={plan.amount_cents}
            onChange={(e) => onChange({ amount_cents: parseInt(e.target.value) || 0 })}
            className={fieldClass}
          />
        </Field>
        <Field label="Display price" hint="What users see (e.g. $12.99)">
          <input
            value={plan.display_price}
            onChange={(e) => onChange({ display_price: e.target.value })}
            className={fieldClass}
          />
        </Field>
        <Field label="Subtext" hint="e.g. /month, /year, one-time">
          <input
            value={plan.subtext}
            onChange={(e) => onChange({ subtext: e.target.value })}
            className={fieldClass}
          />
        </Field>
        <Field label="Badge (optional)" hint="e.g. Save 36% — leave blank for none">
          <input
            value={plan.badge}
            onChange={(e) => onChange({ badge: e.target.value })}
            className={fieldClass}
          />
        </Field>
        <Field label="Billing period">
          <select
            value={plan.billing_period}
            onChange={(e) =>
              onChange({
                billing_period: e.target.value as PricingPlan['billing_period'],
                is_subscription: e.target.value !== 'lifetime',
              })
            }
            className={fieldClass}
          >
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="lifetime">Lifetime (one-time)</option>
          </select>
        </Field>
      </div>

      <div className="mt-6 pt-5 border-t border-border">
        <h4 className="text-sm font-semibold mb-3">Web (Stripe)</h4>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Stripe Product ID" hint="Auto-filled when you sync to Stripe">
            <input
              value={plan.stripe_product_id}
              onChange={(e) => onChange({ stripe_product_id: e.target.value })}
              placeholder="prod_..."
              className={fieldClass}
            />
          </Field>
          <Field label="Stripe Price ID" hint="Used at checkout. Re-sync to create a new one.">
            <input
              value={plan.stripe_price_id}
              onChange={(e) => onChange({ stripe_price_id: e.target.value })}
              placeholder="price_..."
              className={fieldClass}
            />
          </Field>
        </div>
        <button
          onClick={onSyncStripe}
          disabled={syncing}
          className="mt-3 px-4 py-2 rounded-xl border border-border text-sm font-medium
                     hover:bg-surface active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : plan.stripe_price_id ? 'Create New Stripe Price' : 'Create Stripe Price'}
        </button>
        <p className="text-xs text-muted mt-2">
          Stripe Prices are immutable. Syncing creates a new Price at the current amount;
          existing subscribers keep their old price until they re-subscribe.
        </p>
      </div>

      <div className="mt-6 pt-5 border-t border-border">
        <h4 className="text-sm font-semibold mb-3">Native (Apple / Google)</h4>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Apple Product ID" hint="Must match App Store Connect">
            <input
              value={plan.apple_product_id}
              onChange={(e) => onChange({ apple_product_id: e.target.value })}
              className={fieldClass}
            />
          </Field>
          <Field label="Google Product ID" hint="Must match Google Play Console">
            <input
              value={plan.google_product_id}
              onChange={(e) => onChange({ google_product_id: e.target.value })}
              className={fieldClass}
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

const fieldClass =
  'w-full h-11 px-4 rounded-xl border border-border bg-background text-sm placeholder:text-muted ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted mt-1.5">{hint}</p>}
    </div>
  )
}
