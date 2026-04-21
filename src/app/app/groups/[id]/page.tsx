'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { createClient } from '@/lib/supabase/client'
import { AvatarImg } from '@/components/ui/avatar-img'
import CountryCodeSelect from '@/components/auth/country-code-select'
import { QRModal } from '@/components/app/qr-modal'
import { isNative } from '@/lib/capacitor'

interface Member {
  membership_id: string
  user_id: string
  id: string
  first_name: string
  last_name: string
  phone: string
  avatar_url: string | null
  status: string
  priority_order: number
  show_phone?: boolean
}

interface GroupDetail {
  id: string
  name: string
  creator_id: string
  chat_enabled: boolean
  members_visible: boolean
  is_owner: boolean
  current_user_id: string
  creator_is_pro: boolean
  members: Member[]
}

interface ChatMessage {
  id: string
  body: string
  created_at: string
  sender_id: string
  sender: { id: string; first_name: string; last_name: string; avatar_url: string | null }
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  phone: string
  avatar_url: string | null
}

interface GoogleContact {
  name: string
  first_name: string
  last_name: string
  phone: string
  email: string
  photo: string
}

interface DeviceContact {
  name: string
  first_name: string
  last_name: string
  phone: string
  email: string
}

type Tab = 'details' | 'chat' | 'members'
type Modal = null | 'add-phone' | 'add-friends' | 'add-google' | 'add-device' | 'qr-scan' | 'add-menu'

