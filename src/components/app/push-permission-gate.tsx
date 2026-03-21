'use client'

import { useState } from 'react'
import { Capacitor } from '@capacitor/core'

interface Props {
  onGranted: () => void
}

export function PushPermissionGate({ onGranted }: Props) {
  const [requesting, setRequesting] = useState(false)
  const [denied, setDenied] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleEnable() {
    setRequesting(true)
    setErrorMsg('')
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')

      const permResult = await PushNotifications.requestPermissions()
      if (permResult.receive === 'granted') {
        await PushNotifications.register()

        // Wait briefly for the registration listener to fire and save the token
        await new Promise((r) => setTimeout(r, 1500))
        onGranted()
      } else {
        setErrorMsg(`Permission: ${permResult.receive}`)
        setDenied(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
      setDenied(true)
    }
    setRequesting(false)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">
          {denied ? '😕' : '🔔'}
        </div>

        <h1 className="text-[22px] font-bold text-foreground mb-2">
          {denied ? 'Notifications Are Required' : 'Turn On Notifications'}
        </h1>

        <p className="text-[13px] text-muted mb-6 leading-relaxed">
          {denied ? (
            <>
              Whozin needs push notifications to let you know about activity invites,
              group updates, and messages from friends. Without them, you&apos;ll miss out.
              <br /><br />
              Please open your device <strong>Settings &gt; Apps &gt; Whozin &gt; Notifications</strong> and
              turn them on, then come back here.
            </>
          ) : (
            <>
              Whozin uses push notifications to let you know when friends invite you
              to activities, when someone joins your group, and when you get messages.
              <br /><br />
              This keeps the app <strong>free</strong> — without notifications, every alert
              would need a text message, and that costs money.
            </>
          )}
        </p>

        {denied ? (
          <button
            onClick={() => {
              // On Android, try opening app notification settings
              if (Capacitor.getPlatform() === 'android') {
                import('@capacitor/push-notifications').then(({ PushNotifications }) => {
                  PushNotifications.requestPermissions().then((result) => {
                    if (result.receive === 'granted') {
                      PushNotifications.register()
                      setTimeout(onGranted, 1500)
                    }
                  })
                })
              }
            }}
            className="btn-primary w-full py-3.5 text-[14px] font-semibold mb-3"
          >
            Try Again
          </button>
        ) : (
          <button
            onClick={handleEnable}
            disabled={requesting}
            className="btn-primary w-full py-3.5 text-[14px] font-semibold mb-3"
          >
            {requesting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Requesting...
              </span>
            ) : (
              'Enable Notifications'
            )}
          </button>
        )}

        {denied && (
          <>
            {errorMsg && (
              <p className="text-[10px] font-mono text-red-400 mt-2">{errorMsg}</p>
            )}
            <button
              onClick={onGranted}
              className="text-[13px] text-primary font-semibold mt-2"
            >
              Skip for now
            </button>
          </>
        )}

        <p className="text-[11px] text-muted/60 mt-3">
          You can manage notification preferences in Settings anytime.
        </p>
      </div>
    </div>
  )
}
