'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isNative } from '@/lib/capacitor'
import AuthForm from '@/components/auth/auth-form'
import { DEFAULT_ACTIVITY_PRESETS } from '@/lib/activity-presets'
import { BrandedFullLogo } from '@/components/ui/branded-logo'
import { ContactModal } from '@/components/ui/contact-modal'

/* ── Rotating activities for the hero mockup ── */
const HERO_ACTIVITIES = [
  { name: 'Friday Night Basketball', icon: '🏀', date: 'Mar 14 · 7:00 PM', location: 'Downtown Gym', spots: 3 },
  { name: 'Pickleball Doubles', icon: '🏓', date: 'Mar 15 · 10:00 AM', location: 'Sunset Courts', spots: 2 },
  { name: 'Saturday Golf', icon: '⛳', date: 'Mar 16 · 8:30 AM', location: 'Pine Valley CC', spots: 1 },
  { name: 'Dinner at Nobu', icon: '🍽️', date: 'Mar 17 · 7:30 PM', location: 'Nobu Downtown', spots: 4 },
  { name: 'Beach Volleyball', icon: '🏐', date: 'Mar 18 · 4:00 PM', location: 'Mission Beach', spots: 6 },
  { name: 'Movie Night', icon: '🎬', date: 'Mar 19 · 8:00 PM', location: 'AMC Theater', spots: 5 },
  { name: 'Sunday Soccer', icon: '⚽', date: 'Mar 20 · 9:00 AM', location: 'Balboa Park', spots: 4 },
  { name: 'Happy Hour', icon: '🍺', date: 'Mar 21 · 5:30 PM', location: 'Rooftop Bar', spots: 8 },
]

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

