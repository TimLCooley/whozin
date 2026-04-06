'use client'

import { useState, useEffect } from 'react'
import { MarketingShell, HeroNav, CtaSection } from '@/components/landing/marketing-shell'

export default function PickleballPage() {
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
              HERO — Pickleball: Court Chaos
              ═══════════════════════════════════════════════ */}
          <section className="relative bg-[#0a0f1e] overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#f59e0b]/15 blur-[120px] animate-float-slow pointer-events-none" />
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
                    <div className="inline-flex items-center gap-2 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-full px-4 py-1.5 mb-6">
                      <span className="text-lg">🏓</span>
                      <span className="text-[#fbbf24] text-xs font-medium tracking-wide uppercase">Built for Pickleball</span>
                    </div>

                    <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                      20 people.<br />2 courts.<br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f59e0b] via-[#fbbf24] to-[#f97316] animate-gradient">
                        Pure chaos.
                      </span>
                    </h1>
                    <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-md mb-3">
                      You booked the courts. Now you&apos;re managing a spreadsheet of who&apos;s playing, who&apos;s waiting, and who&apos;s &ldquo;running late.&rdquo;
                    </p>
                    <p className="text-white/80 text-lg md:text-xl font-semibold max-w-md mb-8">
                      Whozin turns the chaos into a system.
                    </p>

                    <button
                      onClick={onSignIn}
                      className="px-8 py-4 rounded-2xl bg-[#f59e0b] text-white font-bold text-base hover:bg-[#d97706] active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(245,158,11,0.4)] hover:shadow-[0_8px_32px_rgba(245,158,11,0.5)]"
                    >
                      Organize Your Courts — Free
                    </button>
                  </div>
                </div>

                {/* Right: Court rotation visual */}
                <div className={`flex-1 max-w-md mx-auto md:mx-0 transition-all duration-700 delay-300 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                  <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-5 backdrop-blur-sm">
                    <div className="bg-white/[0.06] rounded-2xl p-4 mb-3">
                      <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1">Wednesday</p>
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">🏓</span>
                        <div>
                          <p className="text-white font-bold text-lg leading-tight">Wednesday Pickleball</p>
                          <p className="text-white/50 text-sm">6:00 PM · Sunset Courts · 2 courts</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-white/30 text-[11px] font-semibold uppercase tracking-wider mb-2 px-1">Court 1 (4 players)</p>
                    <div className="space-y-1.5 mb-3">
                      {['Sarah M.', 'Jake R.', 'Alex W.', 'Lisa P.'].map((name, i) => (
                        <div key={i} className="flex items-center gap-2 bg-[#34c759]/10 rounded-xl px-3 py-2 border border-[#34c759]/15">
                          <div className="w-6 h-6 rounded-full bg-[#34c759]/20 flex items-center justify-center text-[11px] font-bold text-[#34c759]">{name[0]}</div>
                          <span className="text-white/80 text-[13px] font-medium flex-1">{name}</span>
                          <span className="text-[10px] font-bold text-[#34c759]">PLAYING</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-white/30 text-[11px] font-semibold uppercase tracking-wider mb-2 px-1">Court 2 (4 players)</p>
                    <div className="space-y-1.5 mb-3">
                      {['Dev P.', 'Chris L.', 'Tom H.', 'Nina K.'].map((name, i) => (
                        <div key={i} className="flex items-center gap-2 bg-[#34c759]/10 rounded-xl px-3 py-2 border border-[#34c759]/15">
                          <div className="w-6 h-6 rounded-full bg-[#34c759]/20 flex items-center justify-center text-[11px] font-bold text-[#34c759]">{name[0]}</div>
                          <span className="text-white/80 text-[13px] font-medium flex-1">{name}</span>
                          <span className="text-[10px] font-bold text-[#34c759]">PLAYING</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-white/30 text-[11px] font-semibold uppercase tracking-wider mb-2 px-1">Waitlist</p>
                    <div className="space-y-1.5">
                      {['Mike T.', 'Rachel S.', 'Dan B.'].map((name, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold text-white/50">{name[0]}</div>
                          <span className="text-white/50 text-[13px] font-medium flex-1">{name}</span>
                          <span className="text-[10px] font-bold text-white/30">#{i + 1}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 px-1 flex items-center justify-between">
                      <span className="text-[#34c759] text-sm font-bold">8/8 Courts Full</span>
                      <span className="text-white/40 text-xs">3 on waitlist</span>
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
              PROBLEM — The court rotation nightmare
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-14">
                <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">The Problem</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Pickleball doesn&apos;t have a playing problem.<br />It has an <em className="not-italic text-red-500">organizing</em> problem.
                </h2>
              </div>

              <div className="space-y-4 max-w-2xl mx-auto">
                {[
                  'You booked 2 courts for 6-8 PM. Now 22 people want to play.',
                  'The group chat is 47 messages deep. Nobody knows who\'s actually confirmed.',
                  'You show up and 14 people are there. 8 can play at once. 6 are standing around.',
                  '"Who\'s been sitting out longest?" Nobody knows. Arguments start.',
                  'Two people leave early because the rotation is a mess. Now you\'re short.',
                ].map((text, i) => (
                  <div key={i} className="bg-red-50 border border-red-100 rounded-2xl p-5">
                    <p className="text-[15px] font-semibold text-red-800">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              AGITATION — What organizing pickleball actually looks like
              ═══════════════════════════════════════════════ */}
          <section className="py-16 md:py-20 bg-surface">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                  You&apos;re not an organizer. You&apos;re a traffic cop.
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">📊</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Headcount Chaos</h3>
                  <p className="text-[14px] text-muted leading-relaxed">You need exactly 4 per court. Not 3, not 5. But 15 people said &ldquo;maybe&rdquo; and 8 said &ldquo;yes&rdquo; — two of whom might flake.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">⏰</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Court-Grabbing</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Courts are scarce. You book early. Then half your group bails and you&apos;re paying for empty courts.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">🔁</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Rotation Drama</h3>
                  <p className="text-[14px] text-muted leading-relaxed">Who sits out next? Who played the last 3 games? You&apos;re managing a mental spreadsheet while trying to play.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-border/60">
                  <p className="text-3xl mb-3">👻</p>
                  <h3 className="text-[16px] font-bold text-foreground mb-2">Ghost Players</h3>
                  <p className="text-[14px] text-muted leading-relaxed">&ldquo;Yeah I&apos;ll be there!&rdquo; ...radio silence. Now you&apos;re at 7 players. Uneven. Awkward.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              SOLUTION — Whozin for Pickleball
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28">
            <div className="max-w-4xl mx-auto px-6">
              <div className="text-center mb-14">
                <p className="text-[#f59e0b] text-sm font-bold uppercase tracking-widest mb-3">The Solution</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Set the courts. Set the cap. Whozin does the rest.
                </h2>
              </div>

              <div className="space-y-6 max-w-2xl mx-auto">
                <div className="flex items-start gap-5 bg-white rounded-2xl p-6 border border-[#f59e0b]/20 shadow-[0_4px_20px_rgba(245,158,11,0.06)]">
                  <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center flex-shrink-0 font-extrabold text-[#f59e0b]">1</div>
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground mb-1">Set Your Player Cap</h3>
                    <p className="text-[14px] text-muted leading-relaxed">2 courts = 8 spots. Set it. Whozin enforces it. No more showing up to 14 people for 8 spots.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5 bg-white rounded-2xl p-6 border border-[#f59e0b]/20 shadow-[0_4px_20px_rgba(245,158,11,0.06)]">
                  <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center flex-shrink-0 font-extrabold text-[#f59e0b]">2</div>
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground mb-1">Priority Fills Courts</h3>
                    <p className="text-[14px] text-muted leading-relaxed">Your regulars get first dibs. Spots fill in order. Everyone else goes on the waitlist. Fair. Automatic.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5 bg-white rounded-2xl p-6 border border-[#f59e0b]/20 shadow-[0_4px_20px_rgba(245,158,11,0.06)]">
                  <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center flex-shrink-0 font-extrabold text-[#f59e0b]">3</div>
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground mb-1">Dropouts Auto-Fill</h3>
                    <p className="text-[14px] text-muted leading-relaxed">Someone bails? The next person on the waitlist gets auto-texted. They reply IN. Spot filled. You didn&apos;t do a thing.</p>
                  </div>
                </div>
              </div>

              <div className="mt-12 text-center">
                <div className="inline-block bg-[#f59e0b]/5 border border-[#f59e0b]/15 rounded-2xl px-8 py-5">
                  <p className="text-foreground font-extrabold text-lg mb-1">Nobody needs the app to play.</p>
                  <p className="text-muted text-sm">Your players reply via text. IN or OUT. No download, no account, no friction.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              FINAL CTA
              ═══════════════════════════════════════════════ */}
          <CtaSection
            onSignIn={onSignIn}
            headline={<>Stop managing the chaos.<br /><span className="text-[#f59e0b]">Own the courts.</span></>}
            subheadline="Set up your pickleball group in 2 minutes. Every session fills to the exact right number."
            buttonText="Organize Your Courts — Free"
            footnote="Free forever. No credit card. Your players respond via text — no app needed."
          />
        </>
      )}
    </MarketingShell>
  )
}
