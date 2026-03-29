'use client'

import { useEffect } from 'react'

const APP_STORE_URL = 'https://apps.apple.com/us/app/whozin-app/id6754605540'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=io.whozin.app'

export default function DownloadPage() {
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()

    if (/iphone|ipad|ipod/.test(ua)) {
      window.location.href = APP_STORE_URL
    } else if (/android/.test(ua)) {
      window.location.href = PLAY_STORE_URL
    } else {
      // Desktop or unknown — show both options
      return
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 text-white">
      <h1 className="mb-2 text-3xl font-bold">Get Whozin</h1>
      <p className="mb-8 text-gray-400">Download the app to see what&apos;s happening</p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <a
          href={APP_STORE_URL}
          className="rounded-xl bg-white px-8 py-4 text-center font-semibold text-black transition hover:bg-gray-200"
        >
          Download on the App Store
        </a>
        <a
          href={PLAY_STORE_URL}
          className="rounded-xl bg-white px-8 py-4 text-center font-semibold text-black transition hover:bg-gray-200"
        >
          Get it on Google Play
        </a>
      </div>
    </div>
  )
}
