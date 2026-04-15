import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

const SOCIAL_CHANNELS = new Set(['tiktok', 'linkedin', 'reddit', 'facebook', 'instagram'])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shortcode: string }> }
) {
  const { shortcode } = await params
  const admin = getAdminClient()

  const { data: item, error } = await admin
    .from('whozin_marketing_content_items')
    .select('id, campaign_id, channel, destination_url, click_count')
    .eq('short_code', shortcode)
    .maybeSingle()

  if (error || !item || !item.destination_url) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const { data: campaign } = await admin
    .from('whozin_marketing_campaigns')
    .select('slug')
    .eq('id', item.campaign_id)
    .maybeSingle()

  // Best-effort: increment click count and log a click metric.
  // Fire-and-forget so the redirect isn't blocked by DB latency.
  void admin
    .from('whozin_marketing_content_items')
    .update({ click_count: (item.click_count ?? 0) + 1 })
    .eq('id', item.id)
    .then(() => undefined)

  void admin
    .from('whozin_marketing_content_metrics')
    .insert({
      content_item_id: item.id,
      metric_type: 'click',
      value: 1,
      metadata: {
        referrer: req.headers.get('referer') ?? null,
        user_agent: req.headers.get('user-agent') ?? null,
      },
    })
    .then(() => undefined)

  const dest = new URL(item.destination_url)
  const medium = item.channel === 'newsletter'
    ? 'email'
    : SOCIAL_CHANNELS.has(item.channel) ? 'social' : 'other'

  if (campaign?.slug) dest.searchParams.set('utm_campaign', campaign.slug)
  dest.searchParams.set('utm_source', item.channel)
  dest.searchParams.set('utm_medium', medium)
  dest.searchParams.set('utm_content', item.id)

  return NextResponse.redirect(dest.toString(), 302)
}
