import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 })

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use PNG, JPG, WebP, or GIF.' }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 })
  }

  const admin = getAdminClient()

  const ext = file.name.split('.').pop() || 'png'
  const fileName = `${user.id}-${Date.now()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  // Ensure bucket exists
  await admin.storage.createBucket('activity-images', { public: true }).catch(() => {})

  const { error: uploadError } = await admin.storage
    .from('activity-images')
    .upload(fileName, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  const { data: urlData } = admin.storage
    .from('activity-images')
    .getPublicUrl(fileName)

  return NextResponse.json({ url: urlData.publicUrl })
}
