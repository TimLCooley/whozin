'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

interface UpdateInfo {
  updateRequired: boolean
  minVersion: string
  currentVersion: string
  storeUrl: string
}

export function ForceUpdateGate({ children }: { children: React.ReactNode }) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setChecked(true)
      return
    }

    async function checkVersion() {
      try {
        const { App } = await import('@capacitor/app')
        const info = await App.getInfo()
        const platform = Capacitor.getPlatform()

        const res = await fetch(
          `/api/app/version-check?platform=${platform}&version=${info.version}`
        )
        if (res.ok) {
          const data = await res.json()
          if (data.updateRequired) {
            setUpdateInfo(data)
          }
        }
      } catch {
        // If check fails, don't block the user
      }
      setChecked(true)
    }

    checkVersion()
  }, [])

  if (!checked) return null

  if (updateInfo?.updateRequired) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/90 p-6">
        <div className="w-full max-w-sm rounded-3xl bg-background p-8 text-center shadow-2xl">
          <div className="mb-4 text-5xl">🔄</div>
          <h2 className="mb-2 text-xl font-bold">Update Required</h2>
          <p className="mb-6 text-sm text-muted">
            A new version of Whozin is available. Please update to continue
            using the app.
          </p>
          <p className="mb-6 text-xs text-muted">
            Your version: {updateInfo.currentVersion} — Required:{' '}
            {updateInfo.minVersion}+
          </p>
          <a
            href={updateInfo.storeUrl}
            className="inline-block w-full rounded-xl bg-primary px-6 py-3.5 font-semibold text-white transition hover:bg-primary-dark active:scale-[0.98]"
          >
            Update Now
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
