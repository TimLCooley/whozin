'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { BrandedFullLogo } from '@/components/ui/branded-logo'

interface Profile {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  group?: { id: string; name: string } | null
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const groupId = searchParams.get('group')
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [error, setError] = useState('')

  // Join flow state
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [joinFirstName, setJoinFirstName] = useState('')
  const [joinLastName, setJoinLastName] = useState('')
  const [joinShowPhone, setJoinShowPhone] = useState(false)
  const [joinShowLastName, setJoinShowLastName] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [joinError, setJoinError] = useState('')

  // Logged-in add friend state
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    const groupParam = groupId ? `&group=${groupId}` : ''
    fetch(`/api/user/public?id=${id}${groupParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError('User not found'); return }
        setProfile(data)
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))

    fetch('/api/user/profile')
      .then((r) => { if (r.ok) setIsLoggedIn(true) })
      .catch(() => {})
  }, [id, groupId])

  async function handleAdd() {
    if (adding) return
    setAdding(true)
    try {
      const body: Record<string, string> = { friend_id: id }
      if (groupId) body.group_id = groupId
      const res = await fetch('/api/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setAdded(true)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to add')
      }
    } catch {
      setError('Network error')
    } finally {
      setAdding(false)
    }
  }

  function maskLastName(name: string) {
    if (!name) return ''
    return name[0].toUpperCase() + '*'.repeat(7)
  }

  async function handleJoin() {
    if (joining || !phone.trim() || !joinFirstName.trim()) return
    setJoining(true)
    setJoinError('')
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          first_name: joinFirstName.trim(),
          last_name: joinLastName.trim(),
          show_phone: joinShowPhone,
          show_last_name: joinShowLastName,
          inviter_id: id,
          group_id: groupId || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setJoined(true)
      } else {
        setJoinError(data.error || 'Something went wrong')
      }
    } catch {
      setJoinError('Network error. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <p className="text-foreground font-bold text-lg mb-2">User Not Found</p>
        <p className="text-muted text-[14px] mb-6">This QR code may be invalid or expired.</p>
        <a href="/" className="px-6 py-3 rounded-xl bg-primary text-white font-semibold text-[14px]">
          Go to Whozin
        </a>
      </div>
    )
  }

  const firstName = profile?.first_name ?? ''
  const name = `${firstName} ${profile?.last_name ?? ''}`.trim()
  const initials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase()
  const groupName = profile?.group?.name

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="bg-gradient-to-b from-primary to-primary-dark px-4 py-3.5 flex items-center gap-2.5">
        <BrandedFullLogo className="h-9" />
      </div>

      {/* Profile card */}
      <div className="px-5 py-8 flex flex-col items-center">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={name} className="w-24 h-24 rounded-full object-cover shadow-lg" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center shadow-lg">
            <span className="text-3xl font-bold text-primary">{initials}</span>
          </div>
        )}

        <h2 className="text-xl font-bold text-foreground mt-4">{name}</h2>

        {groupName ? (
          <p className="text-[14px] text-muted mt-1 text-center">
            wants to add you to <span className="font-semibold text-foreground">{groupName}</span>
          </p>
        ) : (
          <p className="text-[13px] text-muted mt-1">Whozin Member</p>
        )}

        {/* ===== LOGGED-IN USER FLOW ===== */}
        {isLoggedIn && !added && (
          <button
            onClick={handleAdd}
            disabled={adding}
            className="mt-6 px-8 py-3.5 rounded-xl bg-primary text-white font-bold text-[15px] shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {adding ? 'Adding...' : groupName ? `Join ${groupName}` : 'Add Friend'}
          </button>
        )}

        {isLoggedIn && added && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#34c759]/10 text-[#34c759] font-semibold text-[15px]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {groupName ? `Joined ${groupName}!` : 'Friend Added!'}
            </div>
            <button
              onClick={() => router.push(groupId ? `/app/groups/${groupId}` : '/app')}
              className="block mt-4 px-8 py-3 rounded-xl bg-primary text-white font-semibold text-[14px] mx-auto"
            >
              Open App
            </button>
          </div>
        )}

        {/* ===== NON-LOGGED-IN: SECURE JOIN FLOW ===== */}
        {!isLoggedIn && !joined && !showJoinForm && (
          <div className="mt-8 w-full max-w-xs space-y-3">
            <button
              onClick={() => setShowJoinForm(true)}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-[15px] shadow-lg active:scale-[0.98] transition-transform"
            >
              Join Securely
            </button>
            <a
              href="/dl"
              className="block w-full py-3.5 rounded-xl border-2 border-primary text-primary font-bold text-[15px] text-center active:scale-[0.98] transition-transform"
            >
              Download Whozin
            </a>
            <p className="text-[12px] text-muted text-center mt-2">
              Already have an account?{' '}
              <a href={`/auth/sign-in?redirect=/u/${id}${groupId ? `?group=${groupId}` : ''}`} className="text-primary font-semibold">
                Sign in
              </a>
            </p>
          </div>
        )}

        {/* ===== JOIN FORM ===== */}
        {!isLoggedIn && !joined && showJoinForm && (
          <div className="mt-6 w-full max-w-xs">
            <div className="bg-surface/50 border border-border/50 rounded-2xl p-5">
              <p className="text-[14px] text-foreground font-semibold text-center mb-1">
                {groupName
                  ? `Join ${groupName}`
                  : `Connect with ${firstName}`
                }
              </p>
              <p className="text-[12px] text-muted text-center mb-4">
                Enter your info to join securely.
              </p>

              {/* Name fields */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={joinFirstName}
                  onChange={(e) => setJoinFirstName(e.target.value)}
                  placeholder="First name"
                  autoFocus
                  className="flex-1 h-12 px-4 rounded-xl border border-border bg-background text-[15px]
                             placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                             focus:border-primary"
                />
                <input
                  type="text"
                  value={joinLastName}
                  onChange={(e) => setJoinLastName(e.target.value)}
                  placeholder="Last name"
                  className="flex-1 h-12 px-4 rounded-xl border border-border bg-background text-[15px]
                             placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                             focus:border-primary"
                />
              </div>

              {/* Phone field */}
              <div className="flex gap-2">
                <div className="flex items-center px-3 rounded-xl border border-border bg-background text-[14px] text-muted">
                  +1
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="flex-1 h-12 px-4 rounded-xl border border-border bg-background text-[15px]
                             placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                             focus:border-primary"
                />
              </div>

              {/* Privacy toggles */}
              <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
                <p className="text-[12px] text-muted font-semibold uppercase tracking-wide">Privacy</p>

                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-foreground">Show my phone number</span>
                  <button
                    role="switch"
                    aria-checked={joinShowPhone}
                    onClick={() => setJoinShowPhone(!joinShowPhone)}
                    className={`relative w-[42px] h-[26px] rounded-full transition-colors duration-200 flex-shrink-0 ${
                      joinShowPhone ? 'bg-primary' : 'bg-[#d5d9e2]'
                    }`}
                  >
                    <span className={`absolute top-[3px] left-[3px] w-[20px] h-[20px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                      joinShowPhone ? 'translate-x-[16px]' : ''
                    }`} />
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-foreground">Show my full last name</span>
                    <button
                      role="switch"
                      aria-checked={joinShowLastName}
                      onClick={() => setJoinShowLastName(!joinShowLastName)}
                      className={`relative w-[42px] h-[26px] rounded-full transition-colors duration-200 flex-shrink-0 ${
                        joinShowLastName ? 'bg-primary' : 'bg-[#d5d9e2]'
                      }`}
                    >
                      <span className={`absolute top-[3px] left-[3px] w-[20px] h-[20px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                        joinShowLastName ? 'translate-x-[16px]' : ''
                      }`} />
                    </button>
                  </div>
                  {joinLastName && !joinShowLastName && (
                    <p className="text-[12px] text-muted mt-1">
                      Others will see: <span className="font-medium">{joinFirstName || 'You'} {maskLastName(joinLastName)}</span>
                    </p>
                  )}
                </div>
              </div>

              {joinError && (
                <p className="text-[12px] text-danger mt-3 text-center">{joinError}</p>
              )}

              <button
                onClick={handleJoin}
                disabled={joining || !phone.trim() || !joinFirstName.trim()}
                className="w-full mt-4 py-3.5 rounded-xl bg-primary text-white font-bold text-[15px]
                           active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {joining ? 'Joining...' : groupName ? `Join ${groupName}` : 'Connect'}
              </button>

              <button
                onClick={() => { setShowJoinForm(false); setJoinError('') }}
                className="w-full mt-2 py-2 text-[13px] text-muted font-medium"
              >
                Back
              </button>
            </div>

            <p className="text-[11px] text-muted text-center mt-3 px-2 leading-relaxed">
              Your info is stored securely. Privacy settings can be changed anytime in the app.
            </p>
          </div>
        )}

        {/* ===== SUCCESS STATE ===== */}
        {!isLoggedIn && joined && (
          <div className="mt-6 w-full max-w-xs text-center">
            <div className="bg-[#34c759]/10 border border-[#34c759]/20 rounded-2xl p-6">
              <div className="w-14 h-14 rounded-full bg-[#34c759]/20 flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <p className="text-[16px] font-bold text-foreground">You&apos;re in!</p>
              <p className="text-[13px] text-muted mt-1">
                {groupName
                  ? `You've been added to ${groupName}.`
                  : `You're now connected with ${firstName}.`
                }
              </p>
              <p className="text-[12px] text-muted mt-2">
                Download the app for the full experience.
              </p>
              <a
                href="/dl"
                className="inline-block mt-4 px-8 py-3 rounded-xl bg-primary text-white font-bold text-[14px] shadow-lg"
              >
                Download Whozin
              </a>
            </div>
          </div>
        )}

        {error && profile && (
          <p className="mt-4 text-[13px] text-danger">{error}</p>
        )}
      </div>
    </div>
  )
}
