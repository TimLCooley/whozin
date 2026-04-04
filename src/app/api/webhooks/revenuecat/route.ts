import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

/**
 * RevenueCat Webhook
 * Receives subscription lifecycle events and updates membership_tier in Supabase.
 * Docs: https://www.revenuecat.com/docs/integrations/webhooks
 *
 * Configure in RevenueCat Dashboard → Project Settings → Integrations → Webhooks
 * URL: https://whozin.io/api/webhooks/revenuecat
 * Auth Header: Bearer <REVENUECAT_WEBHOOK_SECRET>
 */

// RevenueCat event types that grant/revoke pro access
const PRO_GRANT_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',       // upgrade/crossgrade
  'UNCANCELLATION',       // user re-enabled auto-renew
  'SUBSCRIBER_ALIAS',
]

const PRO_REVOKE_EVENTS = [
  'EXPIRATION',
  'BILLING_ISSUE',
]

// CANCELLATION means auto-renew turned off, but access continues until period ends
// So we do NOT revoke on CANCELLATION — only on EXPIRATION

export async function POST(req: NextRequest) {
  // Verify webhook auth
  const authHeader = req.headers.get('authorization')
  const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim()

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const event = body.event

    if (!event) {
      return NextResponse.json({ error: 'No event in payload' }, { status: 400 })
    }

    const eventType = event.type as string
    const appUserId = event.app_user_id as string

    if (!appUserId) {
      return NextResponse.json({ ok: true, skipped: 'no_user_id' })
    }

    console.log(`[RevenueCat] ${eventType} for user ${appUserId}`)

    const admin = getAdminClient()

    // Determine the new tier based on event type
    let newTier: 'pro' | 'free' | null = null

    if (PRO_GRANT_EVENTS.includes(eventType)) {
      newTier = 'pro'
    } else if (PRO_REVOKE_EVENTS.includes(eventType)) {
      newTier = 'free'
    }

    if (!newTier) {
      // Event type we don't act on (e.g., CANCELLATION, TRANSFER, etc.)
      return NextResponse.json({ ok: true, skipped: eventType })
    }

    // RevenueCat app_user_id can be:
    // 1. The Supabase auth user ID (if we set it as the RC user ID)
    // 2. An anonymous RC-generated ID (starts with $RCAnonymousID:)
    //
    // We try to match by auth_user_id first, then fall back to checking
    // if the app_user_id is stored somewhere

    // Try matching by auth_user_id
    const { data: user, error } = await admin
      .from('whozin_users')
      .select('id, membership_tier')
      .eq('auth_user_id', appUserId)
      .maybeSingle()

    if (error) {
      console.error('[RevenueCat] DB error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!user) {
      console.warn(`[RevenueCat] No user found for app_user_id: ${appUserId}`)
      return NextResponse.json({ ok: true, skipped: 'user_not_found' })
    }

    // Only update if tier actually changed
    if (user.membership_tier !== newTier) {
      const productId = (event.product_id as string) || ''
      const subType = productId.includes('lifetime') ? 'lifetime'
        : productId.includes('annual') ? 'annual'
        : productId.includes('monthly') ? 'monthly'
        : null
      const expiresAt = event.expiration_at_ms
        ? new Date(event.expiration_at_ms as number).toISOString()
        : null

      const updates: Record<string, unknown> = {
        membership_tier: newTier,
        subscription_platform: 'revenuecat',
      }
      if (newTier === 'pro') {
        if (subType) updates.subscription_type = subType
        if (expiresAt) updates.subscription_expires_at = expiresAt
      } else {
        updates.subscription_type = null
        updates.subscription_expires_at = null
      }

      await admin.from('whozin_users').update(updates).eq('id', user.id)
      console.log(`[RevenueCat] Updated ${appUserId} tier: ${user.membership_tier} → ${newTier}`)
    }

    return NextResponse.json({ ok: true, tier: newTier })
  } catch (err) {
    console.error('[RevenueCat] Webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
