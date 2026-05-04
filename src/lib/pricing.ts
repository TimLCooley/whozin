import { getAdminClient } from '@/lib/supabase/admin'

export type PricingPlanId = 'monthly' | 'annual' | 'lifetime'

export interface PricingPlan {
  id: PricingPlanId
  label: string
  amount_cents: number
  display_price: string
  subtext: string
  badge: string
  billing_period: 'month' | 'year' | 'lifetime'
  is_subscription: boolean
  stripe_product_id: string
  stripe_price_id: string
  apple_product_id: string
  google_product_id: string
  enabled: boolean
}

export interface PricingConfig {
  currency: string
  plans: PricingPlan[]
}

const SETTINGS_KEY = 'pricing_plans'

const FALLBACK: PricingConfig = {
  currency: 'USD',
  plans: [
    {
      id: 'monthly',
      label: 'Monthly',
      amount_cents: 1299,
      display_price: '$12.99',
      subtext: '/month',
      badge: '',
      billing_period: 'month',
      is_subscription: true,
      stripe_product_id: '',
      stripe_price_id: '',
      apple_product_id: 'whozin_pro_monthly',
      google_product_id: 'whozin_pro_monthly',
      enabled: true,
    },
    {
      id: 'annual',
      label: 'Annual',
      amount_cents: 9999,
      display_price: '$99.99',
      subtext: '/year',
      badge: 'Save 36%',
      billing_period: 'year',
      is_subscription: true,
      stripe_product_id: '',
      stripe_price_id: '',
      apple_product_id: 'whozin_pro_annual',
      google_product_id: 'whozin_pro_annual',
      enabled: true,
    },
    {
      id: 'lifetime',
      label: 'Lifetime',
      amount_cents: 19999,
      display_price: '$199.99',
      subtext: 'one-time',
      badge: '',
      billing_period: 'lifetime',
      is_subscription: false,
      stripe_product_id: '',
      stripe_price_id: '',
      apple_product_id: 'whozin_pro_lifetime',
      google_product_id: 'whozin_pro_lifetime',
      enabled: true,
    },
  ],
}

function normalize(raw: unknown): PricingConfig {
  if (!raw || typeof raw !== 'object') return FALLBACK
  const obj = raw as Partial<PricingConfig>
  if (!Array.isArray(obj.plans)) return FALLBACK
  const byId = new Map(obj.plans.map((p) => [p.id, p]))
  const plans = FALLBACK.plans.map((fallback) => {
    const found = byId.get(fallback.id)
    if (!found) return fallback
    return { ...fallback, ...found }
  })
  return { currency: obj.currency || FALLBACK.currency, plans }
}

export async function getPricingConfig(): Promise<PricingConfig> {
  const admin = getAdminClient()
  const { data } = await admin
    .from('whozin_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single()

  if (!data) return FALLBACK
  const value = data.value
  if (typeof value === 'string') {
    try { return normalize(JSON.parse(value)) } catch { return FALLBACK }
  }
  return normalize(value)
}

export async function savePricingConfig(config: PricingConfig): Promise<void> {
  const admin = getAdminClient()
  await admin
    .from('whozin_settings')
    .upsert(
      {
        key: SETTINGS_KEY,
        value: config as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
}

/** Public-safe view (strips Stripe IDs and disabled plans). */
export function publicPricing(config: PricingConfig) {
  return {
    currency: config.currency,
    plans: config.plans
      .filter((p) => p.enabled)
      .map(({ stripe_product_id, stripe_price_id, ...rest }) => {
        void stripe_product_id
        void stripe_price_id
        return rest
      }),
  }
}
