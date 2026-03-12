'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CountryCodeSelect from '@/components/auth/country-code-select'

export default function CompleteProfilePage() {
  const router = useRouter()
  const [countryCode, setCountryCode] = useState('1')
  const [phoneRaw, setPhoneRaw] = useState('')
  const phoneDigits = phoneRaw.replace(/\D/g, '')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const [step, setStep] = useState<'name' | 'phone' | 'otp'>('name')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  // Check if user already has phone & name — skip steps as needed
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/')
        return
      }
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const profile = await res.json()
        if (profile.phone) {
          router.replace('/app')
          return
        }
        // If they already have a name, skip to phone step
        if (profile.first_name) {
          setFirstName(profile.first_name)
          setLastName(profile.last_name || '')
          setStep('phone')
        }
      }
      setCheckingProfile(false)
    })
  }, [router])

  function formatPhone(digits: string): string {
    if (digits.length <= 3) return digits.length > 0 ? `(${digits}` : ''
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6, 10)}`
  }

  async function handleNameSubmit() {
    if (!firstName.trim()) {
      setError('First name is required')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() }),
      })
      if (!res.ok) {
        setError('Failed to save name')
        setLoading(false)
        return
      }
      setStep('phone')
    } catch {
      setError('Something went wrong')
    }
    setLoading(false)
  }

  async function handleSendOtp() {
    if (phoneDigits.length < 7) {
      setError('Please enter a valid phone number')
      return
    }
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
      if (data.dev_code) {
        setOtpDigits(data.dev_code.split(''))
      }
      setStep('otp')
    } catch {
      setError('Something went wrong')
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

    const digit = cleaned.slice(-1)
    const newDigits = [...otpDigits]
    newDigits[index] = digit
    setOtpDigits(newDigits)
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
    if (digit && index === 5) {
      const code = newDigits.join('')
      if (code.length === 6) handleVerifyOtp(code)
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
      setOtpDigits(pasted.split(''))
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
      // Verify the OTP is valid
      const res = await fetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneDigits,
          country_code: countryCode,
          code: otpCode,
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
      // Success — redirect to app
      router.replace('/app')
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  if (checkingProfile) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-sm">
        {step === 'name' && (
          <>
            <h1 className="text-[22px] font-bold text-foreground text-center mb-2">What&apos;s Your Name?</h1>
            <p className="text-[13px] text-muted text-center mb-6">
              So your friends know who you are on Whozin.
            </p>

            {error && (
              <div className="bg-danger/10 text-danger text-[13px] font-medium px-4 py-2.5 rounded-xl mb-4 text-center">
                {error}
              </div>
            )}

            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="input-field w-full mb-3"
              autoFocus
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="input-field w-full mb-5"
            />
            <button
              onClick={handleNameSubmit}
              disabled={loading || !firstName.trim()}
              className="btn-primary w-full py-3 text-[14px]"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </>
        )}

        {step === 'phone' && (
          <>
            <h1 className="text-[22px] font-bold text-foreground text-center mb-2">Add Your Phone Number</h1>
            <p className="text-[13px] text-muted text-center mb-6">
              Whozin uses SMS to send activity invites and notifications. A phone number is required.
            </p>

            {error && (
              <div className="bg-danger/10 text-danger text-[13px] font-medium px-4 py-2.5 rounded-xl mb-4 text-center">
                {error}
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
              <input
                type="tel"
                value={formatPhone(phoneDigits)}
                onChange={(e) => setPhoneRaw(e.target.value)}
                placeholder="(555) 555 - 5555"
                className="input-field flex-1"
                autoFocus
                maxLength={16}
              />
            </div>
            <button
              onClick={handleSendOtp}
              disabled={loading || phoneDigits.length < 7}
              className="btn-primary w-full py-3 text-[14px]"
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </>
        )}

        {step === 'otp' && (
          <>
            <h1 className="text-[22px] font-bold text-foreground text-center mb-2">Verify Your Number</h1>
            <p className="text-[13px] text-muted text-center mb-4">
              Enter the 6-digit code sent to +{countryCode} {formatPhone(phoneDigits)}
            </p>

            {error && (
              <div className="bg-danger/10 text-danger text-[13px] font-medium px-4 py-2.5 rounded-xl mb-4 text-center">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-center mb-6">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpInput(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={handleOtpPaste}
                  autoComplete={i === 0 ? 'one-time-code' : undefined}
                  className="w-11 h-13 text-center text-[20px] font-bold rounded-xl border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  autoFocus={i === 0}
                />
              ))}
            </div>
            <button
              onClick={() => handleVerifyOtp()}
              disabled={loading || otpDigits.join('').length !== 6}
              className="btn-primary w-full py-3 text-[14px]"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <button
              onClick={() => { setStep('phone'); setOtpDigits(['', '', '', '', '', '']); setError('') }}
              className="w-full text-[13px] text-muted mt-3 text-center"
            >
              Change number
            </button>
          </>
        )}
      </div>
    </div>
  )
}
