'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { BottomNav } from '@/components/app/bottom-nav'

interface ActivityCard {
  id: string
  activity_type: string
  activity_name: string
  activity_date: string | null
  activity_time: string | null
  location: string | null
  cost: number | null
  cost_type: string
  max_capacity: number | null
  member_count: number
  status: string
  chat_enabled: boolean
  is_creator: boolean
  my_status: string | null
  creator_name: string
  group_name: string
  confirmed_count: number
}

function formatDate(date: string | null, time: string | null) {
  if (!date) return 'No date set'
  const d = new Date(date + 'T00:00:00')
  const dateStr = d.toLocaleDateString('en-US', { month: 'numeric', day: '2-digit', year: '2-digit' })
  if (!time) return dateStr
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'pm' : 'am'
  const h12 = hour % 12 || 12
  return `${dateStr} at ${h12}:${m} ${ampm}`
}

function formatCost(costType: string, cost: number | null) {
  if (costType === 'free') return 'Free'
  if (!cost) return costType === 'pay_me' ? 'Pay Host' : 'Pay at Location'
  return `$${cost.toFixed(2)}`
}

export default function AppHome() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [activities, setActivities] = useState<ActivityCard[]>([])
  const [loading, setLoading] = useState(true)

  const loadActivities = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/activities?tab=${activeTab}`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) setActivities(data)
    }
    setLoading(false)
  }, [activeTab])

  useEffect(() => { loadActivities() }, [loadActivities])

  async function handleResponse(activityId: string, response: 'in' | 'out') {
    // Optimistic update
    setActivities((prev) =>
      prev.map((a) =>
        a.id === activityId ? { ...a, my_status: response === 'in' ? 'confirmed' : 'out' } : a
      )
    )

    const res = await fetch(`/api/activities/${activityId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    })

    if (!res.ok) {
      // Revert on error
      loadActivities()
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <AppHeader />

      {/* Tabs */}
      <div className="bg-background flex relative">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-3 text-[13px] font-semibold text-center transition-colors ${
            activeTab === 'upcoming' ? 'text-primary' : 'text-muted'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex-1 py-3 text-[13px] font-semibold text-center transition-colors ${
            activeTab === 'past' ? 'text-primary' : 'text-muted'
          }`}
        >
          Past
        </button>
        <div
          className="absolute bottom-0 h-[2.5px] bg-primary rounded-full transition-all duration-300 ease-out"
          style={{
            width: '50%',
            left: activeTab === 'upcoming' ? '0%' : '50%',
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-20 px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-background border border-border/50 rounded-xl p-4 h-32 animate-pulse" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="animate-enter pt-6 text-center">
            <p className="text-foreground/80 text-[15px] leading-relaxed">
              {activeTab === 'upcoming'
                ? 'You do not have any activities coming up.'
                : 'You do not have any past activities.'}
            </p>
            <div className="flex justify-center mt-10">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="16" width="52" height="46" rx="6" fill="#f0f2f8" stroke="#d4d8e8" strokeWidth="1.5" />
                <rect x="10" y="16" width="52" height="14" rx="6" fill="#e4e7f1" />
                <rect x="10" y="24" width="52" height="6" fill="#e4e7f1" />
                <rect x="22" y="11" width="3" height="10" rx="1.5" fill="#d4d8e8" />
                <rect x="47" y="11" width="3" height="10" rx="1.5" fill="#d4d8e8" />
                {activeTab === 'upcoming' ? (
                  <path d="M26 42l7 7 13-15" stroke="#c0c6d6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M28 44l16-16M44 44L28 28" stroke="#c0c6d6" strokeWidth="3" strokeLinecap="round" />
                )}
              </svg>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, i) => (
              <div
                key={activity.id}
                onClick={() => router.push(`/app/activities/${activity.id}`)}
                className={`bg-background border rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] animate-enter cursor-pointer active:bg-surface transition-colors ${
                  activity.is_creator ? 'border-primary/30' : 'border-border/50'
                }`}
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold text-foreground truncate">{activity.activity_name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-muted">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M3 10h18M8 2v4M16 2v4" />
                      </svg>
                      <span className="text-[12px]">{formatDate(activity.activity_date, activity.activity_time)}</span>
                    </div>
                  </div>

                  {/* Chat icon */}
                  {activity.chat_enabled && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  )}

                  {/* Response button */}
                  {activity.my_status === 'confirmed' ? (
                    <button
                      onClick={() => handleResponse(activity.id, 'out')}
                      className="flex-shrink-0 bg-[#00C853] text-white text-[12px] font-bold px-4 py-2 rounded-lg active:opacity-80 transition-opacity"
                    >
                      IN
                    </button>
                  ) : activity.my_status === 'out' ? (
                    <button
                      onClick={() => handleResponse(activity.id, 'in')}
                      className="flex-shrink-0 bg-surface text-muted text-[12px] font-bold px-4 py-2 rounded-lg border border-border/50 active:opacity-80 transition-opacity"
                    >
                      OUT
                    </button>
                  ) : activity.my_status === 'tbd' || activity.my_status === 'waiting' ? (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleResponse(activity.id, 'in')}
                        className="bg-[#00C853] text-white text-[11px] font-bold px-3 py-2 rounded-lg active:opacity-80 transition-opacity"
                      >
                        IN
                      </button>
                      <button
                        onClick={() => handleResponse(activity.id, 'out')}
                        className="bg-surface text-muted text-[11px] font-bold px-3 py-2 rounded-lg border border-border/50 active:opacity-80 transition-opacity"
                      >
                        OUT
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Location */}
                {activity.location && (
                  <div className="flex items-center gap-1.5 mt-2 text-muted">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span className="text-[12px] text-primary truncate">{activity.location}</span>
                  </div>
                )}

                {/* Cost */}
                <div className="flex items-center gap-1.5 mt-1.5 text-muted">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                  <span className="text-[12px]">{formatCost(activity.cost_type, activity.cost)}</span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/30">
                  <button className="flex items-center gap-1.5 text-muted text-[11px] active:text-primary transition-colors">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M3 10h18M8 2v4M16 2v4" />
                    </svg>
                    Add to calendar
                  </button>
                  <div className="flex items-center gap-1.5 text-muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                    </svg>
                    <span className="text-[12px] font-medium">
                      {activity.max_capacity
                        ? `${activity.confirmed_count} / ${activity.max_capacity} filled`
                        : `${activity.confirmed_count} in`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/app/activities/create')}
        className="fixed bottom-[72px] right-4 w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-[0_4px_14px_rgba(66,133,244,0.35)] active:scale-95 transition-transform z-50"
        style={{ animation: 'fabPulse 3s ease-in-out infinite' }}
        aria-label="Create activity"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <BottomNav />
    </div>
  )
}
