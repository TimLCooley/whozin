import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = getAdminClient()

  // Try both key names for backwards compatibility
  const { data } = await admin
    .from('whozin_settings')
    .select('value')
    .in('key', ['favicon', 'logo_favicon'])

  const row = data?.find((r) => r.value)
  let faviconUrl = row?.value as string | null

  if (!faviconUrl) {
    return new NextResponse(null, { status: 404 })
  }

  // Handle JSON-wrapped strings from older saves
  if (faviconUrl.startsWith('"') && faviconUrl.endsWith('"')) {
    try { faviconUrl = JSON.parse(faviconUrl) as string } catch { /* use as-is */ }
  }

  if (!faviconUrl) {
    return new NextResponse(null, { status: 404 })
  }

  // Fetch the actual image and proxy it
  try {
    const res = await fetch(faviconUrl)
    if (!res.ok) {
      return new NextResponse(null, { status: 404 })
    }

    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/x-icon'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
