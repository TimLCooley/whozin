'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isNative } from '@/lib/capacitor'
import AuthForm from '@/components/auth/auth-form'
import { BrandedFullLogo } from '@/components/ui/branded-logo'
import { ContactModal } from '@/components/ui/contact-modal'

/* ── Navigation links ── */
const NAV_LINKS = [
  { href: '/build', label: 'Build' },
  { href: '/fill', label: 'Fill' },
  { href: '/golf', label: 'Golf' },
  { href: '/pickleball', label: 'Pickleball' },
  { href: '/volleyball', label: 'Volleyball' },
]

/* ── Marketing Shell: wraps all landing/marketing pages ── */
export function MarketingShell({
  children,
  isHome = false,
}: {
  children: (props: { onSignIn: () => void }) => React.ReactNode
  isHome?: boolean
}) {
  const [showAuth, setShowAuth] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()

  // On native app, go straight to auth (no landing page)
  useEffect(() => {
    if (isNative() && isHome) {
      const supabase = createClient()
      const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) { router.replace('/app'); return }

        const nonceMatch = document.cookie.match(/(^| )_whozin_nonce=([^;]*)/)
        const savedNonce = nonceMatch ? nonceMatch[2] : null
        if (savedNonce) {
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000))
            try {
              const res = await fetch(`/api/auth/oauth-poll?nonce=${savedNonce}`)
              const data = await res.json()
              if (!data.pending && data.access_token) {
                const { error: sessionError } = await supabase.auth.setSession({
                  access_token: data.access_token,
                  refresh_token: data.refresh_token,
                })
                if (!sessionError) {
                  document.cookie = '_whozin_nonce=;path=/;max-age=0'
                  await fetch('/api/auth/ensure-profile', { method: 'POST' })
                  router.replace('/app')
                  return
                }
              }
            } catch { /* keep polling */ }
          }
        }

        setShowAuth(true)
        setCheckingAuth(false)
      }
      checkAuth()

      const handleVisibility = () => {
        if (document.visibilityState === 'visible') checkAuth()
      }
      document.addEventListener('visibilitychange', handleVisibility)
      return () => document.removeEventListener('visibilitychange', handleVisibility)
    } else {
      setCheckingAuth(false)
    }
  }, [router, isHome])

  function handleSignIn() {
    if (isNative()) {
      setShowAuth(true)
      return
    }
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { router.replace('/app') } else { setShowAuth(true) }
    })
  }

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
      {children({ onSignIn: handleSignIn })}

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-[#0a0f1e] text-white/50 py-10">
        <div className="max-w-6xl mx-auto px-6">
          {/* Nav links */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-6 text-sm">
            {!isHome && <a href="/" className="hover:text-white transition-colors">Home</a>}
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-white transition-colors">{l.label}</a>
            ))}
          </div>

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

/* ── Hero Nav Bar (used inside hero sections) ── */
export function HeroNav({ onSignIn }: { onSignIn: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="flex items-center justify-between mb-16 md:mb-24 relative">
      <a href="/"><BrandedFullLogo className="h-9" /></a>

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-6">
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href} className="text-white/50 hover:text-white text-sm font-medium transition-colors">{l.label}</a>
        ))}
        <button
          onClick={onSignIn}
          className="text-white/80 hover:text-white text-sm font-semibold px-5 py-2.5 rounded-xl border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all"
        >
          Sign In
        </button>
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden text-white/80 hover:text-white p-2"
        aria-label="Menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          {menuOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
        </svg>
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0f1e]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3 md:hidden z-50">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-white/70 hover:text-white text-sm font-medium py-2 px-3 rounded-lg hover:bg-white/5 transition-all">{l.label}</a>
          ))}
          <button
            onClick={() => { setMenuOpen(false); onSignIn() }}
            className="text-white font-semibold text-sm py-2.5 px-3 rounded-xl bg-primary hover:bg-primary-dark transition-all text-center"
          >
            Sign In
          </button>
        </div>
      )}
    </nav>
  )
}

/* ── CTA Section (reused on every page) ── */
export function CtaSection({
  onSignIn,
  headline,
  subheadline,
  buttonText = 'Get Started — Free',
  footnote = 'No credit card. No app download required for your friends.',
}: {
  onSignIn: () => void
  headline: React.ReactNode
  subheadline: string
  buttonText?: string
  footnote?: string
}) {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-[#6366f1]/5" />
      <div className="relative max-w-2xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4">
          {headline}
        </h2>
        <p className="text-muted text-lg mb-8 max-w-md mx-auto">{subheadline}</p>
        <button
          onClick={onSignIn}
          className="px-10 py-4 rounded-2xl bg-primary text-white font-bold text-lg hover:bg-primary-dark active:scale-[0.97] transition-all shadow-[0_4px_24px_rgba(66,133,244,0.4)] hover:shadow-[0_8px_32px_rgba(66,133,244,0.5)]"
        >
          {buttonText}
        </button>
        <p className="text-xs text-muted mt-4">{footnote}</p>
      </div>
    </section>
  )
}
