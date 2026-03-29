import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get('platform')
  const currentVersion = req.nextUrl.searchParams.get('version')

  if (!platform || !currentVersion) {
    return NextResponse.json({ updateRequired: false })
  }

  const admin = getAdminClient()
  const key = platform === 'ios' ? 'min_ios_version' : 'min_android_version'

  const { data } = await admin
    .from('whozin_settings')
    .select('value')
    .eq('key', key)
    .single()

  const minVersion = (data?.value as string)?.replace(/"/g, '')?.trim()

  if (!minVersion) {
    return NextResponse.json({ updateRequired: false })
  }

  const needsUpdate = compareVersions(currentVersion, minVersion) < 0

  return NextResponse.json({
    updateRequired: needsUpdate,
    minVersion,
    currentVersion,
    storeUrl:
      platform === 'ios'
        ? 'https://apps.apple.com/us/app/whozin-app/id6754605540'
        : 'https://play.google.com/store/apps/details?id=io.whozin.app',
  })
}

/** Compare semver strings. Returns -1 if a < b, 0 if equal, 1 if a > b */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na < nb) return -1
    if (na > nb) return 1
  }
  return 0
}
