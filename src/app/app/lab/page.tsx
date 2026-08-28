'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth'

// Dev-only line-calling lab. Where the cross-platform in/out caller gets built.
export default function LabPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await createClient().auth.getUser()
        let ok = user?.email ? isSuperAdmin(user.email) : false
        if (!ok) {
          const p = await fetch('/api/user/profile').then((r) => (r.ok ? r.json() : null)).catch(() => null)
          const digits = (p?.phone || '').replace(/\D/g, '')
          ok = digits.startsWith('1') ? digits.slice(1, 4) === '999' : digits.slice(0, 3) === '999'
        }
        if (cancelled) return
        setAllowed(ok)
        if (!ok) router.replace('/app')
      } catch {
        if (!cancelled) { setAllowed(false); router.replace('/app') }
      }
    })()
    return () => { cancelled = true }
  }, [router])

  if (!allowed) {
    return (
      <div className="h-full flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface overflow-y-auto">
      <AppHeader showBack />
      <div className="px-4 py-5 space-y-4 pb-10">
        <div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wide text-red-600 bg-red-100 px-2 py-0.5 rounded-full mb-2">Dev only</span>
          <h1 className="text-2xl font-bold text-foreground">Line-calling lab</h1>
          <p className="text-[14px] text-muted mt-1 leading-relaxed">
            Where we build the cross-platform in/out caller. Record a rally, tag the court once, and we work out whether the ball was in or out.
          </p>
        </div>

        <div className="bg-background border border-border/50 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" fill="#ef4444" stroke="none" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-foreground">Recording + analysis lands here</p>
          <p className="text-[13px] text-muted mt-1 leading-relaxed">
            The CV toolchain is live. Next up: record a clip → tag the court corners → track the ball → call the bounce.
          </p>
        </div>

        <div className="bg-background border border-border/50 rounded-2xl p-4 space-y-1.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-muted mb-1">Progress</p>
          <p className="text-[13px] text-foreground">✅ Phone → Claude clip transfer (Remote Control)</p>
          <p className="text-[13px] text-foreground">✅ CV toolchain installed (OpenCV + ffmpeg)</p>
          <p className="text-[13px] text-muted">⏳ Court calibration → ball tracking → bounce → in/out</p>
        </div>
      </div>
    </div>
  )
}
