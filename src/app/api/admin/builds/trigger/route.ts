import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth'

// POST — trigger a GitHub Actions build workflow
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { platform, track } = body as { platform: 'android' | 'ios'; track?: string }

  if (!platform || !['android', 'ios'].includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }

  const token = process.env.GITHUB_PAT?.trim()
  if (!token) {
    return NextResponse.json(
      { error: 'GITHUB_PAT not configured. Add a GitHub Personal Access Token with actions:write scope to Vercel env vars.' },
      { status: 500 }
    )
  }

  const workflowFile = platform === 'android' ? 'android-build.yml' : 'ios-build.yml'
  const inputs: Record<string, string> = {}

  if (platform === 'android') {
    inputs.track = track || 'production'
  } else {
    inputs.submit_for_review = track === 'production' ? 'true' : 'false'
  }

  const res = await fetch(
    `https://api.github.com/repos/TimLCooley/whozin/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'master',
        inputs,
      }),
    }
  )

  if (res.status === 204) {
    return NextResponse.json({ success: true, message: `${platform} build triggered on ${track || 'production'} track` })
  }

  const errorText = await res.text()
  return NextResponse.json(
    { error: `GitHub API error (${res.status}): ${errorText}` },
    { status: res.status }
  )
}
