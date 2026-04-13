'use client'

import { useEffect, useState } from 'react'

// Module-level cache so we only fetch once across all instances
let cachedBranding: { logo_full: string; favicon: string } | null = null
let brandingFetch: Promise<{ logo_full: string; favicon: string }> | null = null

function fetchBranding() {
  if (cachedBranding) return Promise.resolve(cachedBranding)
  if (brandingFetch) return brandingFetch
  brandingFetch = fetch('/api/admin/settings')
    .then((r) => r.json())
    .then((data) => {
      cachedBranding = {
        logo_full: data.logo_full || '',
        favicon: data.favicon || '',
      }
      return cachedBranding
    })
    .catch(() => ({ logo_full: '', favicon: '' }))
  return brandingFetch
}

// Text-only fallback (no paw logo)
function TextFallback({ size = 'full' }: { size?: 'full' | 'icon' }) {
  if (size === 'icon') {
    return (
      <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
        <span className="text-white text-sm font-extrabold">W</span>
      </div>
    )
  }
  return (
    <span className="text-white text-xl font-bold tracking-tight">
      Whoz<em className="not-italic font-extrabold">in</em>
    </span>
  )
}

/** Full logo from branding (header/footer) */
export function BrandedFullLogo({ className = 'h-9' }: { className?: string }) {
  const [logo, setLogo] = useState(cachedBranding?.logo_full || '')

  useEffect(() => {
    if (!cachedBranding) {
      fetchBranding().then((b) => setLogo(b.logo_full))
    }
  }, [])

  if (logo) {
    return <img src={logo} alt="Whozin" className={`${className} object-contain`} />
  }
  return <TextFallback size="full" />
}

/** Favicon/icon logo from branding (contact form, small spots) */
export function BrandedFavicon({ className = 'w-9 h-9' }: { className?: string }) {
  const [icon, setIcon] = useState(cachedBranding?.favicon || '')

  useEffect(() => {
    if (!cachedBranding) {
      fetchBranding().then((b) => setIcon(b.favicon))
    }
  }, [])

  if (icon) {
    return <img src={icon} alt="Whozin" className={`${className} object-contain`} />
  }
  return <TextFallback size="icon" />
}

/** Hook to get branding URLs directly */
export function useBranding() {
  const [branding, setBranding] = useState(cachedBranding || { logo_full: '', favicon: '' })

  useEffect(() => {
    fetchBranding().then(setBranding)
  }, [])

  return branding
}
