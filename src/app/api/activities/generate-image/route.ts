import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'AI image generation not configured' }, { status: 500 })
  }

  const { prompt } = await req.json()
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
  }

  try {
    // Use Gemini image generation via generateContent
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt.trim() }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
          },
        }),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      console.error('Gemini image API error:', data)
      return NextResponse.json(
        { error: data.error?.message || 'Image generation failed' },
        { status: 500 }
      )
    }

    // Extract base64 image from response parts
    const parts = data.candidates?.[0]?.content?.parts
    const imagePart = parts?.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith('image/'))
    if (!imagePart?.inlineData?.data) {
      return NextResponse.json({ error: 'No image returned' }, { status: 500 })
    }

    const imageBase64 = imagePart.inlineData.data
    const mimeType = imagePart.inlineData.mimeType || 'image/png'
    const ext = mimeType.includes('jpeg') ? 'jpg' : 'png'

    // Upload the generated image to Supabase storage
    const admin = getAdminClient()
    const buffer = Buffer.from(imageBase64, 'base64')
    const fileName = `${user.id}-ai-${Date.now()}.${ext}`

    await admin.storage.createBucket('activity-images', { public: true }).catch(() => {})

    const { error: uploadError } = await admin.storage
      .from('activity-images')
      .upload(fileName, buffer, { contentType: mimeType, upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = admin.storage
      .from('activity-images')
      .getPublicUrl(fileName)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error('Image generation error:', err)
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
  }
}
