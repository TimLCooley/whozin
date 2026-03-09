'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
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
  }, [router])

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
