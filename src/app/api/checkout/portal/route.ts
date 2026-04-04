import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

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

  const admin = getAdminClient()
  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('stripe_customer_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!whozinUser?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: whozinUser.stripe_customer_id,
    return_url: `${req.nextUrl.origin}/app/settings`,
  })

  return NextResponse.json({ url: session.url })
}
