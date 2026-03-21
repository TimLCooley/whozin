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

        // Log to a visible place for debugging
        const log = (msg: string) => {
          const logs = JSON.parse(localStorage.getItem('push_debug') || '[]')
          logs.push(`${new Date().toLocaleTimeString()}: ${msg}`)
          localStorage.setItem('push_debug', JSON.stringify(logs.slice(-20)))
        }

        log('Plugin loaded OK')

        // Set up listeners BEFORE registering (events can fire immediately)
        PushNotifications.addListener('registration', async (token) => {
          log(`Got token: ${token.value.slice(0, 20)}...`)
          try {
            const res = await fetch('/api/user/push-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token.value,
                platform: Capacitor.getPlatform(),
              }),
            })
            log(`Token save: ${res.status} ${res.ok ? 'OK' : 'FAILED'}`)
          } catch (err) {
            log(`Token save error: ${err instanceof Error ? err.message : String(err)}`)
          }
        })

        PushNotifications.addListener('registrationError', (err) => {
          log(`Registration ERROR: ${JSON.stringify(err)}`)
        })

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          log(`Push received: ${notification.title}`)
        })

        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const link = action.notification.data?.link
          if (link && typeof window !== 'undefined') {
            window.location.href = link
          }
        })

        // Now request permission and register
        const permResult = await PushNotifications.requestPermissions()
        log(`Permission: ${permResult.receive}`)
        if (permResult.receive !== 'granted') return

        await PushNotifications.register()
        log('register() called')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const logs = JSON.parse(localStorage.getItem('push_debug') || '[]')
        logs.push(`${new Date().toLocaleTimeString()}: CATCH: ${msg}`)
        localStorage.setItem('push_debug', JSON.stringify(logs.slice(-20)))
      }
    }

    setupPush()
  }, [])
}
