'use client'

import { useState, useEffect } from 'react'
import { MarketingShell, HeroNav, CtaSection, useInView } from '@/components/landing/marketing-shell'

export default function VolleyballPage() {
  const [heroLoaded, setHeroLoaded] = useState(false)
  const problemSection = useInView()
  const agitateSection = useInView()
  const solveSection = useInView()

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <MarketingShell>
      {({ onSignIn }) => (
        <>
          {/* ═══════════════════════════════════════════════
              HERO — Volleyball: Position Filling
              ═══════════════════════════════════════════════ */}
          <section className="relative bg-[#0a0f1e] overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#dc2626]/15 blur-[120px] animate-float-slow pointer-events-none" />
            <div className="absolute bottom-[-30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-[#6366f1]/15 blur-[100px] animate-float pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }} />

            <div className="relative max-w-6xl mx-auto px-6 pt-8 pb-16 md:pb-24">
              <HeroNav onSignIn={onSignIn} />

              <div className="md:flex md:items-center md:gap-16">
                <div className="flex-1 mb-12 md:mb-0">
                  <div className={`transition-all duration-700 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="inline-flex items-center gap-2 bg-[#dc2626]/10 border border-[#dc2626]/20 rounded-full px-4 py-1.5 mb-6">
                      <span className="text-lg">🏐</span>
                      <span className="text-red-300 text-xs font-medium tracking-wide uppercase">Built for Volleyball</span>
                    </div>

                    <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                      You can&apos;t play<br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ef4444] via-[#f97316] to-[#fbbf24] animate-gradient">
                        without a setter.
                      </span>
                    </h1>
                    <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-md mb-3">
                      Volleyball isn&apos;t just about headcount. You need the right people in the right positions. One gap and the whole team falls apart.
                    </p>
                    <p className="text-white/80 text-lg md:text-xl font-semibold max-w-md mb-8">
                      Whozin fills spots — and the right spots.
                    </p>

                    <button
                      onClick={onSignIn}
                      className="px-8 py-4 rounded-2xl bg-[#dc2626] text-white font-bold text-base hover:bg-[#b91c1c] active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(220,38,38,0.4)] hover:shadow-[0_8px_32px_rgba(220,38,38,0.5)]"
                    >
                      Build Your Roster — Free
                    </button>
                  </div>
                </div>

                {/* Right: Position-based roster demo */}
                <div className={`flex-1 max-w-md mx-auto md:mx-0 transition-all duration-700 delay-300 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                  <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-5 backdrop-blur-sm">
                    <div className="bg-white/[0.06] rounded-2xl p-4 mb-3">
                      <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1">Tuesday</p>
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">🏐</span>
                        <div>
                          <p className="text-white font-bold text-lg leading-tight">Tuesday Night Volleyball</p>
                          <p className="text-white/50 text-sm">7:00 PM · Sandbar Courts · 12 spots</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-white/30 text-[11px] font-semibold uppercase tracking-wider mb-2 px-1">Roster</p>
                    <div className="space-y-1.5">
                      {[
                        { name: 'You (Captain)', role: 'Setter', status: 'IN', ok: true },
                        { name: 'Sarah M.', role: 'Outside', status: 'IN', ok: true },
                        { name: 'Jake R.', role: 'Middle', status: 'IN', ok: true },
                        { name: 'Alex W.', role: 'Libero', status: 'IN', ok: true },
                        { name: 'Dev P.', role: 'Outside', status: 'IN', ok: true },
                        { name: 'Mike T.', role: 'Setter', status: 'BAILED', ok: false },
                        { name: 'Chris L.', role: 'Setter', status: 'AUTO-TEXTED', ok: null },
                      ].map((p, i) => (
                        <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition-all ${
                          p.ok === false ? 'bg-red-500/10 border-red-500/15' :
                          p.ok === null ? 'bg-primary/10 border-primary/15' :
                          'bg-[#34c759]/10 border-[#34c759]/15'
                        }`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                            p.ok === false ? 'bg-red-500/20 text-red-400' :
                            p.ok === null ? 'bg-primary/20 text-primary' :
                            'bg-[#34c759]/20 text-[#34c759]'
                          }`}>{p.name[0]}</div>
                          <span className={`text-[13px] font-medium flex-1 ${p.ok === false ? 'text-red-400/70 line-through' : 'text-white/80'}`}>{p.name}</span>
                          <span className="text-[10px] font-bold text-white/30 mr-1">{p.role}</span>
                          <span className={`text-[10px] font-bold ${
                            p.ok === false ? 'text-red-400' :
                            p.ok === null ? 'text-primary' :
                            'text-[#34c759]'
                          }`}>{p.status}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 px-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-primary text-[13px] font-bold">Finding a setter replacement...</span>
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
              PROBLEM — Position-dependent sports
              ═══════════════════════════════════════════════ */}
          <section ref={problemSection.ref} className="py-20 md:py-28">
            <div className={`max-w-3xl mx-auto px-6 transition-all duration-700 ${problemSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-14">
                <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">The Problem</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  12 bodies isn&apos;t a team.<br /><em className="not-italic text-red-500">12 right bodies</em> is a team.
                </h2>
                <p className="text-muted text-lg mt-4 max-w-xl mx-auto">
                  Volleyball is position-dependent. When your setter bails, you don&apos;t just need a body — you need a setter.
                </p>
              </div>

              <div className="space-y-4 max-w-2xl mx-auto">
                {[
                  'Your setter bails 3 hours before the match. You have 11 players — but no setter.',
                  'You text the group: "Anyone know a setter?" Radio silence.',
                  'Someone volunteers who\'s "played setter once." It shows.',
                  'You lose in straight sets. Not because you didn\'t have enough people. Because you didn\'t have the right people.',
                  'Next week? Same anxiety. Same scramble. Same result.',
                ].map((text, i) => (
                  <div key={i} className="bg-red-50 border border-red-100 rounded-2xl p-5">
                    <p className="text-[15px] font-semibold text-red-800">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              AGITATION — The position gap
              ═══════════════════════════════════════════════ */}
          <section ref={agitateSection.ref} className="py-16 md:py-20 bg-surface">
            <div className={`max-w-3xl mx-auto px-6 transition-all duration-700 ${agitateSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                  This is what kills recreational volleyball.
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">🏐</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Setter Dependency</h3>
                  <p className="text-[14px] text-muted leading-relaxed">No setter = no offense. It&apos;s the hardest position to fill and the first one to bail.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">📉</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Lopsided Teams</h3>
                  <p className="text-[14px] text-muted leading-relaxed">12 people show up — but 8 are hitters and nobody can set or pass. The game quality tanks.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">😤</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Organizer Burnout</h3>
                  <p className="text-[14px] text-muted leading-relaxed">You&apos;re managing positions, headcounts, and egos. Not organizing — babysitting.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">❌</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Cancelled Matches</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Not for lack of players. For lack of the <em>right</em> players. The most frustrating cancellation there is.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              SOLUTION — Whozin for Volleyball
              ═══════════════════════════════════════════════ */}
          <section ref={solveSection.ref} className="py-20 md:py-28">
            <div className={`max-w-4xl mx-auto px-6 transition-all duration-700 ${solveSection.visible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center mb-14">
                <p className="text-[#dc2626] text-sm font-bold uppercase tracking-widest mb-3">The Solution</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Build a roster. Not just a headcount.
                </h2>
                <p className="text-muted text-lg mt-4 max-w-2xl mx-auto">
                  Whozin lets you organize by what matters — getting the right players in the right spots.
                </p>
              </div>

              <div className="space-y-6 max-w-2xl mx-auto">
                <div className="flex items-start gap-5 bg-white rounded-2xl p-6 border border-[#dc2626]/20 shadow-[0_4px_20px_rgba(220,38,38,0.06)]">
                  <div className="w-12 h-12 rounded-xl bg-[#dc2626]/10 flex items-center justify-center flex-shrink-0 font-extrabold text-[#dc2626]">1</div>
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground mb-1">Build Your Full Roster</h3>
                    <p className="text-[14px] text-muted leading-relaxed">Add every player in your volleyball network. Whozin knows who plays what. Setters, hitters, liberos, all-arounders.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5 bg-white rounded-2xl p-6 border border-[#dc2626]/20 shadow-[0_4px_20px_rgba(220,38,38,0.06)]">
                  <div className="w-12 h-12 rounded-xl bg-[#dc2626]/10 flex items-center justify-center flex-shrink-0 font-extrabold text-[#dc2626]">2</div>
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground mb-1">Set Priority by Position</h3>
                    <p className="text-[14px] text-muted leading-relaxed">Your most reliable setter gets invited first. Then your backup setter. Then your flex players. Whozin contacts them in order.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5 bg-white rounded-2xl p-6 border border-[#dc2626]/20 shadow-[0_4px_20px_rgba(220,38,38,0.06)]">
                  <div className="w-12 h-12 rounded-xl bg-[#dc2626]/10 flex items-center justify-center flex-shrink-0 font-extrabold text-[#dc2626]">3</div>
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground mb-1">Auto-Fill the Right Position</h3>
                    <p className="text-[14px] text-muted leading-relaxed">Setter bails? Whozin auto-texts your backup setters first — not just the next warm body. The waitlist is smart.</p>
                  </div>
                </div>
              </div>

              {/* Zero app callout */}
              <div className="mt-12 text-center">
                <div className="inline-block bg-[#dc2626]/5 border border-[#dc2626]/15 rounded-2xl px-8 py-5">
                  <p className="text-foreground font-extrabold text-lg mb-1">Your players don&apos;t need the app.</p>
                  <p className="text-muted text-sm">They get a text: &ldquo;Are you in for Tuesday volleyball?&rdquo; They reply IN or OUT. Done.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              THE DIFFERENCE
              ═══════════════════════════════════════════════ */}
          <section className="py-16 md:py-20 bg-surface">
            <div className="max-w-4xl mx-auto px-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-border/60 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-red-500" />
                  <h3 className="text-[17px] font-bold text-foreground mb-4">Without Whozin</h3>
                  <ul className="space-y-3 text-[14px] text-muted">
                    <li>&ldquo;Does anyone know a setter?&rdquo;</li>
                    <li>45 minutes texting around</li>
                    <li>Random fill who can&apos;t set</li>
                    <li>Terrible game quality</li>
                    <li>People stop showing up</li>
                  </ul>
                </div>
                <div className="bg-white border border-[#34c759]/20 rounded-2xl p-6 relative overflow-hidden shadow-[0_4px_20px_rgba(52,199,89,0.08)]">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#34c759] to-[#22d3ee]" />
                  <h3 className="text-[17px] font-bold text-foreground mb-4">With Whozin</h3>
                  <ul className="space-y-3 text-[14px] text-foreground font-medium">
                    <li>Setter bails &rarr; backup setter auto-texted</li>
                    <li>0 minutes of your time</li>
                    <li>Right player. Right position.</li>
                    <li>Competitive, balanced match</li>
                    <li>People keep coming back</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              FINAL CTA
              ═══════════════════════════════════════════════ */}
          <CtaSection
            onSignIn={onSignIn}
            headline={<>Never scramble for a setter again.<br /><span className="text-[#dc2626]">Build the roster that fills itself.</span></>}
            subheadline="Set up your volleyball group in 2 minutes. Every position covered. Every week."
            buttonText="Build Your Roster — Free"
            footnote="Free forever. No credit card. Your players respond via SMS — no app needed."
          />
        </>
      )}
    </MarketingShell>
  )
}
