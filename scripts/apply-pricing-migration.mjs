#!/usr/bin/env node
/**
 * One-shot script to seed the `pricing_plans` row in `whozin_settings`.
 * Equivalent to supabase/migrations/20260504000000_pricing_settings.sql but
 * runnable without the Supabase CLI / DB password.
 *
 * Usage: node scripts/apply-pricing-migration.mjs
 *
 * Idempotent — uses ignoreDuplicates so re-running is safe and won't
 * overwrite values you've edited via the admin UI.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Minimal .env.local loader — avoids adding a dotenv dependency
function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      const [, key, rawValue] = m
      if (process.env[key]) continue
      let value = rawValue.trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      // Strip literal escape sequences (\n, \r) that sometimes leak into env values
      value = value.replace(/\\[nr]/g, '').replace(/[\r\n]/g, '').trim()
      process.env[key] = value
    }
  } catch {
    // .env.local optional — fall through and rely on already-set env
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const PRICING_VALUE = {
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

async function main() {
  // Check if the row already exists so we don't clobber edited prices
  const checkRes = await fetch(
    `${url}/rest/v1/whozin_settings?key=eq.pricing_plans&select=key`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  )

  if (!checkRes.ok) {
    console.error(`GET failed: ${checkRes.status} ${await checkRes.text()}`)
    process.exit(1)
  }

  const existing = await checkRes.json()
  if (Array.isArray(existing) && existing.length > 0) {
    console.log('pricing_plans row already exists — leaving it alone.')
    console.log('To force a reset, delete the row in Supabase first.')
    process.exit(0)
  }

  // Insert fresh
  const insertRes = await fetch(`${url}/rest/v1/whozin_settings`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      key: 'pricing_plans',
      value: PRICING_VALUE,
      updated_at: new Date().toISOString(),
    }),
  })

  if (!insertRes.ok) {
    console.error(`INSERT failed: ${insertRes.status} ${await insertRes.text()}`)
    process.exit(1)
  }

  console.log('Seeded pricing_plans into whozin_settings.')
  console.log('Visit /admin/pricing to edit and sync to Stripe.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
