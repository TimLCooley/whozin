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

        // Request permission
        const permResult = await PushNotifications.requestPermissions()
        if (permResult.receive !== 'granted') return

        // Register for push
        await PushNotifications.register()

        // Listen for token
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

        // Handle registration error
        PushNotifications.addListener('registrationError', (err) => {
          console.error('Push registration failed:', err)
        })

        // Handle notification received while app is open
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received in foreground:', notification)
        })

        // Handle notification tapped
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const link = action.notification.data?.link
          if (link && typeof window !== 'undefined') {
            window.location.href = link
          }
        })
      } catch (err) {
        console.error('Push notification setup failed:', err)
      }
    }

    setupPush()
  }, [])
}
