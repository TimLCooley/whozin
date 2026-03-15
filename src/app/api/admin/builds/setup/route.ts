import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth'

// POST — create the app_builds table if it doesn't exist
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()

  const { error } = await admin.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS app_builds (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        platform text NOT NULL CHECK (platform IN ('android', 'ios')),
        version_code integer,
        version_name text,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'built', 'deployed', 'failed')),
        track text,
        commit_sha text,
        commit_message text,
        run_id bigint,
        run_url text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `
  })

  if (error) {
    // Try direct insert to check if table already exists
    const { error: testError } = await admin
      .from('app_builds')
      .select('id')
      .limit(1)

    if (!testError) {
      return NextResponse.json({ success: true, message: 'Table already exists' })
    }

    return NextResponse.json({ error: error.message, hint: 'Run this SQL manually in Supabase SQL Editor' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
