'use client'

import { useState, useEffect } from 'react'
import { MarketingShell, HeroNav, CtaSection } from '@/components/landing/marketing-shell'

export default function BuildPage() {
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
              HERO — Build an Activity
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
                <div className="flex-1 mb-12 md:mb-0">
                  <div className={`transition-all duration-700 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-primary/80 text-xs font-medium tracking-wide uppercase">Build an Activity</span>
                    </div>

                    <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                      Set it up.<br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#60a5fa] to-[#818cf8] animate-gradient">
                        Watch it fill.
                      </span>
                    </h1>
                    <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-md mb-3">
                      Create an activity in 30 seconds. Pick your group. Set the spots. Choose priority or blast all. Then sit back — the group builds itself.
                    </p>
                    <p className="text-white/80 text-lg md:text-xl font-semibold max-w-md mb-8">
                      No chasing. No counting heads. No group chat.
                    </p>

                    <button
                      onClick={onSignIn}
                      className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-base hover:bg-primary-dark active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(66,133,244,0.4)] hover:shadow-[0_8px_32px_rgba(66,133,244,0.5)]"
                    >
                      Create Your First Activity — Free
                    </button>
                  </div>
                </div>

                {/* Right: Activity creation mockup */}
                <div className={`flex-1 max-w-md mx-auto md:mx-0 transition-all duration-700 delay-300 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                  <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-5 backdrop-blur-sm">
                    <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-3 px-1">New Activity</p>

                    <div className="space-y-3">
                      <div className="bg-white/[0.06] rounded-xl px-4 py-3 border border-white/10">
                        <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Activity</p>
                        <p className="text-white font-bold text-[15px]">⛳ Saturday Golf</p>
                      </div>
                      <div className="bg-white/[0.06] rounded-xl px-4 py-3 border border-white/10">
                        <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">When & Where</p>
                        <p className="text-white font-bold text-[15px]">Sat 8:30 AM · Pine Valley CC</p>
                      </div>
                      <div className="bg-white/[0.06] rounded-xl px-4 py-3 border border-white/10">
                        <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Spots</p>
                        <p className="text-white font-bold text-[15px]">4 spots open</p>
                      </div>
                      <div className="bg-white/[0.06] rounded-xl px-4 py-3 border border-white/10">
                        <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Group</p>
                        <p className="text-white font-bold text-[15px]">Saturday Golf Crew (12 members)</p>
                      </div>
                      <div className="bg-primary/15 rounded-xl px-4 py-3 border border-primary/25">
                        <p className="text-primary/60 text-[10px] font-semibold uppercase tracking-wider mb-1">Invite Mode</p>
                        <div className="flex gap-2">
                          <span className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-primary text-white">Priority Order</span>
                          <span className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-white/5 text-white/40 border border-white/10">Blast All</span>
                        </div>
                      </div>
                    </div>

                    <button className="w-full mt-4 py-3 rounded-xl bg-primary text-white font-bold text-[14px]">
                      Send Invites
                    </button>
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
              THE FLOW — 4 steps to build an activity
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28">
            <div className="max-w-4xl mx-auto px-6">
              <div className="text-center mb-14">
                <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">The Flow</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  30 seconds. Four fields. Done.
                </h2>
              </div>

              <div className="grid md:grid-cols-4 gap-6">
                {[
                  { num: '1', title: 'Name It', desc: 'Pick the activity — golf, pickleball, basketball, dinner, anything.', icon: '✏️' },
                  { num: '2', title: 'Set the Details', desc: 'Date, time, location. When and where are you doing this thing.', icon: '📅' },
                  { num: '3', title: 'Set the Spots', desc: 'How many people do you need? 4 for golf? 8 for pickleball? 12 for volleyball?', icon: '🔢' },
                  { num: '4', title: 'Pick a Group & Send', desc: 'Choose your group. Pick Priority or Blast All. Hit send. You\'re done.', icon: '🚀' },
                ].map((step, i) => (
                  <div key={i} className="text-center">
                    <div className="w-14 h-14 rounded-full bg-primary text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-3 shadow-[0_4px_20px_rgba(66,133,244,0.35)]">
                      {step.num}
                    </div>
                    <span className="text-2xl block mb-2">{step.icon}</span>
                    <h3 className="text-[16px] font-bold text-foreground mb-1">{step.title}</h3>
                    <p className="text-[13px] text-muted leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              TWO INVITE MODES
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28 bg-surface">
            <div className="max-w-4xl mx-auto px-6">
              <div className="text-center mb-14">
                <p className="text-[#6366f1] text-sm font-bold uppercase tracking-widest mb-3">Two Ways to Invite</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Blast everyone. Or invite in order. Your call.
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Blast All */}
                <div className="bg-white rounded-2xl p-6 border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-[#60a5fa]" />
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <span className="text-2xl">📢</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-foreground mb-2">Blast All</h3>
                  <p className="text-[14px] text-muted leading-relaxed mb-4">
                    Everyone in the group gets the invite at the same time. First to reply IN gets the spots. Simple, fast, first-come-first-served.
                  </p>
                  <div className="bg-surface rounded-xl p-4 border border-border/40">
                    <p className="text-[13px] text-muted"><strong className="text-foreground">Best for:</strong> Casual groups where invite order doesn&apos;t matter. Dinner, happy hour, open gym.</p>
                  </div>
                </div>

                {/* Priority Order */}
                <div className="bg-white rounded-2xl p-6 border border-[#6366f1]/20 shadow-[0_4px_20px_rgba(99,102,241,0.08)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6366f1] to-[#818cf8]" />
                  <div className="w-12 h-12 rounded-xl bg-[#6366f1]/10 flex items-center justify-center mb-4">
                    <span className="text-2xl">🏆</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-foreground mb-2">Priority Order</h3>
                  <p className="text-[14px] text-muted leading-relaxed mb-4">
                    Whozin invites people from the top of your list down. Your most reliable players get first dibs. When they fill, everyone else goes on the waitlist.
                  </p>
                  <div className="bg-[#6366f1]/5 rounded-xl p-4 border border-[#6366f1]/15">
                    <p className="text-[13px] text-muted"><strong className="text-foreground">Best for:</strong> Competitive groups where reliability matters. Golf foursomes, volleyball teams, league play.</p>
                  </div>
                  <a href="/groups" className="inline-flex items-center gap-2 text-[#6366f1] font-bold text-[13px] hover:underline mt-3">
                    Learn about Priority Order
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              THEN WHAT HAPPENS
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-14">
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Then what happens?
                </h2>
                <p className="text-muted text-lg mt-4">You hit send. Here&apos;s what your group sees:</p>
              </div>

              <div className="space-y-6 max-w-lg mx-auto">
                {/* Text message mockup */}
                <div className="bg-surface rounded-2xl p-6 border border-border/60">
                  <p className="text-[12px] font-bold text-muted uppercase tracking-wider mb-3">What they get:</p>
                  <div className="bg-[#34c759]/10 rounded-2xl p-4 border border-[#34c759]/20 max-w-[280px]">
                    <p className="text-[14px] text-foreground leading-relaxed">
                      ⛳ Saturday Golf<br />
                      Sat 8:30 AM · Pine Valley CC<br />
                      3 spots left<br /><br />
                      Are you in?<br />
                      Reply <strong>IN</strong> or <strong>OUT</strong>
                    </p>
                  </div>
                  <p className="text-[12px] text-muted mt-3">That&apos;s it. A text. They reply IN or OUT. No app. No link. No account.</p>
                </div>

                {/* What you see */}
                <div className="bg-surface rounded-2xl p-6 border border-border/60">
                  <p className="text-[12px] font-bold text-muted uppercase tracking-wider mb-3">What you see:</p>
                  <div className="space-y-2">
                    {[
                      { name: 'Dave K.', time: '2 min', status: 'IN', color: 'text-[#34c759] bg-[#34c759]/10 border-[#34c759]/20' },
                      { name: 'Tom R.', time: '5 min', status: 'IN', color: 'text-[#34c759] bg-[#34c759]/10 border-[#34c759]/20' },
                      { name: 'Steve M.', time: '12 min', status: 'OUT', color: 'text-red-400 bg-red-50 border-red-100' },
                      { name: 'Brian L.', time: '14 min', status: 'IN', color: 'text-[#34c759] bg-[#34c759]/10 border-[#34c759]/20' },
                    ].map((r, i) => (
                      <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 border ${r.color}`}>
                        <span className="text-[14px] font-medium flex-1">{r.name}</span>
                        <span className="text-[11px] text-muted">{r.time}</span>
                        <span className="text-[12px] font-extrabold">{r.status}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[13px] font-bold text-[#34c759] mt-3">3/4 spots filled. Steve dropped, Brian auto-promoted from waitlist.</p>
                  <p className="text-[12px] text-muted mt-1">The group built itself. You watched it happen.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              WHAT IF SOMEONE BAILS
              ═══════════════════════════════════════════════ */}
          <section className="py-16 md:py-20 bg-surface">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mb-4">
                What if someone bails after the group is full?
              </h2>
              <p className="text-muted text-lg max-w-xl mx-auto mb-6">
                That&apos;s what <strong className="text-foreground">Fill</strong> is for. Emergency Fill, Auto Emergency Fill, or Open Fill — three ways to replace a dropout in seconds.
              </p>
              <a
                href="/fill"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#34c759] text-white font-bold text-[14px] hover:bg-[#2db84e] transition-all shadow-[0_4px_16px_rgba(52,199,89,0.3)]"
              >
                Learn about Fill
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </a>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              FINAL CTA
              ═══════════════════════════════════════════════ */}
          <CtaSection
            onSignIn={onSignIn}
            headline={<>Set it up. Watch it fill.<br /><span className="text-primary">That&apos;s it.</span></>}
            subheadline="Create your first activity in under 30 seconds. The group builds itself."
            buttonText="Create Your First Activity — Free"
          />
        </>
      )}
    </MarketingShell>
  )
}
