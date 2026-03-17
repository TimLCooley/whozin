import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth'

// POST — sync GitHub Actions run history into app_builds table
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.GITHUB_PAT?.trim()
  if (!token) {
    return NextResponse.json(
      { error: 'GITHUB_PAT not configured' },
      { status: 500 }
    )
  }

  const admin = getAdminClient()
  let synced = 0

  for (const workflow of ['android-build.yml', 'ios-build.yml']) {
    const platform = workflow.includes('android') ? 'android' : 'ios'

    const res = await fetch(
      `https://api.github.com/repos/TimLCooley/whozin/actions/workflows/${workflow}/runs?per_page=20`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!res.ok) continue

    const data = await res.json()
    const runs = data.workflow_runs || []

    for (const run of runs) {
      // Check if this run_id already exists
      const { data: existing } = await admin
        .from('app_builds')
        .select('id')
        .eq('run_id', run.id)
        .limit(1)

      if (existing && existing.length > 0) continue

      const status = run.conclusion === 'success' ? 'deployed'
        : run.conclusion === 'failure' ? 'failed'
        : run.status === 'in_progress' ? 'building'
        : 'pending'

      // Try to extract track from the workflow dispatch inputs
      const track = run.event === 'workflow_dispatch'
        ? (platform === 'android' ? 'production' : 'testflight')
        : (platform === 'android' ? 'internal' : 'testflight')

      await admin.from('app_builds').insert({
        platform,
        status,
        track: status === 'deployed' ? track : null,
        commit_sha: run.head_sha?.slice(0, 7) || null,
        commit_message: run.head_commit?.message?.split('\n')[0] || run.display_title || null,
        run_id: run.id,
        run_url: run.html_url,
        created_at: run.created_at,
        updated_at: run.updated_at,
      })
      synced++
    }
  }

  return NextResponse.json({ success: true, synced })
}
