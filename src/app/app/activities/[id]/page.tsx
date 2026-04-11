'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { AvatarImg } from '@/components/ui/avatar-img'
import { PlacesAutocomplete } from '@/components/ui/places-autocomplete'
import { createClient } from '@/lib/supabase/client'

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
  invite_starts_at: string | null
}

type Tab = 'details' | 'group' | 'chat'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  confirmed: { label: 'Confirmed', color: 'text-green-600', icon: 'check' },
  waiting: { label: 'Invited', color: 'text-yellow-600', icon: 'clock' },
  tbd: { label: 'On Deck', color: 'text-muted', icon: 'queue' },
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
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'details'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [responding, setResponding] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [showOutModal, setShowOutModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editField, setEditField] = useState<'location' | 'datetime' | 'cost' | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editLocation, setEditLocation] = useState('')
  const locationWrapRef = useRef<HTMLDivElement>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editCostType, setEditCostType] = useState<'free' | 'pay_me' | 'pay_at_location'>('free')
  const [editCostAmount, setEditCostAmount] = useState('')

  function openEdit(field: 'location' | 'datetime' | 'cost') {
    if (!activity) return
    if (field === 'location') setEditLocation(activity.location ?? '')
    if (field === 'datetime') {
      setEditDate(activity.activity_date ?? '')
      setEditTime(activity.activity_time ?? '')
    }
    if (field === 'cost') {
      setEditCostType((activity.cost_type as 'free' | 'pay_me' | 'pay_at_location') ?? 'free')
      setEditCostAmount(activity.cost != null ? String(activity.cost) : '')
    }
    setEditField(field)
  }

  async function saveEdit() {
    if (!activity || !editField) return
    setEditSaving(true)
    const payload: Record<string, unknown> = {}
    if (editField === 'location') {
      // PlacesAutocomplete's Google element only syncs state on blur; read the
      // live DOM value in case the user clicks Save without blurring first.
      const domVal = locationWrapRef.current?.querySelector('input')?.value ?? ''
      const effective = (domVal || editLocation).trim()
      payload.location = effective || null
    }
    if (editField === 'datetime') {
      payload.activity_date = editDate || null
      payload.activity_time = editTime || null
    }
    if (editField === 'cost') {
      payload.cost_type = editCostType
      payload.cost = editCostType === 'free' ? null : (parseFloat(editCostAmount) || null)
    }
    try {
      const res = await fetch(`/api/activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setActivity((prev) => (prev ? { ...prev, ...payload } as ActivityDetail : prev))
        setEditField(null)
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to save')
      }
    } catch {
      alert('Failed to save')
    }
    setEditSaving(false)
  }
  const [countdownSeconds, setCountdownSeconds] = useState(0)
  const [selectedMember, setSelectedMember] = useState<MemberInfo | null>(null)
  const [memberActioning, setMemberActioning] = useState(false)

  const loadActivity = useCallback(async () => {
    const res = await fetch(`/api/activities/${id}`)
    if (res.ok) {
      const data = await res.json()
      setActivity(data)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadActivity() }, [loadActivity])

  // Auto-refresh every 6s to see invite progress
  useEffect(() => {
    const interval = setInterval(loadActivity, 6000)
    return () => clearInterval(interval)
  }, [loadActivity])

  // Auto-switch to group tab during countdown
  useEffect(() => {
    if (activity?.is_creator && activity?.invite_starts_at && new Date(activity.invite_starts_at) > new Date()) {
      setTab('group')
    }
  }, [activity?.is_creator, activity?.invite_starts_at])

  // Countdown timer for Build workflow
  useEffect(() => {
    if (!activity?.invite_starts_at) return
    const target = new Date(activity.invite_starts_at).getTime()

    const tick = () => {
      const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000))
      setCountdownSeconds(remaining)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activity?.invite_starts_at])

  const isCountdownActive = !!(
    activity?.is_creator &&
    activity?.priority_invite &&
    activity?.invite_starts_at &&
    countdownSeconds > 0
  )

  async function handleConfirmMember(member: MemberInfo) {
    setMemberActioning(true)
    await fetch(`/api/activities/${id}/confirm-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: member.user_id }),
    })
    setSelectedMember(null)
    setMemberActioning(false)
    await loadActivity()
  }

  async function handleRemoveMember(member: MemberInfo, notify = false) {
    setMemberActioning(true)
    await fetch(`/api/activities/${id}/remove-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: member.user_id, notify }),
    })
    setSelectedMember(null)
    setMemberActioning(false)
    await loadActivity()
  }

  async function handleStartInvites() {
    await fetch(`/api/activities/${id}/start-invites`, { method: 'POST' })
    await loadActivity()
  }

  async function handleEmergencyFill() {
    const res = await fetch(`/api/activities/${id}/emergency-fill`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      await loadActivity()
    }
  }

  async function handleResponse(response: 'in' | 'out') {
    if (!activity) return
    if (response === 'out' && activity.my_status === 'confirmed') {
      setShowOutModal(true)
      return
    }
    await doResponse(response)
  }

  async function doResponse(response: 'in' | 'out') {
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
    setDeleting(true)
    const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/app')
    setDeleting(false)
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="h-full flex flex-col bg-surface">
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
    ...(activity.chat_enabled && (activity.my_status === 'confirmed' || activity.is_creator) ? [{ key: 'chat' as Tab, label: 'Chat' }] : []),
  ]

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <AppHeader showBack />

      {/* Activity Title Bar */}
      <div className="bg-background border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-bold text-foreground">{activity.activity_name}</h1>
          {activity.is_creator && (
            <p className="text-[12px] text-muted mt-0.5">{activity.group_name}</p>
          )}
        </div>
        {activity.is_creator && (
          <button
            onClick={() => router.push(`/app/activities/create?clone=${activity.id}`)}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Clone
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex relative bg-background border-b border-border/40">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); contentRef.current?.scrollTo(0, 0) }}
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
      <div ref={contentRef} className={`flex-1 ${tab === 'chat' ? 'flex flex-col min-h-0' : 'overflow-y-auto pb-4'}`}>
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
                   isCountdownActive ? 'Getting ready to send invites...' :
                   activity.status === 'open' ? (activity.priority_invite ? 'Invites in progress...' : 'Open') :
                   activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                </div>

                <InfoRow icon="pin" label="Location" value={activity.location || "Not specified"} link={!!activity.location} onEdit={activity.is_creator ? () => openEdit('location') : undefined} />
                <InfoRow icon="calendar" label="Date & Time" value={formatDate(activity.activity_date, activity.activity_time)} trailing={<AddToCalendarButton activity={activity} />} onEdit={activity.is_creator ? () => openEdit('datetime') : undefined} />
                <InfoRow icon="dollar" label="Cost" value={formatCost(activity.cost_type, activity.cost)} onEdit={activity.is_creator ? () => openEdit('cost') : undefined} />
                <InfoRow icon="people" label="Spots" value={
                  activity.max_capacity
                    ? `${confirmed.length} / ${activity.max_capacity} ${confirmed.length >= activity.max_capacity ? 'filled' : 'open'}`
                    : `${confirmed.length} in`
                } />
                {activity.note && <InfoRow icon="note" label="Note" value={activity.note} />}
                {activity.priority_invite && (
                  <InfoRow icon="timer" label="Response Timer" value={`${activity.response_timer_minutes} min per batch`} />
                )}

                {/* Emergency Fill button */}
                {activity.status === 'open' && activity.max_capacity && confirmed.length < activity.max_capacity && (missed.length > 0 || tbd.length > 0 || out.length > 0) && (
                  <button
                    onClick={handleEmergencyFill}
                    className="w-full bg-danger/5 border border-danger/30 rounded-xl px-4 py-3 flex items-center gap-3 active:bg-danger/10 transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    <span className="text-[14px] font-semibold text-danger">Emergency Fill</span>
                  </button>
                )}

                {/* Delete button */}
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full text-center text-danger text-[14px] font-semibold py-2 active:opacity-70 transition-opacity"
                >
                  Delete Activity
                </button>
              </>
            )}

            {/* Invitee view — just the essentials */}
            {!activity.is_creator && (
              <>
                <InfoRow icon="pin" label="Location" value={activity.location || "Not specified"} link={!!activity.location} />
                <InfoRow icon="calendar" label="Date & Time" value={formatDate(activity.activity_date, activity.activity_time)} trailing={<AddToCalendarButton activity={activity} />} />
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
            {/* Countdown banner */}
            {isCountdownActive && (
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-center space-y-2">
                <div className="text-[32px] font-bold text-primary tabular-nums tracking-wider">
                  {Math.floor(countdownSeconds / 60)}:{String(countdownSeconds % 60).padStart(2, '0')}
                </div>
                <p className="text-[13px] text-foreground/70 leading-snug">
                  Invites will go out when the timer ends. Tap anyone below to <span className="font-semibold text-green-600">mark them in</span> or <span className="font-semibold text-red-500">remove them</span>.
                </p>
                <button
                  onClick={handleStartInvites}
                  className="mt-2 px-5 py-2 rounded-xl text-[13px] font-bold text-primary border border-primary/30 active:bg-primary/10 transition-colors"
                >
                  Send Invites Now
                </button>
              </div>
            )}

            <StatusSection title="In" count={confirmed.length} badge={isFull ? 'Full' : undefined} badgeColor="bg-green-100 text-green-700" members={confirmed} statusKey="confirmed" onMemberTap={activity.is_creator ? setSelectedMember : undefined} />
            {!isCountdownActive && <StatusSection title="Waiting" count={waiting.length} members={waiting} statusKey="waiting" />}

            {/* Status banner — show when invites are done */}
            {!isCountdownActive && isFull && tbd.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <path d="M22 4L12 14.01l-3-3" />
                </svg>
                <span className="text-[12px] text-foreground/70">All spots filled — no more invites will be sent</span>
              </div>
            )}
            {!isCountdownActive && !isFull && tbd.length === 0 && waiting.length === 0 && confirmed.length > 1 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <path d="M22 4L12 14.01l-3-3" />
                </svg>
                <span className="text-[12px] text-foreground/70">Everyone has been invited</span>
              </div>
            )}

            {/* On Deck — tappable during countdown */}
            {isCountdownActive ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[15px] font-bold text-foreground">On Deck ({tbd.length})</h3>
                </div>
                {tbd.length > 0 ? (
                  <div className="bg-background border border-border/50 rounded-xl overflow-hidden">
                    {tbd.map((m, i) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMember(m)}
                        className={`flex items-center gap-3 px-4 py-3 w-full text-left active:bg-primary/5 transition-colors ${i < tbd.length - 1 ? 'border-b border-border/30' : ''}`}
                      >
                        <AvatarImg src={m.user?.avatar_url} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-foreground truncate">
                            {m.user ? `${m.user.first_name} ${m.user.last_name}` : 'Unknown'}
                          </p>
                          <p className="text-[11px] font-medium text-muted">Tap to mark in or remove</p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="border-b border-border/20 pb-3" />
                )}
              </div>
            ) : (
              <StatusSection title="On Deck" count={tbd.length} members={tbd} statusKey="tbd" />
            )}

            {!isCountdownActive && <StatusSection title="Missed" count={missed.length} members={missed} statusKey="missed" />}
            <StatusSection title="Out" count={out.length} members={out} statusKey="out" />

            {activity.is_creator && (
              <div className="pt-4 space-y-3">
                <button className="btn-primary w-full py-3.5 text-[14px]">
                  Save
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full text-center text-danger text-[14px] font-semibold py-2 active:opacity-70"
                >
                  Delete Activity
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <ActivityChat activity={activity} />
        )}
      </div>

      {/* Member Action Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => !memberActioning && setSelectedMember(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-xl animate-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3">
                <AvatarImg src={selectedMember.user?.avatar_url} size="xl" />
              </div>
              <h3 className="text-[17px] font-bold text-foreground">
                {selectedMember.user ? `${selectedMember.user.first_name} ${selectedMember.user.last_name}` : 'Unknown'}
              </h3>
              <p className="text-[13px] text-muted mt-1">What would you like to do?</p>
            </div>
            <div className="space-y-2.5">
              {/* Mark as In — only for tbd members */}
              {selectedMember.status === 'tbd' && (
                <button
                  onClick={() => handleConfirmMember(selectedMember)}
                  disabled={memberActioning}
                  className="w-full py-3 rounded-xl text-[14px] font-bold bg-[#00C853] text-white active:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {memberActioning ? 'Updating...' : 'Mark as In'}
                </button>
              )}

              {/* Remove & Notify — for confirmed members when activity is/was full */}
              {selectedMember.status === 'confirmed' && isFull && (
                <button
                  onClick={() => handleRemoveMember(selectedMember, true)}
                  disabled={memberActioning}
                  className="w-full py-3 rounded-xl text-[14px] font-bold bg-primary text-white active:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {memberActioning ? 'Removing...' : 'Remove & Notify Open Spot'}
                </button>
              )}

              <button
                onClick={() => handleRemoveMember(selectedMember)}
                disabled={memberActioning}
                className="w-full py-3 rounded-xl text-[14px] font-bold bg-red-500 text-white active:opacity-80 transition-opacity disabled:opacity-50"
              >
                {memberActioning ? 'Removing...' : 'Remove'}
              </button>
              <button
                onClick={() => setSelectedMember(null)}
                disabled={memberActioning}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-muted active:bg-surface transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => setShowDeleteModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-xl animate-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <h3 className="text-[17px] font-bold text-foreground">Delete Activity?</h3>
              <p className="text-[14px] text-foreground/70 mt-2 leading-relaxed">
                This will permanently delete <span className="font-semibold">{activity.activity_name}</span> and notify all members. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-surface text-foreground border border-border/50 active:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-red-500 text-white active:opacity-80 transition-opacity disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OUT Confirmation Modal */}
      {showOutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => setShowOutModal(false)}>
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
                Someone waited for this spot in <span className="font-semibold">{activity.activity_name}</span>. Dropping out means they missed out for nothing.
              </p>
              <p className="text-[13px] text-muted mt-1.5 italic">
                Don&apos;t be that person...
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowOutModal(false)}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-[#00C853] text-white active:opacity-80 transition-opacity"
              >
                Stay In
              </button>
              <button
                onClick={() => { setShowOutModal(false); doResponse('out') }}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-surface text-muted border border-border/50 active:opacity-80 transition-opacity"
              >
                Drop Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline field edit modal */}
      {editField && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => !editSaving && setEditField(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-xl animate-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-bold text-foreground mb-4">
              {editField === 'location' && 'Edit Location'}
              {editField === 'datetime' && 'Edit Date & Time'}
              {editField === 'cost' && 'Edit Cost'}
            </h3>

            {editField === 'location' && (
              <div ref={locationWrapRef}>
                <PlacesAutocomplete
                  value={editLocation}
                  onChange={setEditLocation}
                  placeholder="Search for a location..."
                />
              </div>
            )}

            {editField === 'datetime' && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="flex-1 min-w-0 h-12 px-3 rounded-xl border border-border bg-background text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="flex-1 min-w-0 h-12 px-3 rounded-xl border border-border bg-background text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            )}

            {editField === 'cost' && (
              <div className="space-y-3">
                <select
                  value={editCostType}
                  onChange={(e) => setEditCostType(e.target.value as 'free' | 'pay_me' | 'pay_at_location')}
                  className="w-full h-12 px-3 rounded-xl border border-border bg-background text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="free">Free</option>
                  <option value="pay_me">Pay Host</option>
                  <option value="pay_at_location">Pay at Location</option>
                </select>
                {editCostType !== 'free' && (
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={editCostAmount}
                    onChange={(e) => setEditCostAmount(e.target.value)}
                    placeholder="Amount (USD)"
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background text-[15px] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                )}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditField(null)}
                disabled={editSaving}
                className="flex-1 py-2.5 rounded-xl border border-border text-[14px] font-semibold text-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 btn-primary py-2.5 text-[14px] disabled:opacity-60"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
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
  onMemberTap,
}: {
  title: string
  count: number
  badge?: string
  badgeColor?: string
  members: MemberInfo[]
  statusKey: string
  onMemberTap?: (member: MemberInfo) => void
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
          {members.map((m, i) => {
            const Row = onMemberTap ? 'button' : 'div'
            return (
              <Row
                key={m.id}
                {...(onMemberTap ? { onClick: () => onMemberTap(m) } : {})}
                className={`flex items-center gap-3 px-4 py-3 w-full text-left ${onMemberTap ? 'active:bg-primary/5 transition-colors' : ''} ${i < members.length - 1 ? 'border-b border-border/30' : ''}`}
              >
                <AvatarImg src={m.user?.avatar_url} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-foreground truncate">
                    {m.user ? `${m.user.first_name} ${m.user.last_name}` : 'Unknown'}
                  </p>
                  <p className={`text-[11px] font-medium ${config.color}`}>{config.label}</p>
                </div>
                {onMemberTap ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                ) : (
                  <StatusIcon status={statusKey} />
                )}
              </Row>
            )
          })}
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

interface ChatMessage {
  id: string
  body: string
  created_at: string
  sender_id: string
  sender: { id: string; first_name: string; last_name: string; avatar_url: string | null }
}

function ActivityChat({ activity }: { activity: ActivityDetail }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)
  const [showCatchUp, setShowCatchUp] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const catchUpRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const isConfirmed = activity.my_status === 'confirmed'

  // Load messages
  useEffect(() => {
    if (!isConfirmed) { setLoadingMessages(false); return }

    fetch(`/api/activities/${activity.id}/messages`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages)
          if (data.last_read_at) {
            setLastReadAt(data.last_read_at)
            // Check if there are unread messages
            const unread = data.messages.filter(
              (m: ChatMessage) => m.sender_id !== activity.current_user_id && new Date(m.created_at) > new Date(data.last_read_at)
            )
            if (unread.length > 0) setShowCatchUp(true)
          }
        } else if (Array.isArray(data)) {
          setMessages(data)
        }
      })
      .finally(() => setLoadingMessages(false))
  }, [activity.id, isConfirmed, activity.current_user_id])

  // Real-time broadcast
  useEffect(() => {
    if (!isConfirmed) return

    const supabase = createClient()
    const channel = supabase
      .channel(`activity-chat-${activity.id}`)
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        const msg = payload as ChatMessage
        if (msg.sender_id === activity.current_user_id) return
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [activity.id, activity.current_user_id, isConfirmed])

  // Scroll to catch-up line or bottom on initial load
  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      if (showCatchUp && catchUpRef.current) {
        catchUpRef.current.scrollIntoView({ behavior: 'auto', block: 'center' })
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      }
    }
  }, [loadingMessages, showCatchUp, messages.length])

  function scrollToCatchUp() {
    catchUpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setShowCatchUp(false)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      body: text,
      created_at: new Date().toISOString(),
      sender_id: activity.current_user_id,
      sender: { id: activity.current_user_id, first_name: 'You', last_name: '', avatar_url: null },
    }
    setMessages((prev) => [...prev, optimistic])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const res = await fetch(`/api/activities/${activity.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      if (res.ok) {
        const saved = await res.json()
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...optimistic, id: saved.id, created_at: saved.created_at } : m))
        )
        const me = activity.members.find((m) => m.user_id === activity.current_user_id)
        channelRef.current?.send({
          type: 'broadcast',
          event: 'new_message',
          payload: {
            id: saved.id,
            body: text,
            created_at: saved.created_at,
            sender_id: activity.current_user_id,
            sender: me?.user
              ? { id: me.user.id, first_name: me.user.first_name, last_name: me.user.last_name, avatar_url: me.user.avatar_url }
              : { id: activity.current_user_id, first_name: '?', last_name: '', avatar_url: null },
          },
        })
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    }
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  function formatDateSeparator(iso: string) {
    const d = new Date(iso)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Find the index where unread messages start
  const unreadStartIndex = lastReadAt
    ? messages.findIndex((m) => m.sender_id !== activity.current_user_id && new Date(m.created_at) > new Date(lastReadAt))
    : -1

  if (!isConfirmed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={1.5}>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <h3 className="text-[16px] font-bold text-foreground mb-1">Activity Chat</h3>
        <p className="text-[13px] text-muted">
          Only confirmed members can access the chat. Say you&apos;re &quot;In&quot; to join the conversation!
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Catch up floating button */}
      {showCatchUp && (
        <button
          onClick={scrollToCatchUp}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-primary text-white text-[12px] font-bold px-4 py-2 rounded-full shadow-lg active:scale-95 transition-transform flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
          Catch up
        </button>
      )}

      {/* Messages area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-3">
        {loadingMessages ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={1.5}>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-[13px] text-muted">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div>
            {messages.map((msg, i) => {
              const isMe = msg.sender_id === activity.current_user_id
              const prevMsg = i > 0 ? messages[i - 1] : null
              const sameSender = prevMsg?.sender_id === msg.sender_id && !isMe === !(prevMsg && prevMsg.sender_id === activity.current_user_id)
              const showDateSep = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()
              const isUnreadLine = i === unreadStartIndex
              const continuation = sameSender && !showDateSep && !isUnreadLine

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex justify-center my-2">
                      <span className="text-[10px] font-semibold text-muted bg-surface px-3 py-1 rounded-full">
                        {formatDateSeparator(msg.created_at)}
                      </span>
                    </div>
                  )}
                  {isUnreadLine && (
                    <div ref={catchUpRef} className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-primary/40" />
                      <span className="text-[11px] font-bold text-primary whitespace-nowrap">New messages</span>
                      <div className="flex-1 h-px bg-primary/40" />
                    </div>
                  )}
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${continuation ? 'mt-px' : 'mt-2.5'}`}>
                    {!isMe && !continuation && (
                      <div className="mr-1.5 mt-0.5 flex-shrink-0">
                        <AvatarImg size="sm" src={msg.sender?.avatar_url} />
                      </div>
                    )}
                    {!isMe && continuation && <div className="w-[30px] flex-shrink-0" />}

                    <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && !continuation && (
                        <p className="text-[10px] font-semibold text-primary mb-0.5 ml-1">
                          {msg.sender?.first_name} {msg.sender?.last_name}
                        </p>
                      )}
                      <div
                        className={`px-3 py-1 rounded-2xl text-[14px] leading-snug ${
                          isMe
                            ? `bg-primary text-white ${continuation ? 'rounded-tr-md' : 'rounded-br-md'}`
                            : `bg-background border border-border/50 text-foreground ${continuation ? 'rounded-tl-md' : 'rounded-bl-md'}`
                        }`}
                      >
                        <span>{msg.body}</span>
                        <span className={`text-[9px] ml-2 inline-block align-bottom translate-y-[1px] ${isMe ? 'text-white/60' : 'text-muted'}`}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-border/50 bg-background px-3 py-2.5 flex items-end gap-2 flex-shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          className="flex-1 resize-none bg-surface border border-border/50 rounded-2xl px-4 py-2.5 text-[14px]
                     placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     max-h-32 overflow-y-auto"
          style={{ minHeight: '40px' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0
                     disabled:opacity-40 active:scale-95 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  )
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

function InfoRow({ icon, label, value, link, trailing, onEdit }: { icon: string; label: string; value: string; link?: boolean; trailing?: React.ReactNode; onEdit?: () => void }) {
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
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="flex-shrink-0 p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label={`Edit ${label}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
      )}
      {trailing}
    </div>
  )
}
