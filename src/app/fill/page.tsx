'use client'

import { useState, useEffect } from 'react'
import { MarketingShell, HeroNav, CtaSection, useInView } from '@/components/landing/marketing-shell'

/* ── Animated waitlist demo ── */
function WaitlistDemo() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1500),
      setTimeout(() => setStep(2), 3200),
      setTimeout(() => setStep(3), 4800),
      setTimeout(() => setStep(4), 6200),
    ]
    const loop = setTimeout(() => setStep(0), 8500)
    return () => { timers.forEach(clearTimeout); clearTimeout(loop) }
  }, [step === 0 ? 0 : undefined]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-5 backdrop-blur-sm">
      <div className="bg-white/[0.06] rounded-2xl p-4 mb-3">
        <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1">Tonight</p>
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🏀</span>
          <div>
            <p className="text-white font-bold text-lg leading-tight">Friday Basketball</p>
            <p className="text-white/50 text-sm">7:00 PM · Downtown Gym · 5 spots</p>
          </div>
        </div>
      </div>

      {/* Roster */}
      <p className="text-white/30 text-[11px] font-semibold uppercase tracking-wider mb-3 px-1">Roster (5/5)</p>
      <div className="space-y-2">
        {['Sarah M.', 'Jake R.', 'Alex W.', 'Dev P.'].map((name, i) => (
          <div key={i} className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-white/10">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">{name[0]}</div>
            <span className="text-white/90 text-sm font-medium flex-1">{name}</span>
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-[#34c759]/20 text-[#34c759] border border-[#34c759]/30">IN</span>
          </div>
        ))}

        {/* Mike - the one who bails */}
        <div className={`flex items-center gap-2.5 backdrop-blur-md rounded-2xl px-4 py-2.5 border transition-all duration-500 ${
          step >= 1 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/10 border-white/10'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${step >= 1 ? 'bg-red-500/20 text-red-400' : 'bg-white/20 text-white'}`}>M</div>
          <span className={`text-sm font-medium flex-1 ${step >= 1 ? 'text-red-400/70 line-through' : 'text-white/90'}`}>Mike T.</span>
          <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
            step >= 1 ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-[#34c759]/20 text-[#34c759] border border-[#34c759]/30'
          }`}>{step >= 1 ? 'BAILED' : 'IN'}</span>
        </div>
      </div>

      {/* Waitlist */}
      {step >= 2 && (
        <div className="mt-3 animate-enter">
          <p className="text-white/30 text-[11px] font-semibold uppercase tracking-wider mb-2 px-1">Waitlist</p>
          <div className={`flex items-center gap-2.5 backdrop-blur-md rounded-2xl px-4 py-2.5 border transition-all duration-500 ${
            step >= 4 ? 'bg-[#34c759]/10 border-[#34c759]/20' : 'bg-primary/10 border-primary/20'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              step >= 4 ? 'bg-[#34c759]/20 text-[#34c759]' : 'bg-primary/20 text-primary'
            }`}>C</div>
            <span className="text-white/90 text-sm font-medium flex-1">Chris L.</span>
            <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
              step >= 4 ? 'bg-[#34c759]/20 text-[#34c759] border border-[#34c759]/30' : 'bg-primary/20 text-primary border border-primary/30'
            }`}>{step >= 4 ? 'PROMOTED!' : step >= 3 ? 'TEXTED...' : 'NEXT UP'}</span>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mt-4 px-1">
        {step === 0 && <span className="text-[#34c759] text-sm font-bold">5/5 Full</span>}
        {step === 1 && (
          <div className="flex items-center gap-2 animate-enter">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-red-400 text-sm font-bold">Mike bailed! 4/5 — auto-filling...</span>
          </div>
        )}
        {step === 2 && (
          <div className="flex items-center gap-2 animate-enter">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-primary text-sm font-bold">Texting Chris L. (next on waitlist)...</span>
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
            <span className="text-white/40 text-xs">Filled in 38 seconds</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FillPage() {
  const [heroLoaded, setHeroLoaded] = useState(false)
  const problemSection = useInView()
  const agitateSection = useInView()
  const solveSection = useInView()
  const comparisonSection = useInView()

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <MarketingShell>
      {({ onSignIn }) => (
        <>
          {/* ═══════════════════════════════════════════════
              HERO — Auto-Waitlist
              ═══════════════════════════════════════════════ */}
          <section className="relative bg-[#0a0f1e] overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-red-500/15 blur-[120px] animate-float-slow pointer-events-none" />
            <div className="absolute bottom-[-30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-[#34c759]/10 blur-[100px] animate-float pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }} />

            <div className="relative max-w-6xl mx-auto px-6 pt-8 pb-16 md:pb-24">
              <HeroNav onSignIn={onSignIn} />

              <div className="md:flex md:items-center md:gap-16">
                <div className="flex-1 mb-12 md:mb-0">
                  <div className={`transition-all duration-700 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 mb-6">
                      <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-red-300 text-xs font-medium tracking-wide uppercase">Someone just bailed</span>
                    </div>

                    <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                      2 hours to game time.<br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34c759] via-[#4ade80] to-[#22d3ee] animate-gradient">
                        You&apos;re short one.
                      </span>
                    </h1>
                    <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-md mb-3">
                      We&apos;ve all been there. Someone bails. Now you&apos;re panic-texting 15 people to find a replacement.
                    </p>
                    <p className="text-white/80 text-lg md:text-xl font-semibold max-w-md mb-8">
                      Whozin&apos;s auto-waitlist fills the spot before you even notice.
                    </p>

                    <button
                      onClick={onSignIn}
                      className="px-8 py-4 rounded-2xl bg-[#34c759] text-white font-bold text-base hover:bg-[#2db84e] active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(52,199,89,0.4)] hover:shadow-[0_8px_32px_rgba(52,199,89,0.5)]"
                    >
                      Never Cancel Again — Free
                    </button>
                  </div>
                </div>

                <div className={`flex-1 max-w-md mx-auto md:mx-0 transition-all duration-700 delay-300 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                  <WaitlistDemo />
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0">
              <svg viewBox="0 0 1440 80" fill="none" className="w-full block">
                <path d="M0 40C360 80 720 0 1080 40C1260 60 1380 50 1440 40V80H0V40Z" fill="white" />
              </svg>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              PROBLEM — The last-minute cancellation nightmare
              ═══════════════════════════════════════════════ */}
          <section ref={problemSection.ref} className="py-20 md:py-28">
            <div className={`max-w-3xl mx-auto px-6 transition-all duration-700 ${problemSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-14">
                <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">The Problem</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Cancellations don&apos;t ruin games.<br /><em className="not-italic text-red-500">Unfilled spots</em> ruin games.
                </h2>
                <p className="text-muted text-lg mt-4 max-w-xl mx-auto">
                  People will always bail. That&apos;s life. The real problem is what happens next.
                </p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              AGITATION — The old way
              ═══════════════════════════════════════════════ */}
          <section ref={agitateSection.ref} className="py-16 md:py-20 bg-surface">
            <div className={`max-w-3xl mx-auto px-6 transition-all duration-700 ${agitateSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                  What you do right now when someone bails:
                </h2>
              </div>

              <div className="space-y-4 max-w-2xl mx-auto">
                {[
                  { num: '5:02 PM', text: 'Mike texts "can\'t make it tonight, sorry"' },
                  { num: '5:03 PM', text: 'You text Sarah. No response.' },
                  { num: '5:08 PM', text: 'You text Jake. "Can\'t tonight."' },
                  { num: '5:12 PM', text: 'You text 4 more people individually.' },
                  { num: '5:25 PM', text: 'You post desperately in the group chat.' },
                  { num: '5:41 PM', text: 'Still no response. Game is at 7.' },
                  { num: '6:15 PM', text: 'Someone\'s cousin says they "might" come.' },
                  { num: '6:58 PM', text: 'You cancel. Again.' },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-4 bg-white rounded-xl p-4 border border-border/60">
                    <span className="text-[12px] font-bold text-red-500 bg-red-50 rounded-lg px-2.5 py-1 flex-shrink-0 font-mono">{step.num}</span>
                    <p className="text-[14px] text-muted leading-relaxed">{step.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 text-center">
                <p className="text-foreground font-bold text-lg">Total time wasted: 1 hour 56 minutes.</p>
                <p className="text-red-500 font-semibold mt-1">Result: Game cancelled anyway.</p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              SOLUTION — Auto-Waitlist
              ═══════════════════════════════════════════════ */}
          <section ref={solveSection.ref} className="py-20 md:py-28">
            <div className={`max-w-4xl mx-auto px-6 transition-all duration-700 ${solveSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-14">
                <p className="text-[#34c759] text-sm font-bold uppercase tracking-widest mb-3">The Solution</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  What Whozin does instead:
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">👋</span>
                  </div>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Someone Drops</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Mike taps OUT. The spot opens instantly.</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📱</span>
                  </div>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Auto-Text Sent</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Whozin texts the next person on the waitlist. Instantly. No input from you.</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-[#34c759]/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✅</span>
                  </div>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Spot Filled</h3>
                  <p className="text-[14px] text-muted leading-relaxed">They reply IN. If they pass, Whozin texts the next person. Automatic.</p>
                </div>
              </div>

              <div className="mt-12 text-center">
                <div className="inline-block bg-[#34c759]/10 border border-[#34c759]/20 rounded-2xl px-8 py-4">
                  <p className="text-[#34c759] font-extrabold text-2xl">Average fill time: 47 seconds.</p>
                  <p className="text-muted text-sm mt-1">Your time spent: zero.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              COMPARISON
              ═══════════════════════════════════════════════ */}
          <section ref={comparisonSection.ref} className="py-16 md:py-20 bg-surface">
            <div className={`max-w-4xl mx-auto px-6 transition-all duration-700 ${comparisonSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-border/60 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-red-500" />
                  <h3 className="text-[17px] font-bold text-foreground mb-4">Without Whozin</h3>
                  <ul className="space-y-3 text-[14px] text-muted">
                    <li>1 hour+ chasing replacements</li>
                    <li>10+ individual texts sent</li>
                    <li>Stress through the roof</li>
                    <li>Game cancelled 40% of the time</li>
                  </ul>
                </div>
                <div className="bg-white border border-[#34c759]/20 rounded-2xl p-6 relative overflow-hidden shadow-[0_4px_20px_rgba(52,199,89,0.08)]">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#34c759] to-[#22d3ee]" />
                  <h3 className="text-[17px] font-bold text-foreground mb-4">With Whozin</h3>
                  <ul className="space-y-3 text-[14px] text-foreground font-medium">
                    <li>0 minutes of your time</li>
                    <li>0 texts you need to send</li>
                    <li>Spot filled automatically</li>
                    <li>Game happens. Every time.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              ZERO APP CALLOUT
              ═══════════════════════════════════════════════ */}
          <section className="py-16 md:py-20">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mb-4">
                Your waitlist doesn&apos;t need the app.
              </h2>
              <p className="text-muted text-lg max-w-xl mx-auto">
                They get a text. They reply IN or OUT. That&apos;s it. No download. No account. No excuse not to respond.
              </p>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              FINAL CTA
              ═══════════════════════════════════════════════ */}
          <CtaSection
            onSignIn={onSignIn}
            headline={<>Stop chasing subs.<br /><span className="text-[#34c759]">Let Whozin fill the spot.</span></>}
            subheadline="Build your waitlist once. Next time someone bails, you won't even notice."
            buttonText="Never Cancel Again — Free"
            footnote="Free forever. No credit card. Waitlisted people respond via text — no app needed."
          />
        </>
      )}
    </MarketingShell>
  )
}
