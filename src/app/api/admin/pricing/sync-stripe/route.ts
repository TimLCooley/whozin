import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth'
import { getPricingConfig, savePricingConfig, type PricingPlanId } from '@/lib/pricing'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_LIVE_SECRET_KEY?.trim()
  if (!key) throw new Error('Stripe secret key not configured')
  return new Stripe(key, { apiVersion: '2026-02-25.clover' })
}

/**
 * Creates a fresh Stripe Price for the given plan at its current amount and
 * stores the new price ID. Stripe Prices are immutable; the old price (if any)
 * is left in place so existing subscribers keep their billing — only new
 * checkouts use the new price.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { planId } = (await req.json()) as { planId: PricingPlanId }
  const config = await getPricingConfig()
  const plan = config.plans.find((p) => p.id === planId)
  if (!plan) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })

  let stripe: Stripe
  try {
    stripe = getStripe()
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }

  let productId = plan.stripe_product_id?.trim()
  if (!productId) {
    const product = await stripe.products.create({
      name: `Whozin Pro — ${plan.label}`,
      metadata: { plan_id: plan.id },
    })
    productId = product.id
  }

  const priceParams: Stripe.PriceCreateParams = {
    product: productId,
    unit_amount: plan.amount_cents,
    currency: config.currency.toLowerCase(),
    metadata: { plan_id: plan.id },
  }
  if (plan.is_subscription) {
    priceParams.recurring = {
      interval: plan.billing_period === 'year' ? 'year' : 'month',
    }
  }

  const price = await stripe.prices.create(priceParams)

  const updated = {
    ...config,
    plans: config.plans.map((p) =>
      p.id === plan.id
        ? { ...p, stripe_product_id: productId, stripe_price_id: price.id }
        : p
    ),
  }
  await savePricingConfig(updated)

  return NextResponse.json({
    success: true,
    stripe_product_id: productId,
    stripe_price_id: price.id,
  })
}
