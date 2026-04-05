/**
 * Storage adapter that saves the full session to localStorage (for in-session use)
 * AND saves the refresh token to a simple JS cookie (for persistence across app restarts).
 * Android WebView clears httpOnly server cookies AND localStorage on app close,
 * but preserves simple JS-set cookies (proven by GA cookies persisting).
 */

const REFRESH_COOKIE = '_whozin_rt'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'))
  return match ? decodeURIComponent(match[2]) : null
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${400 * 24 * 60 * 60};samesite=lax`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;path=/;max-age=0`
}

export const nativeStorage = {
  getItem(key: string): string | null {
    // Try localStorage first (works within same session)
    const stored = localStorage.getItem(key)
    if (stored) return stored

    // If no session in localStorage, check if we have a saved refresh token
    // Return a minimal session object so Supabase can refresh it
    if (key.includes('auth-token') && !key.includes('code-verifier')) {
      const rt = getCookie(REFRESH_COOKIE)
      if (rt) {
        console.log(`[STORAGE] Restoring session from refresh token cookie`)
        const minimal = JSON.stringify({
          access_token: 'expired',
          refresh_token: rt,
          token_type: 'bearer',
          expires_in: 0,
          expires_at: 0,
        })
        return minimal
      }
    }
    return null
  },

  setItem(key: string, value: string): void {
    // Save to localStorage for in-session use
    localStorage.setItem(key, value)

    if (key.includes('auth-token') && !key.includes('code-verifier')) {
      // Save refresh token to a persistent cookie (survives app restart)
      try {
        const parsed = JSON.parse(value)
        if (parsed.refresh_token) {
          setCookie(REFRESH_COOKIE, parsed.refresh_token)
        }
      } catch (e) { /* ignore */ }

      // Also set as simple JS cookies for server-side API auth
      // The SSR client expects chunked cookies: key.0, key.1, etc.
      const encoded = 'base64-' + btoa(value)
      const CHUNK = 3500
      // Clear old chunks
      for (let i = 0; i < 5; i++) deleteCookie(`${key}.${i}`)
      for (let i = 0; i < encoded.length; i += CHUNK) {
        const chunkIndex = Math.floor(i / CHUNK)
        const chunk = encoded.slice(i, i + CHUNK)
        setCookie(`${key}.${chunkIndex}`, chunk)
      }
    }
  },

  removeItem(key: string): void {
    localStorage.removeItem(key)
    if (key.includes('auth-token') && !key.includes('code-verifier')) {
      deleteCookie(REFRESH_COOKIE)
      for (let i = 0; i < 5; i++) deleteCookie(`${key}.${i}`)
    }
  },
}
