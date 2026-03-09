import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

/**
 * Stripe Webhook
 * Handles subscription lifecycle events for web payments.
 * Configure in Stripe Dashboard → Developers → Webhooks
 * URL: https://whozin.io/api/webhooks/stripe
 * Events to listen for:
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_succeeded
 *   - invoice.payment_failed
 */

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()

  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: 'Missing webhook secret or signature' }, { status: 400 })
  }

  // Verify Stripe signature
  // Using raw crypto verification instead of Stripe SDK to keep things lightweight
  let event: Record<string, unknown>
  try {
    // Import Stripe for webhook verification
    const stripe = await getStripe()
    const constructed = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    event = constructed as unknown as Record<string, unknown>
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const eventType = event.type as string
  const data = event.data as { object: Record<string, unknown> }
  const subscription = data.object

  console.log(`[Stripe] ${eventType}`)

  const admin = getAdminClient()

  try {
    if (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated') {
      const status = subscription.status as string
      const customerId = subscription.customer as string
      const tier = ['active', 'trialing'].includes(status) ? 'pro' : 'free'

      // Find user by stripe_customer_id (stored in whozin_users metadata)
      // Or by the customer email from Stripe
      await updateTierByStripeCustomer(admin, customerId, tier)
    }

    if (eventType === 'customer.subscription.deleted') {
      const customerId = subscription.customer as string
      await updateTierByStripeCustomer(admin, customerId, 'free')
    }

    if (eventType === 'invoice.payment_failed') {
      const customerId = subscription.customer as string
      console.warn(`[Stripe] Payment failed for customer ${customerId}`)
      // Don't immediately downgrade — Stripe retries. Downgrade happens on subscription.deleted
    }
  } catch (err) {
    console.error('[Stripe] Webhook processing error:', err)
    return NextResponse.json({ error: 'Processing error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function updateTierByStripeCustomer(
  admin: ReturnType<typeof getAdminClient>,
  customerId: string,
  tier: 'pro' | 'free'
) {
  // Look up user by stripe_customer_id
  const { data: user } = await admin
    .from('whozin_users')
    .select('id, membership_tier')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (user && user.membership_tier !== tier) {
    await admin
      .from('whozin_users')
      .update({ membership_tier: tier })
      .eq('id', user.id)
    console.log(`[Stripe] Updated customer ${customerId} tier: ${user.membership_tier} → ${tier}`)
  } else if (!user) {
    console.warn(`[Stripe] No user found for customer ${customerId}`)
  }
}

async function getStripe() {
  const Stripe = (await import('stripe')).default
  return new Stripe(process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_LIVE_SECRET_KEY?.trim() || '', {
    apiVersion: '2026-02-25.clover',
  })
}
