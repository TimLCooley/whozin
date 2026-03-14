'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function useSwipeBack() {
  const router = useRouter()
  const pathname = usePathname()
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    function handleTouchStart(e: TouchEvent) {
      const touch = e.touches[0]
      // Only trigger from the left edge (first 30px)
      if (touch.clientX < 30) {
        touchStart.current = { x: touch.clientX, y: touch.clientY }
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!touchStart.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStart.current.x
      const dy = Math.abs(touch.clientY - touchStart.current.y)

      // Swipe right at least 80px, and more horizontal than vertical
      if (dx > 80 && dy < dx) {
        // Don't go back from the main app page
        if (pathname !== '/app') {
          router.back()
        }
      }
      touchStart.current = null
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [router, pathname])
}
