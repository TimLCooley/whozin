import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'marketing-media'

async function generateOneImage(apiKey: string, prompt: string): Promise<{ data: string; mimeType: string } | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    }
  )

  const data = await res.json()
  if (!res.ok) {
    console.error('Gemini image error:', data)
    return null
  }

  const parts = data.candidates?.[0]?.content?.parts
  const imagePart = parts?.find(
    (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith('image/')
  )
  if (!imagePart?.inlineData?.data) return null
  return {
    data: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_AI_API_KEY not configured' }, { status: 500 })
  }

  const body = await req.json()
  const { prompt, count = 3, content_item_id, aspect = 'square', update_item = false } = body

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }
  const n = Math.max(1, Math.min(6, Number(count) || 3))

  const aspectHint =
    aspect === 'portrait'
      ? 'Generate in 9:16 portrait orientation, 1080x1920 pixels.'
      : aspect === 'landscape'
        ? 'Generate in 16:9 landscape orientation, 1920x1080 pixels.'
        : 'Generate in 1:1 square orientation, 1080x1080 pixels.'

  const fullPrompt = `${prompt.trim()}. ${aspectHint} No text overlays. Vivid, high-quality photography.`

  const admin = getAdminClient()
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {})

  const results = await Promise.all(
    Array.from({ length: n }, async (_, idx) => {
      const img = await generateOneImage(apiKey, fullPrompt)
      if (!img) return { ok: false as const, error: `Image ${idx + 1} failed` }

      const buffer = Buffer.from(img.data, 'base64')
      const ext = img.mimeType.includes('jpeg') ? 'jpg' : 'png'
      const fileName = `${content_item_id ?? 'adhoc'}/${Date.now()}-${idx + 1}.${ext}`

      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(fileName, buffer, { contentType: img.mimeType, upsert: true })

      if (uploadError) {
        return { ok: false as const, error: uploadError.message }
      }

      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(fileName)
      return { ok: true as const, url: urlData.publicUrl }
    })
  )

  const urls = results.filter((r) => r.ok).map((r) => r.url)
  const errors = results.filter((r) => !r.ok).map((r) => r.error)

  if (urls.length === 0) {
    return NextResponse.json({ error: 'All image generations failed', errors }, { status: 500 })
  }

  if (update_item && content_item_id) {
    await admin
      .from('whozin_marketing_content_items')
      .update({ image_urls: urls })
      .eq('id', content_item_id)
  }

  return NextResponse.json({ urls, errors: errors.length ? errors : undefined })
}
