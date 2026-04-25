'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app/header'

interface ActivityCard {
  id: string
  activity_type: string
  activity_name: string
  activity_date: string | null
  activity_time: string | null
  duration_hours: number | null
  location: string | null
  cost: number | null
  cost_type: string
  max_capacity: number | null
  member_count: number
  status: string
  chat_enabled: boolean
  reminder_enabled: boolean
  waitlist_enabled: boolean
  timezone: string | null
  image_url: string | null
  is_creator: boolean
  my_status: string | null
  creator_name: string
  group_name: string
  confirmed_count: number
}

function formatDate(date: string | null, time: string | null, duration?: number | null) {
  if (!date) return 'No date set'
  const d = new Date(date + 'T00:00:00')
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  const dateStr = `${weekday} ${d.toLocaleDateString('en-US', { month: 'numeric', day: '2-digit', year: '2-digit' })}`
  if (!time) return dateStr
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'pm' : 'am'
  const h12 = hour % 12 || 12
  const durLabel = duration ? (duration >= 4 ? '4+ hr' : `${duration} hr`) : ''
  return `${dateStr} at ${h12}:${m} ${ampm}${durLabel ? ` · ${durLabel}` : ''}`
}

/** Next reminder fires at T-24h, T-1h, T-10m before the event. Returns the label of the next one still upcoming. */
function getNextReminderLabel(date: string | null, time: string | null): '24h' | '1h' | '10m' | null {
  if (!date || !time) return null
  const timeStr = time.length === 5 ? `${time}:00` : time
  const event = new Date(`${date}T${timeStr}`)
  if (isNaN(event.getTime())) return null
  const minutesUntil = (event.getTime() - Date.now()) / 60000
  if (minutesUntil > 1440) return '24h'
  if (minutesUntil > 60) return '1h'
  if (minutesUntil > 10) return '10m'
  return null
}

function formatCost(costType: string, cost: number | null) {
  if (costType === 'free') return 'Free'
  if (!cost) return costType === 'pay_me' ? 'Pay Host' : 'Pay at Location'
  return `$${cost.toFixed(2)}`
}

/** Sort: pending responses (tbd/waiting) first, then by date */
function sortActivities(activities: ActivityCard[]) {
  return [...activities].sort((a, b) => {
    const aPending = a.my_status === 'tbd' || a.my_status === 'waiting' ? 0 : 1
    const bPending = b.my_status === 'tbd' || b.my_status === 'waiting' ? 0 : 1
    if (aPending !== bPending) return aPending - bPending
    return 0 // keep original date order from API
  })
}

