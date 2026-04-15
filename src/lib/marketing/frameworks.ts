/**
 * Viral content frameworks and hook taxonomies.
 * Encodes what experienced marketers know so the AI doesn't have to guess.
 *
 * Sources: Hormozi hooks, Ship 30 for 30 (Cole/Bush), TikTok 3-second hook taxonomy,
 * AIDA, PAS, BAB, Ogilvy headline rules, Reddit native-post conventions.
 */

export type HookType =
  | 'pattern_interrupt'
  | 'curiosity_gap'
  | 'bold_claim'
  | 'relatable_pain'
  | 'visual_surprise'
  | 'self_deprecating'
  | 'specific_number'
  | 'controversial_take'
  | 'behind_the_scenes'
  | 'transformation'

export interface HookDefinition {
  id: HookType
  label: string
  description: string
  when_to_use: string
  example: string
}

export const HOOK_TAXONOMY: HookDefinition[] = [
  {
    id: 'pattern_interrupt',
    label: 'Pattern interrupt',
    description: 'Start with something unexpected that breaks the scroll rhythm.',
    when_to_use: 'TikTok, Instagram Reels. When feed is sleepy.',
    example: '"Stop using group texts to plan anything."',
  },
  {
    id: 'curiosity_gap',
    label: 'Curiosity gap',
    description: 'Open a loop. Reveal the tension, not the answer.',
    when_to_use: 'Every channel. Especially Reddit titles, email subjects.',
    example: '"I stopped downloading apps in 2023. One changed my mind."',
  },
  {
    id: 'bold_claim',
    label: 'Bold claim',
    description: 'Stake a strong position. Invite disagreement.',
    when_to_use: 'LinkedIn, Twitter/X. When you want comments.',
    example: '"Group chats are where plans go to die."',
  },
  {
    id: 'relatable_pain',
    label: 'Relatable pain',
    description: 'Name the exact frustration your user feels, in their words.',
    when_to_use: 'Reddit, Facebook groups, TikTok voice-over.',
    example: '"You ever try to get 8 friends to agree on a time?"',
  },
  {
    id: 'visual_surprise',
    label: 'Visual surprise',
    description: 'First frame or image makes the viewer blink.',
    when_to_use: 'TikTok, Instagram, carousel slide 1.',
    example: 'A phone screen showing 47 unread messages in a group chat, zooming in.',
  },
  {
    id: 'self_deprecating',
    label: 'Self-deprecating founder',
    description: 'Admit failure, smallness, or naivety. Trust signal.',
    when_to_use: 'Reddit (r/SideProject, r/indiehackers), LinkedIn founder posts.',
    example: '"I built this in 3 weekends and only my wife uses it. Here\'s what I learned."',
  },
  {
    id: 'specific_number',
    label: 'Specific number',
    description: 'Concrete numbers feel more credible than adjectives.',
    when_to_use: 'Headlines, subject lines, tweet hooks.',
    example: '"I sent 2,847 texts to coordinate pickup basketball last year."',
  },
  {
    id: 'controversial_take',
    label: 'Mild controversy',
    description: 'Stake a position most people quietly disagree with.',
    when_to_use: 'LinkedIn, Twitter/X. Careful on Reddit.',
    example: '"The best group app is still SMS. We\'re just using it wrong."',
  },
  {
    id: 'behind_the_scenes',
    label: 'Behind the scenes',
    description: 'Show the mess, the numbers, the ugly middle of building.',
    when_to_use: 'Twitter/X build-in-public, LinkedIn founder posts.',
    example: '"Day 47: killed 3 features, shipped 1. Here\'s what I learned about cutting scope."',
  },
  {
    id: 'transformation',
    label: 'Transformation / Before-After',
    description: 'Show what life looked like before vs after.',
    when_to_use: 'TikTok, Instagram, testimonial-style content.',
    example: '"Before: 4 days of group chat, no plan. After: one text, 6 people in."',
  },
]

export type Framework =
  | 'aida'
  | 'pas'
  | 'bab'
  | 'four_cs'
  | 'hormozi_hook'
  | 'ship30_131'
  | 'reddit_native'

export interface FrameworkDefinition {
  id: Framework
  label: string
  structure: string
  best_for: string[]
  template: string
}

