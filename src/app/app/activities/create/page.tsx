'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { PlacesAutocomplete } from '@/components/ui/places-autocomplete'
import { usePaywall } from '@/hooks/use-pro-status'
import ProBadge from '@/components/ui/pro-badge'

interface Preset {
  id: string
  name: string
  icon: string
  category: string
  image_url?: string
}

interface GroupOption {
  id: string
  name: string
  member_count: number
}

type CostType = 'free' | 'pay_me' | 'pay_at_location'
type Tab = 'details' | 'group'
type Mode = 'select' | 'fill' | 'build'

interface TimerOption {
  id: string
  value: number
  label: string
  pro_fill: boolean
  pro_group: boolean
  test_only: boolean
  modes: ('fill' | 'group')[]
}

const FALLBACK_TIMERS: TimerOption[] = [
  { id: 'free-5m', value: 5, label: '5 min', pro_fill: false, pro_group: false, test_only: false, modes: ['fill', 'group'] },
]

export default function CreateActivityPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cloneId = searchParams.get('clone')
  const [mode, setMode] = useState<Mode>(cloneId ? 'build' : 'select')
  const [tab, setTab] = useState<Tab>('details')
  const [submitting, setSubmitting] = useState(false)
  const { isPro, requirePro } = usePaywall()
  const [isTestUser, setIsTestUser] = useState(false)
  const [allTimers, setAllTimers] = useState<TimerOption[]>(FALLBACK_TIMERS)
  const [defaultTimerFill, setDefaultTimerFill] = useState(5)
  const [defaultTimerGroup, setDefaultTimerGroup] = useState(5)

  // Activity Details
  const [presets, setPresets] = useState<Preset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [presetSearch, setPresetSearch] = useState('')
  const [showPresetPicker, setShowPresetPicker] = useState(false)
  const [activityName, setActivityName] = useState('')
  const [activityDate, setActivityDate] = useState('')
  const [activityTime, setActivityTime] = useState('')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [costType, setCostType] = useState<CostType>('free')
  const [costAmount, setCostAmount] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const [showImageGen, setShowImageGen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Group Details
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [maxCapacity, setMaxCapacity] = useState<number | 'custom'>(2)
  const [customMode, setCustomMode] = useState<'number' | 'all' | 'any'>('number')
  const [customCapacity, setCustomCapacity] = useState('')
  const [priorityInvite, setPriorityInvite] = useState(true)
  const [responseTimer, setResponseTimer] = useState(5)
  const [chatEnabled, setChatEnabled] = useState(false)
  const [autoEmergencyFill, setAutoEmergencyFill] = useState(false)
  const [showTimerDropdown, setShowTimerDropdown] = useState(false)
  const [showNoGroupsModal, setShowNoGroupsModal] = useState(false)

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
        if (data.phone?.replace(/\D/g, '').includes('999')) setIsTestUser(true)
      })

    fetch('/api/activities/timers')
      .then((r) => r.json())
      .then((data) => {
        if (data.timers && Array.isArray(data.timers) && data.timers.length > 0) {
          setAllTimers(data.timers)
        }
        if (data.default_fill) { setDefaultTimerFill(data.default_fill); setResponseTimer(data.default_fill) }
        if (data.default_group) { setDefaultTimerGroup(data.default_group) }
      })
  }, [])

  // Set default date/time
  useEffect(() => {
    if (cloneId) return // cloned activity will set its own date
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const hours = String(now.getHours()).padStart(2, '0')
    const roundedMin = Math.ceil(now.getMinutes() / 15) * 15
    const minutes = roundedMin === 60 ? '00' : String(roundedMin).padStart(2, '0')
    const adjustedHours = roundedMin === 60 ? String((now.getHours() + 1) % 24).padStart(2, '0') : hours
    setActivityDate(dateStr)
    setActivityTime(`${adjustedHours}:${minutes}`)
  }, [cloneId])

  // Load cloned activity data
  useEffect(() => {
    if (!cloneId) return
    fetch(`/api/activities/${cloneId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.id) return
        setSelectedPreset(data.activity_type ?? '')
        setActivityName(data.activity_name ?? '')
        setLocation(data.location ?? '')
        setNote(data.note ?? '')
        setCostType(data.cost_type ?? 'free')
        setCostAmount(data.cost ? String(data.cost) : '')
        setReminderEnabled(data.reminder_enabled ?? false)
        setChatEnabled(data.chat_enabled ?? false)
        setAutoEmergencyFill(data.auto_emergency_fill ?? false)
        setPriorityInvite(data.priority_invite ?? true)
        setResponseTimer(data.response_timer_minutes ?? 5)
        if (data.image_url) setImageUrl(data.image_url)
        if (data.max_capacity === 999) {
          setMaxCapacity('custom')
          setCustomMode('any')
        } else if (data.max_capacity && [2, 3, 4].includes(data.max_capacity)) {
          setMaxCapacity(data.max_capacity)
        } else if (data.max_capacity) {
          setMaxCapacity('custom')
          setCustomMode('number')
          setCustomCapacity(String(data.max_capacity))
        } else {
          setMaxCapacity('custom')
          setCustomMode('all')
        }
        if (data.group_id) setSelectedGroup(data.group_id)
        // Set date to today, keep same time
        const now = new Date()
        setActivityDate(now.toISOString().split('T')[0])
        setActivityTime(data.activity_time ?? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
      })
  }, [cloneId])

  function handlePresetChange(presetId: string) {
    setSelectedPreset(presetId)
    const preset = presets.find((p) => p.id === presetId)
    if (preset) {
      setActivityName(preset.name)
      if (preset.image_url) {
        setImageUrl(preset.image_url)
      }
    }
  }

  async function handleImageUpload(file: File) {
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/activities/upload-image', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data.url) {
        setImageUrl(data.url)
      } else {
        alert(data.error || 'Upload failed')
      }
    } catch {
      alert('Upload failed')
    }
    setUploadingImage(false)
  }

  async function handleGenerateImage() {
    const prompt = imagePrompt.trim() || `A vibrant, inviting image for a group activity: ${activityName || 'fun event'}`
    setGeneratingImage(true)
    try {
      const res = await fetch('/api/activities/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        setImageUrl(data.url)
        setShowImageGen(false)
        setImagePrompt('')
      } else {
        alert(data.error || 'Generation failed')
      }
    } catch {
      alert('Generation failed')
    }
    setGeneratingImage(false)
  }

  const isAllMode = maxCapacity === 'custom' && customMode === 'all'

  function getEffectiveMaxCapacity(): number | null {
    if (maxCapacity === 'custom') {
      if (customMode === 'all') return null
      if (customMode === 'any') return 999
      return parseInt(customCapacity) || null
    }
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
          auto_emergency_fill: autoEmergencyFill,
          image_url: imageUrl || null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })

      const data = await res.json()
      if (res.ok && data.id) {
        router.push(`/app/activities/${data.id}`)
      } else {
        alert(data.error || 'Failed to create activity')
      }
    } catch {
      alert('Failed to create activity')
    }
    setSubmitting(false)
  }

  // Fill a Spot specific state
  const [fillSpots, setFillSpots] = useState<number>(1)

  async function handleFillSubmit() {
    if (!activityName.trim()) return alert('Select an activity type')
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
          location: null,
          note: null,
          cost_type: 'free',
          cost: null,
          max_capacity: fillSpots,
          response_timer_minutes: responseTimer,
          priority_invite: priorityInvite,
          chat_enabled: chatEnabled,
          reminder_enabled: false,
          auto_emergency_fill: true,
          image_url: imageUrl || null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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

  // ── MODE SELECTOR ──
  if (mode === 'select') {
    return (
      <div className="h-full flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="bg-background border-b border-border/40 px-4 py-3 text-center">
          <h1 className="text-[17px] font-bold text-foreground">Create Activity</h1>
          <p className="text-[12px] text-muted mt-0.5">What do you need?</p>
        </div>
        <div className="flex-1 px-4 pt-6 space-y-4 animate-enter">
          {/* Fill a Spot card */}
          <button
            onClick={() => { if (groups.length === 0) { setShowNoGroupsModal(true); return } setMode('fill'); setResponseTimer(defaultTimerFill) }}
            className="w-full bg-background border-2 border-[#34c759]/30 rounded-2xl p-5 text-left active:scale-[0.98] transition-all hover:shadow-[0_4px_20px_rgba(52,199,89,0.12)] hover:border-[#34c759]/50"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#34c759]/10 flex items-center justify-center flex-shrink-0">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[17px] font-bold text-foreground mb-0.5">Fill a Spot</h3>
                <p className="text-[13px] text-muted leading-snug">Someone dropped out? Auto-invite the next person on your list.</p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>

          {/* Build Group Activity card */}
          <button
            onClick={() => { if (groups.length === 0) { setShowNoGroupsModal(true); return } setMode('build'); setResponseTimer(defaultTimerGroup) }}
            className="w-full bg-background border-2 border-primary/20 rounded-2xl p-5 text-left active:scale-[0.98] transition-all hover:shadow-[0_4px_20px_rgba(66,133,244,0.12)] hover:border-primary/40"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M2 21v-1a5 5 0 0110 0v1M14 21v-1a4 4 0 018 0v1" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[17px] font-bold text-foreground mb-0.5">Build Group Activity</h3>
                <p className="text-[13px] text-muted leading-snug">Plan a full activity with all the details — date, location, cost, and more.</p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        </div>

        {/* No groups modal */}
        {showNoGroupsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setShowNoGroupsModal(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-primary to-[#3367D6] px-6 py-5 text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/20 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="7" r="3" />
                    <circle cx="17" cy="9" r="2.5" />
                    <path d="M2 21v-1a5 5 0 0110 0v1M14 21v-1a4 4 0 018 0v1" />
                  </svg>
                </div>
                <h3 className="text-white text-lg font-bold">You need a crew first!</h3>
                <p className="text-white/70 text-sm mt-1">Create a group and add your people, then come back to plan something.</p>
              </div>
              <div className="bg-white p-5 space-y-3">
                <button
                  onClick={() => router.push('/app/groups/create')}
                  className="w-full py-3 rounded-xl bg-[#4285F4] text-white font-semibold text-[14px] active:opacity-80 transition-opacity"
                >
                  Create a Group
                </button>
                <button
                  onClick={() => setShowNoGroupsModal(false)}
                  className="w-full py-3 rounded-xl text-[14px] font-semibold border border-[#e5e7eb] text-[#6b7280] active:bg-[#f3f4f6] transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── FILL A SPOT MODE ──
  if (mode === 'fill') {
    const selectedPresetObj = presets.find((p) => p.id === selectedPreset)
    return (
      <div className="h-full flex flex-col bg-surface">
        <AppHeader showBack onBack={() => setMode('select')} />

        <div className="bg-background border-b border-border/40 px-4 py-3 text-center">
          <h1 className="text-[17px] font-bold text-foreground flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Fill a Spot
          </h1>
          <p className="text-[12px] text-muted mt-0.5">Quick fill — pick your activity, group, and go!</p>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          <div className="px-4 pt-4 space-y-5 animate-enter">
            {/* Activity Type */}
            <FieldCard>
              <FieldLabel>What activity?</FieldLabel>
              <button
                type="button"
                onClick={() => { setShowPresetPicker(true); setPresetSearch('') }}
                className="input-field w-full text-left flex items-center justify-between"
              >
                <span className={selectedPreset ? 'text-foreground' : 'text-muted'}>
                  {selectedPresetObj
                    ? `${selectedPresetObj.icon} ${selectedPresetObj.name}`
                    : 'Select an activity...'}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </FieldCard>

            {/* Preset Picker Modal (shared) */}
            {showPresetPicker && (
              <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16" onClick={() => setShowPresetPicker(false)}>
                <div className="absolute inset-0 bg-black/40" />
                <div
                  className="relative w-full max-w-md max-h-[75dvh] bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-enter"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 pt-4 pb-3 border-b border-border/40">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[16px] font-bold text-foreground">Choose Activity</h3>
                      <button onClick={() => setShowPresetPicker(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-surface">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                      </svg>
                      <input type="text" value={presetSearch} onChange={(e) => setPresetSearch(e.target.value)} placeholder="Search activities..." autoFocus
                        className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-[14px] text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 py-2">
                    {(() => {
                      const q = presetSearch.toLowerCase().trim()
                      const filtered = presets.filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
                      if (filtered.length === 0) return <p className="text-center text-muted text-[13px] py-8">No activities match &ldquo;{presetSearch}&rdquo;</p>
                      const grouped: Record<string, Preset[]> = {}
                      for (const p of filtered) { if (!grouped[p.category]) grouped[p.category] = []; grouped[p.category].push(p) }
                      return Object.entries(grouped).map(([cat, items]) => (
                        <div key={cat} className="mb-2">
                          <p className="text-[10px] font-bold text-muted uppercase tracking-wider px-3 py-1.5">{cat}</p>
                          {items.map((p) => (
                            <button key={p.id} onClick={() => { handlePresetChange(p.id); setShowPresetPicker(false) }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selectedPreset === p.id ? 'bg-primary/10 text-primary' : 'text-foreground active:bg-surface hover:bg-surface/60'}`}>
                              <span className="text-xl w-8 text-center flex-shrink-0">{p.icon}</span>
                              <span className="text-[14px] font-medium">{p.name}</span>
                              {selectedPreset === p.id && (
                                <svg className="ml-auto flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                              )}
                            </button>
                          ))}
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Activity Image */}
            <FieldCard>
              <FieldLabel>Activity Image</FieldLabel>
              {imageUrl && (
                <div className="relative rounded-xl overflow-hidden mt-1 mb-2">
                  <img src={imageUrl} alt="Activity" className="w-full aspect-video object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => { setImageUrl(''); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center text-[14px]"
                  >
                    &times;
                  </button>
                </div>
              )}
              {showImageGen ? (
                <div className="space-y-3 mt-1 animate-enter">
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder={`Describe the image, e.g. "Friends playing ${activityName || 'sports'} at sunset"`}
                    rows={2}
                    className="input-field resize-none text-[13px]"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={handleGenerateImage} disabled={generatingImage}
                      className="btn-primary flex-1 py-2.5 text-[13px] disabled:opacity-60">
                      {generatingImage ? 'Generating...' : 'Generate'}
                    </button>
                    <button type="button" onClick={() => { setShowImageGen(false); setImagePrompt('') }}
                      className="px-4 py-2.5 rounded-xl border border-border/50 text-[13px] text-muted font-medium">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
                    className="flex-1 py-2.5 rounded-xl border border-border/50 text-[13px] font-semibold text-muted flex items-center justify-center gap-1.5 active:bg-surface">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                    </svg>
                    {uploadingImage ? 'Uploading...' : 'Upload'}
                  </button>
                  <button type="button" onClick={() => { if (!requirePro()) return; setShowImageGen(true) }}
                    className={`flex-1 py-2.5 rounded-xl border text-[13px] font-semibold flex items-center justify-center gap-1.5 ${
                      isPro ? 'border-primary/40 text-primary active:bg-primary/5' : 'border-border/40 text-muted/50'
                    }`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Generate
                    {!isPro && <ProBadge small />}
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file) }} />
            </FieldCard>

            {/* Group */}
            <FieldCard>
              <FieldLabel>Which group?</FieldLabel>
              <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} className="input-field w-full">
                <option value="">Select Group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.member_count} {g.member_count === 1 ? 'person' : 'people'})</option>
                ))}
              </select>
            </FieldCard>

            {/* How many spots */}
            <FieldCard>
              <FieldLabel>How many spots to fill?</FieldLabel>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setFillSpots(n)}
                    className={`w-12 h-10 rounded-full text-[14px] font-bold transition-colors ${
                      fillSpots === n
                        ? 'bg-[#34c759] text-white'
                        : 'bg-surface text-muted border border-border/50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const custom = prompt('How many spots?')
                    if (custom && parseInt(custom) > 0) setFillSpots(parseInt(custom))
                  }}
                  className={`px-4 h-10 rounded-full text-[13px] font-semibold transition-colors bg-surface text-muted border border-border/50`}
                >
                  More
                </button>
              </div>
            </FieldCard>

            {/* Invite Style: Priority vs All */}
            <FieldCard>
              <FieldLabel>Invite style</FieldLabel>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setPriorityInvite(true)}
                  className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                    priorityInvite
                      ? 'bg-[#34c759] text-white'
                      : 'bg-surface text-muted border border-border/50'
                  }`}
                >
                  Priority Order
                </button>
                <button
                  onClick={() => setPriorityInvite(false)}
                  className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                    !priorityInvite
                      ? 'bg-[#34c759] text-white'
                      : 'bg-surface text-muted border border-border/50'
                  }`}
                >
                  Invite All
                </button>
              </div>
              <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
                {priorityInvite
                  ? 'Invites one at a time, top to bottom. If they pass or time runs out, the next person gets invited.'
                  : 'Texts everyone at once — first to reply gets the spot.'}
              </p>
            </FieldCard>

            {/* Response Timer — only for priority */}
            {priorityInvite && (
              <FieldCard>
                <FieldLabel>Response timer</FieldLabel>
                <div className="relative mt-1">
                  <button
                    onClick={() => setShowTimerDropdown(!showTimerDropdown)}
                    className="w-full flex items-center justify-between input-field"
                  >
                    <span className="text-[14px]">
                      {allTimers.find((o) => o.value === responseTimer)?.label ?? '5 min'}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showTimerDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border/50 rounded-xl shadow-lg z-20 overflow-hidden animate-enter">
                      {allTimers
                        .filter((o) => o.modes.includes('fill'))
                        .filter((o) => !o.test_only || isTestUser)
                        .map((o) => {
                          const locked = o.pro_fill && !isPro
                          return (
                            <button
                              key={o.value}
                              onClick={() => { if (locked) { requirePro(); return } setResponseTimer(o.value); setShowTimerDropdown(false) }}
                              className={`w-full px-4 py-3 text-left text-[14px] flex items-center justify-between border-b border-border/20 last:border-0 transition-colors ${
                                locked
                                  ? 'text-muted/50 bg-surface/30'
                                  : responseTimer === o.value
                                    ? 'bg-primary/5 text-primary font-semibold'
                                    : 'text-foreground active:bg-surface'
                              }`}
                            >
                              <span>{o.label}</span>
                              <div className="flex items-center gap-2">
                                {o.pro_fill && <ProBadge small />}
                                {o.test_only && <span className="text-[9px] px-1.5 py-0.5 bg-danger/10 text-danger rounded-full font-bold">TEST</span>}
                                {responseTimer === o.value && (
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
                <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
                  How long each person has to respond before moving to the next.
                </p>
              </FieldCard>
            )}

            {/* When */}
            <FieldCard>
              <FieldLabel>When?</FieldLabel>
              <div className="flex gap-3">
                <input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} className="input-field flex-1" />
                <div className="flex gap-1.5 flex-1">
                  <select
                    value={activityTime.split(':')[0] || ''}
                    onChange={(e) => {
                      const mins = activityTime.split(':')[1] || '00'
                      setActivityTime(`${e.target.value}:${mins}`)
                    }}
                    className="input-field flex-1 text-center"
                  >
                    <option value="" disabled>Hr</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const h12 = i === 0 ? 12 : i
                      const ampm = 'AM'
                      return (
                        <option key={`am-${i}`} value={String(i).padStart(2, '0')}>
                          {h12} {ampm}
                        </option>
                      )
                    })}
                    {Array.from({ length: 12 }, (_, i) => {
                      const h24 = i + 12
                      const h12 = i === 0 ? 12 : i
                      const ampm = 'PM'
                      return (
                        <option key={`pm-${h24}`} value={String(h24).padStart(2, '0')}>
                          {h12} {ampm}
                        </option>
                      )
                    })}
                  </select>
                  <select
                    value={activityTime.split(':')[1] || '00'}
                    onChange={(e) => {
                      const hrs = activityTime.split(':')[0] || '12'
                      setActivityTime(`${hrs}:${e.target.value}`)
                    }}
                    className="input-field flex-1 text-center"
                  >
                    {['00', '15', '30', '45'].map((m) => (
                      <option key={m} value={m}>:{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FieldCard>

            {/* Chat Toggle */}
            <FieldCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-foreground">Allow Chat</span>
                  <ProBadge />
                </div>
                <Toggle
                  checked={chatEnabled}
                  onChange={(v) => { if (v && !requirePro()) return; setChatEnabled(v) }}
                />
              </div>
              <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
                {isPro ? 'Let subs coordinate in a group chat.' : 'Upgrade to Pro for activity chat.'}
              </p>
            </FieldCard>

            {/* Auto-fill note */}
            <div className="flex items-center gap-2 px-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="text-[12px] text-[#15803d] font-medium">Auto-fill enabled — if someone drops, the next sub is auto-invited</span>
            </div>
          </div>
        </div>

        {/* GO Button */}
        <div className="flex-shrink-0 bg-background/95 backdrop-blur-md border-t border-border/60 p-4">
          <button
            onClick={handleFillSubmit}
            disabled={submitting || !activityName.trim() || !selectedGroup}
            className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-white bg-[#34c759] hover:bg-[#2db84e] active:scale-[0.97] transition-all shadow-[0_4px_20px_rgba(52,199,89,0.35)] disabled:opacity-60"
          >
            {submitting ? 'Sending Invites...' : `GO — Fill ${fillSpots} ${fillSpots === 1 ? 'Spot' : 'Spots'}`}
          </button>
        </div>
      </div>
    )
  }

  // ── BUILD GROUP ACTIVITY MODE (existing full flow) ──

  return (
    <div className="h-full flex flex-col bg-surface">
      <AppHeader showBack onBack={() => setMode('select')} />

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
            onClick={() => { setTab(t.key); contentRef.current?.scrollTo(0, 0) }}
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
      <div ref={contentRef} className="flex-1 overflow-y-auto pb-4">
        {tab === 'details' && (
          <div className="px-4 pt-4 space-y-5 animate-enter">
            <SectionHeader>Activity Details</SectionHeader>

            {/* Activity Preset Picker */}
            <FieldCard>
              <FieldLabel>Activity</FieldLabel>
              <button
                type="button"
                onClick={() => { setShowPresetPicker(true); setPresetSearch('') }}
                className="input-field w-full text-left flex items-center justify-between"
              >
                <span className={selectedPreset ? 'text-foreground' : 'text-muted'}>
                  {selectedPreset
                    ? `${presets.find((p) => p.id === selectedPreset)?.icon ?? ''} ${presets.find((p) => p.id === selectedPreset)?.name ?? selectedPreset}`
                    : 'Select an activity...'}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </FieldCard>

            {/* Preset Picker Modal */}
            {showPresetPicker && (
              <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16" onClick={() => setShowPresetPicker(false)}>
                <div className="absolute inset-0 bg-black/40" />
                <div
                  className="relative w-full max-w-md max-h-[75dvh] bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-enter"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Search header */}
                  <div className="px-4 pt-4 pb-3 border-b border-border/40">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[16px] font-bold text-foreground">Choose Activity</h3>
                      <button
                        onClick={() => setShowPresetPicker(false)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-surface"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                      </svg>
                      <input
                        type="text"
                        value={presetSearch}
                        onChange={(e) => setPresetSearch(e.target.value)}
                        placeholder="Search activities..."
                        autoFocus
                        className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-[14px] text-foreground
                                   placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Scrollable list */}
                  <div className="flex-1 overflow-y-auto px-2 py-2">
                    {(() => {
                      const q = presetSearch.toLowerCase().trim()
                      const filtered = presets.filter((p) =>
                        !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
                      )
                      if (filtered.length === 0) {
                        return (
                          <p className="text-center text-muted text-[13px] py-8">
                            No activities match &ldquo;{presetSearch}&rdquo;
                          </p>
                        )
                      }
                      // Group by category
                      const grouped: Record<string, Preset[]> = {}
                      for (const p of filtered) {
                        if (!grouped[p.category]) grouped[p.category] = []
                        grouped[p.category].push(p)
                      }
                      return Object.entries(grouped).map(([cat, items]) => (
                        <div key={cat} className="mb-2">
                          <p className="text-[10px] font-bold text-muted uppercase tracking-wider px-3 py-1.5">{cat}</p>
                          {items.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                handlePresetChange(p.id)
                                setShowPresetPicker(false)
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                                selectedPreset === p.id
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-foreground active:bg-surface hover:bg-surface/60'
                              }`}
                            >
                              <span className="text-xl w-8 text-center flex-shrink-0">{p.icon}</span>
                              <span className="text-[14px] font-medium">{p.name}</span>
                              {selectedPreset === p.id && (
                                <svg className="ml-auto flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </div>
            )}

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
              <PlacesAutocomplete
                value={location}
                onChange={setLocation}
                placeholder="Search for a location..."
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

            {/* Activity Image */}
            <FieldCard>
              <FieldLabel>Activity Image</FieldLabel>
              <p className="text-[11px] text-muted mb-3">Add a photo to include in the invite text message.</p>
              {imageUrl && (
                <div className="relative rounded-xl overflow-hidden mb-2">
                  <img src={imageUrl} alt="Activity" className="w-full aspect-video object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => { setImageUrl(''); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center text-[14px]"
                  >
                    &times;
                  </button>
                </div>
              )}
              {showImageGen ? (
                <div className="space-y-3 animate-enter">
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder={`Describe the image you want, e.g. "A group of friends playing basketball at sunset"`}
                    rows={3}
                    className="input-field resize-none text-[13px]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateImage}
                      disabled={generatingImage}
                      className="btn-primary flex-1 py-2.5 text-[13px] disabled:opacity-60"
                    >
                      {generatingImage ? 'Generating...' : 'Generate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowImageGen(false); setImagePrompt('') }}
                      className="px-4 py-2.5 rounded-xl border border-border/50 text-[13px] text-muted font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
                    className="flex-1 py-2.5 rounded-xl border border-border/50 text-[13px] font-semibold text-muted flex items-center justify-center gap-1.5 active:bg-surface">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                    </svg>
                    {uploadingImage ? 'Uploading...' : 'Upload'}
                  </button>
                  <button type="button" onClick={() => { if (!requirePro()) return; setShowImageGen(true) }}
                    className={`flex-1 py-2.5 rounded-xl border text-[13px] font-semibold flex items-center justify-center gap-1.5 ${
                      isPro ? 'border-primary/40 text-primary active:bg-primary/5' : 'border-border/40 text-muted/50'
                    }`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Generate
                    {!isPro && <ProBadge small />}
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageUpload(file)
                }}
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
                    if (v && !requirePro()) return
                    setReminderEnabled(v)
                  }}
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
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-[14px]">$</span>
                    <input
                      type="number"
                      value={costAmount}
                      onChange={(e) => setCostAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="input-field"
                      style={{ paddingLeft: '2rem' }}
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
                    if (!requirePro()) return
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
              </div>
              {maxCapacity === 'custom' && (
                <div className="mt-3 animate-enter">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCustomMode('number')}
                      className={`flex-1 h-10 rounded-full text-[13px] font-semibold transition-colors ${
                        customMode === 'number'
                          ? 'bg-primary text-white'
                          : 'bg-surface text-muted border border-border/50'
                      }`}
                    >
                      Number
                    </button>
                    <button
                      onClick={() => setCustomMode('all')}
                      className={`flex-1 h-10 rounded-full text-[13px] font-semibold transition-colors ${
                        customMode === 'all'
                          ? 'bg-primary text-white'
                          : 'bg-surface text-muted border border-border/50'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setCustomMode('any')}
                      className={`flex-1 h-10 rounded-full text-[13px] font-semibold transition-colors ${
                        customMode === 'any'
                          ? 'bg-primary text-white'
                          : 'bg-surface text-muted border border-border/50'
                      }`}
                    >
                      Any
                    </button>
                  </div>
                  {customMode === 'number' && (
                    <input
                      type="number"
                      value={customCapacity}
                      onChange={(e) => setCustomCapacity(e.target.value)}
                      placeholder="Enter number..."
                      min="2"
                      className="input-field mt-3 animate-enter"
                    />
                  )}
                  <p className="text-[12px] text-muted mt-2 leading-relaxed">
                    {customMode === 'all' && 'Everyone in the group is invited — no cap, all invited at once.'}
                    {customMode === 'any' && 'Up to 999 spots — invites sent in priority order.'}
                    {customMode === 'number' && 'Set a specific cap for this activity.'}
                  </p>
                </div>
              )}
            </FieldCard>

            {/* Priority Order Toggle — hidden when "All" selected */}
            {!isAllMode && (
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
            )}

            {/* Response Timer — hidden when "All" selected */}
            {!isAllMode && (
              <FieldCard>
                <FieldLabel>Response Time Per Invite</FieldLabel>
                <div className="relative">
                  <button
                    onClick={() => setShowTimerDropdown(!showTimerDropdown)}
                    className="input-field w-full text-left flex items-center justify-between"
                  >
                    <span>
                      {allTimers.find((o) => o.value === responseTimer)?.label ?? '5 min'} response timer
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showTimerDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border/50 rounded-xl shadow-lg z-20 overflow-hidden animate-enter">
                      {allTimers.filter((opt) => opt.modes.includes('group') && (!opt.test_only || isTestUser)).map((opt) => {
                        const locked = opt.pro_group && !isPro
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              if (locked) { requirePro(); return }
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
                              {opt.pro_group && <ProBadge small />}
                              {opt.test_only && <span className="text-[9px] px-1.5 py-0.5 bg-danger/10 text-danger rounded-full font-bold">TEST</span>}
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
            )}

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
                    if (v && !requirePro()) return
                    setChatEnabled(v)
                  }}
                />
              </div>
              <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
                {isPro
                  ? 'Enable group chat for this activity.'
                  : 'Upgrade to Pro to enable activity chat.'}
              </p>
            </FieldCard>

            {/* Auto Emergency Fill */}
            {!isAllMode && (
              <FieldCard>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-foreground">Auto-Fill Dropouts</span>
                  <Toggle checked={autoEmergencyFill} onChange={setAutoEmergencyFill} />
                </div>
                <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
                  {autoEmergencyFill
                    ? 'When someone drops out, the next person on the list is automatically invited.'
                    : 'When someone drops out, you\'ll get a text to decide whether to fill the spot.'}
                </p>
              </FieldCard>
            )}

          </div>
        )}
      </div>

      {/* Bottom Submit Bar */}
      <div className="flex-shrink-0 bg-background/95 backdrop-blur-md border-t border-border/60 p-4">
        {tab === 'details' ? (
          <button
            onClick={() => { setTab('group'); contentRef.current?.scrollTo(0, 0) }}
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
