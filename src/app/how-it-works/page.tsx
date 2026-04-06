'use client'

import { useState, useEffect } from 'react'
import { MarketingShell, HeroNav, CtaSection } from '@/components/landing/marketing-shell'

export default function HowItWorksPage() {
  const [heroLoaded, setHeroLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <MarketingShell>
      {({ onSignIn }) => (
        <>
          {/* ═══════════════════════════════════════════════
              HERO
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

              <div className="max-w-3xl mx-auto text-center">
                <div className={`transition-all duration-700 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                  <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                    Here&apos;s how<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#60a5fa] to-[#818cf8] animate-gradient">
                      Whozin works.
                    </span>
                  </h1>
                  <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-lg mx-auto">
                    From creating an activity to filling every spot — the whole flow in plain English. No jargon. No fluff.
                  </p>
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
              THE FULL FLOW — Step by step
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-16">
                <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">The Full Flow</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Five steps. Start to finish.
                </h2>
              </div>

              <div className="space-y-8">
                {/* Step 1 */}
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-full bg-primary text-white text-xl font-extrabold flex items-center justify-center shadow-[0_4px_20px_rgba(66,133,244,0.35)]">1</div>
                    <div className="w-0.5 h-full bg-primary/20 mx-auto mt-2" />
                  </div>
                  <div className="pb-8">
                    <h3 className="text-xl font-extrabold text-foreground mb-2">Build Your Group</h3>
                    <p className="text-[15px] text-muted leading-relaxed mb-4">
                      Create a group for your activity — your golf crew, pickleball regulars, volleyball team. Add people by phone number or import from your contacts. This is your roster.
                    </p>
                    <div className="bg-surface rounded-xl p-4 border border-border/40">
                      <p className="text-[13px] text-muted"><strong className="text-foreground">Optional:</strong> Set a priority order. Your most reliable people go at the top. They get invited first when spots are limited.</p>
                    </div>
                    <a href="/groups" className="inline-flex items-center gap-2 text-primary font-bold text-[14px] hover:underline mt-3">
                      Learn about Groups & Priority
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </a>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-full bg-primary text-white text-xl font-extrabold flex items-center justify-center shadow-[0_4px_20px_rgba(66,133,244,0.35)]">2</div>
                    <div className="w-0.5 h-full bg-primary/20 mx-auto mt-2" />
                  </div>
                  <div className="pb-8">
                    <h3 className="text-xl font-extrabold text-foreground mb-2">Create an Activity</h3>
                    <p className="text-[15px] text-muted leading-relaxed mb-4">
                      Name it. Set the date, time, and location. Choose how many spots are open. Pick which group to invite. Takes under 30 seconds.
                    </p>
                    <div className="bg-surface rounded-xl p-4 border border-border/40">
                      <p className="text-[13px] text-muted"><strong className="text-foreground">Two invite modes:</strong> Blast to everyone at once, or use Priority Order to invite your top people first and fill remaining spots down the list.</p>
                    </div>
                    <a href="/build" className="inline-flex items-center gap-2 text-primary font-bold text-[14px] hover:underline mt-3">
                      Learn about Build
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </a>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-full bg-primary text-white text-xl font-extrabold flex items-center justify-center shadow-[0_4px_20px_rgba(66,133,244,0.35)]">3</div>
                    <div className="w-0.5 h-full bg-primary/20 mx-auto mt-2" />
                  </div>
                  <div className="pb-8">
                    <h3 className="text-xl font-extrabold text-foreground mb-2">They Get a Text</h3>
                    <p className="text-[15px] text-muted leading-relaxed mb-4">
                      Your group gets a text message: &ldquo;Are you in for Friday Basketball?&rdquo; They reply <strong className="text-foreground">IN</strong> or <strong className="text-foreground">OUT</strong>. That&apos;s it.
                    </p>
                    <div className="bg-[#34c759]/5 rounded-xl p-4 border border-[#34c759]/15">
                      <p className="text-[13px] text-[#15803d]"><strong>Zero friction:</strong> No app download. No account creation. No login. They just reply to a text. That&apos;s the whole point.</p>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-full bg-primary text-white text-xl font-extrabold flex items-center justify-center shadow-[0_4px_20px_rgba(66,133,244,0.35)]">4</div>
                    <div className="w-0.5 h-full bg-primary/20 mx-auto mt-2" />
                  </div>
                  <div className="pb-8">
                    <h3 className="text-xl font-extrabold text-foreground mb-2">The Group Builds Itself</h3>
                    <p className="text-[15px] text-muted leading-relaxed mb-4">
                      Watch responses come in live. Spots fill as people reply IN. If you used Priority Order, spots fill from the top of your list down. When it&apos;s full, everyone else goes on the waitlist.
                    </p>
                    <div className="bg-surface rounded-xl p-4 border border-border/40">
                      <p className="text-[13px] text-muted"><strong className="text-foreground">You don&apos;t chase anyone.</strong> You don&apos;t count heads. You don&apos;t wonder who&apos;s coming. You just watch it fill.</p>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-full bg-[#34c759] text-white text-xl font-extrabold flex items-center justify-center shadow-[0_4px_20px_rgba(52,199,89,0.35)]">5</div>
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-foreground mb-2">Someone Bails? It Fills Itself.</h3>
                    <p className="text-[15px] text-muted leading-relaxed mb-4">
                      Game day. Someone drops out. Whozin handles it. Emergency Fill blasts the group. Auto Emergency Fill does it without you lifting a finger. The spot fills in seconds. The game happens.
                    </p>
                    <a href="/fill" className="inline-flex items-center gap-2 text-[#34c759] font-bold text-[14px] hover:underline">
                      Learn about Fill
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              SUMMARY — The before and after
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28 bg-surface">
            <div className="max-w-4xl mx-auto px-6">
              <div className="text-center mb-14">
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  The bottom line.
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-border/60 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-red-500" />
                  <h3 className="text-[17px] font-bold text-foreground mb-4">The old way</h3>
                  <ul className="space-y-3 text-[14px] text-muted">
                    <li>Text everyone individually</li>
                    <li>Chase RSVPs for days</li>
                    <li>Count heads manually</li>
                    <li>Panic when someone bails</li>
                    <li>Cancel when you can&apos;t fill the spot</li>
                    <li>Do it all again next week</li>
                  </ul>
                  <div className="mt-5 pt-4 border-t border-border/40">
                    <p className="text-[13px] font-bold text-red-500">Time: hours per week</p>
                  </div>
                </div>

                <div className="bg-white border border-[#34c759]/20 rounded-2xl p-6 relative overflow-hidden shadow-[0_4px_20px_rgba(52,199,89,0.08)]">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#34c759] to-[#22d3ee]" />
                  <h3 className="text-[17px] font-bold text-foreground mb-4">The Whozin way</h3>
                  <ul className="space-y-3 text-[14px] text-foreground font-medium">
                    <li>Build your group once</li>
                    <li>Create an activity in 30 seconds</li>
                    <li>Group fills itself via text</li>
                    <li>Someone bails? Auto-filled.</li>
                    <li>Game happens. Every time.</li>
                    <li>You just show up and play</li>
                  </ul>
                  <div className="mt-5 pt-4 border-t border-[#34c759]/10">
                    <p className="text-[13px] font-bold text-[#34c759]">Time: 30 seconds</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              DEEP DIVES
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28">
            <div className="max-w-4xl mx-auto px-6">
              <div className="text-center mb-10">
                <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">Go Deeper</p>
                <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                  Learn more about each piece.
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-5">
                <a href="/build" className="group bg-white rounded-2xl p-6 border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(66,133,244,0.12)] hover:border-primary/30 transition-all duration-300">
                  <span className="text-3xl block mb-3">🏗️</span>
                  <h3 className="text-[16px] font-bold text-foreground mb-1 group-hover:text-primary transition-colors">Build</h3>
                  <p className="text-[13px] text-muted leading-relaxed">Create an activity, set spots, choose priority or blast all.</p>
                </a>
                <a href="/groups" className="group bg-white rounded-2xl p-6 border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(66,133,244,0.12)] hover:border-primary/30 transition-all duration-300">
                  <span className="text-3xl block mb-3">👥</span>
                  <h3 className="text-[16px] font-bold text-foreground mb-1 group-hover:text-primary transition-colors">Groups</h3>
                  <p className="text-[13px] text-muted leading-relaxed">Smart Groups, priority order, and your inner circle.</p>
                </a>
                <a href="/fill" className="group bg-white rounded-2xl p-6 border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(66,133,244,0.12)] hover:border-primary/30 transition-all duration-300">
                  <span className="text-3xl block mb-3">⚡</span>
                  <h3 className="text-[16px] font-bold text-foreground mb-1 group-hover:text-primary transition-colors">Fill</h3>
                  <p className="text-[13px] text-muted leading-relaxed">Three ways to fill a spot when someone bails.</p>
                </a>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              FINAL CTA
              ═══════════════════════════════════════════════ */}
          <CtaSection
            onSignIn={onSignIn}
            headline={<>Now you know how it works.<br /><span className="text-primary">Try it.</span></>}
            subheadline="Set up your first activity in under 30 seconds. Your group will thank you."
            buttonText="Get Started — Free"
          />
        </>
      )}
    </MarketingShell>
  )
}
