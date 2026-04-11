'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { showPaywall } from '@/components/ui/paywall-modal'

type Membership = 'free' | 'pro'

let cachedMembership: Membership | null = null
let fetchPromise: Promise<Membership> | null = null

function fetchMembership(): Promise<Membership> {
  if (fetchPromise) return fetchPromise
  fetchPromise = fetch('/api/user/profile')
    .then((r) => r.json())
    .then((p) => {
      const tier = (p.membership_tier as Membership) || 'free'
      cachedMembership = tier
      fetchPromise = null
      return tier
    })
    .catch(() => {
      fetchPromise = null
      return 'free' as Membership
    })
  return fetchPromise
}

export function useProStatus() {
  const [membership, setMembership] = useState<Membership>(cachedMembership ?? 'free')
  const [isLoading, setIsLoading] = useState(cachedMembership === null)

  useEffect(() => {
    if (cachedMembership !== null) {
      setMembership(cachedMembership)
      setIsLoading(false)
      return
    }
    fetchMembership().then((tier) => {
      setMembership(tier)
      setIsLoading(false)
    })
  }, [])

  function refresh() {
    cachedMembership = null
    fetchPromise = null
    setIsLoading(true)
    fetchMembership().then((tier) => {
      setMembership(tier)
      setIsLoading(false)
    })
  }

  return { isPro: membership === 'pro', membership, isLoading, refresh }
}

// Deprecated — kept for backwards compat. Prefer `requirePro` from `usePaywall`.
export function openPaywall(_router: ReturnType<typeof useRouter>, _returnTo?: string) {
  showPaywall()
}

export function usePaywall() {
  const _router = useRouter()
  const _pathname = usePathname()
  const status = useProStatus()

  function requirePro(_returnTo?: string) {
    if (status.isPro) return true
    showPaywall()
    return false
  }

  return { ...status, requirePro }
}
