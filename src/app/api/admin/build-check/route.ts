import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth'

// Paths that require a native rebuild when changed
const NATIVE_PATHS: Record<string, string[]> = {
  both: [
    'capacitor.config.ts',
    'package.json',
  ],
  android: [
    'android/',
    '.github/workflows/android-build.yml',
  ],
  ios: [
    'ios/',
    '.github/workflows/ios-build.yml',
  ],
}

function classifyFile(filename: string): ('android' | 'ios')[] {
  const platforms: ('android' | 'ios')[] = []

  for (const path of NATIVE_PATHS.both) {
    if (filename === path || filename.startsWith(path)) {
      return ['android', 'ios']
    }
  }
  for (const path of NATIVE_PATHS.android) {
    if (filename === path || filename.startsWith(path)) {
      platforms.push('android')
    }
  }
  for (const path of NATIVE_PATHS.ios) {
    if (filename === path || filename.startsWith(path)) {
      platforms.push('ios')
    }
  }
  return platforms
}

interface PlatformResult {
  needsBuild: boolean
  changedNativeFiles: string[]
  lastBuildSha: string | null
  lastBuildDate: string | null
  error?: string
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.GITHUB_PAT?.trim()
  if (!token) {
    return NextResponse.json({ error: 'GITHUB_PAT not configured' }, { status: 500 })
  }

  const admin = getAdminClient()

  // Get last successful build per platform (deployed/in_review/live all mean built successfully)
  const results: Record<string, PlatformResult> = {}

  for (const platform of ['android', 'ios'] as const) {
    const { data: builds } = await admin
      .from('app_builds')
      .select('commit_sha, created_at')
      .eq('platform', platform)
      .in('status', ['deployed', 'in_review', 'live'])
      .not('commit_sha', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)

    const lastBuild = builds?.[0]
    if (!lastBuild?.commit_sha) {
      results[platform] = {
        needsBuild: false,
        changedNativeFiles: [],
        lastBuildSha: null,
        lastBuildDate: null,
        error: 'No successful builds tracked yet',
      }
      continue
    }

    // Use GitHub Compare API to find changed files since last build
    const compareRes = await fetch(
      `https://api.github.com/repos/TimLCooley/whozin/compare/${lastBuild.commit_sha}...HEAD`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!compareRes.ok) {
      const errText = await compareRes.text()
      results[platform] = {
        needsBuild: false,
        changedNativeFiles: [],
        lastBuildSha: lastBuild.commit_sha,
        lastBuildDate: lastBuild.created_at,
        error: `GitHub API error (${compareRes.status}): ${errText.slice(0, 200)}`,
      }
      continue
    }

    const compareData = await compareRes.json()
    const files: { filename: string }[] = compareData.files || []

    const changedNativeFiles: string[] = []
    for (const file of files) {
      const platforms = classifyFile(file.filename)
      if (platforms.includes(platform)) {
        changedNativeFiles.push(file.filename)
      }
    }

    results[platform] = {
      needsBuild: changedNativeFiles.length > 0,
      changedNativeFiles,
      lastBuildSha: lastBuild.commit_sha,
      lastBuildDate: lastBuild.created_at,
    }
  }

  return NextResponse.json(results)
}
