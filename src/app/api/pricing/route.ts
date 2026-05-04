import { NextResponse } from 'next/server'
import { getPricingConfig, publicPricing } from '@/lib/pricing'

export async function GET() {
  const config = await getPricingConfig()
  return NextResponse.json(publicPricing(config))
}
