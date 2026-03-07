'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stats {
  users: number
  groups: number
  activities: number
  messages: number
  activeUsers: number
  invitesPending: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ users: 0, groups: 0, activities: 0, messages: 0, activeUsers: 0, invitesPending: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('whozin_users').select('id', { count: 'exact', head: true }),
      supabase.from('whozin_groups').select('id', { count: 'exact', head: true }),
      supabase.from('whozin_activity').select('id', { count: 'exact', head: true }),
      supabase.from('whozin_message').select('id', { count: 'exact', head: true }),
      supabase.from('whozin_users').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('whozin_invite').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]).then(([users, groups, activities, messages, active, invites]) => {
      setStats({
        users: users.count ?? 0,
        groups: groups.count ?? 0,
        activities: activities.count ?? 0,
        messages: messages.count ?? 0,
        activeUsers: active.count ?? 0,
        invitesPending: invites.count ?? 0,
      })
      setLoading(false)
    })
  }, [])

  const cards = [
    { label: 'Total Users', value: stats.users, accent: 'bg-blue-500' },
    { label: 'Active Users', value: stats.activeUsers, accent: 'bg-green-500' },
    { label: 'Groups', value: stats.groups, accent: 'bg-purple-500' },
    { label: 'Activities', value: stats.activities, accent: 'bg-orange-500' },
    { label: 'Messages', value: stats.messages, accent: 'bg-pink-500' },
    { label: 'Pending Invites', value: stats.invitesPending, accent: 'bg-yellow-500' },
  ]

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-6">Dashboard</h2>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-background border border-border rounded-xl p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((card) => (
            <div key={card.label} className="bg-background border border-border/50 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${card.accent}`} />
                <span className="text-[11px] font-medium text-muted uppercase tracking-wide">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <h3 className="text-sm font-bold text-foreground mt-8 mb-3">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <QuickAction label="Send Broadcast" href="/admin/messaging" description="Email or SMS all users" />
        <QuickAction label="Manage Templates" href="/admin/templates" description="Edit system emails & SMS" />
        <QuickAction label="Update Branding" href="/admin/branding" description="Logo, favicon, app store assets" />
        <QuickAction label="View Integrations" href="/admin/integrations" description="API keys & service status" />
      </div>
    </div>
  )
}

function QuickAction({ label, href, description }: { label: string; href: string; description: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 bg-background border border-border/50 rounded-xl p-3.5 hover:bg-surface active:bg-surface transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted truncate">{description}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8892a7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </a>
  )
}
