'use client'

import Link from 'next/link'

interface ChannelTile {
  id: string
  href: string | null
  name: string
  description: string
  status: 'live' | 'soon'
  count?: number
  icon: React.ReactNode
}

const CHANNELS: ChannelTile[] = [
  {
    id: 'sms',
    href: '/admin/templates/sms',
    name: 'SMS',
    description: 'Twilio SMS sent during auth, invites, reminders, waitlist, and chat fallback.',
    status: 'live',
    count: 11,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    id: 'email',
    href: null,
    name: 'Email',
    description: 'Transactional emails via SendGrid — onboarding, activity invites, reminders.',
    status: 'soon',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    id: 'push',
    href: null,
    name: 'Push',
    description: 'iOS/Android/Web push notifications via APNs and FCM.',
    status: 'soon',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
]

export default function TemplatesHubPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">System Templates</h2>
        <p className="text-sm text-muted mt-1">
          Edit the wording of every automated message Whozin sends. Pick a channel below.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHANNELS.map((ch) => {
          const inner = (
            <div className="h-full rounded-2xl border border-border bg-background p-5 transition-all hover:border-primary/40 hover:shadow-md group">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  ch.status === 'live' ? 'bg-primary/10 text-primary' : 'bg-surface text-muted'
                }`}>
                  {ch.icon}
                </div>
                {ch.status === 'soon' ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted bg-surface px-2 py-1 rounded-full">
                    Soon
                  </span>
                ) : ch.count !== undefined ? (
                  <span className="text-xs font-semibold text-muted">
                    {ch.count} templates
                  </span>
                ) : null}
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">{ch.name}</h3>
              <p className="text-xs text-muted leading-relaxed">{ch.description}</p>
              {ch.status === 'live' && (
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary">
                  Open
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              )}
            </div>
          )
          return ch.href ? (
            <Link key={ch.id} href={ch.href}>{inner}</Link>
          ) : (
            <div key={ch.id} className="opacity-60 cursor-not-allowed">{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
