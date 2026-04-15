import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

interface Turn {
  role: 'assistant' | 'user'
  content: string
}

const INTAKE_SYSTEM = `You are a senior CMO running a 10-minute product brief intake with a founder. Your job is to extract exactly what you need to give sharp marketing advice later. Ask ONE question at a time. Keep each question short, specific, and conversational. No corporate jargon.

You are gathering these fields (in roughly this order):
1. product_one_liner — what does the product actually do, in plain English
2. ideal_customer — who is the sharpest user, specifically (name a persona, an age, a job, a moment of frustration)
3. customer_pain — the exact pain or friction they feel, in their own words
4. why_we_win — why this product, not another one (the unfair angle, the one thing only you do well)
5. what_worked — any marketing, content, or channel that has actually moved the needle so far (even if small)
6. what_flopped — things that didn't work, plus why you think they didn't
7. forbidden_tactics — things you will NOT do (no spam, no clickbait, no LinkedIn cringe, no whatever)
8. voice_rules — tone, banned words, emoji policy, specific phrases that sound like you

Rules:
- Ask ONE question per turn. Don't stack questions.
- When the founder answers, acknowledge briefly (one sentence max), then ask the next question.
- If an answer is vague, probe once with a concrete follow-up ("Can you name one specific person who'd love this?"). Don't interrogate.
- You are not allowed to give marketing advice during intake. Just listen and collect.
- After you have enough for all 8 fields (some may be combined), return a JSON object instead of a question. JSON shape:

{
  "done": true,
  "brief": {
    "product_one_liner": "...",
    "ideal_customer": "...",
    "customer_pain": "...",
    "why_we_win": "...",
    "what_worked": "...",
    "what_flopped": "...",
    "forbidden_tactics": "...",
    "voice_rules": "..."
  }
}

Your very FIRST message should greet them warmly (1 sentence), explain you'll ask ~8 quick questions (1 sentence), then ask question 1. No preamble beyond that.

While asking questions, return JSON of the form:
{
  "done": false,
  "message": "<your next message to the founder>"
}

Never return anything other than a JSON object. No markdown fences, no commentary.`

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

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const body = await req.json()
  const conversation: Turn[] = Array.isArray(body.conversation) ? body.conversation : []
  const userMessage: string | undefined = body.message?.trim() || undefined

  const messages: Turn[] = [...conversation]
  if (userMessage) {
    messages.push({ role: 'user', content: userMessage })
  }

  // If there's nothing yet, seed with an empty user turn so Claude produces the greeting.
  const apiMessages = messages.length === 0
    ? [{ role: 'user' as const, content: 'Please start the intake.' }]
    : messages

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
        system: INTAKE_SYSTEM,
        messages: apiMessages,
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
    const parsed = extractJson(text) as
      | { done: true; brief: Record<string, string> }
      | { done: false; message: string }
      | null

    if (!parsed) {
      return NextResponse.json({ error: 'Model returned unparseable response', raw: text }, { status: 502 })
    }

    // Persist conversation turn-by-turn so refresh doesn't lose state.
    const admin = getAdminClient()
    const newConversation: Turn[] = [...messages]
    if (!parsed.done) {
      newConversation.push({ role: 'assistant', content: parsed.message })
    }

    if (parsed.done) {
      await admin
        .from('whozin_marketing_brief')
        .upsert({
          singleton: true,
          ...parsed.brief,
          intake_conversation: newConversation,
          is_complete: true,
        }, { onConflict: 'singleton' })
      return NextResponse.json({ done: true, brief: parsed.brief })
    }

    await admin
      .from('whozin_marketing_brief')
      .upsert({
        singleton: true,
        intake_conversation: newConversation,
        is_complete: false,
      }, { onConflict: 'singleton' })

    return NextResponse.json({ done: false, message: parsed.message, conversation: newConversation })
  } catch (err) {
    console.error('brief/chat error:', err)
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}
