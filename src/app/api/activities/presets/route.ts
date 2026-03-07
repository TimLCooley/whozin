import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_ACTIVITY_PRESETS } from '@/lib/activity-presets'

// GET enabled activity presets
export async function GET() {
  const admin = getAdminClient()

  const { data: setting } = await admin
    .from('whozin_settings')
    .select('value')
    .eq('key', 'activity_presets')
    .single()

  let presets = DEFAULT_ACTIVITY_PRESETS

  if (setting?.value) {
    try {
      const parsed = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
      if (Array.isArray(parsed) && parsed.length > 0) {
        presets = parsed
      }
    } catch { /* use defaults */ }
  }

  // Only return enabled presets
  const enabled = presets.filter((p) => p.enabled)
  return NextResponse.json(enabled)
}
