import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { CMO_SYSTEM_PROMPT, formatBriefForPrompt, FRAMEWORKS, type BriefContext } from '@/lib/marketing/frameworks'
import { getNextScheduledSlot } from '@/lib/marketing/scheduling'

function stripFences(text: string): string {
  let t = text.trim()
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return t.trim()
}

function extractJson(text: string): unknown {
  const cleaned = stripFences(text)
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const start = cleaned.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < cleaned.length; i += 1) {
    if (cleaned[i] === '{') depth += 1
    if (cleaned[i] === '}') {
      depth -= 1
      if (depth === 0) {
        try { return JSON.parse(cleaned.slice(start, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

function randomShortCode(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const admin = getAdminClient()

  const { data: idea, error: ideaErr } = await admin
    .from('whozin_marketing_ideas')
    .select('*')
    .eq('id', id)
    .single()
  if (ideaErr || !idea) {
    return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
  }

  const { data: brief } = await admin
    .from('whozin_marketing_brief')
    .select('*')
    .eq('singleton', true)
    .maybeSingle()

  const briefText = formatBriefForPrompt(brief as BriefContext | null)
  const framework = FRAMEWORKS.find((f) => f.id === idea.framework)

  const userMsg = `Take this idea and draft the full post.

Idea title: ${idea.title}
Channel: ${idea.channel}
Hook type: ${idea.hook_type}
Framework: ${framework ? `${framework.label}\nStructure: ${framework.structure}\nTemplate:\n${framework.template}` : idea.framework}
Hook (first line): ${idea.hook}
Why it might work: ${idea.why_it_might_work}

Write the full post for ${idea.channel}. Use the hook as the first line. Follow the framework template. Match the voice from the product brief. Be specific (numbers, names, sensory details) not generic. No corporate jargon. The product is Whozin.

Return ONLY valid JSON:
{
  "body_text": "<the full post body, with line breaks>",
  "title": "<the title MUST be derived from body_text — either the literal first line of body_text, or a 4-8 word summary of what the post is about. Do NOT invent a separate headline. If the channel has no real headline (e.g. TikTok caption, Reddit post body), still provide a short internal label so we can find it later.>"
}
Write body_text FIRST, then derive the title from it. No markdown fences, no commentary.`

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
        max_tokens: 2048,
        system: `${CMO_SYSTEM_PROMPT}\n\n${briefText}`,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || 'Claude API error' }, { status: 500 })
    }

    const text: string = data.content?.[0]?.text ?? ''
    const parsed = extractJson(text) as { title?: string; body_text?: string } | null
    if (!parsed || typeof parsed.body_text !== 'string' || !parsed.body_text.trim()) {
      return NextResponse.json(
        { error: 'Model returned empty or unparseable body text', raw: text },
        { status: 502 },
      )
    }

    // Create or find a default "CMO Drafts" campaign if the idea has no campaign yet
    let campaignId: string | null = idea.campaign_id
    if (!campaignId) {
      const { data: existing } = await admin
        .from('whozin_marketing_campaigns')
        .select('id')
        .eq('slug', 'cmo-drafts')
        .maybeSingle()

      if (existing) {
        campaignId = existing.id
      } else {
        const { data: created } = await admin
          .from('whozin_marketing_campaigns')
          .insert({
            title: 'CMO Drafts',
            slug: 'cmo-drafts',
            topic: 'Auto-generated drafts from the CMO agent',
            goal_type: 'app_downloads',
            status: 'active',
          })
          .select('id')
          .single()
        campaignId = created?.id ?? null
      }
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'Could not create campaign' }, { status: 500 })
    }

    // Unique short code
    let shortCode = randomShortCode()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: conflict } = await admin
        .from('whozin_marketing_content_items')
        .select('id')
        .eq('short_code', shortCode)
        .maybeSingle()
      if (!conflict) break
      shortCode = randomShortCode()
    }

    const scheduledAt = await getNextScheduledSlot(admin, idea.channel)

    // Title fallback chain: parsed.title → idea.hook → idea.title → body first line
    const firstBodyLine = parsed.body_text.split('\n').find((l) => l.trim())?.trim().slice(0, 80) ?? null
    const finalTitle =
      (parsed.title && parsed.title.trim()) ||
      (idea.hook && idea.hook.trim().slice(0, 80)) ||
      (idea.title && idea.title.trim()) ||
      firstBodyLine ||
      '(untitled)'

    const { data: contentItem, error: ciErr } = await admin
      .from('whozin_marketing_content_items')
      .insert({
        campaign_id: campaignId,
        channel: idea.channel,
        content_type: idea.channel === 'tiktok' || idea.channel === 'instagram' ? 'carousel' : 'text',
        title: finalTitle,
        body_text: parsed.body_text,
        short_code: shortCode,
        status: 'review',
        scheduled_at: scheduledAt,
        destination_url: 'https://whozin.io/dl',
      })
      .select('*')
      .single()

    if (ciErr || !contentItem) {
      return NextResponse.json({ error: ciErr?.message || 'Failed to create content item' }, { status: 500 })
    }

    // Update idea → drafted
    await admin
      .from('whozin_marketing_ideas')
      .update({
        status: 'drafted',
        draft_body: parsed.body_text,
        content_item_id: contentItem.id,
        campaign_id: campaignId,
      })
      .eq('id', id)

    return NextResponse.json({
      content_item: contentItem,
      campaign_id: campaignId,
    })
  } catch (err) {
    console.error('idea draft error:', err)
    return NextResponse.json({ error: 'Draft generation failed' }, { status: 500 })
  }
}
