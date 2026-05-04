import { getAdminClient } from '@/lib/supabase/admin'

export type SmsCategory = 'Auth' | 'Onboarding' | 'Activities' | 'Spots & Waitlist' | 'Chat'

export interface SmsVariable {
  key: string
  description: string
  example: string
  required?: boolean
}

export interface SmsTemplateDef {
  id: string
  name: string
  category: SmsCategory
  trigger: string
  call_sites: string[]
  default_body: string
  variables: SmsVariable[]
}

/**
 * Canonical registry of every SMS template. Defaults live here; admin
 * overrides live in `whozin_settings.sms_templates` keyed by id.
 *
 * Variables use `{{snake_case}}`. The runtime pass-through that fills these
 * in is in src/lib/sms.ts and the call sites listed under `call_sites` —
 * this registry is the single source of truth for what each message says.
 */
export const SMS_TEMPLATES: SmsTemplateDef[] = [
  {
    id: 'otp_login',
    name: 'Login OTP',
    category: 'Auth',
    trigger: 'User requests a login code at /auth/sign-in',
    call_sites: ['src/app/api/auth/send-otp/route.ts'],
    default_body: 'Your Whozin code is: {{code}}. It expires in 5 minutes.',
    variables: [
      { key: 'code', description: '6-digit verification code', example: '482910', required: true },
    ],
  },
  {
    id: 'group_invite',
    name: 'Group Invite',
    category: 'Onboarding',
    trigger: 'A non-user is added to a group (link, QR, or direct invite)',
    call_sites: ['src/lib/sms.ts (sendSmsInvite)'],
    default_body: "{{inviter_name}} added you to a group on Whozin!\n\nHow it works: When there's an activity, you'll get a text. Just reply IN or OUT — that's it. No app needed.\n\nWant to see your groups and activities? Download the app: {{download_link}}",
    variables: [
      { key: 'inviter_name', description: 'First name of the user who added them', example: 'Sarah', required: true },
      { key: 'download_link', description: 'Short app download link', example: 'https://whozin.io/dl', required: true },
    ],
  },
  {
    id: 'group_invite_reinvite',
    name: 'Group Re-Invite (Admin)',
    category: 'Onboarding',
    trigger: 'Admin resends a group invite to a previously-invited contact',
    call_sites: ['src/app/api/admin/users/reinvite/route.ts'],
    default_body: "Hey{{first_name_prefix}}! You've been added to a group on Whozin.\n\nHow it works: When there's an activity, you'll get a text. Just reply IN or OUT — that's it. No app needed.\n\nWant to see your groups and manage activities? Download the app: {{download_link}}",
    variables: [
      { key: 'first_name_prefix', description: "Leading space + first name, or empty if unknown (e.g. ' Tim' or '')", example: ' Tim' },
      { key: 'download_link', description: 'Short app download link', example: 'https://whozin.io/dl', required: true },
    ],
  },
  {
    id: 'activity_invite',
    name: 'Activity Invite',
    category: 'Activities',
    trigger: 'Member is invited to an activity (incl. priority batch processing)',
    call_sites: ['src/lib/sms.ts (sendActivityInvite)'],
    default_body: '{{inviter_name}} is using Whozin to organize {{activity_name}} on {{date_time}}. Are you in? Reply IN or OUT',
    variables: [
      { key: 'inviter_name', description: 'First name of the host', example: 'Sarah', required: true },
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'date_time', description: 'Formatted date/time of the activity', example: 'Sat May 10 at 6 PM', required: true },
    ],
  },
  {
    id: 'activity_reminder',
    name: 'Activity Reminder',
    category: 'Activities',
    trigger: 'Scheduled reminder fires before activity start',
    call_sites: ['src/lib/sms.ts (sendReminderSms)'],
    default_body: 'Whozin reminder: {{activity_name}} is starting in {{window_label}}.',
    variables: [
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'window_label', description: 'Human-readable time window', example: '30 minutes', required: true },
    ],
  },
  {
    id: 'fill_invite',
    name: 'Fill Invite',
    category: 'Spots & Waitlist',
    trigger: 'Emergency or batch fill request to backfill open spots',
    call_sites: ['src/lib/sms.ts (sendFillInvite)', 'src/lib/emergency-fill.ts'],
    default_body: '{{inviter_name}} is using Whozin to fill {{spots_text}} for {{activity_name}} on {{date_time}}. Are you in? Reply IN',
    variables: [
      { key: 'inviter_name', description: 'First name of the host', example: 'Sarah', required: true },
      { key: 'spots_text', description: 'Pluralized spot count', example: '2 spots', required: true },
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'date_time', description: 'Formatted date/time of the activity', example: 'Sat May 10 at 6 PM', required: true },
    ],
  },
  {
    id: 'activity_confirmed',
    name: 'Spot Confirmed',
    category: 'Activities',
    trigger: 'Host confirms / accepts a member into an activity',
    call_sites: ['src/app/api/activities/[id]/confirm-member/route.ts'],
    default_body: "You're in for {{activity_name}}!{{chat_line}}",
    variables: [
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'chat_line', description: 'Optional follow-on with chat or app link (leading space)', example: ' Open the app: https://whozin.io/dl' },
    ],
  },
  {
    id: 'waitlist_added',
    name: 'Added to Waitlist',
    category: 'Spots & Waitlist',
    trigger: 'User joins activity but it is full — added to waitlist',
    call_sites: ['src/lib/waitlist.ts'],
    default_body: "You're on the wait list for {{activity_name}} (spot #{{position}}). We'll text you if a spot opens up.",
    variables: [
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'position', description: 'Numeric position in line', example: '3', required: true },
    ],
  },
  {
    id: 'waitlist_promoted',
    name: 'Promoted from Waitlist',
    category: 'Spots & Waitlist',
    trigger: 'Spot opens and waitlisted user is promoted to confirmed',
    call_sites: ['src/lib/waitlist.ts'],
    default_body: "A spot opened up — you're now in for {{activity_name}}! Open the app to change to OUT if you can't make it: {{download_link}}",
    variables: [
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
      { key: 'download_link', description: 'Short app download link', example: 'https://whozin.io/dl', required: true },
    ],
  },
  {
    id: 'dropout_notification',
    name: 'Dropout Notification (to Host)',
    category: 'Spots & Waitlist',
    trigger: 'Member drops out — host gets notified with FILL option',
    call_sites: ['src/lib/emergency-fill.ts'],
    default_body: '{{dropout_name}} just dropped out of {{activity_name}}! Reply FILL to send an emergency invite to everyone.',
    variables: [
      { key: 'dropout_name', description: 'First name of the user who dropped out', example: 'Mike', required: true },
      { key: 'activity_name', description: 'Activity title', example: 'Pickleball at Memorial', required: true },
    ],
  },
  {
    id: 'chat_fallback',
    name: 'Chat Fallback',
    category: 'Chat',
    trigger: 'Chat message sent but no push delivered to recipient',
    call_sites: ['src/lib/alerts.ts'],
    default_body: 'You have a chat waiting on Whozin. Download the app: {{download_link}}',
    variables: [
      { key: 'download_link', description: 'Short app download link', example: 'https://whozin.io/dl', required: true },
    ],
  },
]

