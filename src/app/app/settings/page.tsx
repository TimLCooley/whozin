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
  const [membership, setMembership] = useState('Free')
  const [pushNotifications, setPushNotifications] = useState(false)
  const [hideFromSearch, setHideFromSearch] = useState(false)
  const [blockPhoneNumber, setBlockPhoneNumber] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEmailUpdate, setShowEmailUpdate] = useState(false)
  const [newEmail, setNewEmail] = useState('')

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    personal: true,
    membership: true,
    notifications: true,
    privacy: true,
    blocked: false,
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setFirstName(user.user_metadata?.first_name || '')
        setLastName(user.user_metadata?.last_name || '')
        setEmail(user.email || '')
        setAvatarUrl(user.user_metadata?.avatar_url || null)
      }
    })
  }, [supabase.auth])

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
      <AppHeader />

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
                onChange={(e) => setFirstName(e.target.value)}
                className="input-field"
              />
            </Field>

            <Field label="Last Name">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="input-field"
              />
            </Field>

            <Field label="Email">
              {email.endsWith('@whozin.io') ? (
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 input-field text-muted select-none">****</div>
                  <button
                    onClick={() => { setNewEmail(''); setShowEmailUpdate(true) }}
                    className="btn-primary text-[13px] px-4 py-2.5 whitespace-nowrap"
                  >
                    Update email
                  </button>
                </div>
              ) : (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                />
              )}
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
              <div className="input-field text-foreground/70 select-none">{membership}</div>
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <button className="text-[13px] text-primary font-semibold px-3">Cancel</button>
              <button
                onClick={() => setMembership(membership === 'Free' ? 'Premium' : 'Free')}
                className="btn-primary flex-1 py-2.5"
              >
                Change
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
            <Toggle checked={pushNotifications} onChange={setPushNotifications} />
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
              <Toggle checked={hideFromSearch} onChange={setHideFromSearch} />
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
      </div>

      {/* Update Email Modal */}
      {showEmailUpdate && (
        <Modal onClose={() => setShowEmailUpdate(false)}>
          <h3 className="text-lg font-bold text-foreground mb-1">Update Email</h3>
          <p className="text-[13px] text-muted mb-5 leading-relaxed">
            Enter your new email address. We&apos;ll send a verification link before updating.
          </p>
          <input
            type="email"
            placeholder="New email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="input-field mb-5"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={() => setShowEmailUpdate(false)}
              className="flex-1 border border-border text-foreground font-semibold text-[13px] py-2.5 rounded-xl active:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // TODO: call Supabase to update email
                if (newEmail) setEmail(newEmail)
                setShowEmailUpdate(false)
              }}
              className="btn-primary flex-1 py-2.5"
            >
              Update
            </button>
          </div>
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
