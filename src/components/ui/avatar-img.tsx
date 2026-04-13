'use client'

import { useEffect, useState } from 'react'

// Module-level cache so we only fetch the logo once per session
let cachedLogoUrl: string | null = null
let fetchPromise: Promise<string | null> | null = null

function getLogoUrl(): Promise<string | null> {
  if (cachedLogoUrl !== null) return Promise.resolve(cachedLogoUrl)
  if (fetchPromise) return fetchPromise

  fetchPromise = fetch('/api/admin/settings')
    .then((r) => r.json())
    .then((data) => {
      cachedLogoUrl = data.logo_icon || null
      return cachedLogoUrl
    })
    .catch(() => null)

  return fetchPromise
}

const DIMS = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-10 h-10', xl: 'w-16 h-16' } as const
const ICON_SIZE = { sm: 14, md: 16, lg: 20, xl: 32 } as const
const IMG_SIZE = { sm: 16, md: 20, lg: 24, xl: 36 } as const

function UserIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export function AvatarImg({ size = 'md', src }: { size?: 'sm' | 'md' | 'lg' | 'xl'; src?: string | null }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(cachedLogoUrl)

  useEffect(() => {
    if (!src && !cachedLogoUrl) {
      getLogoUrl().then((url) => { if (url) setLogoUrl(url) })
    }
  }, [src])

  if (src) {
    return (
      <div className={`${DIMS[size]} rounded-full overflow-hidden flex-shrink-0`}>
        <img src={src} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }

  // Use branding icon logo if available, otherwise fall back to user icon
  if (logoUrl) {
    return (
      <div className={`${DIMS[size]} rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
        <img src={logoUrl} alt="" width={IMG_SIZE[size]} height={IMG_SIZE[size]} className="object-contain" />
      </div>
    )
  }

  return (
    <div className={`${DIMS[size]} rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0`}>
      <UserIcon size={ICON_SIZE[size]} />
    </div>
  )
}
