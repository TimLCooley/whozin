import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

const PLAN_PRICES: Record<string, { envKey: string; mode: 'subscription' | 'payment' }> = {
  monthly: { envKey: 'STRIPE_PRICE_MONTHLY', mode: 'subscription' },
  annual: { envKey: 'STRIPE_PRICE_ANNUAL', mode: 'subscription' },
  lifetime: { envKey: 'STRIPE_PRICE_LIFETIME', mode: 'payment' },
}

function getStripe() {
  return new Stripe(
    process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_LIVE_SECRET_KEY?.trim() || '',
    { apiVersion: '2026-02-25.clover' }
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, returnTo } = await req.json()
  const planConfig = PLAN_PRICES[plan]
  if (!planConfig) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const priceId = process.env[planConfig.envKey]?.trim()
  if (!priceId) return NextResponse.json({ error: 'Plan not configured' }, { status: 500 })

  const admin = getAdminClient()
  const stripe = getStripe()

  // Get or create whozin_users record
  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id, stripe_customer_id, email')
    .eq('auth_user_id', user.id)
    .single()

  if (!whozinUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Get or create Stripe customer
  let customerId = whozinUser.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: whozinUser.email || user.email || undefined,
      metadata: { supabase_user_id: user.id, whozin_user_id: whozinUser.id },
    })
    customerId = customer.id
    await admin
      .from('whozin_users')
      .update({ stripe_customer_id: customerId })
      .eq('id', whozinUser.id)
  }

  const origin = req.nextUrl.origin
  const successUrl = `${origin}/app/upgrade?success=true&returnTo=${encodeURIComponent(returnTo || '/app')}`
  const cancelUrl = `${origin}/app/upgrade?returnTo=${encodeURIComponent(returnTo || '/app')}`

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: planConfig.mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { supabase_user_id: user.id, whozin_user_id: whozinUser.id },
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  return NextResponse.json({ url: session.url })
}
