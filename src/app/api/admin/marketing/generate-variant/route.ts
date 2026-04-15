import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { CMO_SYSTEM_PROMPT, formatBriefForPrompt, type BriefContext } from '@/lib/marketing/frameworks'

type Channel = 'tiktok' | 'linkedin' | 'reddit' | 'facebook' | 'instagram' | 'newsletter' | 'other'

const CHANNEL_RULES: Record<Channel, string> = {
  tiktok:
    'TikTok: hook-driven. First line must stop the scroll. Casual, energetic, Gen Z voice. ' +
    'Under 150 chars for the description. NO hashtag spam (max 3 relevant tags). ' +
    'Sentences fragment. Punchy. Direct.',
  linkedin:
    'LinkedIn: professional but human. Lead with an insight or observation, not a boast. ' +
    '3-5 short paragraphs, each 1-2 sentences. No emoji spam. Use line breaks liberally. ' +
    'End with a question to invite comments. Avoid corporate jargon.',
  reddit:
    'Reddit: native and conversational. NEVER sound like marketing. Write like a normal user ' +
    'sharing something relevant. No CTAs. No "check out my app." Share the story or insight, ' +
    'let the product speak for itself. Use lowercase in the title if casual.',
  facebook:
    'Facebook: warm, community-oriented, accessible. 2-3 sentences. Friendly tone. ' +
    'Okay to use emoji sparingly. Make it shareable.',
  instagram:
    'Instagram: visual-first caption. Short, punchy. 1-2 sentences + strategic hashtags (5-10). ' +
    'Emoji welcome. First line must hook.',
  newsletter:
    'Newsletter: direct, helpful, skimmable. Short paragraphs. Clear value upfront. ' +
    'One main idea. End with a single clear CTA.',
  other:
    'Platform-agnostic: clear, concise, one strong hook, one clear idea.',
}

function stripFences(text: string): string {
  let t = text.trim()
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return t.trim()
}

function extractJson(text: string): unknown {
  const cleaned = stripFences(text)
  try {
    return JSON.parse(cleaned)
  } catch {
    // balanced-brace extraction fallback
    const start = cleaned.indexOf('{')
    if (start === -1) return null
    let depth = 0
    for (let i = start; i < cleaned.length; i += 1) {
      if (cleaned[i] === '{') depth += 1
      if (cleaned[i] === '}') {
        depth -= 1
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1))
          } catch {
            return null
          }
        }
      }
    }
    return null
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const body = await req.json()
  const { campaign_id, parent_content_item_id, target_channel, notes } = body

  if (!campaign_id || !target_channel) {
    return NextResponse.json({ error: 'campaign_id and target_channel are required' }, { status: 400 })
  }

  const channel = target_channel as Channel
  if (!CHANNEL_RULES[channel]) {
    return NextResponse.json({ error: `Unknown channel: ${target_channel}` }, { status: 400 })
  }

  const admin = getAdminClient()

  const { data: campaign, error: cErr } = await admin
    .from('whozin_marketing_campaigns')
    .select('*')
    .eq('id', campaign_id)
    .single()
  if (cErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  let parent: { title: string | null; body_text: string | null; channel: string } | null = null
  if (parent_content_item_id) {
    const { data: p } = await admin
      .from('whozin_marketing_content_items')
      .select('title, body_text, channel')
      .eq('id', parent_content_item_id)
      .single()
    if (p) parent = p
  }

  const { data: brief } = await admin
    .from('whozin_marketing_brief')
    .select('*')
    .eq('singleton', true)
    .maybeSingle()
  const briefText = formatBriefForPrompt(brief as BriefContext | null)

  const source = parent
    ? `Parent content (from ${parent.channel}):\nTitle: ${parent.title ?? '(none)'}\nBody: ${parent.body_text ?? '(none)'}`
    : `Campaign: ${campaign.title}\nTopic: ${campaign.topic ?? '(none)'}\nAngle: ${campaign.angle ?? '(none)'}`

  const userPrompt = `Source material:
${source}

Target channel: ${channel}

Channel rules:
${CHANNEL_RULES[channel]}

${notes ? `Additional notes: ${notes}\n\n` : ''}Write ONE draft for this channel. The product is Whozin — never call it anything else.

Return ONLY valid JSON with exactly these keys:
{
  "body_text": "<the full body of the post, with line breaks>",
  "title": "<the title MUST be derived from body_text — either the literal first line of body_text, or a 4-8 word summary of what the post is about. Do NOT invent a separate headline. NEVER return empty string. Even for TikTok captions or Reddit bodies, return a short internal label (4-8 words) so we can find this item later.>"
}
Write body_text FIRST, then derive the title from it. No markdown, no explanation, just the JSON object.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: `${CMO_SYSTEM_PROMPT}\n\n${briefText}`,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'Claude API error' },
        { status: 500 }
      )
    }

    const text: string = data.content?.[0]?.text ?? ''
    const parsed = extractJson(text) as { title?: string; body_text?: string } | null
    if (!parsed || typeof parsed.body_text !== 'string') {
      return NextResponse.json({ error: 'Model returned unparseable response', raw: text }, { status: 502 })
    }

    // Title fallback: never return empty. Use first line of body_text if model omitted it.
    const firstBodyLine = parsed.body_text.split('\n').find((l) => l.trim())?.trim().slice(0, 80) ?? '(untitled)'
    const finalTitle = (parsed.title && parsed.title.trim()) || firstBodyLine

    return NextResponse.json({
      title: finalTitle,
      body_text: parsed.body_text,
    })
  } catch (err) {
    console.error('generate-variant error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
