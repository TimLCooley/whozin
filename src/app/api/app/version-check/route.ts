import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get('platform')
  const currentVersion = req.nextUrl.searchParams.get('version')

  if (!platform || !currentVersion) {
    return NextResponse.json({ updateRequired: false })
  }

  const admin = getAdminClient()

  // First check for a manual override in settings
  const settingsKey = platform === 'ios' ? 'min_ios_version' : 'min_android_version'
  const { data: setting } = await admin
    .from('whozin_settings')
    .select('value')
    .eq('key', settingsKey)
    .single()

  const manualMin = (setting?.value as string)?.replace(/"/g, '')?.trim()

  // Then get the two most recent live builds to auto-calculate minimum
  const { data: builds } = await admin
    .from('app_builds')
    .select('version_name')
    .eq('platform', platform)
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(2)

  let minVersion: string | null = null

  if (manualMin) {
    // Manual override takes priority
    minVersion = manualMin
  } else if (builds && builds.length >= 2) {
    // Allow current + previous version, block anything older
    minVersion = builds[1].version_name
  } else if (builds && builds.length === 1) {
    // Only one live build — that's the minimum
    minVersion = builds[0].version_name
  }

  if (!minVersion) {
    return NextResponse.json({ updateRequired: false })
  }

  const needsUpdate = compareVersions(currentVersion, minVersion) < 0

  return NextResponse.json({
    updateRequired: needsUpdate,
    minVersion,
    currentVersion,
    latestVersion: builds?.[0]?.version_name || null,
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