export default function AppHome() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [activities, setActivities] = useState<ActivityCard[]>([])
  const [loading, setLoading] = useState(true)
  const [outConfirm, setOutConfirm] = useState<{ id: string; name: string } | null>(null)

  const loadActivities = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/activities?tab=${activeTab}`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) setActivities(sortActivities(data))
    }
    setLoading(false)
  }, [activeTab])

  useEffect(() => { loadActivities() }, [loadActivities])

  async function handleResponse(activityId: string, response: 'in' | 'out') {
    let predicted: 'confirmed' | 'out' | 'waitlist' = response === 'in' ? 'confirmed' : 'out'

    // Optimistic update
    setActivities((prev) =>
      sortActivities(
        prev.map((a) => {
          if (a.id !== activityId) return a
          // If they're missed/out and the activity is full with waitlist on,
          // they'll land on the wait list — predict that instead of confirmed.
          if (
            response === 'in' &&
            a.waitlist_enabled &&
            (a.my_status === 'missed' || a.my_status === 'out') &&
            a.max_capacity != null &&
            a.confirmed_count >= a.max_capacity
          ) {
            predicted = 'waitlist'
          }
          const wasConfirmed = a.my_status === 'confirmed'
          const willBeConfirmed = predicted === 'confirmed'
          const delta = willBeConfirmed === wasConfirmed ? 0 : willBeConfirmed ? 1 : -1
          return {
            ...a,
            my_status: predicted,
            confirmed_count: Math.max(0, a.confirmed_count + delta),
          }
        })
      )
    )

    const res = await fetch(`/api/activities/${activityId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok || (data?.status && data.status !== predicted)) {
      loadActivities()
    }
  }

  function handleOutClick(e: React.MouseEvent, activity: ActivityCard) {
    e.stopPropagation()
    setOutConfirm({ id: activity.id, name: activity.activity_name })
  }

  function confirmOut() {
    if (outConfirm) {
      handleResponse(outConfirm.id, 'out')
      setOutConfirm(null)
    }
  }

  return (
    <div className="relative h-full flex flex-col bg-surface overflow-hidden">
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
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20">
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
            {activities.map((activity, i) => {
              const needsResponse = activity.my_status === 'tbd' || activity.my_status === 'waiting'
              const showReminder = activity.reminder_enabled && activity.is_creator && activity.my_status === 'confirmed'
              const nextReminder = showReminder ? getNextReminderLabel(activity.activity_date, activity.activity_time) : null
              return (
                <div
                  key={activity.id}
                  onClick={() => router.push(`/app/activities/${activity.id}`)}
                  className={`rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] animate-enter cursor-pointer active:opacity-90 transition-all overflow-hidden ${
                    needsResponse
                      ? 'border-[1.5px] border-primary/50 ring-2 ring-primary/15'
                      : activity.is_creator
                        ? 'border-[1.5px] border-primary/40 ring-1 ring-primary/10'
                        : 'border border-border/50'
                  }`}
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  {activity.image_url ? (
                    /* ── Full-bleed image card ── */
                    <div
                      className="relative bg-cover bg-top min-h-[260px] flex flex-col"
                      style={{ backgroundImage: `url(${activity.image_url})` }}
                    >
                      {/* Full overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/15 rounded-xl" />

                      {/* Top badges */}
                      <div className="relative flex items-start justify-between p-3.5">
                        {needsResponse ? (
                          <div className="flex items-center gap-1.5 bg-primary/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wide">Response needed</span>
                          </div>
                        ) : (
                          <div />
                        )}
                        <div className="flex items-center gap-2">
                          {nextReminder && (
                            <div className="flex items-center gap-1 bg-black/35 backdrop-blur-sm px-2 py-0.5 rounded-full">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              <span className="text-[10px] font-bold text-white">{nextReminder}</span>
                            </div>
                          )}
                          {activity.reminder_enabled && activity.is_creator && !nextReminder && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm">
                              <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                              <path d="M13.73 21a2 2 0 01-3.46 0" />
                            </svg>
                          )}
                          {activity.chat_enabled && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm">
                              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Bottom content over image */}
                      <div className="relative px-4 pb-4">
                        <h3 className="text-[30px] font-bold text-white truncate drop-shadow-sm">{activity.activity_name}</h3>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M3 10h18M8 2v4M16 2v4" />
                          </svg>
                          <span className="text-[15px] text-white/90">{formatDate(activity.activity_date, activity.activity_time, activity.duration_hours)}</span>
                        </div>
                        {activity.location && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location!)}`, '_blank')
                            }}
                            className="flex items-center gap-1.5 mt-1 active:opacity-70 transition-opacity"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span className="text-[15px] text-white/90 truncate max-w-[260px] underline-offset-2 hover:underline">{activity.location}</span>
                          </button>
                        )}

                        <div className="flex items-center gap-4 mt-1">
                          {activity.cost_type !== 'free' && (
                            <div className="flex items-center gap-1.5">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                                <line x1="12" y1="1" x2="12" y2="23" />
                                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                              </svg>
                              <span className="text-[15px] text-white/80">{formatCost(activity.cost_type, activity.cost)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                            </svg>
                            <span className="text-[15px] text-white/80 font-medium">
                              {activity.max_capacity
                                ? `${activity.confirmed_count}/${activity.max_capacity}`
                                : `${activity.confirmed_count} in`}
                            </span>
                          </div>
                        </div>

                        {/* Buttons over image */}
                        {activity.my_status === 'confirmed' ? (
                          <div className="flex gap-2 mt-3">
                            <div className="flex-1 bg-[#00C853]/90 backdrop-blur-sm text-white text-[13px] font-bold py-2.5 rounded-lg text-center flex items-center justify-center gap-1.5">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              You&apos;re In
                            </div>
                          </div>
                        ) : activity.my_status === 'out' ? (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleResponse(activity.id, 'in') }}
                              className="px-4 py-2.5 rounded-lg bg-white/20 backdrop-blur-sm text-white text-[13px] font-bold active:opacity-80 transition-opacity"
                            >
                              IN
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation() }}
                              className="flex-1 bg-red-500/80 backdrop-blur-sm text-white text-[13px] font-bold py-2.5 rounded-lg"
                            >
                              You&apos;re Out
                            </button>
                          </div>
                        ) : activity.my_status === 'waitlist' ? (
                          <div className="flex gap-2 mt-3">
                            <div className="flex-1 bg-amber-500/90 backdrop-blur-sm text-white text-[13px] font-bold py-2.5 rounded-lg text-center flex items-center justify-center gap-1.5">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              On Wait List
                            </div>
                            <button
                              onClick={(e) => handleOutClick(e, activity)}
                              className="px-4 py-2.5 rounded-lg bg-white/20 backdrop-blur-sm text-white text-[13px] font-bold active:opacity-80 transition-opacity"
                            >
                              I&apos;m Out
                            </button>
                          </div>
                        ) : (activity.waitlist_enabled && activity.my_status === 'missed') ? (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleResponse(activity.id, 'in') }}
                              className="flex-1 bg-amber-500 text-white text-[13px] font-bold py-2.5 rounded-lg active:opacity-80 transition-opacity shadow-[0_2px_8px_rgba(245,158,11,0.3)] flex items-center justify-center gap-1.5"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              Join Wait List
                            </button>
                          </div>
                        ) : (activity.my_status === 'tbd' || activity.my_status === 'waiting' || activity.my_status === 'missed' || (!activity.my_status && !activity.is_creator)) ? (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleResponse(activity.id, 'in') }}
                              className="flex-1 bg-[#00C853] text-white text-[13px] font-bold py-2.5 rounded-lg active:opacity-80 transition-opacity shadow-[0_2px_8px_rgba(0,200,83,0.3)]"
                            >
                              I&apos;m In!
                            </button>
                            <button
                              onClick={(e) => handleOutClick(e, activity)}
                              className="flex-1 bg-white/20 backdrop-blur-sm text-white text-[13px] font-bold py-2.5 rounded-lg active:opacity-80 transition-opacity"
                            >
                              I&apos;m Out
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    /* ── Standard card (no image) ── */
                    <div className="bg-background p-4">
                  {/* Needs response banner */}
                  {needsResponse && (
                    <div className="flex items-center gap-1.5 mb-2.5 pb-2.5 border-b border-primary/15">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wide">Response needed</span>
                    </div>
                  )}

                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[30px] font-bold text-foreground truncate">{activity.activity_name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 text-muted">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M3 10h18M8 2v4M16 2v4" />
                        </svg>
                        <span className="text-[15px]">{formatDate(activity.activity_date, activity.activity_time, activity.duration_hours)}</span>
                      </div>
                    </div>

                    {/* Top-right icons: reminder countdown / host bell / chat */}
                    <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                      {nextReminder && (
                        <div className="flex items-center gap-1 text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span className="text-[10px] font-bold">{nextReminder}</span>
                        </div>
                      )}
                      {activity.reminder_enabled && activity.is_creator && !nextReminder && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.73 21a2 2 0 01-3.46 0" />
                        </svg>
                      )}
                      {activity.chat_enabled && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Location */}
                  {activity.location && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location!)}`, '_blank')
                      }}
                      className="flex items-center gap-1.5 mt-2 text-muted active:opacity-70 transition-opacity"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="text-[15px] text-primary truncate underline-offset-2 hover:underline">{activity.location}</span>
                    </button>
                  )}

                  {/* Cost — only show if not free */}
                  {activity.cost_type !== 'free' && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-muted">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                      </svg>
                      <span className="text-[15px]">{formatCost(activity.cost_type, activity.cost)}</span>
                    </div>
                  )}

                  {/* Capacity */}
                  <div className="flex items-center gap-1.5 mt-1.5 text-muted">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                    </svg>
                    <span className="text-[15px] font-medium">
                      {activity.max_capacity
                        ? `${activity.confirmed_count} / ${activity.max_capacity} filled`
                        : `${activity.confirmed_count} in`}
                    </span>
                  </div>

                  {/* IN/OUT Response buttons */}
                  {activity.my_status === 'confirmed' ? (
                    <div className="flex gap-2 mt-3 pt-2.5 border-t border-border/30">
                      <div className="flex-1 bg-[#00C853]/10 text-[#00C853] text-[13px] font-bold py-2.5 rounded-lg text-center flex items-center justify-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        You&apos;re In
                      </div>
                    </div>
                  ) : activity.my_status === 'out' ? (
                    <div className="flex gap-2 mt-3 pt-2.5 border-t border-border/30">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResponse(activity.id, 'in') }}
                        className="px-4 py-2.5 rounded-lg bg-surface text-foreground text-[13px] font-bold border border-border/50 active:opacity-80 transition-opacity"
                      >
                        IN
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation() }}
                        className="flex-1 bg-red-500/10 text-red-500 text-[13px] font-bold py-2.5 rounded-lg border border-red-200"
                      >
                        You&apos;re Out
                      </button>
                    </div>
                  ) : activity.my_status === 'waitlist' ? (
                    <div className="flex gap-2 mt-3 pt-2.5 border-t border-amber-200">
                      <div className="flex-1 bg-amber-500/10 text-amber-700 text-[13px] font-bold py-2.5 rounded-lg text-center flex items-center justify-center gap-1.5 border border-amber-200">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        On Wait List
                      </div>
                      <button
                        onClick={(e) => handleOutClick(e, activity)}
                        className="px-4 py-2.5 rounded-lg bg-surface text-foreground text-[13px] font-bold border border-border/50 active:opacity-80 transition-opacity"
                      >
                        I&apos;m Out
                      </button>
                    </div>
                  ) : (activity.waitlist_enabled && activity.my_status === 'missed') ? (
                    <div className="flex gap-2 mt-3 pt-2.5 border-t border-amber-200">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResponse(activity.id, 'in') }}
                        className="flex-1 bg-amber-500 text-white text-[13px] font-bold py-2.5 rounded-lg active:opacity-80 transition-opacity shadow-[0_2px_8px_rgba(245,158,11,0.3)] flex items-center justify-center gap-1.5"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Join Wait List
                      </button>
                    </div>
                  ) : (activity.my_status === 'tbd' || activity.my_status === 'waiting' || activity.my_status === 'missed' || (!activity.my_status && !activity.is_creator)) ? (
                    <div className="flex gap-2 mt-3 pt-2.5 border-t border-primary/15">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResponse(activity.id, 'in') }}
                        className="flex-1 bg-[#00C853] text-white text-[13px] font-bold py-2.5 rounded-lg active:opacity-80 transition-opacity shadow-[0_2px_8px_rgba(0,200,83,0.3)]"
                      >
                        I&apos;m In!
                      </button>
                      <button
                        onClick={(e) => handleOutClick(e, activity)}
                        className="flex-1 bg-surface text-muted text-[13px] font-bold py-2.5 rounded-lg border border-border/50 active:opacity-80 transition-opacity"
                      >
                        I&apos;m Out
                      </button>
                    </div>
                  ) : (
                    /* Footer for host/no-status cards */
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/30">
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-muted text-[11px] active:text-primary transition-colors"
                      >
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
                        <span className="text-[15px] font-medium">
                          {activity.max_capacity
                            ? `${activity.confirmed_count} / ${activity.max_capacity} filled`
                            : `${activity.confirmed_count} in`}
                        </span>
                      </div>
                    </div>
                  )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* OUT Confirmation Modal */}
      {outConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => setOutConfirm(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-xl animate-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-orange-50 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <h3 className="text-[17px] font-bold text-foreground">Are you sure?</h3>
              <p className="text-[14px] text-foreground/70 mt-2 leading-relaxed">
                Someone waited for this spot in <span className="font-semibold">{outConfirm.name}</span>. Dropping out means they missed out for nothing.
              </p>
              <p className="text-[13px] text-muted mt-1.5 italic">
                Don&apos;t be that person...
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setOutConfirm(null)}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-[#00C853] text-white active:opacity-80 transition-opacity"
              >
                Stay In
              </button>
              <button
                onClick={confirmOut}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-surface text-muted border border-border/50 active:opacity-80 transition-opacity"
              >
                Drop Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push('/app/activities/create')}
        className="absolute bottom-4 right-4 w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-[0_4px_14px_rgba(66,133,244,0.35)] active:scale-95 transition-transform z-50"
        style={{ animation: 'fabPulse 3s ease-in-out infinite' }}
        aria-label="Create activity"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

    </div>
  )
}