export default function GroupDetailPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.id as string

  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [groupName, setGroupName] = useState('')
  const [chatEnabled, setChatEnabled] = useState(false)
  const [membersVisible, setMembersVisible] = useState(true)
  const [saving, setSaving] = useState(false)
  const nameTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  // Add member by phone state
  const [phoneRaw, setPhoneRaw] = useState('')
  const phoneInput = phoneRaw.replace(/\D/g, '') // digits only for submission
  const [countryCode, setCountryCode] = useState('1')
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  // Add from groups state
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [loadingContacts, setLoadingContacts] = useState(false)

  // Google contacts state
  const [googleContacts, setGoogleContacts] = useState<GoogleContact[]>([])
  const [googleSearch, setGoogleSearch] = useState('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [googleError, setGoogleError] = useState('')
  const googleSearchTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  // Device (Apple/Android) contacts state
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([])
  const [allDeviceContacts, setAllDeviceContacts] = useState<DeviceContact[]>([])
  const [deviceSearch, setDeviceSearch] = useState('')
  const [loadingDevice, setLoadingDevice] = useState(false)
  const [deviceError, setDeviceError] = useState('')

  // Drag reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // Remove member confirm
  const [removingMember, setRemovingMember] = useState<Member | null>(null)

  // Added-member confirmation toast
  const [addedConfirm, setAddedConfirm] = useState<string | null>(null)
  const [lastAddModal, setLastAddModal] = useState<Modal>(null)

  function showAddedConfirm(firstName: string) {
    setLastAddModal(modal)
    setModal(null)
    setAddedConfirm(firstName || 'Member')
  }

  const loadGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`)
    if (res.ok) {
      const data = await res.json()
      setGroup(data)
      setGroupName(data.name)
      setChatEnabled(data.chat_enabled)
      setMembersVisible(data.members_visible ?? true)
      // Default tab: use URL param if present, else host sees details, non-host sees chat
      if (tab === null) {
        const urlTab = new URLSearchParams(window.location.search).get('tab') as Tab
        if (urlTab && ['details', 'chat', 'members'].includes(urlTab)) {
          setTab(urlTab)
        } else {
          setTab(data.is_owner ? 'details' : 'chat')
        }
      }
    }
    setLoading(false)
  }, [groupId])

  useEffect(() => { loadGroup() }, [loadGroup])

  // Auto-save group name on change (debounced)
  function handleNameChange(value: string) {
    setGroupName(value)
    if (nameTimeout.current) clearTimeout(nameTimeout.current)
    nameTimeout.current = setTimeout(() => {
      fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: value, chat_enabled: chatEnabled }),
      })
    }, 800)
  }

  async function saveGroupSettings(updates: { chat_enabled?: boolean; members_visible?: boolean }) {
    const payload = {
      name: groupName,
      chat_enabled: updates.chat_enabled ?? chatEnabled,
      members_visible: updates.members_visible ?? membersVisible,
    }
    await fetch(`/api/groups/${groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  async function handleChatToggle(enabled: boolean) {
    setChatEnabled(enabled)
    // Enabling chat forces members_visible on — members in a chat can see each other anyway.
    if (enabled && !membersVisible) {
      setMembersVisible(true)
      saveGroupSettings({ chat_enabled: enabled, members_visible: true })
    } else {
      saveGroupSettings({ chat_enabled: enabled })
    }
  }

  async function handleMembersVisibleToggle(visible: boolean) {
    setMembersVisible(visible)
    saveGroupSettings({ members_visible: visible })
  }

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`
    return digits
  }

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    setPhoneRaw(digits)
    // Auto-fill test names for 999 area code
    if (digits.length === 10 && digits.startsWith('999')) {
      const last4 = digits.slice(6)
      setNewFirstName(`T-${last4}`)
      setNewLastName(`C-${last4}`)
    }
  }

  async function handleAddByPhone() {
    if (!phoneInput) return
    setAddingMember(true)
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneInput,
        country_code: countryCode,
        first_name: newFirstName,
        last_name: newLastName,
      }),
    })
    if (res.ok) {
      const addedName = newFirstName
      setPhoneRaw('')
      setNewFirstName('')
      setNewLastName('')
      loadGroup()
      showAddedConfirm(addedName)
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to add member')
    }
    setAddingMember(false)
  }

  async function handleAddFromGroups(userId: string) {
    const picked = contacts.find((c) => c.id === userId)
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    if (res.ok) {
      loadGroup()
      showAddedConfirm(picked?.first_name || 'Member')
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to add member')
    }
  }

  async function handleRemoveMember(membershipId: string) {
    await fetch(`/api/groups/${groupId}/members?membership_id=${membershipId}`, {
      method: 'DELETE',
    })
    loadGroup()
  }

  async function openAddFriends() {
    setModal('add-friends')
    setContactSearch('')
    setLoadingContacts(true)
    const res = await fetch('/api/friends')
    if (res.ok) {
      const data = await res.json()
      setContacts(data)
    }
    setLoadingContacts(false)
  }

  async function openGoogleContacts() {
    setModal('add-google')
    setGoogleSearch('')
    setGoogleError('')
    setLoadingGoogle(true)
    try {
      const res = await fetch('/api/google/contacts')
      if (!res.ok) {
        const data = await res.json()
        if (data.error === 'no_google_token') {
          setGoogleError('Sign in with Google to search your contacts.')
        } else {
          setGoogleError('Failed to load contacts.')
        }
        setLoadingGoogle(false)
        return
      }
      const data = await res.json()
      setGoogleContacts(data)
    } catch {
      setGoogleError('Failed to load contacts.')
    }
    setLoadingGoogle(false)
  }

  async function searchGoogleContacts(query: string) {
    setGoogleSearch(query)
    if (googleSearchTimeout.current) clearTimeout(googleSearchTimeout.current)
    if (!query.trim()) {
      // Reset to initial list
      openGoogleContacts()
      return
    }
    googleSearchTimeout.current = setTimeout(async () => {
      setLoadingGoogle(true)
      try {
        const res = await fetch(`/api/google/contacts?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          setGoogleContacts(await res.json())
        }
      } catch { /* keep existing */ }
      setLoadingGoogle(false)
    }, 400)
  }

  async function openDeviceContacts() {
    setModal('add-device')
    setDeviceSearch('')
    setDeviceError('')
    setLoadingDevice(true)
    try {
      const { Contacts } = await import('@capacitor-community/contacts')
      const permission = await Contacts.requestPermissions()
      if (permission.contacts !== 'granted') {
        setDeviceError('Contacts permission denied. Please allow access in your device settings.')
        setLoadingDevice(false)
        return
      }
      const result = await Contacts.getContacts({
        projection: { name: true, phones: true, emails: true },
      })
      const mapped: DeviceContact[] = (result.contacts || [])
        .map((c) => ({
          name: c.name?.display || '',
          first_name: c.name?.given || '',
          last_name: c.name?.family || '',
          phone: c.phones?.[0]?.number?.replace(/[\s\-().]/g, '') || '',
          email: c.emails?.[0]?.address || '',
        }))
        .filter((c) => c.name && c.phone)
        .sort((a, b) => a.name.localeCompare(b.name))
      setAllDeviceContacts(mapped)
      setDeviceContacts(mapped)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setDeviceError(`Contacts error: ${msg}`)
    }
    setLoadingDevice(false)
  }

  function searchDeviceContacts(query: string) {
    setDeviceSearch(query)
    if (!query.trim()) {
      setDeviceContacts(allDeviceContacts)
      return
    }
    const q = query.toLowerCase()
    setDeviceContacts(
      allDeviceContacts.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q)
      )
    )
  }

  async function handleAddDeviceContact(contact: DeviceContact) {
    if (!contact.phone) {
      alert('This contact has no phone number.')
      return
    }
    let phone = contact.phone.replace(/\D/g, '')
    let countryCodeVal = '1'
    if (phone.startsWith('1') && phone.length === 11) {
      phone = phone.slice(1)
    } else if (phone.length > 10) {
      countryCodeVal = phone.slice(0, phone.length - 10)
      phone = phone.slice(-10)
    }

    const firstName = contact.first_name || contact.name.split(' ')[0] || ''
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        country_code: countryCodeVal,
        first_name: firstName,
        last_name: contact.last_name || contact.name.split(' ').slice(1).join(' ') || '',
      }),
    })
    if (res.ok) {
      loadGroup()
      showAddedConfirm(firstName)
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to add member')
    }
  }

  async function handleAddGoogleContact(contact: GoogleContact) {
    if (!contact.phone) {
      alert('This contact has no phone number.')
      return
    }
    // Normalize phone: strip non-digits, handle US numbers
    let phone = contact.phone.replace(/\D/g, '')
    let countryCodeVal = '1'
    if (phone.startsWith('1') && phone.length === 11) {
      phone = phone.slice(1)
    } else if (phone.length > 10) {
      // International — use full digits, country code = first digits
      countryCodeVal = phone.slice(0, phone.length - 10)
      phone = phone.slice(-10)
    }

    const firstName = contact.first_name || contact.name.split(' ')[0] || ''
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        country_code: countryCodeVal,
        first_name: firstName,
        last_name: contact.last_name || contact.name.split(' ').slice(1).join(' ') || '',
      }),
    })
    if (res.ok) {
      loadGroup()
      showAddedConfirm(firstName)
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to add member')
    }
  }

  async function handleLeaveGroup() {
    if (!group) return
    if (!confirm(`Leave "${group.name}"?`)) return
    const myMembership = group.members.find((m) => m.user_id === group.current_user_id)
    if (!myMembership) return
    await fetch(`/api/groups/${groupId}/members?membership_id=${myMembership.membership_id}`, {
      method: 'DELETE',
    })
    router.replace('/app/groups')
  }

  async function handleDeleteGroup() {
    if (!confirm('Delete this group? This cannot be undone.')) return
    await fetch(`/api/groups/${groupId}`, { method: 'DELETE' })
    router.replace('/app/groups')
  }

  // Drag to reorder (touch-friendly)
  function moveItem(from: number, to: number) {
    if (!group) return
    // Don't move item 0 (the owner)
    if (from === 0 || to === 0) return
    const members = [...group.members]
    const [moved] = members.splice(from, 1)
    members.splice(to, 0, moved)
    // Update priority_order
    const updated = members.map((m, i) => ({ ...m, priority_order: i + 1 }))
    setGroup({ ...group, members: updated })

    // Save to server
    fetch(`/api/groups/${groupId}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: updated.map((m) => ({
          membership_id: m.membership_id,
          priority_order: m.priority_order,
        })),
      }),
    })
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="h-full flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-muted">Group not found.</p>
        </div>
      </div>
    )
  }

  // Restricted view: non-owner visiting a group where members_visible is off.
  // Hide the whole details/chat/members UI and only offer to leave.
  if (!group.is_owner && !group.members_visible) {
    return (
      <div className="h-full flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-sm mx-auto">
            <div className="bg-background border border-border/50 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M2 21v-1a5 5 0 0110 0v1M14 21v-1a4 4 0 018 0v1" />
                </svg>
              </div>
              <h1 className="text-[17px] font-bold text-foreground text-center">{group.name}</h1>
              <p className="text-[12px] text-muted text-center mt-1 mb-5">
                The host has set this group to private. You can&apos;t see other members.
              </p>

              <button
                onClick={handleLeaveGroup}
                className="w-full py-3 rounded-xl bg-danger/10 text-danger text-[14px] font-semibold active:opacity-80 transition-opacity"
              >
                Leave Group
              </button>

              <p className="text-[11px] text-muted text-center mt-4 leading-snug">
                Note: the group creator won&apos;t be notified when you leave.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const existingMemberIds = new Set(group.members.map((m) => m.user_id))
  const filteredContacts = contacts
    .filter((c) => !existingMemberIds.has(c.id))
    .filter((c) => {
      if (!contactSearch) return true
      const q = contactSearch.toLowerCase()
      const name = `${c.first_name} ${c.last_name}`.toLowerCase()
      const phone = (c.phone || '').replace(/\D/g, '')
      const searchDigits = q.replace(/\D/g, '')
      return name.includes(q) || (searchDigits && phone.includes(searchDigits))
    })

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <AppHeader showBack />

      {/* Tab bar */}
      {(() => {
        const chatActive = group.chat_enabled && group.creator_is_pro
        const tabs: { key: Tab; label: string; badge?: string }[] = []

        if (group.is_owner) {
          tabs.push({ key: 'details', label: 'Group Details' })
          tabs.push({ key: 'chat', label: 'Chat', badge: !chatActive ? 'PRO' : undefined })
        } else {
          if (chatActive) tabs.push({ key: 'chat', label: 'Chat' })
          if (group.members_visible) tabs.push({ key: 'members', label: 'Members' })
        }

        // If only one tab or none, don't show tab bar for non-hosts
        if (!group.is_owner && tabs.length <= 1) return null

        const tabWidth = `${100 / tabs.length}%`
        const activeIndex = tabs.findIndex((t) => t.key === tab)

        return (
          <div className="bg-background flex relative border-b border-border/40">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-[13px] font-semibold text-center transition-colors flex items-center justify-center gap-1.5 ${
                  tab === t.key ? 'text-primary' : 'text-muted'
                }`}
              >
                {t.label}
                {t.badge && (
                  <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{t.badge}</span>
                )}
              </button>
            ))}
            <div
              className="absolute bottom-0 h-[2.5px] bg-primary rounded-full transition-all duration-300"
              style={{ width: tabWidth, left: `${activeIndex * (100 / tabs.length)}%` }}
            />
          </div>
        )
      })()}

      <div className={`flex-1 ${tab === 'chat' ? 'flex flex-col min-h-0' : 'overflow-y-auto pb-8'}`}>
        {/* Non-host group name banner (since they don't see Group Details) */}
        {!group.is_owner && (
          <div className="bg-background border-b border-border/30 px-4 py-2.5">
            <p className="text-[15px] font-bold text-foreground text-center">{group.name}</p>
          </div>
        )}

        {/* Non-host with nothing available */}
        {!group.is_owner && !(group.chat_enabled && group.creator_is_pro) && !group.members_visible && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-[13px] text-muted">The group host hasn&apos;t enabled any features yet.</p>
          </div>
        )}

        {/* Read-only Members tab for non-hosts */}
        {tab === 'members' && !group.is_owner && (
          <div className="px-4 pt-4">
            <p className="text-[12px] text-muted mb-3">{group.members.length} member{group.members.length !== 1 ? 's' : ''}</p>
            <div className="space-y-2">
              {[...group.members].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)).map((member) => {
                const isCurrentUser = member.user_id === group.current_user_id
                return (
                  <div key={member.membership_id} className="bg-background border border-border/50 rounded-xl p-3.5 flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <AvatarImg size="lg" src={member.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground truncate">
                        {member.first_name} {member.last_name}
                        {isCurrentUser && <span className="text-[11px] text-muted font-normal ml-1">(You)</span>}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'details' && (
          <div className="px-4 pt-4">
            {/* Group Info card */}
            <div className="bg-background border border-border/50 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[14px] font-semibold text-foreground">Group Info</span>
                {group.is_owner && (
                  <button onClick={handleDeleteGroup} className="p-1" aria-label="Delete group">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                )}
              </div>

              <input
                type="text"
                value={groupName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="input-field mb-3"
                placeholder="Group name"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-foreground">Enable chat</span>
                  <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">PRO</span>
                </div>
                <button
                  role="switch"
                  aria-checked={chatEnabled}
                  onClick={() => handleChatToggle(!chatEnabled)}
                  className={`relative w-[46px] h-[28px] rounded-full transition-colors duration-200 flex-shrink-0 ${
                    chatEnabled ? 'bg-primary' : 'bg-[#d5d9e2]'
                  }`}
                >
                  <span className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    chatEnabled ? 'translate-x-[18px]' : ''
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className={`text-[13px] ${chatEnabled ? 'text-muted' : 'text-foreground'}`}>
                  See other members
                  {chatEnabled && <span className="block text-[11px] text-muted mt-0.5">Required while chat is on</span>}
                </span>
                <button
                  role="switch"
                  aria-checked={membersVisible}
                  disabled={chatEnabled}
                  onClick={() => !chatEnabled && handleMembersVisibleToggle(!membersVisible)}
                  className={`relative w-[46px] h-[28px] rounded-full transition-colors duration-200 flex-shrink-0 ${
                    membersVisible ? 'bg-primary' : 'bg-[#d5d9e2]'
                  } ${chatEnabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    membersVisible ? 'translate-x-[18px]' : ''
                  }`} />
                </button>
              </div>
            </div>

            {/* Add member button */}
            <button
              onClick={() => setModal('add-menu')}
              className="btn-primary w-full py-3 mb-4 text-[14px]"
            >
              + Add Member
            </button>

            {/* Member list */}
            <p className="text-[12px] text-muted mb-2">
              Click on arrows to reorder invitees.
            </p>
            <div className="space-y-2">
              {group.members.map((member, index) => {
                const isOwner = index === 0
                const isCurrentUser = member.user_id === group.current_user_id
                return (
                  <div
                    key={member.membership_id}
                    className={`bg-background border rounded-xl p-3.5 flex items-center gap-3 transition-all ${
                      dragIndex === index ? 'border-primary shadow-md scale-[1.02]' : 'border-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                    }`}
                  >
                    {/* Avatar */}
                    <AvatarImg size="lg" src={member.avatar_url} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground truncate">
                        {member.first_name} {member.last_name}
                        {isCurrentUser && <span className="text-[11px] text-muted font-normal ml-1">(You)</span>}
                      </p>
                      {member.show_phone && <p className="text-[11px] text-muted truncate">{member.phone}</p>}
                    </div>

                    {/* Reorder arrows (not for owner position) */}
                    {!isOwner && group.is_owner && (
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => index > 1 && moveItem(index, index - 1)}
                          disabled={index <= 1}
                          className="p-1 text-muted disabled:opacity-30 active:text-primary"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 15l-6-6-6 6" />
                          </svg>
                        </button>
                        <button
                          onClick={() => index < group.members.length - 1 && moveItem(index, index + 1)}
                          disabled={index >= group.members.length - 1}
                          className="p-1 text-muted disabled:opacity-30 active:text-primary"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Remove button (not for owner) */}
                    {!isOwner && group.is_owner && (
                      <button
                        onClick={() => setRemovingMember(member)}
                        className="p-1.5 text-danger/60 active:text-danger flex-shrink-0"
                        aria-label="Remove member"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'chat' && (
          <GroupChat group={group} />
        )}
      </div>

      {/* Add Member by Phone Modal */}
      {modal === 'add-phone' && (
        <BottomSheet onClose={() => setModal(null)}>
          <h3 className="text-[16px] font-bold text-foreground text-center mb-5">Add a member to the group</h3>

          <div className="mb-4">
            <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">Phone</label>
            <div className="flex gap-2">
              <CountryCodeSelect value={countryCode} onChange={setCountryCode} />
              <input
                type="text"
                inputMode="tel"
                value={formatPhone(phoneRaw)}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(###) ### - ####"
                className="input-field !w-auto flex-1 min-w-0"
                autoComplete="off"
                autoFocus
              />
            </div>
          </div>

          <div className="flex gap-3 mb-5">
            <div className="flex-1">
              <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">First Name</label>
              <input
                type="text"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                placeholder="Type here..."
                className="input-field"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">Last Name</label>
              <input
                type="text"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                placeholder="Type here..."
                className="input-field"
              />
            </div>
          </div>

          <button
            onClick={handleAddByPhone}
            disabled={addingMember || !phoneInput.trim()}
            className="btn-primary w-full py-3 text-[14px] disabled:opacity-50"
          >
            {addingMember ? 'Adding...' : 'Add Member'}
          </button>
        </BottomSheet>
      )}

      {/* Remove Member Confirm Modal */}
      {addedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/40" onClick={() => setAddedConfirm(null)}>
          <div
            className="modal-panel bg-background rounded-2xl p-6 w-full max-w-xs shadow-2xl mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-[16px] font-bold text-foreground mb-1">Member added</h3>
            <p className="text-[13px] text-muted mb-5">
              <span className="font-semibold text-foreground">{addedConfirm}</span> was added to <span className="font-semibold text-foreground">{groupName}</span>.
            </p>
            <button
              onClick={() => {
                setAddedConfirm(null)
                setModal(lastAddModal || 'add-menu')
              }}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-[14px] font-semibold active:opacity-80 transition-opacity"
            >
              Add More
            </button>
            <button
              onClick={() => setAddedConfirm(null)}
              className="w-full py-2.5 rounded-xl text-[14px] font-semibold text-muted active:bg-surface transition-colors mt-2"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {removingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/40" onClick={() => setRemovingMember(null)}>
          <div
            className="modal-panel bg-background rounded-2xl p-6 w-full max-w-xs shadow-2xl mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </div>
            <h3 className="text-[16px] font-bold text-foreground mb-1">Remove Member</h3>
            <p className="text-[13px] text-muted mb-5">
              Remove <span className="font-semibold text-foreground">{removingMember.first_name} {removingMember.last_name}</span> from this group? They won&apos;t be deleted from the app.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemovingMember(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-[14px] font-semibold text-muted active:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRemoveMember(removingMember.membership_id)
                  setRemovingMember(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-[14px] font-semibold active:opacity-80 transition-opacity"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Contacts Modal */}
      {modal === 'add-google' && (
        <BottomSheet onClose={() => setModal(null)}>
          <h3 className="text-[16px] font-bold text-foreground text-center mb-4">Search Google Contacts</h3>

          {googleError ? (
            <div className="text-center py-8">
              <p className="text-[13px] text-muted mb-4">{googleError}</p>
              {googleError.includes('Sign in') && (
                <a href="/" className="btn-primary inline-block px-6 py-2.5 text-[13px]">
                  Sign in with Google
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="relative mb-4">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={googleSearch}
                  onChange={(e) => searchGoogleContacts(e.target.value)}
                  placeholder="Search by name..."
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  autoFocus
                />
              </div>

              {loadingGoogle ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : googleContacts.length === 0 ? (
                <p className="text-[13px] text-muted text-center py-8">
                  {googleSearch ? 'No contacts found.' : 'No contacts available.'}
                </p>
              ) : (
                <div className="space-y-2 max-h-[50dvh] overflow-y-auto">
                  {googleContacts.map((contact, i) => (
                    <div
                      key={`${contact.phone || contact.email}-${i}`}
                      className="bg-background border border-border/50 rounded-xl p-3 flex items-center gap-3"
                    >
                      {contact.photo ? (
                        <img src={contact.photo} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[14px] font-bold text-primary">
                            {(contact.first_name || contact.name || '?')[0]?.toUpperCase()}
                          </span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{contact.name}</p>
                        <p className="text-[11px] text-muted truncate">{contact.phone || contact.email || 'No phone'}</p>
                      </div>

                      {contact.phone ? (
                        <button
                          onClick={() => handleAddGoogleContact(contact)}
                          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 active:bg-primary-dark transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted/50 flex-shrink-0">No phone</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </BottomSheet>
      )}

      {/* Device Contacts Modal */}
      {modal === 'add-device' && (
        <BottomSheet onClose={() => setModal(null)}>
          <h3 className="text-[16px] font-bold text-foreground text-center mb-4">Search Phone Contacts</h3>

          {deviceError ? (
            <div className="text-center py-8">
              <p className="text-[13px] text-muted">{deviceError}</p>
            </div>
          ) : (
            <>
              <div className="relative mb-4">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={deviceSearch}
                  onChange={(e) => searchDeviceContacts(e.target.value)}
                  placeholder="Search by name..."
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  autoFocus
                />
              </div>

              {loadingDevice ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : deviceContacts.length === 0 ? (
                <p className="text-[13px] text-muted text-center py-8">
                  {deviceSearch ? 'No contacts found.' : 'No contacts available.'}
                </p>
              ) : (
                <div className="space-y-2 max-h-[50dvh] overflow-y-auto">
                  {deviceContacts.map((contact, i) => (
                    <div
                      key={`${contact.phone}-${i}`}
                      className="bg-background border border-border/50 rounded-xl p-3 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[14px] font-bold text-primary">
                          {(contact.first_name || contact.name || '?')[0]?.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{contact.name}</p>
                        <p className="text-[11px] text-muted truncate">{contact.phone || contact.email || 'No phone'}</p>
                      </div>

                      <button
                        onClick={() => handleAddDeviceContact(contact)}
                        className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 active:bg-primary-dark transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </BottomSheet>
      )}

      {/* Add from Friends Modal */}
      {modal === 'add-friends' && (
        <BottomSheet onClose={() => setModal(null)}>
          <h3 className="text-[16px] font-bold text-foreground text-center mb-4">Add from Friends</h3>

          <input
            type="text"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="input-field mb-4"
            autoFocus
          />

          {loadingContacts ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <p className="text-[13px] text-muted text-center py-8">
              {contacts.length === 0 ? 'No friends yet. Add members by phone to build your list!' : 'No matching friends.'}
            </p>
          ) : (
            <div className="space-y-2 max-h-[50dvh] overflow-y-auto">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="bg-background border border-border/50 rounded-xl p-3 flex items-center gap-3"
                >
                  {/* Avatar */}
                  <AvatarImg src={contact.avatar_url} />

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-[11px] text-muted">{contact.phone}</p>
                  </div>

                  <button
                    onClick={() => handleAddFromGroups(contact.id)}
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 active:bg-primary-dark transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </BottomSheet>
      )}

      {/* Add Member Menu */}
      {modal === 'add-menu' && (
        <BottomSheet onClose={() => setModal(null)}>
          <h3 className="text-[16px] font-bold text-foreground text-center mb-5">Add Member</h3>

          {/* QR — featured option */}
          <button
            onClick={() => setModal('qr-scan')}
            className="w-full py-4 mb-4 rounded-2xl bg-primary text-white font-bold text-[15px] flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-sm"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="8" height="8" rx="1" />
              <rect x="14" y="2" width="8" height="8" rx="1" />
              <rect x="2" y="14" width="8" height="8" rx="1" />
              <rect x="14" y="14" width="4" height="4" />
              <path d="M22 14h-4v4" />
              <path d="M22 22h-4v-4" />
            </svg>
            Scan QR Code
          </button>

          {/* Other options — 2x2 grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setModal('add-phone')}
              className="flex flex-col items-center gap-2 py-4 px-3 rounded-2xl bg-background border border-border/50 active:bg-surface transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold text-foreground">Phone Number</span>
            </button>

            <button
              onClick={() => { setModal(null); setTimeout(() => openAddFriends(), 100) }}
              className="flex flex-col items-center gap-2 py-4 px-3 rounded-2xl bg-background border border-border/50 active:bg-surface transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v-2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold text-foreground">My Friends</span>
            </button>

            {isNative() && (
              <button
                onClick={() => { setModal(null); setTimeout(() => openDeviceContacts(), 100) }}
                className="flex flex-col items-center gap-2 py-4 px-3 rounded-2xl bg-background border border-border/50 active:bg-surface transition-colors col-span-2"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16v16H4z" />
                    <path d="M9 9h1M14 9h1M9 14h6" />
                  </svg>
                </div>
                <span className="text-[13px] font-semibold text-foreground">Search Contacts</span>
              </button>
            )}
          </div>
        </BottomSheet>
      )}

      {/* QR Scan Modal */}
      {modal === 'qr-scan' && group && (
        <QRModal
          open={true}
          onClose={() => { setModal(null); loadGroup() }}
          userId={group.current_user_id}
          userName={(() => {
            const me = group.members.find((m) => m.id === group.current_user_id)
            return me ? `${me.first_name} ${me.last_name}`.trim() : ''
          })()}
          groupId={group.id}
          groupName={group.name}
        />
      )}
    </div>
  )
}

function GroupChat({ group }: { group: GroupDetail }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)
  const [showCatchUp, setShowCatchUp] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const catchUpRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const chatAvailable = group.chat_enabled && group.creator_is_pro

  // Load messages
  useEffect(() => {
    if (!chatAvailable) { setLoadingMessages(false); return }

    fetch(`/api/groups/${group.id}/messages`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages)
          if (data.last_read_at) {
            setLastReadAt(data.last_read_at)
            const unread = data.messages.filter(
              (m: ChatMessage) => m.sender_id !== group.current_user_id && new Date(m.created_at) > new Date(data.last_read_at)
            )
            if (unread.length > 0) setShowCatchUp(true)
          }
        } else if (Array.isArray(data)) {
          setMessages(data)
        }
      })
      .finally(() => setLoadingMessages(false))
  }, [group.id, chatAvailable, group.current_user_id])

  // Subscribe to real-time messages via Broadcast
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    if (!chatAvailable) return

    const supabase = createClient()
    const channel = supabase
      .channel(`group-chat-${group.id}`)
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        const msg = payload as ChatMessage
        if (msg.sender_id === group.current_user_id) return
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [group.id, group.current_user_id, chatAvailable])

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

    // Optimistic insert
    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      body: text,
      created_at: new Date().toISOString(),
      sender_id: group.current_user_id,
      sender: {
        id: group.current_user_id,
        first_name: 'You',
        last_name: '',
        avatar_url: null,
      },
    }
    setMessages((prev) => [...prev, optimistic])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const res = await fetch(`/api/groups/${group.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      if (res.ok) {
        const saved = await res.json()
        // Replace optimistic with real message
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...optimistic, id: saved.id, created_at: saved.created_at } : m))
        )
        // Broadcast to other clients
        const me = group.members.find((m) => m.id === group.current_user_id)
        channelRef.current?.send({
          type: 'broadcast',
          event: 'new_message',
          payload: {
            id: saved.id,
            body: text,
            created_at: saved.created_at,
            sender_id: group.current_user_id,
            sender: me
              ? { id: me.id, first_name: me.first_name, last_name: me.last_name, avatar_url: me.avatar_url }
              : { id: group.current_user_id, first_name: '?', last_name: '', avatar_url: null },
          },
        })
      } else {
        // Remove optimistic on error
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        const err = await res.json()
        alert(err.error || 'Failed to send message')
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
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
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
    ? messages.findIndex((m) => m.sender_id !== group.current_user_id && new Date(m.created_at) > new Date(lastReadAt))
    : -1

  // Not available state
  if (!chatAvailable) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={1.5}>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <h3 className="text-[16px] font-bold text-foreground mb-1">Group Chat</h3>
        <p className="text-[13px] text-muted mb-4">
          {!group.chat_enabled
            ? 'Chat is disabled for this group. The group owner can enable it in Group Details.'
            : 'Chat requires a Pro membership. The group owner needs to upgrade to enable chat for everyone.'}
        </p>
        {group.is_owner && !group.creator_is_pro && (
          <button
            onClick={() => window.location.href = `/app/upgrade?returnTo=/app/groups/${group.id}`}
            className="btn-primary px-6 py-2.5 text-[13px]"
          >
            Upgrade to Pro
          </button>
        )}
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
              const isMe = msg.sender_id === group.current_user_id
              const prevMsg = i > 0 ? messages[i - 1] : null
              const sameSender = prevMsg?.sender_id === msg.sender_id && !isMe === !(prevMsg && prevMsg.sender_id === group.current_user_id)
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

function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // When keyboard opens on iOS, scroll the focused input into view
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const handleFocus = () => {
      // Small delay to let keyboard finish animating
      setTimeout(() => {
        const active = document.activeElement as HTMLElement
        if (active && sheet.contains(active)) {
          active.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
    }
    sheet.addEventListener('focusin', handleFocus)
    return () => sheet.removeEventListener('focusin', handleFocus)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop bg-black/40" onClick={onClose}>
      <div
        ref={sheetRef}
        className="modal-panel bg-background rounded-t-2xl p-6 pb-[env(safe-area-inset-bottom)] w-full max-w-lg shadow-2xl max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>
        {children}
      </div>
    </div>
  )
}
