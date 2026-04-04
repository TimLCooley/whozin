'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Capacitor } from '@capacitor/core'
import { useSwipeBack } from '@/hooks/use-swipe-back'
import { usePushNotifications } from '@/lib/use-push-notifications'
import { BottomNav } from '@/components/app/bottom-nav'
import { PushPermissionGate } from '@/components/app/push-permission-gate'
import { ForceUpdateGate } from '@/components/app/force-update-gate'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [needsPushPermission, setNeedsPushPermission] = useState(false)
  useSwipeBack()
  usePushNotifications()

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

        // On native, initialize RevenueCat for IAP
        if (Capacitor.isNativePlatform()) {
          try {
            const { Purchases } = await import('@revenuecat/purchases-capacitor')
            const platform = Capacitor.getPlatform()
            const rcKey = platform === 'ios'
              ? process.env.NEXT_PUBLIC_REVENUECAT_APPLE_KEY?.trim()
              : process.env.NEXT_PUBLIC_REVENUECAT_GOOGLE_KEY?.trim()
            if (rcKey) {
              await Purchases.configure({ apiKey: rcKey, appUserID: user.id })
            }
          } catch {
            // RevenueCat not available — skip
          }
        }

        // On native, check if push token is saved
        // Only show gate if the plugin is actually available
        if (Capacitor.isNativePlatform() && !profile.push_token) {
          try {
            const { PushNotifications } = await import('@capacitor/push-notifications')
            const perm = await PushNotifications.checkPermissions()
            // Only gate if plugin works and permission hasn't been decided yet
            if (perm.receive === 'prompt') {
              setNeedsPushPermission(true)
            }
          } catch {
            // Plugin not available — skip the gate
          }
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

    // Proactive token refresh every 10 minutes to keep session alive
    const refreshInterval = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const expiresAt = session.expires_at ?? 0
          const now = Math.floor(Date.now() / 1000)
          // Refresh if token expires within 15 minutes
          if (expiresAt - now < 900) {
            supabase.auth.refreshSession()
          }
        }
      })
    }, 10 * 60 * 1000)

    return () => {
      subscription.unsubscribe()
      clearInterval(refreshInterval)
    }
  }, [router])

  const handlePushGranted = useCallback(() => {
    setNeedsPushPermission(false)
  }, [])

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (needsPushPermission) {
    return <PushPermissionGate onGranted={handlePushGranted} />
  }

  return (
    <ForceUpdateGate>
      <div className="h-dvh md:flex md:items-center md:justify-center md:bg-gray-100">
        <div className="relative w-full h-full md:max-w-[480px] md:h-[calc(100dvh-4rem)] md:max-h-[932px] md:rounded-3xl md:shadow-2xl md:border md:border-gray-200 bg-background flex flex-col" style={{ transform: 'translateZ(0)' }}>
          <div className="flex-1 flex flex-col min-h-0">
            {children}
          </div>
          <BottomNav />
        </div>
      </div>
    </ForceUpdateGate>
  )
}
