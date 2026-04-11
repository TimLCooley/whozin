import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const BUCKET = 'branding'
const MAX_BYTES = 5 * 1024 * 1024
// Strict whitelist — no SVG (XSS risk via stored script tags) and no
// unknown image types. Everything maps cleanly to a safe extension.
const ALLOWED_TYPES: Record<string, 'webp' | 'png' | 'jpg'> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit({ key: `avatar:${user.id}`, max: 10, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Too large' }, { status: 400 })
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return NextResponse.json({ error: 'Only WebP, PNG, and JPEG are allowed' }, { status: 400 })

  const admin = getAdminClient()

  const { data: me } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const path = `user-avatars/${me.id}.${ext}`

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

  const { error: updateError } = await admin
    .from('whozin_users')
    .update({ avatar_url: publicUrl })
    .eq('id', me.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true, url: publicUrl })
}

export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()

  const { data: me } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await admin.storage.from(BUCKET).remove([
    `user-avatars/${me.id}.webp`,
    `user-avatars/${me.id}.png`,
    `user-avatars/${me.id}.jpg`,
  ])

  const { error } = await admin
    .from('whozin_users')
    .update({ avatar_url: null })
    .eq('id', me.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
