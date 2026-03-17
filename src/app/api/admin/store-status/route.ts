import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth'

interface PlatformStatus {
  platform: 'android' | 'ios'
  latestBuild: {
    version_code: number | null
    version_name: string | null
    status: string
    track: string | null
    commit_sha: string | null
    created_at: string
    run_url: string | null
  } | null
  productionBuild: {
    version_code: number | null
    version_name: string | null
    status: string
    created_at: string
  } | null
  totalBuilds: number
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()

  // Get latest build per platform
  const { data: androidBuilds } = await admin
    .from('app_builds')
    .select('*')
    .eq('platform', 'android')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data: iosBuilds } = await admin
    .from('app_builds')
    .select('*')
    .eq('platform', 'ios')
    .order('created_at', { ascending: false })
    .limit(1)

  // Get latest live production build per platform
  const { data: androidProd } = await admin
    .from('app_builds')
    .select('*')
    .eq('platform', 'android')
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data: iosProd } = await admin
    .from('app_builds')
    .select('*')
    .eq('platform', 'ios')
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(1)

  // Get total build counts
  const { count: androidCount } = await admin
    .from('app_builds')
    .select('id', { count: 'exact', head: true })
    .eq('platform', 'android')

  const { count: iosCount } = await admin
    .from('app_builds')
    .select('id', { count: 'exact', head: true })
    .eq('platform', 'ios')

  const formatBuild = (build: Record<string, unknown> | null) => {
    if (!build) return null
    return {
      version_code: build.version_code as number | null,
      version_name: build.version_name as string | null,
      status: build.status as string,
      track: build.track as string | null,
      commit_sha: build.commit_sha as string | null,
      created_at: build.created_at as string,
      run_url: build.run_url as string | null,
    }
  }

  const result: PlatformStatus[] = [
    {
      platform: 'android',
      latestBuild: formatBuild(androidBuilds?.[0] ?? null),
      productionBuild: formatBuild(androidProd?.[0] ?? null),
      totalBuilds: androidCount ?? 0,
    },
    {
      platform: 'ios',
      latestBuild: formatBuild(iosBuilds?.[0] ?? null),
      productionBuild: formatBuild(iosProd?.[0] ?? null),
      totalBuilds: iosCount ?? 0,
    },
  ]

  return NextResponse.json(result)
}
