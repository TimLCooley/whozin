'use client'

import { useState, useEffect } from 'react'
import { MarketingShell, HeroNav, CtaSection, useInView } from '@/components/landing/marketing-shell'

/* ── Animated response bubble for the hero ── */
function ResponseBubble({ name, status, delay, avatar }: { name: string; status: 'in' | 'out'; delay: number; avatar: string }) {
  return (
    <div
      className="animate-response flex items-center gap-2.5 bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-white/10"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
        {avatar}
      </div>
      <span className="text-white/90 text-sm font-medium flex-1">{name}</span>
      <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
        status === 'in'
          ? 'bg-[#34c759]/20 text-[#34c759] border border-[#34c759]/30'
          : 'bg-white/10 text-white/50 border border-white/10'
      }`}>
        {status === 'in' ? "I'M IN!" : "I'M OUT"}
      </span>
    </div>
  )
}

/* ── Pain/Agitation Card ── */
function PainCard({ icon, text, delay }: { icon: string; text: string; delay: number }) {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      className={`flex items-start gap-4 ${visible ? 'animate-pop-in' : 'opacity-0'}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>
      <p className="text-[15px] text-muted leading-relaxed">{text}</p>
    </div>
  )
}

/* ── Main Landing Page ── */
export default function HomePage() {
  const [heroLoaded, setHeroLoaded] = useState(false)
  const agitationSection = useInView()
  const solutionSection = useInView()
  const howSection = useInView()
  const proofSection = useInView()

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <MarketingShell isHome>
      {({ onSignIn }) => (
        <>
          {/* ═══════════════════════════════════════════════
              HERO — Problem: Group Chat is Dead
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

              <div className="md:flex md:items-center md:gap-16">
                {/* Left: Copy */}
                <div className="flex-1 mb-12 md:mb-0">
                  <div className={`transition-all duration-700 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 mb-6">
                      <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-red-300 text-xs font-medium tracking-wide uppercase">Group chat is dead</span>
                    </div>

                    <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                      Stop begging.<br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#60a5fa] to-[#818cf8] animate-gradient">
                        Start organizing.
                      </span>
                    </h1>
                    <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-md mb-3">
                      You organize everything. You chase every response. You carry the mental load so everyone else can just show up.
                    </p>
                    <p className="text-white/80 text-lg md:text-xl font-semibold max-w-md mb-8">
                      Whozin makes you the hero. Not the babysitter.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={onSignIn}
                        className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-base hover:bg-primary-dark active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(66,133,244,0.4)] hover:shadow-[0_8px_32px_rgba(66,133,244,0.5)]"
                      >
                        Become the Organizer — Free
                      </button>
                      <a
                        href="#the-problem"
                        className="px-8 py-4 rounded-2xl text-white/80 font-semibold text-base border border-white/15 hover:bg-white/5 hover:border-white/25 transition-all text-center"
                      >
                        See the Problem
                      </a>
                    </div>
                  </div>
                </div>

                {/* Right: Animated response bubbles */}
                <div className={`flex-1 max-w-md mx-auto md:mx-0 transition-all duration-700 delay-300 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                  <div className="relative">
                    <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-5 backdrop-blur-sm">
                      <div className="bg-white/[0.06] rounded-2xl p-4 mb-3">
                        <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1">Activity</p>
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">🏀</span>
                          <div>
                            <p className="text-white font-bold text-lg leading-tight">Friday Night Basketball</p>
                            <p className="text-white/50 text-sm">Tonight · 7 PM · Downtown Gym</p>
                          </div>
                        </div>
                      </div>

                      <p className="text-white/30 text-[11px] font-semibold uppercase tracking-wider mb-3 px-1">Responses</p>
                      <div className="space-y-2.5">
                        <ResponseBubble name="Sarah M." status="in" delay={0.8} avatar="S" />
                        <ResponseBubble name="Jake R." status="in" delay={1.2} avatar="J" />
                        <ResponseBubble name="Mike T." status="out" delay={1.6} avatar="M" />
                        <ResponseBubble name="Lex W." status="in" delay={2.0} avatar="L" />
                        <ResponseBubble name="Dev P." status="in" delay={2.4} avatar="D" />
                      </div>

                      <div className="mt-4 flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#34c759]" />
                          <span className="text-[#34c759] text-sm font-bold">4 In</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-white/30" />
                          <span className="text-white/40 text-sm font-bold">1 Out</span>
                        </div>
                        <span className="text-white/25 text-xs">Auto-filling from waitlist...</span>
                      </div>
                    </div>
                  </div>
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
              SOCIAL PROOF BAR
              ═══════════════════════════════════════════════ */}
          <section className="py-10 border-b border-border/50">
            <div className="max-w-4xl mx-auto px-6 flex flex-wrap justify-center gap-x-12 gap-y-4 items-center">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-foreground">Zero</p>
                <p className="text-xs text-muted font-medium">App Required for Invitees</p>
              </div>
              <div className="w-px h-8 bg-border/60 hidden sm:block" />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-foreground">SMS</p>
                <p className="text-xs text-muted font-medium">Binary IN or OUT</p>
              </div>
              <div className="w-px h-8 bg-border/60 hidden sm:block" />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-foreground">Auto</p>
                <p className="text-xs text-muted font-medium">Waitlist & Fill</p>
              </div>
              <div className="w-px h-8 bg-border/60 hidden sm:block" />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-foreground">100%</p>
                <p className="text-xs text-muted font-medium">Free to Use</p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              PROBLEM — The mental load of organizing
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28" id="the-problem">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-14">
                <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">The Problem</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  You&apos;re the organizer.<br />Nobody knows what that costs.
                </h2>
                <p className="text-muted text-lg mt-4 max-w-xl mx-auto">
                  You send the text. You chase the maybes. You count heads. You find the sub. You do it all — and nobody even notices.
                </p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              AGITATION — The group chat nightmare
              ═══════════════════════════════════════════════ */}
          <section ref={agitationSection.ref} className="py-16 md:py-20 bg-surface">
            <div className={`max-w-3xl mx-auto px-6 transition-all duration-700 ${agitationSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-12">
                <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                  This is your life right now.
                </h2>
              </div>

              <div className="space-y-6">
                <PainCard icon="💬" text={`You text the group: "Basketball Friday?" 12 people see it. 3 respond. 5 say "maybe." 4 ghost you completely.`} delay={0} />
                <PainCard icon="🕐" text={`It's Thursday night. You still don't have a headcount. You're texting people individually. Again.`} delay={0.1} />
                <PainCard icon="🚫" text={`Someone bails at 5 PM for a 7 PM game. Now you're panic-texting your entire contact list for a sub.`} delay={0.2} />
                <PainCard icon="😤" text={`The game gets cancelled. Not because people didn't want to play — because nobody could commit.`} delay={0.3} />
                <PainCard icon="🔁" text={`Next week? Same thing. Same chaos. Same mental load. You're one bad week away from quitting.`} delay={0.4} />
              </div>

              <div className="mt-10 text-center">
                <p className="text-foreground font-bold text-lg">The group chat was never built for this.</p>
                <p className="text-muted mt-1">It&apos;s a conversation tool. Not an organizing tool.</p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              SOLUTION — Whozin: Binary. Automatic. Done.
              ═══════════════════════════════════════════════ */}
          <section ref={solutionSection.ref} className="py-20 md:py-28">
            <div className={`max-w-5xl mx-auto px-6 transition-all duration-700 ${solutionSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-14">
                <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">The Solution</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  One question. Two answers. Zero drama.
                </h2>
                <p className="text-muted text-lg mt-4 max-w-2xl mx-auto">
                  Whozin replaces your group chat with a binary system. Your people get a text: <strong className="text-foreground">&ldquo;Are you in?&rdquo;</strong> They reply <strong className="text-foreground">IN</strong> or <strong className="text-foreground">OUT</strong>. That&apos;s it. No app download. No account. No friction.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Card 1 */}
                <div className="bg-white rounded-2xl p-6 border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 21v-1a5 5 0 0110 0v1M14 21v-1a4 4 0 018 0v1" />
                    </svg>
                  </div>
                  <h3 className="text-[17px] font-bold text-foreground mb-1.5">Build Your Crew</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Create smart groups. Set priority order. Your most reliable people get invited first. <a href="/build" className="text-primary font-semibold hover:underline">Learn more</a></p>
                </div>

                {/* Card 2 */}
                <div className="bg-white rounded-2xl p-6 border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                  <div className="w-12 h-12 rounded-xl bg-[#34c759]/10 flex items-center justify-center mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
                    </svg>
                  </div>
                  <h3 className="text-[17px] font-bold text-foreground mb-1.5">Fill Every Spot</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Someone bails? The waitlist auto-promotes the next person. You don&apos;t lift a finger. <a href="/fill" className="text-primary font-semibold hover:underline">Learn more</a></p>
                </div>

                {/* Card 3 */}
                <div className="bg-white rounded-2xl p-6 border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                  <div className="w-12 h-12 rounded-xl bg-[#6366f1]/10 flex items-center justify-center mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" />
                    </svg>
                  </div>
                  <h3 className="text-[17px] font-bold text-foreground mb-1.5">Zero App Required</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Your friends reply via SMS. No download. No login. No excuses. The friction killer that changes everything.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              HOW IT WORKS — 3 steps
              ═══════════════════════════════════════════════ */}
          <section ref={howSection.ref} className="py-20 md:py-28 bg-surface relative" id="how-it-works">
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
              backgroundImage: 'repeating-linear-gradient(45deg, #4285F4 0, #4285F4 1px, transparent 0, transparent 50%)',
              backgroundSize: '20px 20px',
            }} />

            <div className={`relative max-w-4xl mx-auto px-6 transition-all duration-700 ${howSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-16">
                <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">How It Works</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Three steps. Zero group chat drama.
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-10 md:gap-8 relative">
                <div className="hidden md:block absolute top-7 left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-[2px] bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

                <div className="relative text-center">
                  <div className="w-14 h-14 rounded-full bg-primary text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-4 shadow-[0_4px_20px_rgba(66,133,244,0.35)]">1</div>
                  <h3 className="text-[16px] font-bold text-foreground mb-1">Create. Set. Send.</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Name the activity. Pick your group. Set the spots. Hit send. Under 30 seconds.</p>
                </div>

                <div className="relative text-center">
                  <div className="w-14 h-14 rounded-full bg-primary text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-4 shadow-[0_4px_20px_rgba(66,133,244,0.35)]">2</div>
                  <h3 className="text-[16px] font-bold text-foreground mb-1">They Get a Text.</h3>
                  <p className="text-[14px] text-muted leading-relaxed">&ldquo;Are you in?&rdquo; They reply IN or OUT via SMS. No app. No account. No friction.</p>
                </div>

                <div className="relative text-center">
                  <div className="w-14 h-14 rounded-full bg-primary text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-4 shadow-[0_4px_20px_rgba(66,133,244,0.35)]">3</div>
                  <h3 className="text-[16px] font-bold text-foreground mb-1">You See Who&apos;s In.</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Watch responses in real time. Spots fill. Waitlist auto-promotes. You show up and lead.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              NICHE CALLOUTS — Sport-specific pages
              ═══════════════════════════════════════════════ */}
          <section ref={proofSection.ref} className="py-16 md:py-20">
            <div className={`max-w-4xl mx-auto px-6 transition-all duration-700 ${proofSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-10">
                <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">Built For Your Sport</p>
                <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                  Every sport has its organizing nightmare. We solve them all.
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-5">
                <a href="/golf" className="group bg-white rounded-2xl p-6 border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(66,133,244,0.12)] hover:border-primary/30 transition-all duration-300">
                  <span className="text-4xl block mb-3">⛳</span>
                  <h3 className="text-[16px] font-bold text-foreground mb-1 group-hover:text-primary transition-colors">Golf</h3>
                  <p className="text-[13px] text-muted leading-relaxed">Tee times. Foursomes. No-shows that cost everyone money.</p>
                </a>
                <a href="/pickleball" className="group bg-white rounded-2xl p-6 border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(66,133,244,0.12)] hover:border-primary/30 transition-all duration-300">
                  <span className="text-4xl block mb-3">🏓</span>
                  <h3 className="text-[16px] font-bold text-foreground mb-1 group-hover:text-primary transition-colors">Pickleball</h3>
                  <p className="text-[13px] text-muted leading-relaxed">Court rotations. 20 people. 2 courts. Pure chaos — until now.</p>
                </a>
                <a href="/volleyball" className="group bg-white rounded-2xl p-6 border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(66,133,244,0.12)] hover:border-primary/30 transition-all duration-300">
                  <span className="text-4xl block mb-3">🏐</span>
                  <h3 className="text-[16px] font-bold text-foreground mb-1 group-hover:text-primary transition-colors">Volleyball</h3>
                  <p className="text-[13px] text-muted leading-relaxed">Position-dependent. You can&apos;t play without a setter.</p>
                </a>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              FINAL CTA
              ═══════════════════════════════════════════════ */}
          <CtaSection
            onSignIn={onSignIn}
            headline={<>Your group needs a leader.<br /><span className="text-primary">Not a group chat.</span></>}
            subheadline="Set up your first activity in under 30 seconds. Your crew will thank you."
            buttonText="Become the Organizer — Free"
            footnote="No credit card. No app download required for your friends."
          />
        </>
      )}
    </MarketingShell>
  )
}