export const FRAMEWORKS: FrameworkDefinition[] = [
  {
    id: 'aida',
    label: 'AIDA (Attention, Interest, Desire, Action)',
    structure: 'Attention → Interest → Desire → Action',
    best_for: ['email', 'landing-page', 'facebook', 'linkedin'],
    template:
      '[Attention: hook that stops the scroll]\n' +
      '[Interest: why it matters to THIS reader]\n' +
      '[Desire: paint the outcome they want]\n' +
      '[Action: one clear CTA, not three]',
  },
  {
    id: 'pas',
    label: 'Problem-Agitate-Solve',
    structure: 'Problem → Agitate → Solve',
    best_for: ['tiktok', 'reddit', 'facebook', 'newsletter'],
    template:
      '[Problem: name the exact pain in their own words]\n' +
      '[Agitate: make them feel the cost of not solving it]\n' +
      '[Solve: the one thing that fixes it, stated simply]',
  },
  {
    id: 'bab',
    label: 'Before-After-Bridge',
    structure: 'Before → After → Bridge',
    best_for: ['tiktok', 'instagram', 'testimonial'],
    template:
      '[Before: life as it is now, the friction, the frustration]\n' +
      '[After: life as it could be, specific and visceral]\n' +
      '[Bridge: the product is the shortest line between them]',
  },
  {
    id: 'four_cs',
    label: '4Cs (Clear, Concise, Compelling, Credible)',
    structure: 'Every line must hit all four',
    best_for: ['newsletter', 'landing-page', 'email'],
    template:
      'Each sentence: clear (no jargon), concise (cut 30%), compelling (why care), credible (specific proof).',
  },
  {
    id: 'hormozi_hook',
    label: 'Hormozi hook: "The [unusual] way to [outcome] without [pain]"',
    structure: 'Hook → proof → offer',
    best_for: ['tiktok', 'youtube', 'ads', 'twitter'],
    template:
      '"The [unusual adjective] way to [desired outcome] without [common pain]"\n' +
      'Then: specific proof (numbers, names, dates).\n' +
      'Then: one concrete next step.',
  },
  {
    id: 'ship30_131',
    label: 'Ship 30 1-3-1 format',
    structure: '1 hook line → 3 body lines → 1 CTA line',
    best_for: ['linkedin', 'twitter', 'threads'],
    template:
      '[1 hook line: bold claim or curiosity gap]\n\n' +
      '[3 body lines, each 1-2 sentences, lots of white space]\n\n' +
      '[1 CTA: a question, not a link]',
  },
  {
    id: 'reddit_native',
    label: 'Reddit native post',
    structure: 'Specific + self-deprecating + no marketing',
    best_for: ['reddit'],
    template:
      'Title: lowercase, specific number, mild self-deprecation, no emoji.\n' +
      'Body: first person story, the mess of building, what you learned, what you\'d do differently.\n' +
      'Never say "check out my app". Let the story do the selling. Link in a comment, not the post.',
  },
]

/**
 * The system prompt seed every CMO call builds on. Sets the voice:
 * senior marketer energy, allergic to corporate jargon, viral-hook expert.
 */
export const CMO_SYSTEM_PROMPT = `You are the CMO for Whozin (spelled W-H-O-Z-I-N). This is non-negotiable — the product is called Whozin, never anything else. Do not invent, shorten, or substitute the name. If you're about to write any other product name, stop and write "Whozin" instead.

Whozin is an app that helps friend groups coordinate informal activities (pickup sports, hangouts, plans). The magic is that invitees don't need to download the app — they get an SMS and reply IN or OUT. One tap, one text, no friction.

You have 10+ years of experience running growth for consumer apps. You are ESPECIALLY good at:

1. Writing hooks that stop the scroll (TikTok, Reels, Reddit titles, email subjects)
2. Matching tone to platform (LinkedIn ≠ Reddit ≠ TikTok — they speak different languages)
3. Turning product features into user outcomes ("download X" is a feature. "stop sending 12 texts to plan pickup basketball" is an outcome)
4. Knowing when to be specific vs abstract, controversial vs safe, personal vs polished

RULES you follow:
- No corporate jargon. No "synergize," "leverage," "unlock value," "revolutionize."
- No emoji spam. One or two where it helps. Zero on LinkedIn unless earned.
- Specific numbers beat vague adjectives. "47 friends" beats "lots of friends."
- Every idea must name a HOOK TYPE from this taxonomy and a FRAMEWORK it follows.
- Every idea must answer: "why would this one specifically stop someone's scroll?"
- You are allergic to generic marketing. If an idea could apply to any app, reject it.
- You work with a founder who is technical, not a marketer. Speak plainly. No fluff.

HOOK TAXONOMY (you must tag each idea with one):
${HOOK_TAXONOMY.map((h) => `- ${h.id}: ${h.description} (ex: ${h.example})`).join('\n')}

FRAMEWORKS (you must tag each idea with one):
${FRAMEWORKS.map((f) => `- ${f.id}: ${f.structure}`).join('\n')}

You will be given a product brief describing the app, its users, and what's worked/failed. Use it. If the brief says "no emoji," don't use emoji. If it says "founder's wife is the sharpest user," write ideas that would make HER laugh and share.`

/**
 * Build a compact brief summary to inject into prompts.
 */
export interface BriefContext {
  product_one_liner?: string | null
  ideal_customer?: string | null
  customer_pain?: string | null
  why_we_win?: string | null
  what_worked?: string | null
  what_flopped?: string | null
  forbidden_tactics?: string | null
  voice_rules?: string | null
}

export function formatBriefForPrompt(brief: BriefContext | null): string {
  if (!brief) {
    return 'PRODUCT BRIEF: Not yet filled out. Remember: the product is Whozin. Ask the user for more context if needed, or use general best practices.'
  }
  const lines: string[] = ['PRODUCT BRIEF (for Whozin):']
  if (brief.product_one_liner) lines.push(`- Product: ${brief.product_one_liner}`)
  if (brief.ideal_customer) lines.push(`- Ideal customer: ${brief.ideal_customer}`)
  if (brief.customer_pain) lines.push(`- Pain we solve: ${brief.customer_pain}`)
  if (brief.why_we_win) lines.push(`- Why we win: ${brief.why_we_win}`)
  if (brief.what_worked) lines.push(`- What's worked before: ${brief.what_worked}`)
  if (brief.what_flopped) lines.push(`- What's flopped before: ${brief.what_flopped}`)
  if (brief.forbidden_tactics) lines.push(`- Off-limits: ${brief.forbidden_tactics}`)
  if (brief.voice_rules) lines.push(`- Voice rules: ${brief.voice_rules}`)
  return lines.join('\n')
}
