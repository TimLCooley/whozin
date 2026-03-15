import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth'

// GET — list build history (admin only)
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  const platform = req.nextUrl.searchParams.get('platform')

  let query = admin
    .from('app_builds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (platform) {
    query = query.eq('platform', platform)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// POST — record a build event (from GitHub Actions via secret, or admin)
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const buildSecret = process.env.WHOZIN_BUILD_SECRET?.trim()

  // Auth: either build secret from CI or super admin session
  if (auth === `Bearer ${buildSecret}` && buildSecret) {
    // CI webhook — trusted
  } else {
    // Check admin session
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !isSuperAdmin(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await req.json()
  const admin = getAdminClient()

  // If run_id exists and status is an update (deployed/failed), update existing record
  if (body.run_id && (body.status === 'deployed' || body.status === 'failed')) {
    const { data, error } = await admin
      .from('app_builds')
      .update({
        status: body.status,
        track: body.track || null,
        updated_at: new Date().toISOString(),
      })
      .eq('run_id', body.run_id)
      .select()
      .single()

    if (error) {
      // If no existing record, fall through to insert
      if (error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      return NextResponse.json(data)
    }
  }

  // Insert new build record
  const { data, error } = await admin
    .from('app_builds')
    .insert({
      platform: body.platform,
      version_code: body.version_code || null,
      version_name: body.version_name || null,
      status: body.status || 'pending',
      track: body.track || null,
      commit_sha: body.commit_sha || null,
      commit_message: body.commit_message || null,
      run_id: body.run_id || null,
      run_url: body.run_url || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
