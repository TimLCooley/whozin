import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

const DEFAULT_TIMERS = [
  { id: 'test-10s', value: 0.167, label: '10 sec (test)', pro_fill: false, pro_group: false, test_only: true, modes: ['fill', 'group'], enabled: true },
  { id: 'free-5m', value: 5, label: '5 min', pro_fill: false, pro_group: false, test_only: false, modes: ['fill', 'group'], enabled: true },
  { id: 'pro-15m', value: 15, label: '15 min', pro_fill: true, pro_group: true, test_only: false, modes: ['fill', 'group'], enabled: true },
  { id: 'pro-30m', value: 30, label: '30 min', pro_fill: true, pro_group: true, test_only: false, modes: ['fill', 'group'], enabled: true },
  { id: 'pro-1h', value: 60, label: '1 hour', pro_fill: true, pro_group: true, test_only: false, modes: ['fill', 'group'], enabled: true },
  { id: 'pro-2h', value: 120, label: '2 hours', pro_fill: true, pro_group: true, test_only: false, modes: ['fill', 'group'], enabled: true },
]

// GET enabled response timers + defaults
export async function GET() {
  const admin = getAdminClient()

  const { data: settings } = await admin
    .from('whozin_settings')
    .select('key, value')
    .in('key', ['response_timers', 'default_timer_fill', 'default_timer_group'])

  let timers = DEFAULT_TIMERS
  let default_fill = 'free-5m'
  let default_group = 'free-5m'

  for (const row of settings ?? []) {
    if (row.key === 'default_timer_fill' && row.value) {
      default_fill = typeof row.value === 'string' ? row.value : String(row.value)
    }
    if (row.key === 'default_timer_group' && row.value) {
      default_group = typeof row.value === 'string' ? row.value : String(row.value)
    }
    if (row.key === 'response_timers' && row.value) {
      try {
        const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
        if (Array.isArray(parsed) && parsed.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          timers = parsed.map((t: any) => {
            if ('pro' in t && !('pro_fill' in t)) {
              return { ...t, pro_fill: t.pro, pro_group: t.pro, pro: undefined }
            }
            return t
          })
        }
      } catch { /* use defaults */ }
    }
  }

  const enabled = timers.filter((t) => t.enabled)

  // Resolve default values (minutes) from timer IDs
  const fillTimer = enabled.find((t) => t.id === default_fill)
  const groupTimer = enabled.find((t) => t.id === default_group)

  return NextResponse.json({
    timers: enabled,
    default_fill: fillTimer?.value ?? 5,
    default_group: groupTimer?.value ?? 5,
  })
}
