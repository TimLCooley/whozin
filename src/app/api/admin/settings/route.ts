import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET all settings
export async function GET() {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('whozin_settings')
    .select('key, value')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Convert array of {key, value} to a flat object
  // Values are stored as JSONB via JSON.stringify — unwrap them
  const settings: Record<string, string> = {}
  for (const row of data ?? []) {
    let val = row.value
    // If JSONB returned a string, use it directly
    // If it returned an object/array, stringify it for the client
    if (typeof val === 'string') {
      settings[row.key] = val
    } else if (val !== null && val !== undefined) {
      settings[row.key] = typeof val === 'object' ? JSON.stringify(val) : String(val)
    } else {
      settings[row.key] = ''
    }
  }

  return NextResponse.json(settings)
}

// PUT update settings (accepts partial updates — only saves keys that are provided)
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const admin = getAdminClient()

  // Only save non-empty values to avoid overwriting uploads with empty strings
  const entries = Object.entries(body).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  )

  if (entries.length === 0) {
    return NextResponse.json({ success: true })
  }

  const updates = entries.map(([key, value]) =>
    admin
      .from('whozin_settings')
      .upsert(
        { key, value: typeof value === 'string' ? value : JSON.stringify(value), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
  )

  const results = await Promise.all(updates)
  const errors = results.filter((r) => r.error)

  if (errors.length > 0) {
    return NextResponse.json(
      { error: `Failed to update ${errors.length} setting(s): ${errors.map(e => e.error!.message).join(', ')}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
