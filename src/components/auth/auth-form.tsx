'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CountryCodeSelect from './country-code-select'

type Step = 'phone' | 'otp' | 'name'

interface AuthFormProps {
  onBack: () => void
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

  const phoneDigits = phoneRaw.replace(/\D/g, '').slice(0, 10)

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

      // Dev mode: auto-fill code
      if (data.dev_code) {
        const digits = data.dev_code.split('')
        setOtpDigits(digits)
      }

      setStep('otp')
      setResendTimer(30)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  function handleOtpInput(index: number, value: string) {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1)
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

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-border">
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
        <h1 className="flex-1 text-center text-lg font-semibold pr-8">
          {step === 'phone' && 'Enter Phone Number'}
          {step === 'otp' && 'Verify Code'}
          {step === 'name' && 'Your Name'}
        </h1>
      </div>

      <div className="flex-1 px-6 py-8">
        <div className="max-w-sm mx-auto">

          {/* STEP 1: Phone number */}
          {step === 'phone' && (
            <>
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
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    maxLength={1}
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
