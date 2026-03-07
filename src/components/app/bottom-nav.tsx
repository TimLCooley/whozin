'use client'

import { usePathname, useRouter } from 'next/navigation'

const tabs = [
  {
    label: 'All Activities',
    href: '/app',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {active ? (
          <>
            <rect x="3" y="4" width="18" height="18" rx="3" fill="currentColor" />
            <path d="M3 10h18" stroke="white" strokeWidth="1.5" />
            <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <rect x="7" y="13" width="3" height="2.5" rx="0.5" fill="white" />
            <rect x="10.5" y="13" width="3" height="2.5" rx="0.5" fill="white" opacity="0.5" />
          </>
        ) : (
          <>
            <rect x="3" y="4" width="18" height="18" rx="3" />
            <path d="M3 10h18" />
            <path d="M8 2v4M16 2v4" />
          </>
        )}
      </svg>
    ),
  },
  {
    label: 'Groups List',
    href: '/app/groups',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {active ? (
          <>
            <circle cx="9" cy="7" r="3.5" fill="currentColor" />
            <circle cx="17" cy="9" r="2.8" fill="currentColor" opacity="0.7" />
            <path d="M1.5 21v-1a5.5 5.5 0 0111 0v1" fill="currentColor" />
            <path d="M14 21v-1a4.5 4.5 0 019 0v1" fill="currentColor" opacity="0.7" />
          </>
        ) : (
          <>
            <circle cx="9" cy="7" r="3" />
            <circle cx="17" cy="9" r="2.5" />
            <path d="M2 21v-1a5 5 0 0110 0v1" />
            <path d="M14 21v-1a4 4 0 018 0v1" />
          </>
        )}
      </svg>
    ),
  },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/60 pb-[env(safe-area-inset-bottom)] z-40">
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = tab.href === '/app'
            ? pathname === '/app'
            : pathname.startsWith(tab.href)

          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className={`flex-1 flex flex-col items-center pt-2 pb-1.5 transition-colors ${
                isActive ? 'text-primary' : 'text-muted'
              }`}
            >
              {tab.icon(isActive)}
              <span className={`text-[10px] mt-1 ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