/* ── Feature Card ── */
function FeatureCard({ icon, title, desc, delay }: { icon: React.ReactNode; title: string; desc: string; delay: number }) {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      className={`group relative bg-white rounded-2xl p-6 border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(66,133,244,0.12)] hover:border-primary/30 transition-all duration-500 ${visible ? 'animate-pop-in' : 'opacity-0'}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-[17px] font-bold text-foreground mb-1.5">{title}</h3>
      <p className="text-[14px] text-muted leading-relaxed">{desc}</p>
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

/* ── Main Landing Page ── */
export default function HomePage() {
  const [showAuth, setShowAuth] = useState(false)
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [activityIdx, setActivityIdx] = useState(0)
  const [activityFade, setActivityFade] = useState(true)
  const [showContact, setShowContact] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const ctaSection = useInView()
  const socialSection = useInView()
  const router = useRouter()

  // On native app, go straight to auth (no landing page)
  // Otherwise just show the landing page immediately (no auth check blocking render)
  useEffect(() => {
    if (isNative()) {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          router.replace('/app')
        } else {
          setShowAuth(true)
          setCheckingAuth(false)
        }
      })
    } else {
      setCheckingAuth(false)
    }
  }, [router])

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  // Rotate hero activity every 3.5s
  useEffect(() => {
    const interval = setInterval(() => {
      setActivityFade(false)
      setTimeout(() => {
        setActivityIdx((i) => (i + 1) % HERO_ACTIVITIES.length)
        setActivityFade(true)
      }, 300)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  // Check session before showing auth — if already logged in, go straight to app
  function handleSignIn() {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/app')
      } else {
        setShowAuth(true)
      }
    })
  }

  const heroActivity = HERO_ACTIVITIES[activityIdx]

  if (checkingAuth) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (showAuth) {
    return <AuthForm onBack={isNative() ? undefined : () => setShowAuth(false)} />
  }

  return (
    <main className="min-h-dvh bg-background overflow-x-hidden">

      {/* ═══════════════════════════════════════════════
          HERO SECTION — Dark, bold, animated
          ═══════════════════════════════════════════════ */}
      <section className="relative bg-[#0a0f1e] overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/20 blur-[120px] animate-float-slow pointer-events-none" />
        <div className="absolute bottom-[-30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-[#6366f1]/15 blur-[100px] animate-float pointer-events-none" />

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
              onClick={handleSignIn}
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
                <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-full px-4 py-1.5 mb-6">
                  <span className="w-2 h-2 rounded-full bg-[#34c759] animate-pulse" />
                  <span className="text-white/70 text-xs font-medium tracking-wide uppercase">Now in Beta</span>
                </div>

                <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold text-white leading-[1.05] tracking-tight mb-5">
                  Find out<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#60a5fa] to-[#818cf8] animate-gradient">
                    who&apos;s in
                  </span>
                </h1>
                <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-md mb-8">
                  Stop blowing up the group chat. Organize activities, send smart invites, and get instant responses.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleSignIn}
                    className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-base hover:bg-primary-dark active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(66,133,244,0.4)] hover:shadow-[0_8px_32px_rgba(66,133,244,0.5)]"
                  >
                    Get Started — It&apos;s Free
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

            {/* Right: Animated response bubbles */}
            <div className={`flex-1 max-w-md mx-auto md:mx-0 transition-all duration-700 delay-300 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
              <div className="relative">
                {/* Phone frame mockup */}
                <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-5 backdrop-blur-sm">
                  <div className={`bg-white/[0.06] rounded-2xl p-4 mb-3 transition-all duration-300 ${activityFade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                    <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1">Activity</p>
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{heroActivity.icon}</span>
                      <div>
                        <p className="text-white font-bold text-lg leading-tight">{heroActivity.name}</p>
                        <p className="text-white/50 text-sm">{heroActivity.date} · {heroActivity.location}</p>
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
                    <span className="text-white/25 text-xs">{heroActivity.spots} spots left</span>
                  </div>
                </div>
              </div>
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
          SOCIAL PROOF BAR
          ═══════════════════════════════════════════════ */}
      <section
        ref={socialSection.ref}
        className={`py-10 border-b border-border/50 transition-all duration-700 ${socialSection.visible ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap justify-center gap-x-12 gap-y-4 items-center">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-foreground">100%</p>
            <p className="text-xs text-muted font-medium">Free to Use</p>
          </div>
          <div className="w-px h-8 bg-border/60 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-extrabold text-foreground">Zero</p>
            <p className="text-xs text-muted font-medium">App Required for Invitees</p>
          </div>
          <div className="w-px h-8 bg-border/60 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-extrabold text-foreground">Instant</p>
            <p className="text-xs text-muted font-medium">SMS Responses</p>
          </div>
          <div className="w-px h-8 bg-border/60 hidden sm:block" />
          <div className="text-center">
            <p className="text-2xl font-extrabold text-foreground">&lt; 30s</p>
            <p className="text-xs text-muted font-medium">To Create an Activity</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FEATURES — What makes Whozin different
          ═══════════════════════════════════════════════ */}
      <section className="py-20 md:py-28" id="features">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">Why Whozin</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Everything the group chat <em className="not-italic text-primary">can&apos;t</em> do
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <FeatureCard
              delay={0}
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M2 21v-1a5 5 0 0110 0v1M14 21v-1a4 4 0 018 0v1" />
                </svg>
              }
              title="Smart Groups"
              desc="Create groups for your regulars — basketball crew, hiking squad, dinner club. Reuse them across activities."
            />
            <FeatureCard
              delay={0.1}
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M4 12h16M4 18h7" />
                  <path d="M16 16l2 2 4-4" />
                </svg>
              }
              title="Priority Invites"
              desc="Set the invite order. When spots are limited, Whozin contacts people in your priority order until it's full."
            />
            <FeatureCard
              delay={0.2}
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              }
              title="Instant Responses"
              desc='Invitees get a text: "Are you in?" They reply IN or OUT. No app download, no account needed. Done.'
            />
            <FeatureCard
              delay={0.3}
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <path d="M12 18h.01" />
                </svg>
              }
              title="No App Required"
              desc="Your friends don't need to download anything. They respond via SMS. If they want more, the app is optional."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          HOW IT WORKS — 3 steps
          ═══════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 bg-surface relative" id="how-it-works">
        {/* Subtle diagonal stripes */}
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #4285F4 0, #4285F4 1px, transparent 0, transparent 50%)',
          backgroundSize: '20px 20px',
        }} />

        <div className="relative max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Three steps. That&apos;s it.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-7 left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-[2px] bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

            <StepCard
              num={1}
              delay={0}
              title="Create an Activity"
              desc="Name it, set the date, pick your group, and set how many spots are open."
            />
            <StepCard
              num={2}
              delay={0.15}
              title="Whozin Sends Invites"
              desc='Your group gets a text: "Are you in?" They reply IN or OUT — simple as that.'
            />
            <StepCard
              num={3}
              delay={0.3}
              title="See Who's In"
              desc="Watch responses come in live. When spots fill, waitlisted people get bumped up automatically."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          IN vs OUT — Brand personality section
          ═══════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="md:flex md:items-center md:gap-16">
            {/* Left: Visual */}
            <div className="flex-1 mb-10 md:mb-0">
              <div className="relative">
                {/* Big IN */}
                <div className="bg-[#34c759]/10 border-2 border-[#34c759]/20 rounded-3xl p-8 text-center mb-4 animate-pulse-glow">
                  <p className="text-[#34c759] text-6xl md:text-7xl font-extrabold tracking-tight">IN</p>
                  <p className="text-[#34c759]/60 text-sm font-semibold mt-2">4 of 5 spots filled</p>
                </div>
                {/* Small OUT */}
                <div className="bg-surface border border-border/60 rounded-2xl p-5 text-center w-32 absolute -bottom-2 -right-2 shadow-lg">
                  <p className="text-muted text-2xl font-extrabold">OUT</p>
                  <p className="text-muted/50 text-[10px] font-medium mt-1">Maybe next time</p>
                </div>
              </div>
            </div>

            {/* Right: Copy */}
            <div className="flex-1">
              <p className="text-primary text-sm font-bold uppercase tracking-widest mb-3">The Whozin Way</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-5">
                Two words.<br />Zero confusion.
              </h2>
              <p className="text-muted text-base leading-relaxed mb-6">
                No &ldquo;maybe&rdquo;, no &ldquo;let me check&rdquo;, no 47 messages deep in a thread.
                Whozin makes it binary: you&apos;re <strong className="text-foreground">IN</strong> or you&apos;re <strong className="text-foreground">OUT</strong>.
                The activity fills up, the waitlist moves, and everyone knows where they stand.
              </p>
              <ul className="space-y-3">
                {[
                  'Spots fill in priority order — first dibs for your most reliable people',
                  'Response timers ensure nobody holds up the group',
                  'Waitlisted? You auto-move up when someone drops out',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                    <span className="text-[14px] text-muted leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PERFECT FOR — Scrolling ticker tape
          ═══════════════════════════════════════════════ */}
      <section className="py-12 bg-surface border-y border-border/40 overflow-hidden">
        <p className="text-center text-primary text-sm font-bold uppercase tracking-widest mb-6">Perfect for</p>

        {/* Row 1 — scrolls left */}
        <div className="flex animate-marquee whitespace-nowrap mb-3">
          {[...Array(2)].map((_, set) => (
            <div key={set} className="flex gap-3 px-1.5">
              {DEFAULT_ACTIVITY_PRESETS.filter((_, i) => i % 2 === 0).map((a) => (
                <span
                  key={`${set}-${a.id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-border/50 rounded-full text-[13px] font-semibold text-foreground/80 whitespace-nowrap shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  <span className="text-base">{a.icon}</span>
                  {a.name}
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Row 2 — scrolls right */}
        <div className="flex whitespace-nowrap" style={{ animation: 'marquee 35s linear infinite reverse' }}>
          {[...Array(2)].map((_, set) => (
            <div key={set} className="flex gap-3 px-1.5">
              {DEFAULT_ACTIVITY_PRESETS.filter((_, i) => i % 2 === 1).map((a) => (
                <span
                  key={`${set}-${a.id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-border/50 rounded-full text-[13px] font-semibold text-foreground/80 whitespace-nowrap shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  <span className="text-base">{a.icon}</span>
                  {a.name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════ */}
      <section
        ref={ctaSection.ref}
        className="py-24 md:py-32 relative overflow-hidden"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-[#6366f1]/5" />

        <div className={`relative max-w-2xl mx-auto px-6 text-center transition-all duration-700 ${ctaSection.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-6 shadow-[0_4px_24px_rgba(66,133,244,0.3)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <ellipse cx="8" cy="6" rx="2.5" ry="3" />
              <ellipse cx="16" cy="6" rx="2.5" ry="3" />
              <ellipse cx="4.5" cy="12" rx="2" ry="2.5" />
              <ellipse cx="19.5" cy="12" rx="2" ry="2.5" />
              <ellipse cx="12" cy="16.5" rx="5" ry="4.5" />
            </svg>
          </div>

          <h2 className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4">
            Ready to find out<br />who&apos;s in?
          </h2>
          <p className="text-muted text-lg mb-8 max-w-md mx-auto">
            Set up your first activity in under 30 seconds. Your crew will thank you.
          </p>

          <button
            onClick={handleSignIn}
            className="px-10 py-4 rounded-2xl bg-primary text-white font-bold text-lg hover:bg-primary-dark active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(66,133,244,0.4)] hover:shadow-[0_8px_32px_rgba(66,133,244,0.5)]"
          >
            Get Started — Free Forever
          </button>

          <p className="text-xs text-muted mt-4">No credit card. No app download required for your friends.</p>
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
