'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Profile {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Fetch public profile
    fetch(`/api/user/public?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError('User not found'); return }
        setProfile(data)
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))

    // Check if logged in
    fetch('/api/user/profile')
      .then((r) => { if (r.ok) setIsLoggedIn(true) })
      .catch(() => {})
  }, [id])

  async function handleAdd() {
    if (adding) return
    setAdding(true)
    try {
      const res = await fetch('/api/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id: id }),
      })
      if (res.ok) {
        setAdded(true)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to add friend')
      }
    } catch {
      setError('Network error')
    } finally {
      setAdding(false)
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
        <a
          href="/"
          className="px-6 py-3 rounded-xl bg-primary text-white font-semibold text-[14px]"
        >
          Go to Whozin
        </a>
      </div>
    )
  }

  const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
  const initials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase()

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="bg-gradient-to-b from-primary to-primary-dark px-4 py-3.5 flex items-center gap-2.5">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="7.5" cy="6.5" rx="2.2" ry="2.5" fill="white" opacity="0.95" />
          <ellipse cx="16.5" cy="6.5" rx="2.2" ry="2.5" fill="white" opacity="0.95" />
          <circle cx="4" cy="13" r="1.8" fill="white" opacity="0.95" />
          <circle cx="20" cy="13" r="1.8" fill="white" opacity="0.95" />
          <ellipse cx="12" cy="16.5" rx="5.5" ry="4.2" fill="white" />
        </svg>
        <h1 className="text-[22px] font-extrabold text-white tracking-tight leading-none">
          Whoz<span className="italic font-extrabold">in</span>
        </h1>
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
        <p className="text-[13px] text-muted mt-1">Whozin Member</p>

        {isLoggedIn && !added && (
          <button
            onClick={handleAdd}
            disabled={adding}
            className="mt-6 px-8 py-3.5 rounded-xl bg-primary text-white font-bold text-[15px] shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {adding ? 'Adding...' : 'Add Friend'}
          </button>
        )}

        {added && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#34c759]/10 text-[#34c759] font-semibold text-[15px]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Friend Added!
            </div>
            <button
              onClick={() => router.push('/app')}
              className="block mt-4 px-8 py-3 rounded-xl bg-primary text-white font-semibold text-[14px] mx-auto"
            >
              Open App
            </button>
          </div>
        )}

        {!isLoggedIn && (
          <div className="mt-6 text-center">
            <p className="text-[14px] text-muted mb-4">Sign up to connect with {profile?.first_name}</p>
            <a
              href={`/auth/sign-up?redirect=/u/${id}`}
              className="inline-block px-8 py-3.5 rounded-xl bg-primary text-white font-bold text-[15px] shadow-lg"
            >
              Join Whozin
            </a>
            <p className="text-[12px] text-muted mt-3">
              Already have an account? <a href={`/auth/sign-in?redirect=/u/${id}`} className="text-primary font-semibold">Sign in</a>
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 text-[13px] text-danger">{error}</p>
        )}
      </div>
    </div>
  )
}
