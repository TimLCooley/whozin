'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isNative, getPlatform } from '@/lib/capacitor'
import { useProStatus } from '@/hooks/use-pro-status'
import { BrandedFavicon } from '@/components/ui/branded-logo'

type Plan = 'monthly' | 'annual' | 'lifetime'

const PLANS: { id: Plan; label: string; price: string; subtext?: string; badge?: string }[] = [
  { id: 'monthly', label: 'Monthly', price: '$12.99', subtext: '/month' },
  { id: 'annual', label: 'Annual', price: '$99.99', subtext: '/year', badge: 'Save 36%' },
  { id: 'lifetime', label: 'Lifetime', price: '$199.99', subtext: 'one-time' },
]

const PRO_FEATURES = [
  'Activity & Group Chat',
  'Custom Response Timers',
  'AI Image Generation',
  'Auto Reminders',
]

export default function UpgradePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/app'
  const stripeSuccess = searchParams.get('success') === 'true'

  const { isPro, refresh } = useProStatus()
  const [selectedPlan, setSelectedPlan] = useState<Plan>('annual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const native = isNative()
  const platform = getPlatform()

  // Handle Stripe return
  useEffect(() => {
    if (!stripeSuccess) return
    setSuccess(true)
    // Poll for webhook to update tier
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      refresh()
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const profile = await res.json()
        if (profile.membership_tier === 'pro') {
          clearInterval(interval)
          setTimeout(() => router.replace(returnTo), 1500)
          return
        }
      }
      if (attempts >= 10) {
        clearInterval(interval)
        // Webhook might be delayed — show continue button
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [stripeSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubscribe() {
    setLoading(true)
    setError('')
    try {
      if (native) {
        // RevenueCat purchase flow
        const { Purchases } = await import('@revenuecat/purchases-capacitor')
        const offerings = await Purchases.getOfferings()
        const packages = offerings.current?.availablePackages
        if (!packages?.length) {
          setError('Subscriptions are not available yet. Please try again later.')
          setLoading(false)
          return
        }

        // Map plan to package
        const packageMap: Record<Plan, string> = {
          monthly: '$rc_monthly',
          annual: '$rc_annual',
          lifetime: '$rc_lifetime',
        }
        const pkg = packages.find((p) => p.identifier === packageMap[selectedPlan])
          || packages.find((p) => p.packageType === selectedPlan.toUpperCase())
          || packages[0]

        const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })
        if (customerInfo.entitlements.active['pro']) {
          setSuccess(true)
          refresh()
          setTimeout(() => router.replace(returnTo), 1500)
        }
      } else {
        // Stripe Checkout flow
        const res = await fetch('/api/checkout/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: selectedPlan, returnTo }),
        })
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        } else {
          setError(data.error || 'Failed to start checkout')
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('cancelled') || msg.includes('canceled') || msg.includes('1')) {
        // User cancelled — not an error
      } else {
        setError(`Purchase failed: ${msg}`)
      }
    }
    setLoading(false)
  }

  async function handleRestore() {
    setLoading(true)
    setError('')
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor')
      const { customerInfo } = await Purchases.restorePurchases()
      if (customerInfo.entitlements.active['pro']) {
        setSuccess(true)
        refresh()
        setTimeout(() => router.replace(returnTo), 1500)
      } else {
        setError('No active subscription found.')
      }
    } catch {
      setError('Could not restore purchases. Please try again.')
    }
    setLoading(false)
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-surface">
        <div className="w-16 h-16 rounded-full bg-[#34c759]/20 flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Welcome to Pro!</h2>
        <p className="text-[14px] text-muted text-center">
          You now have access to all Pro features.
        </p>
        <button
          onClick={() => router.replace(returnTo)}
          className="mt-6 px-8 py-3 rounded-xl bg-primary text-white font-semibold text-[14px]"
        >
          Continue
        </button>
      </div>
    )
  }

  // Already Pro state
  if (isPro) {
    return (
      <div className="min-h-dvh flex flex-col px-6 pt-14 pb-24 bg-surface">
        <button onClick={() => router.back()} className="self-start mb-6 text-muted text-[14px]">
          ← Back
        </button>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <span className="text-2xl">⭐</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">You&apos;re a Pro!</h2>
          <p className="text-[14px] text-muted text-center mb-6">
            You have access to all Whozin Pro features.
          </p>
          {native ? (
            <button
              onClick={() => {
                // Deep link to App Store / Play Store subscription management
                if (platform === 'ios') {
                  window.open('https://apps.apple.com/account/subscriptions', '_blank')
                } else {
                  window.open('https://play.google.com/store/account/subscriptions', '_blank')
                }
              }}
              className="px-6 py-3 rounded-xl border border-border text-foreground font-semibold text-[14px]"
            >
              Manage Subscription
            </button>
          ) : (
            <button
              onClick={async () => {
                const res = await fetch('/api/checkout/portal', { method: 'POST' })
                const data = await res.json()
                if (data.url) window.location.href = data.url
              }}
              className="px-6 py-3 rounded-xl border border-border text-foreground font-semibold text-[14px]"
            >
              Manage Subscription
            </button>
          )}
        </div>
      </div>
    )
  }

  // Upgrade page
  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <button onClick={() => router.back()} className="text-muted text-[14px] font-medium">
          ← Back
        </button>
      </div>

      <div className="flex-1 px-5 pb-24 overflow-y-auto">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4">
            <BrandedFavicon className="w-20 h-20 rounded-2xl shadow-lg" />
          </div>
          <h1 className="text-[24px] font-bold text-foreground">Unlock Whozin Pro</h1>
          <p className="text-[14px] text-muted mt-2">Get the most out of your group activities</p>
        </div>

        {/* Feature list */}
        <div className="bg-background border border-border/50 rounded-2xl p-5 mb-6">
          <p className="text-[12px] text-muted font-semibold uppercase tracking-wide mb-3">Everything in Pro</p>
          <div className="space-y-3">
            {PRO_FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#34c759]/15 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <span className="text-[14px] text-foreground font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing cards */}
        <div className="space-y-3 mb-6">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                selectedPlan === plan.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border/50 bg-background'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedPlan === plan.id ? 'border-primary' : 'border-border'
                }`}>
                  {selectedPlan === plan.id && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  )}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-foreground">{plan.label}</span>
                    {plan.badge && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#34c759]/10 text-[#34c759]">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[12px] text-muted">{plan.subtext}</span>
                </div>
              </div>
              <span className="text-[17px] font-bold text-foreground">{plan.price}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-danger/10 text-danger text-[13px] font-medium px-4 py-2.5 rounded-xl mb-4 text-center">
            {error}
          </div>
        )}

        {/* Subscribe button */}
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-[16px] shadow-lg
                     active:scale-[0.98] transition-transform disabled:opacity-60 mb-3"
        >
          {loading
            ? 'Processing...'
            : selectedPlan === 'lifetime'
              ? `Buy Lifetime — ${PLANS[2].price}`
              : `Subscribe — ${PLANS.find((p) => p.id === selectedPlan)?.price}${selectedPlan === 'monthly' ? '/mo' : '/yr'}`
          }
        </button>

        {/* Restore purchases (native only) */}
        {native && (
          <button
            onClick={handleRestore}
            disabled={loading}
            className="w-full py-2 text-[13px] text-primary font-medium text-center mb-4"
          >
            Restore Purchases
          </button>
        )}

        {/* Legal */}
        <div className="text-center mt-2 mb-8">
          <p className="text-[11px] text-muted leading-relaxed px-4">
            {selectedPlan === 'lifetime'
              ? 'One-time purchase. Lifetime access to all Pro features.'
              : 'Payment will be charged to your account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.'
            }
          </p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <a href="/terms" className="text-[11px] text-muted underline">Terms</a>
            <span className="text-[11px] text-muted">·</span>
            <a href="/privacy" className="text-[11px] text-muted underline">Privacy</a>
          </div>
        </div>
      </div>
    </div>
  )
}
