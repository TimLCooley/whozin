import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth'
import {
  getResolvedEvent,
  resetOverride,
  saveOverride,
  type ChannelId,
} from '@/lib/notification-templates'

const VALID_CHANNELS: ChannelId[] = ['sms', 'push']

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

function parseChannel(raw: string): ChannelId | null {
  return (VALID_CHANNELS as string[]).includes(raw) ? (raw as ChannelId) : null
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; channel: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id, channel: rawChannel } = await ctx.params
  const channel = parseChannel(rawChannel)
  if (!channel) return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })

  const event = await getResolvedEvent(id)
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const channelData = event.channels[channel]
  if (!channelData) {
    return NextResponse.json({ error: `Event ${id} has no ${channel} channel` }, { status: 404 })
  }

  return NextResponse.json({ event, channel, template: channelData })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string; channel: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id, channel: rawChannel } = await ctx.params
  const channel = parseChannel(rawChannel)
  if (!channel) return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })

  const event = await getResolvedEvent(id)
  if (!event || !event.channels[channel]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { body, title } = (await req.json()) as { body?: string; title?: string }

  const channelData = event.channels[channel]!

  const patch: { body?: string | null; title?: string | null } = {}
  if (typeof body === 'string') {
    if (body.length > 1600) {
      return NextResponse.json({ error: 'Body too long (max 1600 chars)' }, { status: 400 })
    }
    patch.body = body === channelData.default_body ? null : body
  }
  if (channel === 'push' && typeof title === 'string') {
    if (title.length > 200) {
      return NextResponse.json({ error: 'Title too long (max 200 chars)' }, { status: 400 })
    }
    patch.title = title === channelData.default_title ? null : title
  }

  await saveOverride(id, channel, patch)
  const updated = await getResolvedEvent(id)
  return NextResponse.json({ event: updated, channel, template: updated?.channels[channel] })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; channel: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id, channel: rawChannel } = await ctx.params
  const channel = parseChannel(rawChannel)
  if (!channel) return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })

  const event = await getResolvedEvent(id)
  if (!event || !event.channels[channel]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await resetOverride(id, channel)
  const updated = await getResolvedEvent(id)
  return NextResponse.json({ event: updated, channel, template: updated?.channels[channel] })
}
