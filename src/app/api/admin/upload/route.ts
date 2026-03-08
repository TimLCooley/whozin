import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const settingKey = formData.get('key') as string | null

  if (!file || !settingKey) {
    return NextResponse.json({ error: 'File and setting key are required.' }, { status: 400 })
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use PNG, JPG, SVG, WebP, or ICO.' }, { status: 400 })
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Generate filename from setting key
  const ext = file.name.split('.').pop() || 'png'
  const fileName = `${settingKey}.${ext}`

  // Upload to branding bucket (overwrite if exists)
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage
    .from('branding')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = admin.storage
    .from('branding')
    .getPublicUrl(fileName)

  // Add cache-busting param so browsers pick up replacements
  const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

  // Save URL directly as a string value (not JSON-wrapped)
  const { error: settingsError } = await admin
    .from('whozin_settings')
    .upsert(
      { key: settingKey, value: publicUrl, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (settingsError) {
    return NextResponse.json({ error: `Saved file but failed to update setting: ${settingsError.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, url: publicUrl })
}
