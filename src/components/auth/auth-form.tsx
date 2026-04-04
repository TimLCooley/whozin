'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isNative, getPlatform } from '@/lib/capacitor'

declare global {
  interface Window {
    AppleID: {
      auth: {
        init: (config: Record<string, unknown>) => void
        signIn: () => Promise<{ authorization?: { id_token?: string } }>
      }
    }
  }
}
import CountryCodeSelect from './country-code-select'

type Step = 'phone' | 'otp' | 'name'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

interface AuthFormProps {
  onBack?: () => void
}

export default function AuthForm({ onBack }: AuthFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')

  // Phone step
  const [phoneRaw, setPhoneRaw] = useState('')
  const [countryCode, setCountryCode] = useState('1')

  // OTP step
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Name step (for new users)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [existingFirstName, setExistingFirstName] = useState('')
  const [existingLastName, setExistingLastName] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null)
  const phoneDigits = phoneRaw.replace(/\D/g, '').slice(0, 10)

  const platform = getPlatform()
  const native = isNative()

  // Reset socialLoading when page becomes visible again (user hit back from OAuth redirect)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        setSocialLoading(null)
      }
    }
    // Also reset on pageshow (bfcache restoration)
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        setSocialLoading(null)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', handlePageShow)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`
    return digits
  }

  function handlePhoneChange(value: string) {
    setPhoneRaw(value.replace(/\D/g, '').slice(0, 10))
  }

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
    return () => clearTimeout(t)
  }, [resendTimer])

  // ─── Apple Sign In ───────────────────────────────────────

  async function handleNativeOAuth(provider: 'apple' | 'google') {
    const nonce = crypto.randomUUID() + crypto.randomUUID().slice(0, 4)

    // Apple: direct Apple OAuth + signInWithIdToken (bypasses Supabase OAuth)
    // Google: Supabase OAuth redirect
    const url = provider === 'apple'
      ? `/api/auth/apple-native?nonce=${nonce}`
      : `/api/auth/oauth-start?provider=${provider}&nonce=${nonce}`
    const fullUrl = `${window.location.origin}${url}`

    // Open in system browser (not WebView) — Google blocks OAuth from embedded WebViews
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: fullUrl })
    } catch {
      // Fallback: create an anchor with intent scheme to force system browser on Android
      if (/Android/i.test(navigator.userAgent)) {
        const stripped = fullUrl.replace(/^https:\/\//, '')
        const a = document.createElement('a')
        a.href = `intent://${stripped}#Intent;scheme=https;action=android.intent.action.VIEW;end`
        a.click()
      } else {
        window.open(fullUrl, '_blank')
      }
    }

    // Poll for session tokens (callback stores them keyed by nonce)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000))
      try {
        const res = await fetch(`/api/auth/oauth-poll?nonce=${nonce}`)
        const data = await res.json()
        if (!data.pending && data.access_token) {
          const supabase = createClient()
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          })
          if (sessionError) {
            setError(sessionError.message)
            setSocialLoading(null)
            return
          }
          await fetch('/api/auth/ensure-profile', { method: 'POST' })
          window.location.href = '/app'
          return
        }
      } catch {
        // Network error, keep polling
      }
    }
    setError('Sign-in timed out. Please try again.')
    setSocialLoading(null)
  }

  async function handleAppleSignIn() {
    setSocialLoading('apple')
    setError('')
    try {
      if (native) {
        // Native: open OAuth in system browser, poll for session
        await handleNativeOAuth('apple')
      } else {
        // Web: use Apple JS SDK popup
        await loadAppleScript()
        window.AppleID.auth.init({
          clientId: 'io.whozin.app.signin',
          scope: 'email name',
          redirectURI: window.location.origin + '/auth/callback',
          usePopup: true,
        })
        const response = await window.AppleID.auth.signIn()
        const idToken = response.authorization?.id_token
        if (!idToken) {
          setError('No ID token received from Apple')
          setSocialLoading(null)
          return
        }
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: idToken,
        })
        if (signInError) {
          setError(signInError.message)
          setSocialLoading(null)
          return
        }
        await fetch('/api/auth/ensure-profile', { method: 'POST' })
        window.location.href = '/app'
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // User cancelled
      if (msg.includes('popup_closed') || msg.includes('cancelled') || msg.includes('canceled') || msg.includes('1001') || msg.includes('SIGN_IN_CANCELED')) {
        setSocialLoading(null)
        return
      }
      setError('Apple sign-in failed. Please try again.')
      setSocialLoading(null)
    }
  }

  function loadAppleScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.AppleID) return resolve()
      const script = document.createElement('script')
      script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Apple JS SDK'))
      document.head.appendChild(script)
    })
  }

  // ─── Google Sign In ──────────────────────────────────────

  async function handleGoogleSignIn() {
    setSocialLoading('google')
    setError('')
    try {
      if (native) {
        // Native (Android & iOS): open OAuth in system browser, poll for session
        await handleNativeOAuth('google')
      } else {
        // Web: use Supabase OAuth redirect
        const supabase = createClient()
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        })
        if (oauthError) {
          setError(oauthError.message)
          setSocialLoading(null)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('canceled') || msg.includes('cancelled') || msg.includes('12501')) {
        setSocialLoading(null)
        return
      }
      setError(`Google sign-in failed: ${msg}`)
      setSocialLoading(null)
    }
  }

  // ─── Phone OTP ───────────────────────────────────────────

  async function handleSendOtp() {
    if (phoneDigits.length !== 10) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits, country_code: countryCode }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send code')
        setLoading(false)
        return
      }

      // Dev mode: auto-fill and auto-submit code
      if (data.dev_code) {
        const digits = data.dev_code.split('')
        setOtpDigits(digits)
        setStep('otp')
        setResendTimer(30)
        setLoading(false)
        // Auto-submit after a tick so state is updated
        setTimeout(() => handleVerifyOtp(data.dev_code), 100)
        return
      }

      setStep('otp')
      setResendTimer(30)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  function handleOtpInput(index: number, value: string) {
    const cleaned = value.replace(/\D/g, '')

    // Multi-digit input (paste or auto-fill)
    if (cleaned.length > 1) {
      const digits = cleaned.slice(0, 6).split('')
      const newDigits = [...otpDigits]
      digits.forEach((d, i) => { if (index + i < 6) newDigits[index + i] = d })
      setOtpDigits(newDigits)
      const lastIndex = Math.min(index + digits.length, 5)
      otpRefs.current[lastIndex]?.focus()
      if (newDigits.every((d) => d)) handleVerifyOtp(newDigits.join(''))
      return
    }

    // Single digit
    const digit = cleaned.slice(-1)
    const newDigits = [...otpDigits]
    newDigits[index] = digit
    setOtpDigits(newDigits)

    // Auto-advance to next input
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 filled
    if (digit && index === 5 && newDigits.every((d) => d)) {
      handleVerifyOtp(newDigits.join(''))
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const digits = pasted.split('')
      setOtpDigits(digits)
      otpRefs.current[5]?.focus()
      handleVerifyOtp(pasted)
    }
  }

  async function handleVerifyOtp(code?: string) {
    const otpCode = code || otpDigits.join('')
    if (otpCode.length !== 6) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneDigits,
          country_code: countryCode,
          code: otpCode,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Verification failed')
        setOtpDigits(['', '', '', '', '', ''])
        otpRefs.current[0]?.focus()
        setLoading(false)
        return
      }

      if (data.action === 'needs_name') {
        const isTest = phoneDigits.startsWith('999')
        const last4 = phoneDigits.slice(-4)
        setExistingFirstName(data.existing_first_name || '')
        setExistingLastName(data.existing_last_name || '')
        setFirstName(isTest ? `T-${last4}` : (data.existing_first_name || ''))
        setLastName(isTest ? `C-${last4}` : (data.existing_last_name || ''))
        setStep('name')
        setLoading(false)
        return
      }

      if (data.action === 'sign_in') {
        // Sign in with the session token
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.token,
        })

        if (signInError) {
          setError(signInError.message)
          setLoading(false)
          return
        }

        router.push('/app')
        return
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  async function handleNameSubmit() {
    if (!firstName.trim() || !lastName.trim()) return
    setError('')
    setLoading(true)

    // Re-verify with name included
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneDigits,
          country_code: countryCode,
          code: otpDigits.join(''),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        // OTP expired — need to resend
        if (data.error?.includes('expired')) {
          setError('Code expired. Please go back and request a new one.')
        } else {
          setError(data.error || 'Failed to create account')
        }
        setLoading(false)
        return
      }

      if (data.action === 'sign_in') {
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.token,
        })

        if (signInError) {
          setError(signInError.message)
          setLoading(false)
          return
        }

        router.push('/app')
        return
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const formattedPhone = countryCode === '1'
    ? `+1 ${formatPhone(phoneRaw)}`
    : `+${countryCode} ${phoneDigits}`

  // Hide Apple on Android native (not a natural UX there)
  const showApple = !(native && platform === 'android')
  // Hide Google on iOS native (Apple is the primary option there)
  const showGoogle = !(native && platform === 'ios')
  // On iOS native, show Apple first (primary). Otherwise Google first.
  const showAppleFirst = native && platform === 'ios'

  const googleButton = showGoogle ? (
    <button
      onClick={handleGoogleSignIn}
      disabled={socialLoading !== null || loading}
      className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border
                 bg-background text-foreground font-semibold text-[14px]
                 active:scale-[0.98] transition-all disabled:opacity-50 mb-4"
    >
      <GoogleIcon />
      {socialLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
    </button>
  ) : null

  const appleButton = showApple ? (
    <button
      onClick={handleAppleSignIn}
      disabled={socialLoading !== null || loading}
      className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border
                 bg-black text-white font-semibold text-[14px]
                 active:scale-[0.98] transition-all disabled:opacity-50 mb-4"
    >
      <AppleIcon />
      {socialLoading === 'apple' ? 'Connecting...' : 'Continue with Apple'}
    </button>
  ) : null

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] border-b border-border">
        {(step !== 'phone' || onBack) && (
          <button
            onClick={step === 'phone' ? onBack : () => {
              if (step === 'otp') { setStep('phone'); setOtpDigits(['', '', '', '', '', '']); setError('') }
              if (step === 'name') { setStep('otp'); setError('') }
            }}
            className="p-2 -ml-2 text-foreground/60 hover:text-foreground"
            aria-label="Back"
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="flex-1 text-center text-lg font-semibold">
          {step === 'phone' && 'Enter Phone Number'}
          {step === 'otp' && 'Verify Code'}
          {step === 'name' && 'Your Name'}
        </h1>
      </div>

      <div className="flex-1 flex items-center px-6 py-8">
        <div className="max-w-sm mx-auto w-full">

          {/* STEP 1: Phone number */}
          {step === 'phone' && (
            <>
              {/* Social Sign-In — order depends on platform */}
              {showAppleFirst ? (
                <>{appleButton}{googleButton}</>
              ) : (
                <>{googleButton}{appleButton}</>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[12px] text-muted font-medium uppercase tracking-wide">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <p className="text-muted text-[14px] text-center mb-6">
                We&apos;ll text you a 6-digit code to verify your number.
              </p>

              <div className="flex gap-2 mb-4">
                <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
                <input
                  type="text"
                  inputMode="tel"
                  value={formatPhone(phoneRaw)}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="(###) ### - ####"
                  className="flex-1 h-12 px-4 rounded-xl border border-border bg-background text-base
                             placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                             focus:border-primary"
                  autoComplete="off"
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-sm text-danger bg-danger/10 rounded-xl px-4 py-3 mb-4">{error}</div>
              )}

              <button
                onClick={handleSendOtp}
                disabled={loading || phoneDigits.length !== 10}
                className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-semibold text-base
                           active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Code'}
              </button>

              <p className="text-[11px] text-muted text-center mt-3 leading-relaxed">
                By continuing, you agree to our{' '}
                <a href="/terms" target="_blank" className="text-primary font-medium">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" className="text-primary font-medium">Privacy Policy</a>.
              </p>

            </>
          )}

          {/* STEP 2: OTP code */}
          {step === 'otp' && (
            <>
              <p className="text-muted text-[14px] text-center mb-2">
                Enter the 6-digit code sent to
              </p>
              <p className="text-foreground font-semibold text-center mb-6">
                {formattedPhone}
              </p>

              <div className="flex gap-2 justify-center mb-6">
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                    maxLength={6}
                    autoComplete={i === 0 ? 'one-time-code' : undefined}
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-border bg-background
                               focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {error && (
                <div className="text-sm text-danger bg-danger/10 rounded-xl px-4 py-3 mb-4">{error}</div>
              )}

              <button
                onClick={() => handleVerifyOtp()}
                disabled={loading || otpDigits.some((d) => !d)}
                className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-semibold text-base
                           active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-[13px] text-muted">Resend code in {resendTimer}s</p>
                ) : (
                  <button
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="text-[13px] text-primary font-medium hover:underline"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </>
          )}

          {/* STEP 3: Name (new/invited users) */}
          {step === 'name' && (
            <>
              <p className="text-muted text-[14px] text-center mb-6">
                {existingFirstName
                  ? "Confirm your name to finish setting up your account."
                  : "Almost there! What should we call you?"}
              </p>

              <input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base mb-3
                           placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                           focus:border-primary"
                autoFocus
              />
              <input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base mb-4
                           placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                           focus:border-primary"
              />

              {error && (
                <div className="text-sm text-danger bg-danger/10 rounded-xl px-4 py-3 mb-4">{error}</div>
              )}

              <button
                onClick={handleNameSubmit}
                disabled={loading || !firstName.trim() || !lastName.trim()}
                className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-semibold text-base
                           active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : "I'm In!"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
