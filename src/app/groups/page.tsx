'use client'

import { useState, useEffect } from 'react'
import { MarketingShell, HeroNav, CtaSection } from '@/components/landing/marketing-shell'

export default function GroupsPage() {
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
              HERO — Groups & Priority
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
                    <span className="text-lg">👥</span>
                    <span className="text-primary/80 text-xs font-medium tracking-wide uppercase">Smart Groups & Priority</span>
                  </div>

                  <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                    Your regulars.<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#60a5fa] to-[#818cf8] animate-gradient">
                      Your backups. Your order.
                    </span>
                  </h1>
                  <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-lg mb-8">
                    You know who always shows up. You know who flakes. Whozin lets you build groups that reflect reality — and invite in the order that matters.
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
              THE PROBLEM — The scramble
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-14">
                <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">The Problem</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  You golf with the same 3 guys every week.<br />Until one of them can&apos;t make it.
                </h2>
              </div>

              <div className="space-y-4 max-w-2xl mx-auto">
                {[
                  'Dave, Tom, and Steve. Every Saturday. 8:30 AM. Tee time booked.',
                  'Thursday night: "Hey guys, Steve can\'t make it this week."',
                  'Now you need a fourth. You text Brian — busy. Text Mark — no response. Text Kevin — "maybe."',
                  'It\'s Friday afternoon. You still don\'t have a fourth. The tee time is tomorrow.',
                  'You end up playing as a threesome. Or worse, the course slots in a random.',
                ].map((text, i) => (
                  <div key={i} className="bg-red-50 border border-red-100 rounded-2xl p-5">
                    <p className="text-[15px] font-medium text-red-800">{text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 text-center">
                <p className="text-foreground font-bold text-lg">This happens in every sport. Every group. Every week.</p>
                <p className="text-muted mt-1">The core 3 are locked in. It&apos;s always that last spot that kills you.</p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              SOLUTION — Smart Groups
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28 bg-surface">
            <div className="max-w-5xl mx-auto px-6">
              <div className="text-center mb-14">
                <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">Smart Groups</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Build it once. Use it every week.
                </h2>
                <p className="text-muted text-lg mt-4 max-w-2xl mx-auto">
                  A Smart Group is your roster for a specific activity. Add everyone who might play — your regulars, your backups, your &ldquo;sometimes&rdquo; people. Then set the order.
                </p>
              </div>

              <div className="md:flex md:items-start md:gap-12">
                {/* Left: explanation */}
                <div className="flex-1 mb-10 md:mb-0">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-[17px] font-bold text-foreground mb-2 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-extrabold">1</span>
                        Add everyone who might play
                      </h3>
                      <p className="text-[14px] text-muted leading-relaxed ml-10">
                        Import from your contacts or add by phone number. Build a roster of 8, 15, or 50 people — whatever your group looks like.
                      </p>
                    </div>
                    <div>
                      <h3 className="text-[17px] font-bold text-foreground mb-2 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-extrabold">2</span>
                        Reuse it every time
                      </h3>
                      <p className="text-[14px] text-muted leading-relaxed ml-10">
                        Create an activity, pick the group. One tap. No re-adding people. No remembering phone numbers.
                      </p>
                    </div>
                    <div>
                      <h3 className="text-[17px] font-bold text-foreground mb-2 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-extrabold">3</span>
                        Multiple groups for multiple activities
                      </h3>
                      <p className="text-[14px] text-muted leading-relaxed ml-10">
                        Golf crew. Pickleball regulars. Volleyball league. Dinner club. Each activity gets its own group with its own roster.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Visual */}
                <div className="flex-1">
                  <div className="space-y-4">
                    {[
                      { name: 'Saturday Golf', icon: '⛳', count: 12, color: 'border-[#15803d]/20' },
                      { name: 'Pickleball Crew', icon: '🏓', count: 18, color: 'border-[#f59e0b]/20' },
                      { name: 'Volleyball League', icon: '🏐', count: 24, color: 'border-[#dc2626]/20' },
                      { name: 'Basketball Fridays', icon: '🏀', count: 15, color: 'border-primary/20' },
                    ].map((group, i) => (
                      <div key={i} className={`bg-white rounded-2xl p-5 border ${group.color} shadow-[0_2px_8px_rgba(0,0,0,0.04)]`}>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{group.icon}</span>
                          <div className="flex-1">
                            <p className="text-[15px] font-bold text-foreground">{group.name}</p>
                            <p className="text-[12px] text-muted">{group.count} members</p>
                          </div>
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">Smart Group</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              THE PRIORITY SYSTEM
              ═══════════════════════════════════════════════ */}
          <section className="py-20 md:py-28">
            <div className="max-w-5xl mx-auto px-6">
              <div className="text-center mb-14">
                <p className="text-[#6366f1] text-sm font-bold uppercase tracking-widest mb-3">Priority Order</p>
                <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  Your top 3 always get first dibs.
                </h2>
                <p className="text-muted text-lg mt-4 max-w-2xl mx-auto">
                  Not everyone is equal. Your ride-or-dies should get invited before the guy who flakes every other week. Priority Order makes that happen automatically.
                </p>
              </div>

              <div className="md:flex md:items-start md:gap-12">
                {/* Left: Priority list visual */}
                <div className="flex-1 mb-10 md:mb-0">
                  <div className="bg-white rounded-2xl p-6 border border-[#6366f1]/20 shadow-[0_4px_24px_rgba(99,102,241,0.08)]">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">⛳</span>
                      <h3 className="text-[16px] font-bold text-foreground">Saturday Golf — Priority Order</h3>
                    </div>

                    <div className="space-y-2">
                      {[
                        { rank: 1, name: 'You (Captain)', badge: 'Always in', badgeColor: 'bg-[#34c759]/10 text-[#34c759]' },
                        { rank: 2, name: 'Dave K.', badge: 'Never misses', badgeColor: 'bg-[#34c759]/10 text-[#34c759]' },
                        { rank: 3, name: 'Tom R.', badge: 'Reliable', badgeColor: 'bg-primary/10 text-primary' },
                        { rank: 4, name: 'Steve M.', badge: 'Reliable', badgeColor: 'bg-primary/10 text-primary' },
                      ].map((p, i) => (
                        <div key={i} className="flex items-center gap-3 bg-[#6366f1]/5 rounded-xl px-4 py-3 border border-[#6366f1]/10">
                          <span className="w-7 h-7 rounded-full bg-[#6366f1] text-white text-[12px] font-extrabold flex items-center justify-center">{p.rank}</span>
                          <span className="text-[14px] font-medium text-foreground flex-1">{p.name}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${p.badgeColor}`}>{p.badge}</span>
                        </div>
                      ))}

                      <div className="border-t border-border/40 pt-2 mt-2">
                        <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2 px-1">Backups (invited when a spot opens)</p>
                        {[
                          { rank: 5, name: 'Brian L.', badge: 'Backup' },
                          { rank: 6, name: 'Mark W.', badge: 'Backup' },
                          { rank: 7, name: 'Kevin P.', badge: 'Backup' },
                          { rank: 8, name: 'Jason H.', badge: 'New' },
                        ].map((p, i) => (
                          <div key={i} className="flex items-center gap-3 bg-surface rounded-xl px-4 py-2.5 border border-border/30 mb-1.5">
                            <span className="w-7 h-7 rounded-full bg-border/60 text-muted text-[12px] font-extrabold flex items-center justify-center">{p.rank}</span>
                            <span className="text-[14px] font-medium text-muted flex-1">{p.name}</span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface text-muted/60">{p.badge}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[12px] text-muted mt-3 text-center">Drag to reorder. Top = invited first.</p>
                  </div>
                </div>

                {/* Right: How priority works */}
                <div className="flex-1">
                  <h3 className="text-xl font-extrabold text-foreground mb-6">How it works in practice:</h3>

                  <div className="space-y-5">
                    <div className="bg-white rounded-xl p-5 border border-border/60">
                      <p className="text-[15px] font-bold text-foreground mb-2">Normal week:</p>
                      <p className="text-[14px] text-muted leading-relaxed">
                        You create &ldquo;Saturday Golf.&rdquo; 4 spots. Whozin texts your top 4 in order. Dave, Tom, and Steve all reply IN. Foursome locked. Nobody below #4 even gets bothered.
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-red-100">
                      <p className="text-[15px] font-bold text-foreground mb-2">Steve can&apos;t make it:</p>
                      <p className="text-[14px] text-muted leading-relaxed">
                        Steve replies OUT. The spot opens. Whozin auto-texts Brian (#5 on your list). Brian replies IN. Foursome filled. You didn&apos;t send a single text.
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-5 border border-[#34c759]/20">
                      <p className="text-[15px] font-bold text-foreground mb-2">Brian is busy too:</p>
                      <p className="text-[14px] text-muted leading-relaxed">
                        Brian passes. Whozin auto-texts Mark (#6). Mark&apos;s in. Done. The list keeps going until the spot fills. You never touch your phone.
                      </p>
                    </div>

                    <div className="bg-primary/5 rounded-xl p-5 border border-primary/15">
                      <p className="text-[15px] font-bold text-primary mb-2">The key insight:</p>
                      <p className="text-[14px] text-muted leading-relaxed">
                        Your top people always get first dibs. Your backups only get invited when there&apos;s an actual open spot. Nobody gets spammed. Nobody gets skipped. The order matters — and you set it.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              OR JUST BLAST EVERYONE
              ═══════════════════════════════════════════════ */}
          <section className="py-16 md:py-20 bg-surface">
            <div className="max-w-3xl mx-auto px-6">
              <div className="bg-[#0a0f1e] rounded-3xl p-8 md:p-10 relative overflow-hidden">
                <div className="absolute top-[-50%] left-[-20%] w-[400px] h-[400px] rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
                <div className="absolute bottom-[-50%] right-[-20%] w-[300px] h-[300px] rounded-full bg-[#6366f1]/10 blur-[80px] pointer-events-none" />
                <div className="relative">
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
                    Don&apos;t need priority? Just blast everyone.
                  </h2>
                  <p className="text-white/60 text-[15px] leading-relaxed mb-4">
                    Priority Order is optional. If your group is small or you don&apos;t care about invite order, just send it to everyone at once. First people to reply IN get the spots.
                  </p>
                  <p className="text-white/40 text-sm font-medium">
                    Two modes. Same group. You choose every time you create an activity.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              ZERO APP REQUIRED
              ═══════════════════════════════════════════════ */}
          <section className="py-16 md:py-20">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mb-4">
                Nobody in your group needs the app.
              </h2>
              <p className="text-muted text-lg max-w-xl mx-auto">
                You build the group. You set the priority. They just get a text and reply IN or OUT. No download. No account. No friction.
              </p>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              FINAL CTA
              ═══════════════════════════════════════════════ */}
          <CtaSection
            onSignIn={onSignIn}
            headline={<>Build your group once.<br /><span className="text-primary">Use it every week.</span></>}
            subheadline="Your regulars get first dibs. Your backups fill the gaps. You never scramble again."
            buttonText="Build Your First Group — Free"
          />
        </>
      )}
    </MarketingShell>
  )
}
