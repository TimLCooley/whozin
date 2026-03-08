'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppHeader } from '@/components/app/header'

interface MemberInfo {
  id: string
  user_id: string
  status: 'confirmed' | 'tbd' | 'waiting' | 'out' | 'missed'
  priority_order: number
  responded_at: string | null
  user: {
    id: string
    first_name: string
    last_name: string
    avatar_url: string | null
  } | null
}

interface ActivityDetail {
  id: string
  activity_type: string
  activity_name: string
  activity_date: string | null
  activity_time: string | null
  location: string | null
  cost: number | null
  cost_type: string
  note: string | null
  max_capacity: number | null
  status: string
  chat_enabled: boolean
  reminder_enabled: boolean
  priority_invite: boolean
  response_timer_minutes: number
  image_url: string | null
  creator_id: string
  is_creator: boolean
  current_user_id: string
  my_status: string | null
  group_name: string
  creator_name: string
  confirmed_count: number
  members: MemberInfo[]
}

type Tab = 'details' | 'group' | 'chat'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  confirmed: { label: 'Confirmed', color: 'text-green-600', icon: 'check' },
  waiting: { label: 'Invited', color: 'text-yellow-600', icon: 'clock' },
  tbd: { label: 'In Queue', color: 'text-muted', icon: 'queue' },
  missed: { label: 'Missed', color: 'text-orange-500', icon: 'missed' },
  out: { label: 'Out', color: 'text-red-500', icon: 'x' },
}

function formatDate(date: string | null, time: string | null) {
  if (!date) return 'No date set'
  const d = new Date(date + 'T00:00:00')
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  if (!time) return dateStr
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'pm' : 'am'
  const h12 = hour % 12 || 12
  return `${dateStr} at ${h12}:${m} ${ampm}`
}

function formatCost(costType: string, cost: number | null) {
  if (costType === 'free') return 'Free'
  const price = cost ? `$${cost.toFixed(2)}` : ''
  if (costType === 'pay_me') return price ? `${price} (Pay Host)` : 'Pay Host'
  return price ? `${price} (Pay at Location)` : 'Pay at Location'
}

