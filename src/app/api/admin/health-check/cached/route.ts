import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Returns cached health check results from Supabase
export async function GET() {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('integration_health')
      .select('*')
      .order('id')

    if (error) {
      // Table probably doesn't exist yet — return empty
      return NextResponse.json({ results: [], exists: false })
    }

    return NextResponse.json({ results: data || [], exists: true })
  } catch {
    return NextResponse.json({ results: [], exists: false })
  }
}
