'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/app/header'

type SectionKey = 'personal' | 'membership' | 'notifications' | 'privacy' | 'blocked'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [membership, setMembership] = useState('free')
  const [pushNotifications, setPushNotifications] = useState(false)
  const [hideFromSearch, setHideFromSearch] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [blockPhoneNumber, setBlockPhoneNumber] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEmailUpdate, setShowEmailUpdate] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailStep, setEmailStep] = useState<'enter' | 'verify'>('enter')
  const [verifyCode, setVerifyCode] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [nameSaved, setNameSaved] = useState(false)

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    personal: true,
    membership: true,
    notifications: true,
    privacy: true,
    blocked: false,
  })

  useEffect(() => {
    fetch('/api/user/profile')
      .then((r) => r.json())
      .then((profile) => {
        if (profile.id) {
          setFirstName(profile.first_name || '')
          setLastName(profile.last_name || '')
          setEmail(profile.email || '')
          setAvatarUrl(profile.avatar_url || null)
          setMembership(profile.membership_tier || 'free')
          setPushNotifications(profile.push_notifications_enabled ?? false)
          setHideFromSearch(profile.hide_from_invites ?? false)
          setProfileLoaded(true)
        }
      })
  }, [])

  async function saveProfile(updates: Record<string, unknown>) {
    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  }

  function toggleSection(key: SectionKey) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  async function handleDeleteAccount() {
    // TODO: call API route to delete user account
    setShowDeleteConfirm(false)
    await supabase.auth.signOut()
    router.replace('/')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      // TODO: upload to Supabase Storage and update user metadata
      const url = URL.createObjectURL(file)
      setAvatarUrl(url)
    }
  }

  function handleRemovePhoto() {
    setAvatarUrl(null)
    // TODO: remove from Supabase Storage and update user metadata
  }

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <AppHeader showBack />

      {/* Welcome banner */}
      <div className="bg-background border-b border-border/60 py-4 text-center">
        <p className="text-foreground text-[15px] font-medium">
          Welcome, {firstName || 'there'}!
        </p>
      </div>

      {/* Scrollable settings */}
      <div className="flex-1 overflow-y-auto pb-10">

        {/* Personal Info */}
        <Section
          title="Personal Info"
          open={openSections.personal}
          onToggle={() => toggleSection('personal')}
          delay={0}
        >
          <div className="space-y-4">
            <Field label="First Name">
              <input
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setNameSaved(false) }}
                className="input-field"
              />
            </Field>

            <Field label="Last Name">
              <input
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setNameSaved(false) }}
                className="input-field"
              />
            </Field>

            <button
              onClick={async () => {
                await saveProfile({ first_name: firstName, last_name: lastName })
                setNameSaved(true)
                setTimeout(() => setNameSaved(false), 2000)
              }}
              className="btn-primary w-full py-2.5 text-[13px]"
            >
              {nameSaved ? 'Saved!' : 'Save Name'}
            </button>

            <Field label="Email">
              <div className="flex items-center gap-2.5">
                <div className="flex-1 input-field text-muted select-none">
                  {!email || email.endsWith('@whozin.io') ? 'No email set' : email}
                </div>
                <button
                  onClick={() => { setNewEmail(''); setEmailStep('enter'); setVerifyCode(''); setEmailError(''); setShowEmailUpdate(true) }}
                  className="btn-primary text-[13px] px-4 py-2.5 whitespace-nowrap"
                >
                  {!email || email.endsWith('@whozin.io') ? 'Add email' : 'Change'}
                </button>
              </div>
            </Field>

            <Field label="Profile Picture">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-[76px] h-[76px] rounded-full bg-border/60 overflow-hidden flex items-center justify-center ring-2 ring-border/40 ring-offset-2">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#b0b8cc" strokeWidth={1.5}>
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21v-1a8 8 0 0116 0v1" />
                      </svg>
                    )}
                  </div>
                  {avatarUrl && (
                    <button onClick={handleRemovePhoto} className="text-[11px] text-primary font-semibold">
                      Remove Picture
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-1 pt-1">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="photo-btn"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <rect x="2" y="6" width="20" height="14" rx="3" />
                      <circle cx="12" cy="13" r="3.5" />
                      <path d="M8.5 6V4.5a1 1 0 011-1h5a1 1 0 011 1V6" />
                    </svg>
                    Take picture
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="photo-btn"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" opacity="0.3" />
                      <path d="M21 16l-5-5-11 11" />
                    </svg>
                    Choose from Library
                  </button>
                </div>
              </div>
            </Field>
          </div>
        </Section>

        {/* Membership */}
        <Section
          title="Membership"
          open={openSections.membership}
          onToggle={() => toggleSection('membership')}
          delay={1}
        >
          <div className="space-y-3">
            <Field label="Current Membership">
              <div className="input-field text-foreground/70 select-none capitalize">{membership}</div>
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => {
                  const newTier = membership === 'free' ? 'pro' : 'free'
                  setMembership(newTier)
                  saveProfile({ membership_tier: newTier })
                }}
                className="btn-primary flex-1 py-2.5"
              >
                {membership === 'free' ? 'Upgrade to Pro' : 'Downgrade to Free'}
              </button>
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section
          title="Notifications"
          open={openSections.notifications}
          onToggle={() => toggleSection('notifications')}
          delay={2}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-foreground">Receive Push Notifications</span>
            <Toggle checked={pushNotifications} onChange={(v) => { setPushNotifications(v); saveProfile({ push_notifications_enabled: v }) }} />
          </div>
        </Section>

        {/* Privacy */}
        <Section
          title="Privacy"
          open={openSections.privacy}
          onToggle={() => toggleSection('privacy')}
          delay={3}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-foreground">Hide myself from being invited</span>
              <Toggle checked={hideFromSearch} onChange={(v) => { setHideFromSearch(v); saveProfile({ hide_from_invites: v }) }} />
            </div>
            <p className="text-[12px] text-muted leading-relaxed">
              You won&apos;t appear in friends&apos; contacts when they create a new activity.
            </p>
          </div>
        </Section>

        {/* Blocked Users */}
        <Section
          title="Blocked Users (0)"
          open={openSections.blocked}
          onToggle={() => toggleSection('blocked')}
          delay={4}
        >
          <div className="space-y-3">
            <p className="text-[12px] text-muted leading-relaxed">
              Block a user by entering their phone number. They won&apos;t be able to add you to groups or activities.
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="Phone number"
                value={blockPhoneNumber}
                onChange={(e) => setBlockPhoneNumber(e.target.value)}
                className="input-field flex-1"
              />
              <button className="btn-primary px-5 py-2.5">Block</button>
            </div>
          </div>
        </Section>

        {/* Action buttons */}
        <div className="mx-4 mt-8 space-y-3 animate-enter" style={{ animationDelay: '0.25s' }}>
          <button
            onClick={handleSignOut}
            className="btn-primary w-full py-3.5 text-[14px]"
          >
            Log Out
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full border border-danger/30 text-danger font-semibold text-[14px] py-3.5 rounded-xl bg-danger/[0.04] active:bg-danger/10 transition-colors"
          >
            Delete Account
          </button>
        </div>

        {/* Legal links */}
        <div className="flex justify-center gap-4 mt-6 mb-4">
          <a href="/privacy" target="_blank" className="text-[12px] text-muted hover:text-primary transition-colors">Privacy Policy</a>
          <span className="text-[12px] text-muted/40">|</span>
          <a href="/terms" target="_blank" className="text-[12px] text-muted hover:text-primary transition-colors">Terms of Service</a>
        </div>
      </div>

      {/* Update Email Modal */}
      {showEmailUpdate && (
        <Modal onClose={() => !emailSending && setShowEmailUpdate(false)}>
          {emailStep === 'enter' ? (
            <>
              <h3 className="text-lg font-bold text-foreground mb-1">Update Email</h3>
              <p className="text-[13px] text-muted mb-5 leading-relaxed">
                Enter your new email address. We&apos;ll send a 6-digit verification code to confirm it.
              </p>
              <input
                type="email"
                placeholder="New email address"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setEmailError('') }}
                className="input-field mb-2"
                autoFocus
              />
              {emailError && <p className="text-[12px] text-danger mb-3">{emailError}</p>}
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => setShowEmailUpdate(false)}
                  disabled={emailSending}
                  className="flex-1 border border-border text-foreground font-semibold text-[13px] py-2.5 rounded-xl active:bg-surface transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newEmail || !newEmail.includes('@') || newEmail.endsWith('@whozin.io')) {
                      setEmailError('Please enter a valid email address')
                      return
                    }
                    setEmailSending(true)
                    setEmailError('')
                    const res = await fetch('/api/user/verify-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: newEmail }),
                    })
                    const data = await res.json()
                    setEmailSending(false)
                    if (res.ok) {
                      setEmailStep('verify')
                    } else {
                      setEmailError(data.error || 'Failed to send code')
                    }
                  }}
                  disabled={emailSending}
                  className="btn-primary flex-1 py-2.5 disabled:opacity-50"
                >
                  {emailSending ? 'Sending...' : 'Send Code'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-foreground mb-1">Enter Verification Code</h3>
              <p className="text-[13px] text-muted mb-5 leading-relaxed">
                We sent a 6-digit code to <span className="font-semibold text-foreground">{newEmail}</span>. Check your inbox and enter it below.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, '')); setEmailError('') }}
                className="input-field mb-2 text-center text-xl tracking-[0.3em] font-bold"
                autoFocus
              />
              {emailError && <p className="text-[12px] text-danger mb-3">{emailError}</p>}
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => setEmailStep('enter')}
                  disabled={emailSending}
                  className="flex-1 border border-border text-foreground font-semibold text-[13px] py-2.5 rounded-xl active:bg-surface transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={async () => {
                    if (verifyCode.length !== 6) {
                      setEmailError('Please enter the 6-digit code')
                      return
                    }
                    setEmailSending(true)
                    setEmailError('')
                    const res = await fetch('/api/user/verify-email', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ code: verifyCode }),
                    })
                    const data = await res.json()
                    setEmailSending(false)
                    if (res.ok) {
                      setEmail(data.email)
                      setShowEmailUpdate(false)
                    } else {
                      setEmailError(data.error || 'Verification failed')
                    }
                  }}
                  disabled={emailSending}
                  className="btn-primary flex-1 py-2.5 disabled:opacity-50"
                >
                  {emailSending ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Delete Account Modal */}
      {showDeleteConfirm && (
        <Modal onClose={() => setShowDeleteConfirm(false)}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-foreground">Delete Account?</h3>
          </div>
          <p className="text-[13px] text-muted mb-6 leading-relaxed">
            This action is permanent and cannot be undone. All your data, groups, and activities will be deleted.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 border border-border text-foreground font-semibold text-[13px] py-2.5 rounded-xl active:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              className="flex-1 bg-danger text-white font-semibold text-[13px] py-2.5 rounded-xl active:opacity-90 transition-opacity"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ── Reusable components ──────────────────────── */

function Section({
  title,
  open,
  onToggle,
  delay,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  delay: number
  children: React.ReactNode
}) {
  return (
    <section
      className="mx-4 mt-3 bg-background border border-border/50 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] animate-enter"
      style={{ animationDelay: `${delay * 0.05}s` }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-surface/50 transition-colors"
      >
        <span className="font-semibold text-[15px] text-foreground">{title}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8892a7"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="section-content" data-open={open}>
        <div>
          <div className="px-4 pb-4 pt-0.5">{children}</div>
        </div>
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-[46px] h-[28px] rounded-full transition-colors duration-200 flex-shrink-0 ${
        checked ? 'bg-primary' : 'bg-[#d5d9e2]'
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : ''
        }`}
      />
    </button>
  )
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop bg-black/40 px-4 pb-4" onClick={onClose}>
      <div
        className="modal-panel bg-background rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
