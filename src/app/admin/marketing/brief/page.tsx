'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Turn {
  role: 'assistant' | 'user'
  content: string
}

interface Brief {
  product_one_liner: string | null
  ideal_customer: string | null
  customer_pain: string | null
  why_we_win: string | null
  what_worked: string | null
  what_flopped: string | null
  forbidden_tactics: string | null
  voice_rules: string | null
  is_complete: boolean
  intake_conversation: Turn[]
}

export default function MarketingBriefPage() {
  const router = useRouter()
  const [conversation, setConversation] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [existingBrief, setExistingBrief] = useState<Brief | null>(null)
  const [mode, setMode] = useState<'loading' | 'review' | 'chat' | 'done'>('loading')
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadBrief = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/marketing/brief')
      const data = await res.json()
      if (res.ok && data.brief) {
        setExistingBrief(data.brief)
        if (data.brief.is_complete) {
          setMode('review')
        } else if (data.brief.intake_conversation?.length > 0) {
          setConversation(data.brief.intake_conversation)
          setMode('chat')
        } else {
          setMode('chat')
          startIntake()
        }
      } else {
        setMode('chat')
        startIntake()
      }
    } catch {
      setMode('chat')
      startIntake()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadBrief() }, [loadBrief])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [conversation, thinking])

  async function startIntake() {
    setThinking(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/marketing/brief/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: [] }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start intake')
      } else if (data.done) {
        await loadBrief()
      } else {
        setConversation(data.conversation ?? [{ role: 'assistant', content: data.message }])
      }
    } catch {
      setError('Network error')
    }
    setThinking(false)
  }

  async function send() {
    const message = input.trim()
    if (!message || thinking) return
    const nextConversation: Turn[] = [...conversation, { role: 'user', content: message }]
    setConversation(nextConversation)
    setInput('')
    setThinking(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/marketing/brief/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation, message }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Chat failed')
      } else if (data.done) {
        setMode('done')
        await loadBrief()
      } else {
        setConversation(data.conversation ?? [...nextConversation, { role: 'assistant', content: data.message }])
      }
    } catch {
      setError('Network error')
    }
    setThinking(false)
  }

  async function restart() {
    if (!confirm('Restart the intake? Your current answers will be cleared.')) return
    await fetch('/api/admin/marketing/brief', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intake_conversation: [], is_complete: false }),
    })
    setConversation([])
    setExistingBrief(null)
    setMode('chat')
    startIntake()
  }

  if (mode === 'loading') {
    return <div className="h-64 bg-surface rounded-2xl animate-pulse" />
  }

  if (mode === 'review' && existingBrief) {
    const fields: { key: keyof Brief; label: string }[] = [
      { key: 'product_one_liner', label: 'Product' },
      { key: 'ideal_customer', label: 'Ideal customer' },
      { key: 'customer_pain', label: 'The pain' },
      { key: 'why_we_win', label: 'Why we win' },
      { key: 'what_worked', label: "What's worked" },
      { key: 'what_flopped', label: "What's flopped" },
      { key: 'forbidden_tactics', label: 'Off-limits' },
      { key: 'voice_rules', label: 'Voice rules' },
    ]
    return (
      <div className="max-w-3xl">
        <div className="mb-6">
          <Link href="/admin/marketing" className="text-xs text-primary font-medium hover:underline">
            ← Back to Marketing
          </Link>
          <h2 className="text-2xl font-bold mt-2">Your CMO Brief</h2>
          <p className="text-sm text-muted mt-1">
            This is what your CMO knows about Whozin. Every suggestion pulls from here.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {fields.map((f) => (
            <div key={f.key} className="bg-background border border-border/50 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wide mb-1">{f.label}</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {(existingBrief[f.key] as string) || <span className="text-muted italic">(empty)</span>}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={restart}
            className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground"
          >
            Redo intake
          </button>
          <button
            onClick={() => router.push('/admin/marketing')}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold"
          >
            Continue to CMO
          </button>
        </div>
      </div>
    )
  }

  // chat / done mode
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/admin/marketing" className="text-xs text-primary font-medium hover:underline">
          ← Back to Marketing
        </Link>
        <h2 className="text-2xl font-bold mt-2">One-time CMO Setup</h2>
        <p className="text-sm text-muted mt-1">
          Your CMO asks ~8 questions. Takes 10 minutes. Everything is saved as you go.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="bg-background border border-border/50 rounded-2xl p-5 h-[60vh] overflow-y-auto space-y-4 mb-4"
      >
        {conversation.length === 0 && !thinking && (
          <p className="text-sm text-muted italic text-center">Starting...</p>
        )}
        {conversation.map((turn, i) => (
          <div
            key={i}
            className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl whitespace-pre-wrap ${
                turn.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-surface text-foreground rounded-bl-sm'
              }`}
            >
              <p className="text-sm">{turn.content}</p>
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-surface">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted rounded-full animate-pulse" />
                <span className="w-2 h-2 bg-muted rounded-full animate-pulse [animation-delay:0.15s]" />
                <span className="w-2 h-2 bg-muted rounded-full animate-pulse [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}
        {mode === 'done' && (
          <div className="flex justify-center">
            <div className="px-4 py-2 rounded-full bg-green-500/10 text-green-600 text-xs font-semibold">
              ✓ Brief complete. Loading...
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-xl bg-danger/10 text-danger text-sm mb-3">{error}</div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          disabled={thinking || mode === 'done'}
          placeholder={thinking ? 'CMO is thinking...' : 'Type your answer and hit enter'}
          className="input-field flex-1"
          autoFocus
        />
        <button
          onClick={send}
          disabled={thinking || !input.trim() || mode === 'done'}
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
