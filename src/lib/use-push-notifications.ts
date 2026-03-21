'use client'

import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'

export function usePushNotifications() {
  const registered = useRef(false)

  useEffect(() => {
    if (registered.current) return
    if (!Capacitor.isNativePlatform()) return

    registered.current = true

    async function setupPush() {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        // Set up listeners BEFORE registering (events can fire immediately)
        PushNotifications.addListener('registration', async (token) => {
          try {
            await fetch('/api/user/push-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token.value,
                platform: Capacitor.getPlatform(),
              }),
            })
          } catch (err) {
            console.error('Failed to save push token:', err)
          }
        })

        PushNotifications.addListener('registrationError', (err) => {
          console.error('Push registration failed:', err)
        })

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received in foreground:', notification)
        })

        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const link = action.notification.data?.link
          if (link && typeof window !== 'undefined') {
            window.location.href = link
          }
        })

        // Now request permission and register
        const permResult = await PushNotifications.requestPermissions()
        if (permResult.receive !== 'granted') return

        await PushNotifications.register()
      } catch (err) {
        console.error('Push notification setup failed:', err)
      }
    }

    setupPush()
  }, [])
}
