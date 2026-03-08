'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth'

// Module-level cache for nav logo
let cachedNavLogo: string | null = null
let navLogoFetch: Promise<string | null> | null = null

function getNavLogo(): Promise<string | null> {
  if (cachedNavLogo !== null) return Promise.resolve(cachedNavLogo)
  if (navLogoFetch) return navLogoFetch
  navLogoFetch = fetch('/api/admin/settings')
    .then((r) => r.json())
    .then((data) => { cachedNavLogo = data.logo_nav || null; return cachedNavLogo })
    .catch(() => null)
  return navLogoFetch
}

interface AppHeaderProps {
  showBack?: boolean
}

export function AppHeader({ showBack }: AppHeaderProps) {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [navLogo, setNavLogo] = useState<string | null>(cachedNavLogo)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && isSuperAdmin(user.email)) {
        setIsAdmin(true)
      }
    })

    // Fetch unread alert count
    fetch('/api/alerts?count=unread')
      .then((r) => r.json())
      .then((data) => setUnreadCount(data.unread ?? 0))
      .catch(() => {})

    // Fetch nav logo from branding
    if (!cachedNavLogo) {
      getNavLogo().then((url) => { if (url) setNavLogo(url) })
    }
  }, [])

  return (
    <header className="relative bg-gradient-to-b from-primary to-primary-dark px-4 py-3.5 flex items-center justify-between">
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_20%_50%,white_1px,transparent_1px),radial-gradient(circle_at_80%_20%,white_1px,transparent_1px)] bg-[length:32px_32px]" />

      <div className="relative flex items-center gap-1">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 text-white/90 active:text-white transition-colors"
            aria-label="Go back"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <button
          onClick={() => router.push('/app')}
          className="flex items-center gap-2.5 active:opacity-80 transition-opacity"
          aria-label="Home"
        >
          {navLogo ? (
            <img src={navLogo} alt="Whozin" className="h-8 object-contain" />
          ) : (
            <>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="7.5" cy="6.5" rx="2.2" ry="2.5" fill="white" opacity="0.95" />
                <ellipse cx="16.5" cy="6.5" rx="2.2" ry="2.5" fill="white" opacity="0.95" />
                <circle cx="4" cy="13" r="1.8" fill="white" opacity="0.95" />
                <circle cx="20" cy="13" r="1.8" fill="white" opacity="0.95" />
                <ellipse cx="12" cy="16.5" rx="5.5" ry="4.2" fill="white" />
              </svg>
              <h1 className="text-[22px] font-extrabold text-white tracking-tight leading-none">
                Whoz<span className="italic font-extrabold">in</span>
              </h1>
            </>
          )}
        </button>
      </div>

      <div className="relative flex items-center gap-3.5">
        {/* Admin shield - only for super admins */}
        {isAdmin && (
          <button
            className="p-1.5 -m-1.5 text-white/90 active:text-white transition-colors"
            aria-label="Admin Portal"
            onClick={() => router.push('/admin')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </button>
        )}

        {/* Notification bell */}
        <button
          className="relative p-1.5 -m-1.5 text-white/90 active:text-white transition-colors"
          aria-label="Alerts"
          onClick={() => router.push('/app/alerts')}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-danger rounded-full ring-2 ring-primary-dark" />
          )}
        </button>

        {/* Settings gear */}
        <button
          className="p-1.5 -m-1.5 text-white/90 active:text-white transition-colors"
          aria-label="Settings"
          onClick={() => router.push('/app/settings')}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  )
}