const SETTINGS_KEY = 'sms_templates'

const definitionById = new Map(SMS_TEMPLATES.map((t) => [t.id, t]))

export function getTemplateDef(id: string): SmsTemplateDef | undefined {
  return definitionById.get(id)
}

export interface SmsTemplateOverrides {
  [id: string]: { body?: string; updated_at?: string }
}

export async function loadOverrides(): Promise<SmsTemplateOverrides> {
  const admin = getAdminClient()
  const { data } = await admin
    .from('whozin_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single()

  const value = data?.value
  if (!value) return {}
  if (typeof value === 'string') {
    try { return JSON.parse(value) as SmsTemplateOverrides } catch { return {} }
  }
  return value as SmsTemplateOverrides
}

export async function saveOverride(id: string, body: string | null): Promise<void> {
  const admin = getAdminClient()
  const current = await loadOverrides()
  const next = { ...current }
  if (body === null) {
    delete next[id]
  } else {
    next[id] = { body, updated_at: new Date().toISOString() }
  }
  await admin
    .from('whozin_settings')
    .upsert(
      { key: SETTINGS_KEY, value: next as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
}

export interface ResolvedTemplate {
  id: string
  name: string
  category: SmsCategory
  trigger: string
  call_sites: string[]
  body: string
  default_body: string
  is_customized: boolean
  updated_at: string | null
  variables: SmsVariable[]
}

export function resolveTemplate(def: SmsTemplateDef, overrides: SmsTemplateOverrides): ResolvedTemplate {
  const override = overrides[def.id]
  const body = override?.body ?? def.default_body
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    trigger: def.trigger,
    call_sites: def.call_sites,
    body,
    default_body: def.default_body,
    is_customized: !!override?.body && override.body !== def.default_body,
    updated_at: override?.updated_at ?? null,
    variables: def.variables,
  }
}

export async function getAllResolved(): Promise<ResolvedTemplate[]> {
  const overrides = await loadOverrides()
  return SMS_TEMPLATES.map((def) => resolveTemplate(def, overrides))
}

export async function getResolved(id: string): Promise<ResolvedTemplate | null> {
  const def = getTemplateDef(id)
  if (!def) return null
  const overrides = await loadOverrides()
  return resolveTemplate(def, overrides)
}

/** Substitutes `{{var}}` placeholders. Missing vars render as empty strings. */
export function renderSmsBody(body: string, vars: Record<string, string | number | undefined | null>): string {
  return body.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, key) => {
    const value = vars[key]
    if (value === undefined || value === null) return ''
    return String(value)
  })
}

/** Returns the GSM-7 segment count for an SMS body. */
export function smsSegmentInfo(body: string): { length: number; segments: number; encoding: 'GSM-7' | 'UCS-2' } {
  // GSM-7 default alphabet (subset — used for rough segment estimation)
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
