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
const PAW_SIZE = { sm: 14, md: 16, lg: 20, xl: 32 } as const
const IMG_SIZE = { sm: 16, md: 20, lg: 24, xl: 36 } as const

function PawSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="7.5" cy="6.5" rx="2.2" ry="2.5" fill="#4285F4" opacity="0.7" />
      <ellipse cx="16.5" cy="6.5" rx="2.2" ry="2.5" fill="#4285F4" opacity="0.7" />
      <circle cx="4" cy="13" r="1.8" fill="#4285F4" opacity="0.7" />
      <circle cx="20" cy="13" r="1.8" fill="#4285F4" opacity="0.7" />
      <ellipse cx="12" cy="16.5" rx="5.5" ry="4.2" fill="#4285F4" opacity="0.85" />
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

  // Use branding icon logo if available, otherwise fall back to paw SVG
  if (logoUrl) {
    return (
      <div className={`${DIMS[size]} rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
        <img src={logoUrl} alt="" width={IMG_SIZE[size]} height={IMG_SIZE[size]} className="object-contain" />
      </div>
    )
  }

  return (
    <div className={`${DIMS[size]} rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0`}>
      <PawSvg size={PAW_SIZE[size]} />
    </div>
  )
}
