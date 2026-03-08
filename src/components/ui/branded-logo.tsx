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

// Inline SVG fallback
function PawFallback({ size = 'full' }: { size?: 'full' | 'icon' }) {
  if (size === 'icon') {
    return (
      <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <ellipse cx="8" cy="6" rx="2.5" ry="3" />
          <ellipse cx="16" cy="6" rx="2.5" ry="3" />
          <ellipse cx="4.5" cy="12" rx="2" ry="2.5" />
          <ellipse cx="19.5" cy="12" rx="2" ry="2.5" />
          <ellipse cx="12" cy="16.5" rx="5" ry="4.5" />
        </svg>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <ellipse cx="8" cy="6" rx="2.5" ry="3" />
          <ellipse cx="16" cy="6" rx="2.5" ry="3" />
          <ellipse cx="4.5" cy="12" rx="2" ry="2.5" />
          <ellipse cx="19.5" cy="12" rx="2" ry="2.5" />
          <ellipse cx="12" cy="16.5" rx="5" ry="4.5" />
        </svg>
      </div>
      <span className="text-white text-xl font-bold tracking-tight">
        Whoz<em className="not-italic font-extrabold text-primary">in</em>
      </span>
    </div>
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
  return <PawFallback size="full" />
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
  return <PawFallback size="icon" />
}

/** Hook to get branding URLs directly */
export function useBranding() {
  const [branding, setBranding] = useState(cachedBranding || { logo_full: '', favicon: '' })

  useEffect(() => {
    fetchBranding().then(setBranding)
  }, [])

  return branding
}
