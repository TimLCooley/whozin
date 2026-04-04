'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

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

export function openPaywall(router: ReturnType<typeof useRouter>, returnTo?: string) {
  const path = returnTo || (typeof window !== 'undefined' ? window.location.pathname : '/app')
  router.push(`/app/upgrade?returnTo=${encodeURIComponent(path)}`)
}

export function usePaywall() {
  const router = useRouter()
  const pathname = usePathname()
  const status = useProStatus()

  function requirePro(returnTo?: string) {
    if (status.isPro) return true
    openPaywall(router, returnTo ?? pathname)
    return false
  }

  return { ...status, requirePro }
}
