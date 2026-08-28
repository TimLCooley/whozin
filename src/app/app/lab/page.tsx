'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth'

// Dev-only line-calling lab. Where the cross-platform in/out caller gets built.
export default function LabPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  const [view, setView] = useState<'home' | 'clip'>('home')
  const [clipUrl, setClipUrl] = useState<string | null>(null)
  const [clipName, setClipName] = useState('')
  const [clipMeta, setClipMeta] = useState('')
  const recordRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await createClient().auth.getUser()
        let ok = user?.email ? isSuperAdmin(user.email) : false
        if (!ok) {
          const p = await fetch('/api/user/profile').then((r) => (r.ok ? r.json() : null)).catch(() => null)
          const digits = (p?.phone || '').replace(/\D/g, '')
          ok = digits.startsWith('1') ? digits.slice(1, 4) === '999' : digits.slice(0, 3) === '999'
        }
        if (cancelled) return
        setAllowed(ok)
        if (!ok) router.replace('/app')
      } catch {
        if (!cancelled) { setAllowed(false); router.replace('/app') }
      }
    })()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => () => { if (clipUrl) URL.revokeObjectURL(clipUrl) }, [clipUrl])

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!f) return
    if (clipUrl) URL.revokeObjectURL(clipUrl)
    setClipUrl(URL.createObjectURL(f))
    setClipName(f.name)
    setClipMeta(`${(f.size / 1_000_000).toFixed(1)} MB`)
    setView('clip')
  }

  if (!allowed) {
    return (
      <div className="h-full flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface overflow-y-auto">
      <AppHeader showBack />
      <input ref={recordRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={uploadRef} type="file" accept="video/*" className="hidden" onChange={onFile} />

      <div className="px-4 py-5 space-y-4 pb-10">
        <div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wide text-red-600 bg-red-100 px-2 py-0.5 rounded-full mb-2">Dev only</span>
          <h1 className="text-2xl font-bold text-foreground">Line-calling lab</h1>
          <p className="text-[14px] text-muted mt-1 leading-relaxed">Record or upload a rally, calibrate the court, and get the in/out call.</p>
        </div>

        {view === 'home' ? (
          <div className="space-y-3">
            <ModeCard
              onClick={() => recordRef.current?.click()}
              accent="red"
              title="Record"
              desc="Capture a rally with your camera."
              icon={<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill="#ef4444" stroke="none" /></>}
            />
            <ModeCard
              onClick={() => uploadRef.current?.click()}
              accent="blue"
              title="Upload"
              desc="Analyze a clip you already have."
              icon={<><path d="M12 15V3M8 7l4-4 4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></>}
            />
            <ModeCard
              accent="muted"
              title="Live"
              badge="Soon"
              desc="Real-time calls with an on-court overlay."
              disabled
              icon={<><circle cx="12" cy="12" r="3" /><path d="M16.2 7.8a6 6 0 010 8.4M7.8 16.2a6 6 0 010-8.4M19 5a10 10 0 010 14M5 19A10 10 0 015 5" /></>}
            />

            <div className="bg-background border border-border/50 rounded-2xl p-4 space-y-1.5 mt-2">
              <p className="text-[12px] font-bold uppercase tracking-wide text-muted mb-1">Progress</p>
              <p className="text-[13px] text-foreground">✅ Phone → Claude clip transfer (Remote Control)</p>
              <p className="text-[13px] text-foreground">✅ CV toolchain installed (OpenCV + ffmpeg)</p>
              <p className="text-[13px] text-muted">⏳ Court calibration → ball tracking → bounce → in/out</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={clipUrl ?? undefined}
                controls
                playsInline
                className="w-full max-h-[60vh]"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget
                  setClipMeta((m) => `${v.videoWidth}×${v.videoHeight} · ${v.duration.toFixed(1)}s · ${m.split('·').pop()?.trim() ?? ''}`)
                }}
              />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-foreground truncate">{clipName}</p>
              <p className="text-[12px] text-muted">{clipMeta}</p>
            </div>

            <button
              type="button"
              onClick={() => alert('Next build: tap the 4 court corners to calibrate, then analyze.')}
              className="w-full py-3.5 rounded-xl bg-primary text-white text-[15px] font-bold active:opacity-80 transition-opacity flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h18v18H3zM3 9h18M9 3v18" />
              </svg>
              Calibrate the court
            </button>
            <button
              type="button"
              onClick={() => { setView('home') }}
              className="w-full py-3 rounded-xl bg-surface text-foreground border border-border/50 text-[14px] font-bold active:opacity-80 transition-opacity"
            >
              Pick a different clip
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ModeCard({
  title, desc, icon, accent, badge, disabled, onClick,
}: {
  title: string
  desc: string
  icon: React.ReactNode
  accent: 'red' | 'blue' | 'muted'
  badge?: string
  disabled?: boolean
  onClick?: () => void
}) {
  const stroke = accent === 'red' ? '#ef4444' : accent === 'blue' ? '#4285F4' : '#8892a7'
  const bg = accent === 'red' ? 'bg-red-500/10' : accent === 'blue' ? 'bg-primary/10' : 'bg-surface'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3.5 p-4 rounded-2xl bg-background border border-border/50 text-left transition-opacity ${disabled ? 'opacity-55' : 'active:opacity-80'}`}
    >
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[16px] font-bold text-foreground">{title}</p>
          {badge && <span className="text-[10px] font-bold uppercase tracking-wide text-muted bg-surface border border-border/50 px-1.5 py-0.5 rounded-full">{badge}</span>}
        </div>
        <p className="text-[13px] text-muted mt-0.5 leading-snug">{desc}</p>
      </div>
      {!disabled && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </button>
  )
}
