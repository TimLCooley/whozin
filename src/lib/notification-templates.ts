import { getAdminClient } from '@/lib/supabase/admin'

export type ChannelId = 'sms' | 'push'

export type NotifCategory = 'Auth' | 'Onboarding' | 'Groups' | 'Activities' | 'Spots' | 'Chat'

export interface NotifVariable {
  key: string
  description: string
  example: string
  required?: boolean
}

export interface ChannelDefaults {
  /** Body of the message (SMS body or push body). */
  body: string
  /** Push notification title. Push channel only. */
  title?: string
  /** File paths where this template is sent at runtime. */
  call_sites: string[]
}

export interface NotificationEvent {
  id: string
  name: string
  category: NotifCategory
  trigger: string
  /** Variables shared across the event's channels. Each channel can interpolate any subset. */
  variables: NotifVariable[]
  channels: Partial<Record<ChannelId, ChannelDefaults>>
}

/**
 * Single source of truth for every transactional message Whozin sends across SMS and push.
 * Defaults live here; admin overrides live in `whozin_settings.notification_templates`
 * keyed by `<event_id>.<channel>`.
 */
export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  // -------- Auth --------
  {
    id: 'otp_login',
    name: 'Login OTP',
    category: 'Auth',
    trigger: 'User requests a login code at /auth/sign-in',
    variables: [
      { key: 'code', description: '6-digit verification code', example: '482910', required: true },
    ],
    channels: {
      sms: {
        body: 'Your Whozin code is: {{code}}. It expires in 5 minutes.',
        call_sites: ['src/app/api/auth/send-otp/route.ts'],
      },
    },
  },

  // -------- Onboarding --------
  {
    id: 'group_invite',
    name: 'Group Invite',
    category: 'Onboarding',
    trigger: 'A non-user is added to a group (link, QR, or direct invite)',
    variables: [
      { key: 'inviter_name', description: 'First name of the user who added them', example: 'Sarah', required: true },
      { key: 'download_link', description: 'Short app download link', example: 'https://whozin.io/dl', required: true },
    ],
    channels: {
      sms: {
        body: "{{inviter_name}} added you to a group on Whozin!\n\nHow it works: When there's an activity, you'll get a text. Just reply IN or OUT — that's it. No app needed.\n\nWant to see your groups and activities? Download the app: {{download_link}}",
        call_sites: ['src/lib/sms.ts (sendSmsInvite)'],
      },
    },
  },
  {
    id: 'group_invite_reinvite',
    name: 'Group Re-Invite (Admin)',
    category: 'Onboarding',
    trigger: 'Admin resends a group invite to a previously-invited contact',
    variables: [
      { key: 'first_name_prefix', description: "Leading space + first name, or empty (e.g. ' Tim' or '')", example: ' Tim' },
      { key: 'download_link', description: 'Short app download link', example: 'https://whozin.io/dl', required: true },
    ],
    channels: {
      sms: {
        body: "Hey{{first_name_prefix}}! You've been added to a group on Whozin.\n\nHow it works: When there's an activity, you'll get a text. Just reply IN or OUT — that's it. No app needed.\n\nWant to see your groups and manage activities? Download the app: {{download_link}}",
        call_sites: ['src/app/api/admin/users/reinvite/route.ts'],
      },
    },
  },
  {
    id: 'group_join_self_confirm',
    name: 'You Joined a Group',
    category: 'Onboarding',
    trigger: 'User self-joins a group via QR code (confirmation to themself)',
    variables: [
      { key: 'group_name', description: 'Name of the group', example: 'Sunday Pickleball', required: true },
    ],
    channels: {
      push: {
        title: 'Added to {{group_name}}',
        body: 'You joined "{{group_name}}" via QR code.',
        call_sites: ['src/app/api/join/route.ts'],
      },
    },
  },

  // -------- Groups --------
  {
    id: 'member_joined_group',
    name: 'New Group Member (to existing members)',
    category: 'Groups',
    trigger: 'Existing group members are notified when a new member joins',
    variables: [
      { key: 'group_name', description: 'Name of the group', example: 'Sunday Pickleball', required: true },
      { key: 'target_name', description: "First name of the new member, or 'A new member' if unknown", example: 'Mike' },
    ],
    channels: {
      push: {
        title: 'New member in {{group_name}}',
        body: '{{target_name}} was added to "{{group_name}}".',
        call_sites: ['src/app/api/join/route.ts', 'src/app/api/groups/[id]/members/route.ts'],
      },
    },
  },

  // -------- Activities --------
  {
    id: 'activity_invite',
    name: 'Activity Invite',
    category: 'Activities',
    trigger: 'Member is invited to an activity (priority batch processing)',
    variables: [
      { key: 'inviter_name', description: 'First name of the host', example: 'Sarah', required: true },
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'date_time', description: 'Formatted date/time of the activity', example: 'Sat May 10 at 6 PM' },
      { key: 'download_link', description: 'Short app download link', example: 'https://whozin.io/dl' },
    ],
    channels: {
      sms: {
        body: '{{inviter_name}} is using Whozin to organize {{activity_name}} on {{date_time}}. Are you in? Reply IN or OUT',
        call_sites: ['src/lib/sms.ts (sendActivityInvite)'],
      },
      push: {
        title: "You're invited: {{activity_name}}",
        body: '{{inviter_name}} invited you. Reply IN or OUT!',
        call_sites: ['src/lib/invite-processor.ts'],
      },
    },
  },
  {
    id: 'activity_reminder',
    name: 'Activity Reminder',
    category: 'Activities',
    trigger: 'Scheduled reminder before activity start (24h, 1h, 10m windows)',
    variables: [
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'window_label', description: 'Human-readable time window', example: '30 minutes', required: true },
    ],
    channels: {
      sms: {
        body: 'Whozin reminder: {{activity_name}} is starting in {{window_label}}.',
        call_sites: ['src/lib/sms.ts (sendReminderSms)'],
      },
      push: {
        title: 'Reminder: {{activity_name}}',
        body: 'Starting in {{window_label}}!',
        call_sites: ['src/app/api/cron/process-reminders/route.ts'],
      },
    },
  },
  {
    id: 'followup_invite',
    name: 'Follow-up Invite',
    category: 'Activities',
    trigger: 'Last-call nudge ~24h before an activity that still has open spots, sent to anyone who hasn\u2019t replied IN or OUT',
    variables: [
      { key: 'inviter_name', description: 'First name of the host', example: 'Sarah', required: true },
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'date_time', description: 'Formatted date/time of the activity', example: 'Sat May 10 at 6 PM' },
    ],
    channels: {
      sms: {
        body: 'Last call! {{inviter_name}}\u2019s {{activity_name}} is {{date_time}} and still has spots. Reply IN to join or OUT to pass.',
        call_sites: ['src/app/api/cron/process-reminders/route.ts'],
      },
      push: {
        title: 'Last call: {{activity_name}}',
        body: 'Still has room {{date_time}} — tap to join!',
        call_sites: ['src/app/api/cron/process-reminders/route.ts'],
      },
    },
  },
  {
    id: 'activity_confirmed',
    name: 'Spot Confirmed',
    category: 'Activities',
    trigger: 'Host confirms / accepts a member into an activity',
    variables: [
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'host_name', description: 'First name of the host', example: 'Sarah' },
      { key: 'chat_line', description: 'Optional follow-on with chat or app link (leading space)', example: ' Open the app: https://whozin.io/dl' },
    ],
    channels: {
      sms: {
        body: "You're in for {{activity_name}}!{{chat_line}}",
        call_sites: ['src/app/api/activities/[id]/confirm-member/route.ts'],
      },
      push: {
        title: "You're in!",
        body: '{{host_name}} confirmed you for {{activity_name}}.',
        call_sites: ['src/app/api/activities/[id]/confirm-member/route.ts'],
      },
    },
  },
  {
    id: 'member_responded',
    name: 'Member Responded (to host)',
    category: 'Activities',
    trigger: 'Host gets a push when a member confirms via SMS reply',
    variables: [
      { key: 'responder_name', description: 'First name of the responding member', example: 'Mike', required: true },
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
    ],
    channels: {
      push: {
        title: '{{responder_name}} is in!',
        body: '{{responder_name}} confirmed for {{activity_name}}.',
        call_sites: ['src/app/api/twilio/webhook/route.ts'],
      },
    },
  },

  // -------- Tournament invites --------
  // Used in place of activity_invite / fill_invite when the activity has
  // tournament_mode = true, so recipients know up-front that this isn't a
  // casual game.
  {
    id: 'tournament_activity_invite',
    name: 'Tournament Invite',
    category: 'Activities',
    trigger: 'Member is invited to a tournament activity (priority batch)',
    variables: [
      { key: 'inviter_name', description: 'First name of the host', example: 'Sarah', required: true },
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'date_time', description: 'Formatted date/time of the activity', example: 'Sat May 10 at 6 PM' },
      { key: 'tournament_format', description: 'Tournament format label', example: 'Round Robin', required: true },
      { key: 'download_link', description: 'Short app download link', example: 'https://whozin.io/dl' },
    ],
    channels: {
      sms: {
        body: 'TOURNAMENT INVITE: {{inviter_name}} is hosting {{activity_name}} ({{tournament_format}}) on {{date_time}}. Are you in? Reply IN or OUT',
        call_sites: ['src/lib/sms.ts (sendActivityInvite, tournament path)'],
      },
      push: {
        title: 'Tournament invite: {{activity_name}}',
        body: '{{inviter_name}} invited you to a {{tournament_format}}. Reply IN or OUT!',
        call_sites: ['src/lib/invite-processor.ts (tournament path)'],
      },
    },
  },
  {
    id: 'tournament_fill_invite',
    name: 'Tournament Fill Invite',
    category: 'Activities',
    trigger: 'Emergency or batch fill request for a tournament activity',
    variables: [
      { key: 'inviter_name', description: 'First name of the host', example: 'Sarah', required: true },
      { key: 'spots_text', description: 'Pluralized spot count', example: '2 spots', required: true },
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'date_time', description: 'Formatted date/time of the activity', example: 'Sat May 10 at 6 PM' },
      { key: 'tournament_format', description: 'Tournament format label', example: 'Round Robin', required: true },
    ],
    channels: {
      sms: {
        body: 'TOURNAMENT INVITE: {{inviter_name}} needs to fill {{spots_text}} for {{activity_name}} ({{tournament_format}}) on {{date_time}}. Are you in? Reply IN',
        call_sites: ['src/lib/sms.ts (sendFillInvite, tournament path)'],
      },
      push: {
        title: 'Tournament: {{spots_text}} open!',
        body: '{{inviter_name}} is filling a {{tournament_format}} — reply IN to claim it!',
        call_sites: ['src/lib/emergency-fill.ts (tournament path)'],
      },
    },
  },

  // -------- Spots --------
  {
    id: 'fill_invite',
    name: 'Fill Invite (Emergency)',
    category: 'Spots',
    trigger: 'Emergency or batch fill request to backfill open spots',
    variables: [
      { key: 'inviter_name', description: 'First name of the host', example: 'Sarah', required: true },
      { key: 'spots_text', description: 'Pluralized spot count', example: '2 spots', required: true },
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'date_time', description: 'Formatted date/time of the activity', example: 'Sat May 10 at 6 PM' },
    ],
    channels: {
      sms: {
        body: '{{inviter_name}} is using Whozin to fill {{spots_text}} for {{activity_name}} on {{date_time}}. Are you in? Reply IN',
        call_sites: ['src/lib/sms.ts (sendFillInvite)'],
      },
      push: {
        title: '{{activity_name}}: {{spots_text}}!',
        body: '{{inviter_name}} is organizing — reply IN to claim it!',
        call_sites: ['src/lib/emergency-fill.ts'],
      },
    },
  },
  {
    id: 'waitlist_added',
    name: 'Added to Waitlist',
    category: 'Spots',
    trigger: 'User joins activity but it is full — added to waitlist',
    variables: [
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'position', description: 'Numeric position in line', example: '3', required: true },
    ],
    channels: {
      sms: {
        body: "You're on the wait list for {{activity_name}} (spot #{{position}}). We'll text you if a spot opens up.",
        call_sites: ['src/lib/waitlist.ts'],
      },
      push: {
        title: "You're on the wait list",
        body: "Spot #{{position}} for {{activity_name}}. We'll notify you if a spot opens up.",
        call_sites: ['src/lib/waitlist.ts'],
      },
    },
  },
  {
    id: 'waitlist_promoted',
    name: 'Promoted from Waitlist',
    category: 'Spots',
    trigger: 'Spot opens and waitlisted user is promoted to confirmed',
    variables: [
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'download_link', description: 'Short app download link', example: 'https://whozin.io/dl' },
    ],
    channels: {
      sms: {
        body: "A spot opened up — you're now in for {{activity_name}}! Open the app to change to OUT if you can't make it: {{download_link}}",
        call_sites: ['src/lib/waitlist.ts'],
      },
      push: {
        title: 'A spot opened up!',
        body: "You're now confirmed for {{activity_name}}. Open the app to change your status.",
        call_sites: ['src/lib/waitlist.ts'],
      },
    },
  },
  {
    id: 'dropout_notification',
    name: 'Dropout Notification (to Host)',
    category: 'Spots',
    trigger: 'Member drops out — host gets notified with FILL option',
    variables: [
      { key: 'dropout_name', description: 'First name of the user who dropped out', example: 'Mike', required: true },
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
    ],
    channels: {
      sms: {
        body: '{{dropout_name}} just dropped out of {{activity_name}}! Reply FILL to send an emergency invite to everyone.',
        call_sites: ['src/lib/emergency-fill.ts'],
      },
      push: {
        title: '{{dropout_name}} dropped out of {{activity_name}}!',
        body: 'Tap to send an emergency fill, or reply FILL to this text.',
        call_sites: ['src/lib/emergency-fill.ts'],
      },
    },
  },

  // -------- Chat --------
  {
    id: 'chat_message',
    name: 'Chat Message',
    category: 'Chat',
    trigger: 'New message in an activity or group chat (push primary, SMS fallback if push fails)',
    variables: [
      { key: 'context_name', description: 'Activity or group name', example: 'Sunday Pickleball', required: true },
      { key: 'sender_name', description: 'First name of the sender', example: 'Mike' },
      { key: 'text', description: 'Message body, truncated to 80 chars', example: 'Heading there now!' },
      { key: 'download_link', description: 'Short app download link', example: 'https://whozin.io/dl' },
    ],
    channels: {
      push: {
        title: 'New message in {{context_name}}',
        body: '{{sender_name}}: {{text}}',
        call_sites: ['src/app/api/activities/[id]/messages/route.ts', 'src/app/api/groups/[id]/messages/route.ts'],
      },
      sms: {
        body: 'You have a chat waiting on Whozin. Download the app: {{download_link}}',
        call_sites: ['src/lib/alerts.ts'],
      },
    },
  },
]

