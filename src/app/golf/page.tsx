'use client'

import { useState, useEffect } from 'react'
import { MarketingShell, HeroNav, CtaSection, useInView } from '@/components/landing/marketing-shell'

export default function GolfPage() {
  const [heroLoaded, setHeroLoaded] = useState(false)
  const problemSection = useInView()
  const agitateSection = useInView()
  const solveSection = useInView()
  const captainSection = useInView()

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <MarketingShell>
      {({ onSignIn }) => (
        <>
          {/* ═══════════════════════════════════════════════
              HERO — Golf: The Captain
              ═══════════════════════════════════════════════ */}
          <section className="relative bg-[#0a0f1e] overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#15803d]/20 blur-[120px] animate-float-slow pointer-events-none" />
            <div className="absolute bottom-[-30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-primary/15 blur-[100px] animate-float pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }} />

            <div className="relative max-w-6xl mx-auto px-6 pt-8 pb-16 md:pb-24">
              <HeroNav onSignIn={onSignIn} />

              <div className="md:flex md:items-center md:gap-16">
                <div className="flex-1 mb-12 md:mb-0">
                  <div className={`transition-all duration-700 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="inline-flex items-center gap-2 bg-[#15803d]/15 border border-[#15803d]/25 rounded-full px-4 py-1.5 mb-6">
                      <span className="text-lg">⛳</span>
                      <span className="text-[#4ade80] text-xs font-medium tracking-wide uppercase">Built for Golf</span>
                    </div>

                    <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                      You booked the tee time.<br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4ade80] via-[#22d3ee] to-primary animate-gradient">
                        Now fill the foursome.
                      </span>
                    </h1>
                    <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-md mb-3">
                      You&apos;re The Captain. You book the time, organize the group, and chase everyone down. Every. Single. Week.
                    </p>
                    <p className="text-white/80 text-lg md:text-xl font-semibold max-w-md mb-8">
                      Whozin does the chasing. You just show up and play.
                    </p>

                    <button
                      onClick={onSignIn}
                      className="px-8 py-4 rounded-2xl bg-[#15803d] text-white font-bold text-base hover:bg-[#166534] active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(21,128,61,0.4)] hover:shadow-[0_8px_32px_rgba(21,128,61,0.5)]"
                    >
                      Fill Your Foursome — Free
                    </button>
                  </div>
                </div>

                {/* Right: Foursome demo */}
                <div className={`flex-1 max-w-md mx-auto md:mx-0 transition-all duration-700 delay-300 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                  <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-5 backdrop-blur-sm">
                    <div className="bg-white/[0.06] rounded-2xl p-4 mb-3">
                      <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1">Saturday</p>
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">⛳</span>
                        <div>
                          <p className="text-white font-bold text-lg leading-tight">Saturday Morning Golf</p>
                          <p className="text-white/50 text-sm">8:30 AM · Pine Valley CC · 4 spots</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-white/30 text-[11px] font-semibold uppercase tracking-wider mb-3 px-1">Foursome</p>
                    <div className="space-y-2.5">
                      {[
                        { name: 'You (Captain)', status: 'CAPTAIN', color: 'text-amber-400 bg-amber-400/15 border-amber-400/25' },
                        { name: 'Dave K.', status: "I'M IN!", color: 'text-[#34c759] bg-[#34c759]/20 border-[#34c759]/30' },
                        { name: 'Tom R.', status: "I'M IN!", color: 'text-[#34c759] bg-[#34c759]/20 border-[#34c759]/30' },
                        { name: 'Steve M.', status: 'WAITLIST', color: 'text-primary bg-primary/20 border-primary/30' },
                      ].map((p, i) => (
                        <div key={i} className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-white/10">
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">{p.name[0]}</div>
                          <span className="text-white/90 text-sm font-medium flex-1">{p.name}</span>
                          <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${p.color}`}>{p.status}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 px-1 flex items-center justify-between">
                      <span className="text-[#34c759] text-sm font-bold">3/4 Confirmed</span>
                      <span className="text-white/40 text-xs">Waiting on 4th...</span>
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
              PROBLEM — The no-show nightmare
              ═══════════════════════════════════════════════ */}
          <section ref={problemSection.ref} className="py-20 md:py-28">
            <div className={`max-w-3xl mx-auto px-6 transition-all duration-700 ${problemSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-14">
                <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">The Problem</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  A no-show doesn&apos;t just ruin the round.<br />It ruins the <em className="not-italic text-red-500">tee time</em>.
                </h2>
                <p className="text-muted text-lg mt-4 max-w-xl mx-auto">
                  You booked it two weeks ago. Confirmed with everyone. Then Thursday night hits.
                </p>
              </div>

              <div className="space-y-4 max-w-2xl mx-auto">
                {[
                  '"Hey man, something came up Saturday. My bad."',
                  'Now you\'re scrambling for a 4th at 9 PM on a Thursday.',
                  'You text 6 buddies. Two are busy. Three don\'t respond.',
                  'You\'re paying for 4 and playing as a threesome.',
                  'Or worse — the course fills your 4th slot with a random.',
                ].map((text, i) => (
                  <div key={i} className="bg-red-50 border border-red-100 rounded-2xl p-5">
                    <p className="text-[15px] font-semibold text-red-800">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              AGITATION — The Captain's burden
              ═══════════════════════════════════════════════ */}
          <section ref={agitateSection.ref} className="py-16 md:py-20 bg-surface">
            <div className={`max-w-3xl mx-auto px-6 transition-all duration-700 ${agitateSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div ref={captainSection.ref} className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                  Every golf group has a Captain. It&apos;s a thankless job.
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">📅</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Book the Time</h3>
                  <p className="text-[14px] text-muted leading-relaxed">You find the tee time, book it, pay the deposit. Nobody else is going to do it.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">📱</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Chase the RSVPs</h3>
                  <p className="text-[14px] text-muted leading-relaxed">&ldquo;Hey, you in Saturday?&rdquo; Sent Monday. No response by Wednesday. Follow up again Thursday.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">🔄</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Find the Sub</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Someone bails? Now you&apos;re calling guys who might be free. At the last minute. Again.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">💸</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Eat the Cost</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Can&apos;t fill the spot? You&apos;re paying for a ghost. Or splitting it three ways. Fun.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              SOLUTION — Whozin for Golf
              ═══════════════════════════════════════════════ */}
          <section ref={solveSection.ref} className="py-20 md:py-28">
            <div className={`max-w-4xl mx-auto px-6 transition-all duration-700 ${solveSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-14">
                <p className="text-[#15803d] text-sm font-bold uppercase tracking-widest mb-3">The Solution</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Whozin gives The Captain superpowers.
                </h2>
                <p className="text-muted text-lg mt-4 max-w-2xl mx-auto">
                  Set up your golf group once. Whozin handles the rest every week.
                </p>
              </div>

              <div className="space-y-6 max-w-2xl mx-auto">
                <div className="flex items-start gap-5 bg-white rounded-2xl p-6 border border-[#15803d]/20 shadow-[0_4px_20px_rgba(21,128,61,0.06)]">
                  <div className="w-12 h-12 rounded-xl bg-[#15803d]/10 flex items-center justify-center flex-shrink-0 text-2xl">1</div>
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground mb-1">Build Your Golf Roster</h3>
                    <p className="text-[14px] text-muted leading-relaxed">Add your regulars and your subs. Rank them. Your A-list gets first dibs every week.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5 bg-white rounded-2xl p-6 border border-[#15803d]/20 shadow-[0_4px_20px_rgba(21,128,61,0.06)]">
                  <div className="w-12 h-12 rounded-xl bg-[#15803d]/10 flex items-center justify-center flex-shrink-0 text-2xl">2</div>
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground mb-1">Create the Round</h3>
                    <p className="text-[14px] text-muted leading-relaxed">Set the tee time, the course, 4 spots. Hit send. Whozin texts your group in priority order.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5 bg-white rounded-2xl p-6 border border-[#15803d]/20 shadow-[0_4px_20px_rgba(21,128,61,0.06)]">
                  <div className="w-12 h-12 rounded-xl bg-[#15803d]/10 flex items-center justify-center flex-shrink-0 text-2xl">3</div>
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground mb-1">Foursome Fills Itself</h3>
                    <p className="text-[14px] text-muted leading-relaxed">First 3 reply IN? Spot 4 goes to the waitlist. Someone bails Thursday? Whozin auto-invites the next guy. No texts from you.</p>
                  </div>
                </div>
              </div>

              {/* Zero app callout */}
              <div className="mt-12 text-center">
                <div className="inline-block bg-[#15803d]/5 border border-[#15803d]/15 rounded-2xl px-8 py-5">
                  <p className="text-foreground font-extrabold text-lg mb-1">Your buddies don&apos;t need the app.</p>
                  <p className="text-muted text-sm">They get a text. Reply IN or OUT. That&apos;s literally it.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              FINAL CTA
              ═══════════════════════════════════════════════ */}
          <CtaSection
            onSignIn={onSignIn}
            headline={<>Never play as a threesome again.<br /><span className="text-[#15803d]">Fill the foursome. Every time.</span></>}
            subheadline="Build your golf roster in 2 minutes. Next Saturday, the foursome fills itself."
            buttonText="Build Your Golf Group — Free"
            footnote="Free forever. No credit card. Your golf buddies respond via text — no app needed."
          />
        </>
      )}
    </MarketingShell>
  )
}
