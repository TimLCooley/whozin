'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const TABS = [
  {
    href: '/admin/marketing',
    label: 'Ask',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a7 7 0 00-7 7c0 2.8 1.6 5.2 4 6.3V18h6v-2.7c2.4-1.1 4-3.5 4-6.3a7 7 0 00-7-7z" />
        <path d="M9 21h6M10 18v3M14 18v3" />
      </svg>
    ),
  },
  {
    href: '/admin/marketing/calendar',
    label: 'Calendar',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18M8 2v4M16 2v4" />
      </svg>
    ),
  },
  {
    href: '/admin/marketing/drafts',
    label: 'Drafts',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" />
      </svg>
    ),
  },
]

// Paths where we HIDE the tabs — detail/edit views get their own back links.
const HIDE_TABS_ON = [
  /^\/admin\/marketing\/[^/]+\/content\/[^/]+$/,  // content item edit
  /^\/admin\/marketing\/[^/]+\/content\/new$/,    // new content item
  /^\/admin\/marketing\/brief$/,                   // brief intake (its own flow)
  /^\/admin\/marketing\/new$/,                     // new campaign (manual advanced)
]

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const hideTabs = HIDE_TABS_ON.some((re) => re.test(pathname))

  // Campaign detail at /admin/marketing/[id] — also hide tabs since that's a drill-in
  // Match exactly 3 segments after /admin/marketing/
  const isCampaignDetail = /^\/admin\/marketing\/[0-9a-f-]{8,}$/.test(pathname)

  if (hideTabs || isCampaignDetail) {
    return <>{children}</>
  }

  return (
    <div>
      {/* Sub-nav tabs */}
      <div className="flex items-center justify-between gap-3 mb-6 pb-3 border-b border-border/50">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive =
              tab.href === '/admin/marketing'
                ? pathname === '/admin/marketing'
                : pathname === tab.href || pathname.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted hover:text-foreground hover:bg-surface'
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            )
          })}
        </div>

        <Link
          href="/admin/marketing/brief"
          className="text-xs text-muted hover:text-foreground hover:underline whitespace-nowrap flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Edit brief
        </Link>
      </div>

      {children}
    </div>
  )
}
