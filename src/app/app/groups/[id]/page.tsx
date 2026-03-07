'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppHeader } from '@/components/app/header'

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
}

interface GroupDetail {
  id: string
  name: string
  creator_id: string
  chat_enabled: boolean
  is_owner: boolean
  current_user_id: string
  members: Member[]
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  phone: string
  avatar_url: string | null
}

type Tab = 'details' | 'chat'
type Modal = null | 'add-phone' | 'add-groups'

export default function GroupDetailPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.id as string

  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('details')
  const [modal, setModal] = useState<Modal>(null)
  const [groupName, setGroupName] = useState('')
  const [chatEnabled, setChatEnabled] = useState(false)
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

  // Drag reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const loadGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`)
    if (res.ok) {
      const data = await res.json()
      setGroup(data)
      setGroupName(data.name)
      setChatEnabled(data.chat_enabled)
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

  async function handleChatToggle(enabled: boolean) {
    setChatEnabled(enabled)
    await fetch(`/api/groups/${groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName, chat_enabled: enabled }),
    })
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
      setModal(null)
      setPhoneRaw('')
      setNewFirstName('')
      setNewLastName('')
      loadGroup()
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to add member')
    }
    setAddingMember(false)
  }

  async function handleAddFromGroups(userId: string) {
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    if (res.ok) {
      loadGroup()
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

  async function openAddFromGroups() {
    setModal('add-groups')
    setLoadingContacts(true)
    const res = await fetch('/api/groups/contacts')
    if (res.ok) {
      const data = await res.json()
      setContacts(data)
    }
    setLoadingContacts(false)
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
      <div className="min-h-dvh flex flex-col bg-surface">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-dvh flex flex-col bg-surface">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-muted">Group not found.</p>
        </div>
      </div>
    )
  }

  const existingMemberIds = new Set(group.members.map((m) => m.user_id))
  const filteredContacts = contacts
    .filter((c) => !existingMemberIds.has(c.id))
    .filter((c) =>
      contactSearch
        ? `${c.first_name} ${c.last_name}`.toLowerCase().includes(contactSearch.toLowerCase())
        : true
    )

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <AppHeader />

      {/* Tab bar */}
      <div className="bg-background flex relative border-b border-border/40">
        <button
          onClick={() => setTab('details')}
          className={`flex-1 py-3 text-[13px] font-semibold text-center transition-colors ${
            tab === 'details' ? 'text-primary' : 'text-muted'
          }`}
        >
          Group Details
        </button>
        <button
          onClick={() => setTab('chat')}
          className={`flex-1 py-3 text-[13px] font-semibold text-center transition-colors flex items-center justify-center gap-1.5 ${
            tab === 'chat' ? 'text-primary' : 'text-muted'
          }`}
        >
          Chat
          <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">PRO</span>
        </button>
        <div
          className="absolute bottom-0 h-[2.5px] bg-primary rounded-full transition-all duration-300"
          style={{ width: '50%', left: tab === 'details' ? '0%' : '50%' }}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {tab === 'details' ? (
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
            </div>

            {/* Add member buttons */}
            <button
              onClick={() => setModal('add-phone')}
              className="btn-primary w-full py-3 mb-2.5 text-[14px]"
            >
              + Add Member
            </button>
            <button
              onClick={openAddFromGroups}
              className="w-full py-3 mb-4 text-[14px] font-semibold text-primary bg-primary/8 rounded-xl active:bg-primary/15 transition-colors border border-primary/20"
            >
              + Add from your groups
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
                    <div className="w-10 h-10 rounded-full bg-border/40 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8892a7" strokeWidth={1.5}>
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 21v-1a8 8 0 0116 0v1" />
                        </svg>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground truncate">
                        {member.first_name} {member.last_name}
                        {isCurrentUser && <span className="text-[11px] text-muted font-normal ml-1">(You)</span>}
                      </p>
                      <p className="text-[11px] text-muted truncate">{member.phone}</p>
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
                        onClick={() => handleRemoveMember(member.membership_id)}
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
        ) : (
          /* Chat tab placeholder */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={1.5}>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <h3 className="text-[16px] font-bold text-foreground mb-1">Group Chat</h3>
            <p className="text-[13px] text-muted mb-4">
              Chat is a Pro feature. Upgrade your membership to enable group chat.
            </p>
            <button className="btn-primary px-6 py-2.5 text-[13px]">
              Upgrade to Pro
            </button>
          </div>
        )}
      </div>

      {/* Add Member by Phone Modal */}
      {modal === 'add-phone' && (
        <BottomSheet onClose={() => setModal(null)}>
          <h3 className="text-[16px] font-bold text-foreground text-center mb-5">Add a member to the group</h3>

          <div className="mb-4">
            <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">Phone</label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="input-field !w-24 shrink-0 text-[13px]"
              >
                <option value="1">us +1</option>
                <option value="44">uk +44</option>
                <option value="61">au +61</option>
                <option value="91">in +91</option>
                <option value="383">xk +383</option>
              </select>
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

      {/* Add from Groups Modal */}
      {modal === 'add-groups' && (
        <BottomSheet onClose={() => setModal(null)}>
          <h3 className="text-[16px] font-bold text-foreground text-center mb-4">Add member from groups</h3>

          <input
            type="text"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Search by name"
            className="input-field mb-4"
            autoFocus
          />

          {loadingContacts ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <p className="text-[13px] text-muted text-center py-8">
              {contacts.length === 0 ? 'No contacts from your groups yet.' : 'No matching contacts.'}
            </p>
          ) : (
            <div className="space-y-2 max-h-[50dvh] overflow-y-auto">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="bg-background border border-border/50 rounded-xl p-3 flex items-center gap-3"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {contact.avatar_url ? (
                      <img src={contact.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth={1.5}>
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21v-1a8 8 0 0116 0v1" />
                      </svg>
                    )}
                  </div>

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
    </div>
  )
}

function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center modal-backdrop bg-black/40" onClick={onClose}>
      <div
        className="modal-panel bg-background rounded-t-2xl p-6 w-full max-w-lg shadow-2xl max-h-[85dvh] overflow-y-auto"
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