const SETTINGS_KEY = 'notification_templates'

const eventById = new Map(NOTIFICATION_EVENTS.map((e) => [e.id, e]))

export function getEventDef(id: string): NotificationEvent | undefined {
  return eventById.get(id)
}

export interface ChannelOverride {
  body?: string
  title?: string
  updated_at?: string
}

export type NotificationOverrides = {
  [eventId: string]: Partial<Record<ChannelId, ChannelOverride>>
}

let cache: { value: NotificationOverrides; expiresAt: number } | null = null
const CACHE_TTL_MS = 30_000

export function invalidateOverridesCache() {
  cache = null
}

export async function loadOverrides(force = false): Promise<NotificationOverrides> {
  if (!force && cache && cache.expiresAt > Date.now()) return cache.value

  const admin = getAdminClient()
  const { data } = await admin
    .from('whozin_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single()

  const raw = data?.value
  let parsed: NotificationOverrides = {}
  if (raw) {
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw) as NotificationOverrides } catch { parsed = {} }
    } else {
      parsed = raw as NotificationOverrides
    }
  }
  cache = { value: parsed, expiresAt: Date.now() + CACHE_TTL_MS }
  return parsed
}

export async function saveOverride(
  eventId: string,
  channel: ChannelId,
  patch: { body?: string | null; title?: string | null }
): Promise<void> {
  const admin = getAdminClient()
  const current = await loadOverrides(true)
  const event = current[eventId] ?? {}
  const channelOverride = { ...(event[channel] ?? {}) } as ChannelOverride

  if (patch.body !== undefined) {
    if (patch.body === null) delete channelOverride.body
    else channelOverride.body = patch.body
  }
  if (patch.title !== undefined) {
    if (patch.title === null) delete channelOverride.title
    else channelOverride.title = patch.title
  }

  if (Object.keys(channelOverride).filter((k) => k !== 'updated_at').length === 0) {
    delete event[channel]
  } else {
    channelOverride.updated_at = new Date().toISOString()
    event[channel] = channelOverride
  }

  const next: NotificationOverrides = { ...current }
  if (Object.keys(event).length === 0) delete next[eventId]
  else next[eventId] = event

  await admin
    .from('whozin_settings')
    .upsert(
      { key: SETTINGS_KEY, value: next as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  invalidateOverridesCache()
}

export async function resetOverride(eventId: string, channel: ChannelId): Promise<void> {
  await saveOverride(eventId, channel, { body: null, title: null })
}

export interface ResolvedChannel {
  body: string
  title?: string
  default_body: string
  default_title?: string
  is_customized: boolean
  updated_at: string | null
  call_sites: string[]
}

export interface ResolvedEvent {
  id: string
  name: string
  category: NotifCategory
  trigger: string
  variables: NotifVariable[]
  channels: Partial<Record<ChannelId, ResolvedChannel>>
}

function resolveChannel(defaults: ChannelDefaults, override: ChannelOverride | undefined): ResolvedChannel {
  const body = override?.body ?? defaults.body
  const title = override?.title ?? defaults.title
  const customizedBody = !!override?.body && override.body !== defaults.body
  const customizedTitle = !!override?.title && override.title !== defaults.title
  return {
    body,
    title,
    default_body: defaults.body,
    default_title: defaults.title,
    is_customized: customizedBody || customizedTitle,
    updated_at: override?.updated_at ?? null,
    call_sites: defaults.call_sites,
  }
}

export function resolveEvent(def: NotificationEvent, overrides: NotificationOverrides): ResolvedEvent {
  const eventOverrides = overrides[def.id] ?? {}
  const channels: Partial<Record<ChannelId, ResolvedChannel>> = {}
  for (const [channel, defaults] of Object.entries(def.channels) as [ChannelId, ChannelDefaults][]) {
    channels[channel] = resolveChannel(defaults, eventOverrides[channel])
  }
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    trigger: def.trigger,
    variables: def.variables,
    channels,
  }
}

export async function getAllResolvedEvents(): Promise<ResolvedEvent[]> {
  const overrides = await loadOverrides()
  return NOTIFICATION_EVENTS.map((def) => resolveEvent(def, overrides))
}

export async function getResolvedEvent(id: string): Promise<ResolvedEvent | null> {
  const def = getEventDef(id)
  if (!def) return null
  const overrides = await loadOverrides()
  return resolveEvent(def, overrides)
}

/** Substitutes `{{var}}` placeholders. Missing vars render as empty strings. */
export function renderBody(body: string, vars: Record<string, string | number | undefined | null>): string {
  return body.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, key) => {
    const value = vars[key]
    if (value === undefined || value === null) return ''
    return String(value)
  })
}

