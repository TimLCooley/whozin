'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// Module-level store — any page can open the paywall without prop-drilling.
// The modal itself is mounted once at the app layout level.
let listener: ((open: boolean) => void) | null = null
let openState = false

export function showPaywall() {
  openState = true
  listener?.(true)
}

export function hidePaywall() {
  openState = false
  listener?.(false)
}

export function PaywallModal() {
  const [open, setOpen] = useState(openState)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    listener = setOpen
    setOpen(openState)
    return () => {
      listener = null
    }
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-6" onClick={hidePaywall}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-xl animate-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-primary/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <h3 className="text-[18px] font-bold text-foreground">Whozin Pro</h3>
          <p className="text-[13px] text-muted mt-1 leading-relaxed">
            This feature is part of Whozin Pro.
          </p>
        </div>
        <ul className="space-y-2 mb-5 text-[13px] text-foreground">
          <li className="flex items-center gap-2"><span className="text-primary">✓</span> Activity & Group Chat</li>
          <li className="flex items-center gap-2"><span className="text-primary">✓</span> Custom Response Timers</li>
          <li className="flex items-center gap-2"><span className="text-primary">✓</span> AI Image Generation</li>
          <li className="flex items-center gap-2"><span className="text-primary">✓</span> Auto Reminders</li>
        </ul>
        <div className="flex gap-3">
          <button
            onClick={hidePaywall}
            className="flex-1 py-2.5 rounded-xl border border-border text-[14px] font-semibold text-muted active:bg-surface transition-colors"
          >
            Not now
          </button>
          <button
            onClick={() => {
              hidePaywall()
              router.push(`/app/upgrade?returnTo=${encodeURIComponent(pathname || '/app')}`)
            }}
            className="flex-1 btn-primary py-2.5 text-[14px]"
          >
            Upgrade
          </button>
        </div>
      </div>
    </div>
  )
}
