'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSwipeBack } from '@/hooks/use-swipe-back'
import { BottomNav } from '@/components/app/bottom-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  useSwipeBack()

  useEffect(() => {
    const supabase = createClient()

    // Check initial auth state
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/')
        return
      }
      // Check if user has a phone number (required for app access)
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const profile = await res.json()
        if (!profile.phone) {
          router.replace('/auth/complete-profile')
          return
        }
      }
      setReady(true)
    })

    // Listen for auth state changes (sign out, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-dvh md:flex md:items-center md:justify-center md:bg-gray-100">
      <div className="relative w-full h-full md:max-w-[480px] md:h-[calc(100dvh-4rem)] md:max-h-[932px] md:rounded-3xl md:shadow-2xl md:border md:border-gray-200 bg-background" style={{ transform: 'translateZ(0)' }}>
        <div className="h-full overflow-y-auto">
          {children}
        </div>
        <BottomNav />
      </div>
    </div>
  )
}