/** GSM-7 segment estimation for SMS billing display. */
export function smsSegmentInfo(body: string): { length: number; segments: number; encoding: 'GSM-7' | 'UCS-2' } {
  const gsm7Chars = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
  const gsm7Extended = "^{}\\[~]|€"
  let isGsm = true
  for (const ch of body) {
    if (gsm7Chars.includes(ch)) continue
    if (gsm7Extended.includes(ch)) continue
    isGsm = false
    break
  }
  const length = body.length
  const segLen = isGsm ? (length <= 160 ? 160 : 153) : (length <= 70 ? 70 : 67)
  const segments = length === 0 ? 0 : Math.ceil(length / segLen)
  return { length, segments, encoding: isGsm ? 'GSM-7' : 'UCS-2' }
}

/**
 * Render a template's body (and title for push) at runtime. Used by call sites
 * to fetch the live wording. Falls back to default if no override or DB unreachable.
 */
export async function renderTemplate(
  eventId: string,
  channel: ChannelId,
  vars: Record<string, string | number | undefined | null>
): Promise<{ title?: string; body: string }> {
  const def = getEventDef(eventId)
  if (!def) {
    throw new Error(`Unknown notification event: ${eventId}`)
  }
  const channelDefaults = def.channels[channel]
  if (!channelDefaults) {
    throw new Error(`Event ${eventId} has no ${channel} channel`)
  }

  let overrides: NotificationOverrides = {}
  try {
    overrides = await loadOverrides()
  } catch {
    // DB unreachable — fall back to defaults silently
  }
  const channelOverride = overrides[eventId]?.[channel]
  const body = renderBody(channelOverride?.body ?? channelDefaults.body, vars)
  const titleSrc = channelOverride?.title ?? channelDefaults.title
  return titleSrc ? { title: renderBody(titleSrc, vars), body } : { body }
}
