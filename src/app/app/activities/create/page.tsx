'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app/header'

interface Preset {
  id: string
  name: string
  icon: string
  category: string
}

interface GroupOption {
  id: string
  name: string
  member_count: number
}

type CostType = 'free' | 'pay_me' | 'pay_at_location'
type Tab = 'details' | 'group'

const RESPONSE_TIMER_OPTIONS = [
  { value: 5, label: '5 min', pro: false },
  { value: 15, label: '15 min', pro: true },
  { value: 30, label: '30 min', pro: true },
  { value: 60, label: '1 hour', pro: true },
  { value: 120, label: '2 hours', pro: true },
]

export default function CreateActivityPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('details')
  const [submitting, setSubmitting] = useState(false)
  const [isPro, setIsPro] = useState(false)

  // Activity Details
  const [presets, setPresets] = useState<Preset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [activityName, setActivityName] = useState('')
  const [activityDate, setActivityDate] = useState('')
  const [activityTime, setActivityTime] = useState('')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [costType, setCostType] = useState<CostType>('free')
  const [costAmount, setCostAmount] = useState('')

  // Group Details
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [maxCapacity, setMaxCapacity] = useState<number | 'custom' | 'all'>(2)
  const [customCapacity, setCustomCapacity] = useState('')
  const [priorityInvite, setPriorityInvite] = useState(true)
  const [responseTimer, setResponseTimer] = useState(5)
  const [chatEnabled, setChatEnabled] = useState(false)
  const [showTimerDropdown, setShowTimerDropdown] = useState(false)

  // Load presets and groups
  useEffect(() => {
    fetch('/api/activities/presets')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPresets(data) })

    fetch('/api/groups')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setGroups(data.filter((g: GroupOption & { is_owner: boolean }) => g.is_owner))
        }
      })

    fetch('/api/user/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.membership_tier === 'pro') setIsPro(true)
      })
  }, [])

  // Set default date/time
  useEffect(() => {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    setActivityDate(dateStr)
    setActivityTime(`${hours}:${minutes}`)
  }, [])

  function handlePresetChange(presetId: string) {
    setSelectedPreset(presetId)
    const preset = presets.find((p) => p.id === presetId)
    if (preset) {
      setActivityName(preset.name)
    }
  }

  function getEffectiveMaxCapacity(): number | null {
    if (maxCapacity === 'all') return null
    if (maxCapacity === 'custom') return parseInt(customCapacity) || null
    return maxCapacity
  }

  async function handleSubmit() {
    if (!activityName.trim()) return alert('Activity name is required')
    if (!selectedGroup) return alert('Please select a group')

    setSubmitting(true)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: selectedGroup,
          activity_type: selectedPreset || 'other',
          activity_name: activityName.trim(),
          activity_date: activityDate || null,
          activity_time: activityTime || null,
          location: location.trim() || null,
          note: note.trim() || null,
          cost_type: costType,
          cost: costType !== 'free' ? parseFloat(costAmount) || null : null,
          max_capacity: getEffectiveMaxCapacity(),
          response_timer_minutes: responseTimer,
          priority_invite: priorityInvite,
          chat_enabled: chatEnabled,
          reminder_enabled: reminderEnabled,
        }),
      })

      const data = await res.json()
      if (res.ok && data.id) {
        router.push('/app')
      } else {
        alert(data.error || 'Failed to create activity')
      }
    } catch {
      alert('Failed to create activity')
    }
    setSubmitting(false)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Activity Details' },
    { key: 'group', label: 'Group' },
  ]

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <AppHeader showBack />

      {/* Title */}
      <div className="bg-background border-b border-border/40 px-4 py-3 text-center">
        <h1 className="text-[17px] font-bold text-foreground">Create Activity</h1>
        <p className="text-[12px] text-muted mt-0.5">Create an activity and choose the group you want to invite!</p>
      </div>

      {/* Tabs */}
      <div className="flex relative bg-background border-b border-border/40">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-[13px] font-semibold text-center transition-colors relative z-10 ${
              tab === t.key ? 'text-primary' : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div
          className="absolute bottom-0 h-[2.5px] bg-primary rounded-full transition-all duration-300 ease-out z-0"
          style={{
            width: '50%',
            left: tab === 'details' ? '0%' : '50%',
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-28">
        {tab === 'details' && (
          <div className="px-4 pt-4 space-y-5 animate-enter">
            <SectionHeader>Activity Details</SectionHeader>

            {/* Activity Preset Dropdown */}
            <FieldCard>
              <FieldLabel>Activity</FieldLabel>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="input-field"
              >
                <option value="">Select an activity...</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
              </select>
            </FieldCard>

            {/* Activity Name */}
            <FieldCard>
              <FieldLabel>Activity Name</FieldLabel>
              <input
                type="text"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="Event Name"
                className="input-field"
              />
            </FieldCard>

            {/* Date & Time */}
            <FieldCard>
              <div className="flex items-center gap-2 mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M3 10h18M8 2v4M16 2v4" />
                </svg>
                <span className="text-[14px] font-semibold text-foreground">Date & Time</span>
              </div>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="input-field flex-1"
                />
                <input
                  type="time"
                  value={activityTime}
                  onChange={(e) => setActivityTime(e.target.value)}
                  className="input-field flex-1"
                />
              </div>
            </FieldCard>

            {/* Location */}
            <FieldCard>
              <FieldLabel>Location</FieldLabel>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="123 Park Lane"
                className="input-field"
              />
            </FieldCard>

            {/* Note */}
            <FieldCard>
              <FieldLabel>Note</FieldLabel>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Type a note here..."
                rows={3}
                className="input-field resize-none"
              />
            </FieldCard>

            {/* Reminder Toggle (Pro) */}
            <FieldCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-foreground">Reminders</span>
                  <ProBadge />
                </div>
                <Toggle
                  checked={reminderEnabled}
                  onChange={(v) => {
                    if (!isPro) return
                    setReminderEnabled(v)
                  }}
                  disabled={!isPro}
                />
              </div>
              <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
                {isPro
                  ? 'Send reminders 24 hours, 1 hour, and 10 minutes before the event.'
                  : 'Upgrade to Pro to send automatic reminders before the event.'}
              </p>
            </FieldCard>

            {/* Activity Cost */}
            <SectionHeader>Activity Cost</SectionHeader>

            <FieldCard>
              <FieldLabel>Cost</FieldLabel>
              <div className="flex items-center gap-2 mb-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
                <select
                  value={costType}
                  onChange={(e) => setCostType(e.target.value as CostType)}
                  className="input-field flex-1"
                >
                  <option value="free">Free</option>
                  <option value="pay_me">Pay Me</option>
                  <option value="pay_at_location">Pay at Location</option>
                </select>
              </div>
              {costType !== 'free' && (
                <div className="animate-enter">
                  <FieldLabel>Price</FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-[14px]">$</span>
                    <input
                      type="number"
                      value={costAmount}
                      onChange={(e) => setCostAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="input-field pl-7"
                    />
                  </div>
                </div>
              )}
            </FieldCard>
          </div>
        )}

        {tab === 'group' && (
          <div className="px-4 pt-4 space-y-5 animate-enter">
            <SectionHeader>Group Details</SectionHeader>

            {/* Group Selection */}
            <FieldCard>
              <FieldLabel>Group</FieldLabel>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M2 21v-1a5 5 0 0110 0v1M14 21v-1a4 4 0 018 0v1" />
                </svg>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="input-field flex-1"
                >
                  <option value="">Select Group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.member_count} {g.member_count === 1 ? 'person' : 'people'})
                    </option>
                  ))}
                </select>
              </div>
            </FieldCard>

            {/* Max Group Size */}
            <FieldCard>
              <FieldLabel>Max Group Size</FieldLabel>
              <div className="flex flex-wrap gap-2 mt-1">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxCapacity(n)}
                    className={`w-12 h-10 rounded-full text-[14px] font-bold transition-colors ${
                      maxCapacity === n
                        ? 'bg-primary text-white'
                        : 'bg-surface text-muted border border-border/50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => {
                    if (!isPro) return
                    setMaxCapacity('custom')
                  }}
                  className={`px-4 h-10 rounded-full text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${
                    maxCapacity === 'custom'
                      ? 'bg-primary text-white'
                      : isPro
                        ? 'bg-surface text-muted border border-border/50'
                        : 'bg-surface text-muted/50 border border-border/30'
                  }`}
                >
                  Custom
                  {!isPro && <ProBadge small />}
                </button>
                <button
                  onClick={() => setMaxCapacity('all')}
                  className={`px-4 h-10 rounded-full text-[13px] font-semibold transition-colors ${
                    maxCapacity === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-surface text-muted border border-border/50'
                  }`}
                >
                  All
                </button>
              </div>
              {maxCapacity === 'custom' && (
                <input
                  type="number"
                  value={customCapacity}
                  onChange={(e) => setCustomCapacity(e.target.value)}
                  placeholder="Enter number..."
                  min="2"
                  className="input-field mt-3 animate-enter"
                />
              )}
            </FieldCard>

            {/* Priority Order Toggle */}
            <FieldCard>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-foreground">Priority Order</span>
                <Toggle checked={priorityInvite} onChange={setPriorityInvite} />
              </div>
              <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
                {priorityInvite
                  ? 'Invites sent in priority order. If someone passes, the next person gets invited.'
                  : 'All members are invited at once.'}
              </p>
            </FieldCard>

            {/* Response Timer */}
            <FieldCard>
              <FieldLabel>Response Time Per Invite</FieldLabel>
              <div className="relative">
                <button
                  onClick={() => setShowTimerDropdown(!showTimerDropdown)}
                  className="input-field w-full text-left flex items-center justify-between"
                >
                  <span>
                    {RESPONSE_TIMER_OPTIONS.find((o) => o.value === responseTimer)?.label ?? '5 min'} response timer
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {showTimerDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border/50 rounded-xl shadow-lg z-20 overflow-hidden animate-enter">
                    {RESPONSE_TIMER_OPTIONS.map((opt) => {
                      const locked = opt.pro && !isPro
                      return (
                        <button
                          key={opt.value}
                          onClick={() => {
                            if (locked) return
                            setResponseTimer(opt.value)
                            setShowTimerDropdown(false)
                          }}
                          className={`w-full px-4 py-3 text-left text-[14px] flex items-center justify-between border-b border-border/20 last:border-0 transition-colors ${
                            locked
                              ? 'text-muted/50 bg-surface/30'
                              : responseTimer === opt.value
                                ? 'bg-primary/5 text-primary font-semibold'
                                : 'text-foreground active:bg-surface'
                          }`}
                        >
                          <span>{opt.label}</span>
                          <div className="flex items-center gap-2">
                            {opt.pro && <ProBadge small />}
                            {responseTimer === opt.value && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </FieldCard>

            {/* Allow Chat (Pro) */}
            <FieldCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-foreground">Allow Chat</span>
                  <ProBadge />
                </div>
                <Toggle
                  checked={chatEnabled}
                  onChange={(v) => {
                    if (!isPro) return
                    setChatEnabled(v)
                  }}
                  disabled={!isPro}
                />
              </div>
              <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
                {isPro
                  ? 'Enable group chat for this activity.'
                  : 'Upgrade to Pro to enable activity chat.'}
              </p>
            </FieldCard>
          </div>
        )}
      </div>

      {/* Bottom Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-40">
        {tab === 'details' ? (
          <button
            onClick={() => setTab('group')}
            className="btn-primary w-full py-3.5 text-[14px]"
          >
            Next: Group Details
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || !activityName.trim() || !selectedGroup}
            className="btn-primary w-full py-3.5 text-[14px] disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create Activity'}
          </button>
        )}
      </div>
    </div>
  )
}

/* -- Reusable components -- */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[16px] font-bold text-foreground">{children}</h2>
}

function FieldCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background border border-border/50 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">{children}</label>
}

function ProBadge({ small }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center font-bold tracking-wide uppercase bg-primary/10 text-primary rounded-full ${
      small ? 'text-[8px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
    }`}>
      PRO
    </span>
  )
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-[46px] h-[28px] rounded-full transition-colors duration-200 flex-shrink-0 ${
        disabled ? 'opacity-40' : ''
      } ${checked ? 'bg-primary' : 'bg-[#d5d9e2]'}`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : ''
        }`}
      />
    </button>
  )
}
