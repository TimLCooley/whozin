'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app/header'

interface Alert {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  group_invite: { icon: 'group', bg: 'bg-primary/10', color: 'text-primary' },
  member_joined: { icon: 'person_add', bg: 'bg-green-100', color: 'text-green-600' },
  chat_message: { icon: 'chat', bg: 'bg-blue-100', color: 'text-blue-600' },
  activity_invite: { icon: 'event', bg: 'bg-yellow-100', color: 'text-yellow-600' },
  system: { icon: 'info', bg: 'bg-gray-100', color: 'text-gray-600' },
}

function AlertIcon({ type }: { type: string }) {
  const config = TYPE_ICONS[type] || TYPE_ICONS.system
  return (
    <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
      {type === 'group_invite' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={config.color}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      )}
      {type === 'member_joined' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={config.color}>
          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      )}
      {type === 'chat_message' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={config.color}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      )}
      {type === 'activity_invite' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={config.color}>
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" />
        </svg>
      )}
      {type === 'system' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={config.color}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      )}
    </div>
  )
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/alerts')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAlerts(data)
      })
      .finally(() => setLoading(false))
  }, [])

  async function markAllRead() {
    await fetch('/api/alerts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_read: true }),
    })
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })))
  }

  async function handleAlertClick(alert: Alert) {
    // Mark as read
    if (!alert.read) {
      await fetch('/api/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alert.id }),
      })
      setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, read: true } : a))
    }
    // Navigate if link
    if (alert.link) {
      router.push(alert.link)
    }
  }

  const unreadCount = alerts.filter((a) => !a.read).length

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <AppHeader showBack />

      <div className="bg-background border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-foreground">Alerts</h2>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-[13px] text-primary font-semibold active:opacity-70"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b0b8cc" strokeWidth={1.5}>
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </div>
            <p className="text-[15px] font-semibold text-foreground mb-1">All caught up!</p>
            <p className="text-[13px] text-muted">No alerts yet. They&apos;ll show up here when something happens.</p>
          </div>
        ) : (
          <div>
            {alerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-border/30 active:bg-surface/80 transition-colors ${
                  !alert.read ? 'bg-primary/[0.03]' : ''
                }`}
              >
                <AlertIcon type={alert.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-[14px] leading-snug ${!alert.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                      {alert.title}
                    </p>
                    {!alert.read && (
                      <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-[12px] text-muted mt-0.5 line-clamp-2">{alert.body}</p>
                  <p className="text-[11px] text-muted/70 mt-1">{timeAgo(alert.created_at)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
