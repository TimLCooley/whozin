import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { CMO_SYSTEM_PROMPT, formatBriefForPrompt, type BriefContext } from '@/lib/marketing/frameworks'

function stripFences(text: string): string {
  let t = text.trim()
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return t.trim()
}

function extractJson(text: string): unknown {
  const cleaned = stripFences(text)
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const start = cleaned.search(/[[{]/)
  if (start === -1) return null
  const open = cleaned[start]
  const close = open === '[' ? ']' : '}'
  let depth = 0
  for (let i = start; i < cleaned.length; i += 1) {
    if (cleaned[i] === open) depth += 1
    if (cleaned[i] === close) {
      depth -= 1
      if (depth === 0) {
        try { return JSON.parse(cleaned.slice(start, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const body = await req.json()
  const userPrompt: string = (body.prompt ?? '').trim()
  if (!userPrompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const admin = getAdminClient()

  const { data: brief } = await admin
    .from('whozin_marketing_brief')
    .select('*')
    .eq('singleton', true)
    .maybeSingle()

  const briefText = formatBriefForPrompt(brief as BriefContext | null)

  const system = `${CMO_SYSTEM_PROMPT}

${briefText}`

  const userMsg = `The founder just said:
"${userPrompt}"

Generate 3-5 content ideas that would actually move the needle. Each idea must:
- Target a specific channel (tiktok / linkedin / reddit / instagram / facebook / newsletter / other)
- Use a specific hook type (from the taxonomy)
- Follow a specific framework (from the frameworks list)
- Have a first-line HOOK that's already written, not described
- Include ONE sentence on why this specific idea would stop a scroll for this specific audience

Return ONLY valid JSON in this exact shape:
{
  "ideas": [
    {
      "title": "<short internal label so we can find it later>",
      "channel": "<tiktok|linkedin|reddit|instagram|facebook|newsletter|other>",
      "hook": "<the actual first line/headline as it would appear to a reader>",
      "hook_type": "<one of: pattern_interrupt|curiosity_gap|bold_claim|relatable_pain|visual_surprise|self_deprecating|specific_number|controversial_take|behind_the_scenes|transformation>",
      "framework": "<one of: aida|pas|bab|four_cs|hormozi_hook|ship30_131|reddit_native>",
      "why_it_might_work": "<one sentence on WHY for this audience specifically>"
    }
  ]
}

No markdown fences, no commentary. Just the JSON.`

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
        max_tokens: 3000,
        system,
        messages: [{ role: 'user', content: userMsg }],
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
    const parsed = extractJson(text) as { ideas?: Array<Record<string, string>> } | null
    if (!parsed?.ideas || !Array.isArray(parsed.ideas)) {
      return NextResponse.json({ error: 'Model returned unparseable response', raw: text }, { status: 502 })
    }

    // Persist each idea
    const rows = parsed.ideas.map((idea) => ({
      title: idea.title ?? '(untitled)',
      hook: idea.hook ?? null,
      hook_type: idea.hook_type ?? null,
      framework: idea.framework ?? null,
      channel: idea.channel ?? 'other',
      why_it_might_work: idea.why_it_might_work ?? null,
      source_prompt: userPrompt,
      status: 'proposed',
    }))

    const { data: inserted, error: insertError } = await admin
      .from('whozin_marketing_ideas')
      .insert(rows)
      .select('*')

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ ideas: inserted ?? [] })
  } catch (err) {
    console.error('cmo-ideas error:', err)
    return NextResponse.json({ error: 'Idea generation failed' }, { status: 500 })
  }
}
