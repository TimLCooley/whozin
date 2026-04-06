'use client'

import { useState, useEffect } from 'react'
import { MarketingShell, HeroNav, CtaSection, useInView } from '@/components/landing/marketing-shell'

export default function BuildPage() {
  const [heroLoaded, setHeroLoaded] = useState(false)
  const problemSection = useInView()
  const agitateSection = useInView()
  const solveSection = useInView()
  const featuresSection = useInView()

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <MarketingShell>
      {({ onSignIn }) => (
        <>
          {/* ═══════════════════════════════════════════════
              HERO — Build Your Crew
              ═══════════════════════════════════════════════ */}
          <section className="relative bg-[#0a0f1e] overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/20 blur-[120px] animate-float-slow pointer-events-none" />
            <div className="absolute bottom-[-30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-[#6366f1]/15 blur-[100px] animate-float pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }} />

            <div className="relative max-w-6xl mx-auto px-6 pt-8 pb-16 md:pb-24">
              <HeroNav onSignIn={onSignIn} />

              <div className="max-w-3xl">
                <div className={`transition-all duration-700 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                  <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-primary/80 text-xs font-medium tracking-wide uppercase">Smart Groups & Priority Invites</span>
                  </div>

                  <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                    Build your<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#60a5fa] to-[#818cf8] animate-gradient">
                      inner circle.
                    </span>
                  </h1>
                  <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-lg mb-8">
                    You know who shows up and who flakes. Whozin lets you build a crew based on reliability — not just who&apos;s in the group chat.
                  </p>

                  <button
                    onClick={onSignIn}
                    className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-base hover:bg-primary-dark active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(66,133,244,0.4)] hover:shadow-[0_8px_32px_rgba(66,133,244,0.5)]"
                  >
                    Build Your First Group — Free
                  </button>
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
              PROBLEM — Unreliable people ruin everything
              ═══════════════════════════════════════════════ */}
          <section ref={problemSection.ref} className="py-20 md:py-28">
            <div className={`max-w-3xl mx-auto px-6 transition-all duration-700 ${problemSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-14">
                <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">The Problem</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  You don&apos;t have a headcount problem.<br />You have a <em className="not-italic text-red-500">reliability</em> problem.
                </h2>
              </div>

              <div className="space-y-5 max-w-2xl mx-auto">
                <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                  <p className="text-[15px] font-semibold text-red-800">You invite 15 people because you know only 8 will respond.</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                  <p className="text-[15px] font-semibold text-red-800">Half the group says &ldquo;maybe.&rdquo; Which means no.</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                  <p className="text-[15px] font-semibold text-red-800">Your most reliable people get buried in a group text with 20 flakers.</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                  <p className="text-[15px] font-semibold text-red-800">You treat everyone the same — even though they&apos;re not.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              AGITATION — What this costs you
              ═══════════════════════════════════════════════ */}
          <section ref={agitateSection.ref} className="py-16 md:py-20 bg-surface">
            <div className={`max-w-3xl mx-auto px-6 transition-all duration-700 ${agitateSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                  This is what equal invites cost you.
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">⏰</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Time Tax</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Every activity means 30+ minutes chasing RSVPs. That&apos;s hours each month you&apos;re not getting back.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">😤</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Organizer Burnout</h3>
                  <p className="text-[14px] text-muted leading-relaxed">You&apos;re one &ldquo;I&apos;ll let you know&rdquo; away from quitting. The mental load is real.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">🚫</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Cancelled Games</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Not because nobody wants to play. Because nobody committed fast enough.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">👻</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Ghost RSVPs</h3>
                  <p className="text-[14px] text-muted leading-relaxed">&ldquo;Yeah I&apos;m in!&rdquo; ...then silence. No show. No text. You&apos;re short a player at game time.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              SOLUTION — Smart Groups + Priority Invites
              ═══════════════════════════════════════════════ */}
          <section ref={solveSection.ref} className="py-20 md:py-28">
            <div className={`max-w-4xl mx-auto px-6 transition-all duration-700 ${solveSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-14">
                <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">The Solution</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Rank your people. Reward reliability.
                </h2>
                <p className="text-muted text-lg mt-4 max-w-2xl mx-auto">
                  Whozin doesn&apos;t blast everyone at once. It invites in order — your most reliable people get first dibs.
                </p>
              </div>

              <div className="md:flex md:items-start md:gap-12">
                {/* Smart Groups */}
                <div className="flex-1 mb-10 md:mb-0">
                  <div className="bg-white rounded-2xl p-6 border border-primary/20 shadow-[0_4px_20px_rgba(66,133,244,0.08)]">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-[#818cf8] rounded-t-2xl" />
                    <h3 className="text-xl font-extrabold text-foreground mb-3 flex items-center gap-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 21v-1a5 5 0 0110 0v1M14 21v-1a4 4 0 018 0v1" />
                      </svg>
                      Smart Groups
                    </h3>
                    <p className="text-[14px] text-muted leading-relaxed mb-4">
                      Create groups for each activity — basketball crew, golf foursome, dinner club. Reuse them every time.
                    </p>
                    <ul className="space-y-2.5">
                      {[
                        'One tap to invite your entire group',
                        'Add or remove people anytime',
                        'Multiple groups for different activities',
                        'Import contacts from your phone',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="mt-1 w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={3} strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </span>
                          <span className="text-[13px] text-muted">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Priority Invites */}
                <div className="flex-1">
                  <div className="bg-white rounded-2xl p-6 border border-[#34c759]/20 shadow-[0_4px_20px_rgba(52,199,89,0.08)]">
                    <h3 className="text-xl font-extrabold text-foreground mb-3 flex items-center gap-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 6h16M4 12h16M4 18h7" /><path d="M16 16l2 2 4-4" />
                      </svg>
                      Priority Invites
                    </h3>
                    <p className="text-[14px] text-muted leading-relaxed mb-4">
                      Set the order. When spots are limited, Whozin contacts people by priority until it&apos;s full. First dibs for your ride-or-dies.
                    </p>
                    <ul className="space-y-2.5">
                      {[
                        'Drag to rank — most reliable at the top',
                        'Spots fill in priority order automatically',
                        'Late responders go to the waitlist',
                        'Nobody hogs spots they won\'t use',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="mt-1 w-4 h-4 rounded-full bg-[#34c759]/10 flex items-center justify-center flex-shrink-0">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={3} strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                          </span>
                          <span className="text-[13px] text-muted">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              ZERO FRICTION CALLOUT
              ═══════════════════════════════════════════════ */}
          <section ref={featuresSection.ref} className="py-16 md:py-20 bg-surface">
            <div className={`max-w-3xl mx-auto px-6 text-center transition-all duration-700 ${featuresSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="bg-[#0a0f1e] rounded-3xl p-8 md:p-12 relative overflow-hidden">
                <div className="absolute top-[-50%] left-[-20%] w-[400px] h-[400px] rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
                <div className="absolute bottom-[-50%] right-[-20%] w-[300px] h-[300px] rounded-full bg-[#6366f1]/10 blur-[80px] pointer-events-none" />

                <div className="relative">
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
                    Your friends don&apos;t need the app.
                  </h2>
                  <p className="text-white/60 text-lg leading-relaxed max-w-xl mx-auto mb-6">
                    That&apos;s the whole point. You build the group. You set the priorities. They just get a text and reply IN or OUT. No download. No account. No friction.
                  </p>
                  <p className="text-white/40 text-sm font-medium">
                    You&apos;re the organizer. They&apos;re the responders. Everyone wins.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              FINAL CTA
              ═══════════════════════════════════════════════ */}
          <CtaSection
            onSignIn={onSignIn}
            headline={<>Stop inviting everyone.<br /><span className="text-primary">Start inviting the right people.</span></>}
            subheadline="Build your first smart group in under a minute. Your most reliable people get first dibs."
            buttonText="Build Your Crew — Free"
          />
        </>
      )}
    </MarketingShell>
  )
}