export default function ActivityDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [activity, setActivity] = useState<ActivityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('details')
  const [responding, setResponding] = useState(false)

  const loadActivity = useCallback(async () => {
    const res = await fetch(`/api/activities/${id}`)
    if (res.ok) {
      const data = await res.json()
      setActivity(data)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadActivity() }, [loadActivity])

  // Auto-refresh every 30s to see invite progress
  useEffect(() => {
    const interval = setInterval(loadActivity, 30000)
    return () => clearInterval(interval)
  }, [loadActivity])

  async function handleResponse(response: 'in' | 'out') {
    if (!activity) return
    setResponding(true)
    const res = await fetch(`/api/activities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    })
    if (res.ok) {
      await loadActivity()
    }
    setResponding(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this activity? This cannot be undone.')) return
    const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/app')
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="min-h-dvh flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center text-muted">Activity not found.</div>
      </div>
    )
  }

  const confirmed = activity.members.filter((m) => m.status === 'confirmed')
  const waiting = activity.members.filter((m) => m.status === 'waiting')
  const tbd = activity.members.filter((m) => m.status === 'tbd')
  const missed = activity.members.filter((m) => m.status === 'missed')
  const out = activity.members.filter((m) => m.status === 'out')

  const isFull = activity.max_capacity ? confirmed.length >= activity.max_capacity : false

  const tabs: { key: Tab; label: string; pro?: boolean }[] = [
    { key: 'details', label: 'Activity Details' },
    ...(activity.is_creator ? [{ key: 'group' as Tab, label: 'Group' }] : []),
    ...(activity.chat_enabled ? [{ key: 'chat' as Tab, label: 'Chat', pro: true }] : []),
  ]

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <AppHeader showBack />

      {/* Activity Title Bar */}
      <div className="bg-background border-b border-border/40 px-4 py-3">
        <h1 className="text-[17px] font-bold text-foreground">{activity.activity_name}</h1>
        {activity.is_creator && (
          <p className="text-[12px] text-muted mt-0.5">{activity.group_name}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex relative bg-background border-b border-border/40">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-[13px] font-semibold text-center transition-colors relative z-10 flex items-center justify-center gap-1.5 ${
              tab === t.key ? 'text-primary' : 'text-muted'
            }`}
          >
            {t.label}
            {t.pro && (
              <span className="text-[8px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-bold uppercase">PRO</span>
            )}
          </button>
        ))}
        <div
          className="absolute bottom-0 h-[2.5px] bg-primary rounded-full transition-all duration-300 ease-out z-0"
          style={{
            width: `${100 / tabs.length}%`,
            left: `${tabs.findIndex((t) => t.key === tab) * (100 / tabs.length)}%`,
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-28">
        {tab === 'details' && (
          <div className="px-4 pt-4 space-y-4 animate-enter">
            {/* Host view */}
            {activity.is_creator && (
              <>
                {/* Status banner */}
                <div className={`rounded-xl p-3 text-center text-[13px] font-semibold ${
                  activity.status === 'full' ? 'bg-green-50 text-green-700 border border-green-200' :
                  activity.status === 'open' ? 'bg-primary/5 text-primary border border-primary/20' :
                  'bg-surface text-muted border border-border/50'
                }`}>
                  {activity.status === 'full' ? 'Activity is Full!' :
                   activity.status === 'open' ? (activity.priority_invite ? 'Invites in progress...' : 'Open') :
                   activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                </div>

                <InfoRow icon="calendar" label="Date & Time" value={formatDate(activity.activity_date, activity.activity_time)} trailing={<AddToCalendarButton activity={activity} />} />
                {activity.location && <InfoRow icon="pin" label="Location" value={activity.location} link />}
                <InfoRow icon="dollar" label="Cost" value={formatCost(activity.cost_type, activity.cost)} />
                <InfoRow icon="people" label="Spots" value={
                  activity.max_capacity
                    ? `${confirmed.length} / ${activity.max_capacity} filled`
                    : `${confirmed.length} in`
                } />
                {activity.note && <InfoRow icon="note" label="Note" value={activity.note} />}
                {activity.priority_invite && (
                  <InfoRow icon="timer" label="Response Timer" value={`${activity.response_timer_minutes} min per batch`} />
                )}

                {/* Clone button */}
                <button
                  onClick={() => router.push(`/app/activities/create?clone=${activity.id}`)}
                  className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 flex items-center gap-3 active:bg-surface transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  <span className="text-[14px] font-semibold text-primary">Clone Activity</span>
                </button>
              </>
            )}

            {/* Invitee view — just the essentials */}
            {!activity.is_creator && (
              <>
                <InfoRow icon="calendar" label="Date & Time" value={formatDate(activity.activity_date, activity.activity_time)} trailing={<AddToCalendarButton activity={activity} />} />
                {activity.location && <InfoRow icon="pin" label="Location" value={activity.location} link />}
                <InfoRow icon="dollar" label="Cost" value={formatCost(activity.cost_type, activity.cost)} />

                {/* Response buttons */}
                {activity.my_status && activity.my_status !== 'tbd' && (
                  <div className="bg-background border border-border/50 rounded-xl p-4">
                    <p className="text-[13px] font-medium text-foreground/70 mb-3">Your Response</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleResponse('in')}
                        disabled={responding || (isFull && activity.my_status !== 'confirmed')}
                        className={`flex-1 py-3 rounded-xl text-[14px] font-bold transition-colors ${
                          activity.my_status === 'confirmed'
                            ? 'bg-[#00C853] text-white'
                            : 'bg-surface text-foreground border border-border/50 active:bg-primary/5'
                        } disabled:opacity-50`}
                      >
                        {activity.my_status === 'confirmed' ? "You're In!" : 'IN'}
                      </button>
                      <button
                        onClick={() => handleResponse('out')}
                        disabled={responding}
                        className={`flex-1 py-3 rounded-xl text-[14px] font-bold transition-colors ${
                          activity.my_status === 'out'
                            ? 'bg-red-500 text-white'
                            : 'bg-surface text-foreground border border-border/50 active:bg-red-50'
                        }`}
                      >
                        {activity.my_status === 'out' ? "You're Out" : 'OUT'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'group' && (
          <div className="px-4 pt-4 space-y-5 animate-enter">
            {/* In (Confirmed) */}
            <StatusSection
              title="In"
              count={confirmed.length}
              badge={isFull ? 'Full' : undefined}
              badgeColor="bg-green-100 text-green-700"
              members={confirmed}
              statusKey="confirmed"
            />

            {/* Waiting (Currently invited) */}
            <StatusSection
              title="Waiting"
              count={waiting.length}
              members={waiting}
              statusKey="waiting"
            />

            {/* TBD (In queue, not yet invited) */}
            <StatusSection
              title="TBD"
              count={tbd.length}
              members={tbd}
              statusKey="tbd"
            />

            {/* Missed (Timer expired) */}
            <StatusSection
              title="Missed"
              count={missed.length}
              members={missed}
              statusKey="missed"
            />

            {/* Out */}
            <StatusSection
              title="Out"
              count={out.length}
              members={out}
              statusKey="out"
            />

            {/* Host actions */}
            {activity.is_creator && (
              <div className="pt-4 space-y-3">
                <button className="btn-primary w-full py-3.5 text-[14px]">
                  Save
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full text-center text-danger text-[14px] font-semibold py-2 active:opacity-70"
                >
                  Delete Activity
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex-1 flex items-center justify-center py-16 text-muted text-[14px]">
            Activity chat coming soon...
          </div>
        )}
      </div>
    </div>
  )
}

/* -- Components -- */

function StatusSection({
  title,
  count,
  badge,
  badgeColor,
  members,
  statusKey,
}: {
  title: string
  count: number
  badge?: string
  badgeColor?: string
  members: MemberInfo[]
  statusKey: string
}) {
  const config = STATUS_CONFIG[statusKey]
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-[15px] font-bold text-foreground">{title} ({count})</h3>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
            {badge}
          </span>
        )}
        {statusKey === 'confirmed' && count > 0 && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#00C853" stroke="none" className="flex-shrink-0">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        )}
      </div>
      {members.length > 0 ? (
        <div className="bg-background border border-border/50 rounded-xl overflow-hidden">
          {members.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center gap-3 px-4 py-3 ${i < members.length - 1 ? 'border-b border-border/30' : ''}`}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-border/40 overflow-hidden flex items-center justify-center flex-shrink-0">
                {m.user?.avatar_url ? (
                  <img src={m.user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0b8cc" strokeWidth={1.5}>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21v-1a8 8 0 0116 0v1" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-foreground truncate">
                  {m.user ? `${m.user.first_name} ${m.user.last_name}` : 'Unknown'}
                </p>
                <p className={`text-[11px] font-medium ${config.color}`}>{config.label}</p>
              </div>

              {/* Status icon */}
              <StatusIcon status={statusKey} />
            </div>
          ))}
        </div>
      ) : (
        <div className="border-b border-border/20 pb-3" />
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'confirmed':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C853" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
          <path d="M8 12l3 3 5-5" />
        </svg>
      )
    case 'waiting':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
          <path d="M12 6v6l4 2" />
        </svg>
      )
    case 'tbd':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
          <path d="M8 12h8" />
        </svg>
      )
    case 'missed':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      )
    case 'out':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      )
    default:
      return null
  }
}

function AddToCalendarButton({ activity }: { activity: ActivityDetail }) {
  function handleAddToCalendar() {
    const title = encodeURIComponent(activity.activity_name)
    const location = encodeURIComponent(activity.location ?? '')
    let startDate = ''
    let endDate = ''
    if (activity.activity_date) {
      const date = activity.activity_date.replace(/-/g, '')
      const time = activity.activity_time ? activity.activity_time.replace(/:/g, '') + '00' : '120000'
      startDate = `${date}T${time}`
      // Default 2 hour event
      const start = new Date(`${activity.activity_date}T${activity.activity_time ?? '12:00'}`)
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
      const endD = end.toISOString().split('T')[0].replace(/-/g, '')
      const endT = String(end.getHours()).padStart(2, '0') + String(end.getMinutes()).padStart(2, '0') + '00'
      endDate = `${endD}T${endT}`
    }
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&location=${location}`
    window.open(url, '_blank')
  }

  return (
    <button
      onClick={handleAddToCalendar}
      className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center active:bg-primary/20 transition-colors"
      title="Add to Calendar"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18M8 2v4M16 2v4" />
        <path d="M12 14v4M10 16h4" />
      </svg>
    </button>
  )
}

function InfoRow({ icon, label, value, link, trailing }: { icon: string; label: string; value: string; link?: boolean; trailing?: React.ReactNode }) {
  return (
    <div className="bg-background border border-border/50 rounded-xl px-4 py-3 flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">
        {icon === 'calendar' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" />
          </svg>
        )}
        {icon === 'pin' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
        )}
        {icon === 'dollar' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        )}
        {icon === 'people' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
          </svg>
        )}
        {icon === 'note' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
        )}
        {icon === 'timer' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted uppercase tracking-wider">{label}</p>
        <p className={`text-[14px] font-medium mt-0.5 ${link ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      </div>
      {trailing}
    </div>
  )
}
