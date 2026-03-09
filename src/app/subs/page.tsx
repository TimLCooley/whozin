'use client'

import { useState, useEffect, useRef } from 'react'
import AuthForm from '@/components/auth/auth-form'
import { BrandedFullLogo } from '@/components/ui/branded-logo'
import { ContactModal } from '@/components/ui/contact-modal'

/* ── Scroll-triggered visibility hook ── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ── Animated phone screen showing the sub-fill flow ── */
function SubFillDemo() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1200),   // "Mike" drops out
      setTimeout(() => setStep(2), 2800),   // Whozin auto-invites next
      setTimeout(() => setStep(3), 4200),   // Sub confirms
      setTimeout(() => setStep(4), 5600),   // Spot filled
    ]
    const loop = setTimeout(() => setStep(0), 8000)
    return () => { timers.forEach(clearTimeout); clearTimeout(loop) }
  }, [step === 0 ? 0 : undefined]) // eslint-disable-line react-hooks/exhaustive-deps

  const players = [
    { name: 'Sarah M.', status: 'in', avatar: 'S' },
    { name: 'Jake R.', status: 'in', avatar: 'J' },
    { name: step >= 1 ? 'Mike T.' : 'Mike T.', status: step >= 1 ? 'out' : 'in', avatar: 'M' },
    { name: 'Alex W.', status: 'in', avatar: 'A' },
    { name: 'Dev P.', status: 'in', avatar: 'D' },
  ]

  const subPlayer = { name: 'Chris L.', avatar: 'C' }

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-5 backdrop-blur-sm">
      {/* Activity header */}
      <div className="bg-white/[0.06] rounded-2xl p-4 mb-3">
        <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1">Tonight</p>
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🏐</span>
          <div>
            <p className="text-white font-bold text-lg leading-tight">Tuesday Volleyball</p>
            <p className="text-white/50 text-sm">6:00 PM · Sandbar Courts</p>
          </div>
        </div>
      </div>

      {/* Roster */}
      <p className="text-white/30 text-[11px] font-semibold uppercase tracking-wider mb-3 px-1">Roster</p>
      <div className="space-y-2">
        {players.map((p, i) => {
          const isDropout = p.name === 'Mike T.' && step >= 1
          const isReplaced = p.name === 'Mike T.' && step >= 4

          if (isReplaced) {
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 bg-[#34c759]/10 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-[#34c759]/20 transition-all duration-500"
              >
                <div className="w-8 h-8 rounded-full bg-[#34c759]/20 flex items-center justify-center text-sm font-bold text-[#34c759] flex-shrink-0">
                  {subPlayer.avatar}
                </div>
                <span className="text-white/90 text-sm font-medium flex-1">{subPlayer.name}</span>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-[#34c759]/20 text-[#34c759] border border-[#34c759]/30">
                  SUBBED IN!
                </span>
              </div>
            )
          }

          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 backdrop-blur-md rounded-2xl px-4 py-2.5 border transition-all duration-500 ${
                isDropout
                  ? 'bg-red-500/10 border-red-500/20'
                  : 'bg-white/10 border-white/10'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                isDropout ? 'bg-red-500/20 text-red-400' : 'bg-white/20 text-white'
              }`}>
                {p.avatar}
              </div>
              <span className={`text-sm font-medium flex-1 ${isDropout ? 'text-red-400/70 line-through' : 'text-white/90'}`}>
                {p.name}
              </span>
              <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                isDropout
                  ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                  : 'bg-[#34c759]/20 text-[#34c759] border border-[#34c759]/30'
              }`}>
                {isDropout ? 'DROPPED' : "I'M IN!"}
              </span>
            </div>
          )
        })}
      </div>

      {/* Status bar */}
      <div className="mt-4 px-1">
        {step === 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[#34c759] text-sm font-bold">5/5 Full</span>
            <span className="text-white/25 text-xs">All spots filled</span>
          </div>
        )}
        {step === 1 && (
          <div className="flex items-center gap-2 animate-enter">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-red-400 text-sm font-bold">Spot open! Mike dropped out...</span>
          </div>
        )}
        {step === 2 && (
          <div className="flex items-center gap-2 animate-enter">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-primary text-sm font-bold">Auto-inviting Chris L. (next on list)...</span>
          </div>
        )}
        {step === 3 && (
          <div className="flex items-center gap-2 animate-enter">
            <span className="w-2 h-2 rounded-full bg-[#34c759] animate-pulse" />
            <span className="text-[#34c759] text-sm font-bold">Chris replied: &quot;I&apos;M IN!&quot;</span>
          </div>
        )}
        {step === 4 && (
          <div className="flex items-center justify-between animate-enter">
            <span className="text-[#34c759] text-sm font-bold">5/5 Full again!</span>
            <span className="text-white/40 text-xs">Filled in 47 seconds</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Pain Point Card ── */
function PainCard({ emoji, pain, fix, delay }: { emoji: string; pain: string; fix: string; delay: number }) {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      className={`${visible ? 'animate-pop-in' : 'opacity-0'}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="bg-red-50 border border-red-100 rounded-2xl p-5 mb-2">
        <span className="text-2xl mr-2">{emoji}</span>
        <span className="text-[15px] font-semibold text-red-800">{pain}</span>
      </div>
      <div className="bg-[#34c759]/5 border border-[#34c759]/15 rounded-2xl p-5 ml-6">
        <span className="text-[15px] font-semibold text-[#15803d]">With Whozin → {fix}</span>
      </div>
    </div>
  )
}

/* ── Step Card ── */
function StepCard({ num, title, desc, delay }: { num: number; title: string; desc: string; delay: number }) {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      className={`relative text-center ${visible ? 'animate-pop-in' : 'opacity-0'}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="w-14 h-14 rounded-full bg-primary text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-4 shadow-[0_4px_20px_rgba(66,133,244,0.35)]">
        {num}
      </div>
      <h3 className="text-[16px] font-bold text-foreground mb-1">{title}</h3>
      <p className="text-[14px] text-muted leading-relaxed">{desc}</p>
    </div>
  )
}

/* ── Main Subs Landing Page ── */
export default function SubsLandingPage() {
  const [showAuth, setShowAuth] = useState(false)
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const ctaSection = useInView()

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  if (showAuth) {
    return <AuthForm onBack={() => setShowAuth(false)} />
  }

  return (
    <main className="min-h-dvh bg-background overflow-x-hidden">

      {/* ═══════════════════════════════════════════════
          HERO — "Need a Sub? You're In."
          ═══════════════════════════════════════════════ */}
      <section className="relative bg-[#0a0f1e] overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-red-500/15 blur-[120px] animate-float-slow pointer-events-none" />
        <div className="absolute bottom-[-30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-[#34c759]/10 blur-[100px] animate-float pointer-events-none" />

        {/* Dot pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />

        <div className="relative max-w-6xl mx-auto px-6 pt-8 pb-16 md:pb-24">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-16 md:mb-24">
            <BrandedFullLogo className="h-9" />
            <button
              onClick={() => setShowAuth(true)}
              className="text-white/80 hover:text-white text-sm font-semibold px-5 py-2.5 rounded-xl border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all"
            >
              Sign In
            </button>
          </nav>

          {/* Hero content */}
          <div className="md:flex md:items-center md:gap-16">
            {/* Left: Text */}
            <div className="flex-1 mb-12 md:mb-0">
              <div className={`transition-all duration-700 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 mb-6">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-red-300 text-xs font-medium tracking-wide uppercase">Someone just bailed</span>
                </div>

                <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                  Need a Sub?<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34c759] via-[#4ade80] to-[#22d3ee] animate-gradient">
                    You&apos;re In.
                  </span>
                </h1>
                <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-md mb-8">
                  Stop texting 15 people when someone drops out. Whozin auto-fills your empty spot from your backup list in seconds.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowAuth(true)}
                    className="px-8 py-4 rounded-2xl bg-[#34c759] text-white font-bold text-base hover:bg-[#2db84e] active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(52,199,89,0.4)] hover:shadow-[0_8px_32px_rgba(52,199,89,0.5)]"
                  >
                    Build Your Sub List — Free
                  </button>
                  <a
                    href="#how-it-works"
                    className="px-8 py-4 rounded-2xl text-white/80 font-semibold text-base border border-white/15 hover:bg-white/5 hover:border-white/25 transition-all text-center"
                  >
                    See How It Works
                  </a>
                </div>
              </div>
            </div>

            {/* Right: Animated sub-fill demo */}
            <div className={`flex-1 max-w-md mx-auto md:mx-0 transition-all duration-700 delay-300 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
              <SubFillDemo />
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" className="w-full block">
            <path d="M0 40C360 80 720 0 1080 40C1260 60 1380 50 1440 40V80H0V40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          SOCIAL PROOF BAR — The numbers
          ═══════════════════════════════════════════════ */}
      <section className="py-10 border-b border-border/50">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap justify-center gap-x-12 gap-y-4 items-center">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-foreground">&lt; 60s</p>
            <p className="text-xs text-muted font-medium">Average Fill Time</p>
          </div>
          <div className="w-px h-8 bg-border/60 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-extrabold text-foreground">Zero</p>
            <p className="text-xs text-muted font-medium">Texts You Send</p>
          </div>
          <div className="w-px h-8 bg-border/60 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-extrabold text-foreground">Auto</p>
            <p className="text-xs text-muted font-medium">Priority Queue</p>
          </div>
          <div className="w-px h-8 bg-border/60 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-extrabold text-foreground">100%</p>
            <p className="text-xs text-muted font-medium">Free to Start</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          THE PROBLEM — Pain points everyone knows
          ═══════════════════════════════════════════════ */}
      <section className="py-20 md:py-28" id="the-problem">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">Sound Familiar?</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Someone always bails.
            </h2>
            <p className="text-muted text-lg mt-3 max-w-xl mx-auto">
              And then you spend the next hour doing this...
            </p>
          </div>

          <div className="space-y-6">
            <PainCard
              emoji="📱"
              pain="Text your whole contact list one by one"
              fix="Whozin auto-texts the next person on your list"
              delay={0}
            />
            <PainCard
              emoji="😰"
              pain="Post desperately in the Facebook group"
              fix="Your backup list is ranked and ready to go"
              delay={0.1}
            />
            <PainCard
              emoji="⏰"
              pain="Game is in 2 hours and nobody's responded"
              fix="Response timers auto-skip to the next person"
              delay={0.2}
            />
            <PainCard
              emoji="🚫"
              pain="Cancel the game because you're short one"
              fix="The spot fills itself. You just show up and play."
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          HOW IT WORKS — 3 steps
          ═══════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 bg-surface relative" id="how-it-works">
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #4285F4 0, #4285F4 1px, transparent 0, transparent 50%)',
          backgroundSize: '20px 20px',
        }} />

        <div className="relative max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Set it up once. Never chase again.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-8 relative">
            <div className="hidden md:block absolute top-7 left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-[2px] bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

            <StepCard
              num={1}
              delay={0}
              title="Build Your List"
              desc="Add your regulars and your subs. Drag to set priority — most reliable at the top."
            />
            <StepCard
              num={2}
              delay={0.15}
              title="Someone Drops Out"
              desc="It happens. Whozin instantly auto-invites the next person on your sub list via text."
            />
            <StepCard
              num={3}
              delay={0.3}
              title="Spot Filled"
              desc='They reply "IN" and the spot is filled. If they pass, Whozin moves to the next person. Automatic.'
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          COMPARISON — Old way vs Whozin
          ═══════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">The Difference</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Stop begging. Start playing.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Old way */}
            <div className="bg-surface border border-border/60 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-red-500" />
              <h3 className="text-[17px] font-bold text-foreground mb-4 flex items-center gap-2">
                <span className="text-red-500 text-xl">😤</span> Without Whozin
              </h3>
              <div className="space-y-3">
                {[
                  'Mike bails at 3pm for 6pm game',
                  'You text Sarah — no response',
                  'You text Jake — "can\'t tonight"',
                  'You text 5 more people...',
                  'Post on Facebook group as last resort',
                  'Random person shows up (maybe)',
                  '45 minutes of your life: gone',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-red-400">
                      {i + 1}
                    </span>
                    <span className="text-[14px] text-muted leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-border/40">
                <p className="text-[13px] font-bold text-red-500">Time spent: ~45 min</p>
                <p className="text-[13px] text-muted">Stress level: Through the roof</p>
              </div>
            </div>

            {/* Whozin way */}
            <div className="bg-white border border-[#34c759]/20 rounded-2xl p-6 relative overflow-hidden shadow-[0_4px_20px_rgba(52,199,89,0.08)]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#34c759] to-[#22d3ee]" />
              <h3 className="text-[17px] font-bold text-foreground mb-4 flex items-center gap-2">
                <span className="text-[#34c759] text-xl">😎</span> With Whozin
              </h3>
              <div className="space-y-3">
                {[
                  'Mike drops out in the app',
                  'Whozin auto-texts your next sub',
                  'Chris replies "IN" in 47 seconds',
                  'Spot filled. Game on.',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-[#34c759]/10 flex items-center justify-center flex-shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                    <span className="text-[14px] text-foreground leading-relaxed font-medium">{step}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-[#34c759]/10">
                <p className="text-[13px] font-bold text-[#34c759]">Time spent: 0 minutes</p>
                <p className="text-[13px] text-muted">You didn&apos;t even have to pick up your phone</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PERFECT FOR — Sport-specific callouts
          ═══════════════════════════════════════════════ */}
      <section className="py-16 bg-surface border-y border-border/40">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-center text-primary text-sm font-bold uppercase tracking-widest mb-8">Built For</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🏐', sport: 'Volleyball', pain: 'Need 6? Now you have 6.' },
              { icon: '🏀', sport: 'Basketball', pain: 'Never cancel over a missing 10th.' },
              { icon: '⚽', sport: 'Soccer', pain: 'Full squad, every week.' },
              { icon: '🎾', sport: 'Tennis/Pickleball', pain: 'Doubles partner in seconds.' },
            ].map((s) => (
              <div key={s.sport} className="bg-white border border-border/50 rounded-2xl p-5 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(66,133,244,0.12)] hover:border-primary/30 transition-all duration-300">
                <span className="text-4xl block mb-3">{s.icon}</span>
                <p className="text-[15px] font-bold text-foreground mb-1">{s.sport}</p>
                <p className="text-[12px] text-muted leading-snug">{s.pain}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          TESTIMONIAL / QUOTE SECTION
          ═══════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-[#0a0f1e] rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute top-[-50%] left-[-20%] w-[400px] h-[400px] rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
            <div className="absolute bottom-[-50%] right-[-20%] w-[300px] h-[300px] rounded-full bg-[#34c759]/10 blur-[80px] pointer-events-none" />

            <div className="relative">
              <p className="text-white/80 text-xl md:text-2xl font-semibold leading-relaxed mb-6">
                &ldquo;I used to spend 30 minutes texting around every time someone bailed on volleyball.
                Now I don&apos;t even know someone dropped — Whozin fills it before I notice.&rdquo;
              </p>
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-white font-bold text-sm">T</div>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm">Tim C.</p>
                  <p className="text-white/40 text-xs">Volleyball League Organizer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FINAL CTA — Strong close
          ═══════════════════════════════════════════════ */}
      <section
        ref={ctaSection.ref}
        className="py-24 md:py-32 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#34c759]/5 via-transparent to-primary/5" />

        <div className={`relative max-w-2xl mx-auto px-6 text-center transition-all duration-700 ${ctaSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#34c759]/10 mb-6">
            <span className="text-5xl">🏐</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4">
            Stop chasing subs.<br />
            <span className="text-[#34c759]">Start playing.</span>
          </h2>
          <p className="text-muted text-lg mb-8 max-w-md mx-auto">
            Build your sub list in 2 minutes. Next time someone bails, Whozin handles it.
          </p>

          <button
            onClick={() => setShowAuth(true)}
            className="px-10 py-4 rounded-2xl bg-[#34c759] text-white font-bold text-lg hover:bg-[#2db84e] active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(52,199,89,0.4)] hover:shadow-[0_8px_32px_rgba(52,199,89,0.5)]"
          >
            Build Your Sub List — Free
          </button>

          <p className="text-xs text-muted mt-4">Free forever. No credit card. Your subs don&apos;t need the app.</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════ */}
      <footer className="bg-[#0a0f1e] text-white/50 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <BrandedFullLogo className="h-8" />

            <div className="flex gap-6 text-xs">
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
              <button onClick={() => setShowContact(true)} className="hover:text-white transition-colors">Contact</button>
            </div>

            <p className="text-xs">&copy; {new Date().getFullYear()} Chumem, LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </main>
  )
}
