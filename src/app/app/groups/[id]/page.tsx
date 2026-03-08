'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppHeader } from '@/components/app/header'
import { createClient } from '@/lib/supabase/client'
import { PawAvatar } from '@/components/ui/paw-avatar'

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

type Tab = 'details' | 'chat' | 'members'
type Modal = null | 'add-phone' | 'add-friends'

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

  // Drag reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // Remove member confirm
  const [removingMember, setRemovingMember] = useState<Member | null>(null)

  const loadGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`)
    if (res.ok) {
      const data = await res.json()
      setGroup(data)
      setGroupName(data.name)
      setChatEnabled(data.chat_enabled)
      setMembersVisible(data.members_visible ?? true)
      // Default tab: host sees details, non-host sees chat
      if (tab === null) {
        setTab(data.is_owner ? 'details' : 'chat')
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
    saveGroupSettings({ chat_enabled: enabled })
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
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-dvh flex flex-col bg-surface">
        <AppHeader showBack />
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-muted">Group not found.</p>
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
    <div className="h-dvh flex flex-col bg-surface overflow-hidden">
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
              {group.members.map((member) => {
                const isCurrentUser = member.user_id === group.current_user_id
                return (
                  <div key={member.membership_id} className="bg-background border border-border/50 rounded-xl p-3.5 flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <PawAvatar size="lg" src={member.avatar_url} />
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
                <span className="text-[13px] text-foreground">Allow members to see who&apos;s in the group</span>
                <button
                  role="switch"
                  aria-checked={membersVisible}
                  onClick={() => handleMembersVisibleToggle(!membersVisible)}
                  className={`relative w-[46px] h-[28px] rounded-full transition-colors duration-200 flex-shrink-0 ${
                    membersVisible ? 'bg-primary' : 'bg-[#d5d9e2]'
                  }`}
                >
                  <span className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    membersVisible ? 'translate-x-[18px]' : ''
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
              onClick={openAddFriends}
              className="w-full py-3 mb-4 text-[14px] font-semibold text-primary bg-primary/8 rounded-xl active:bg-primary/15 transition-colors border border-primary/20"
            >
              + Add from Friends
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
                    <PawAvatar size="lg" src={member.avatar_url} />

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

      {/* Remove Member Confirm Modal */}
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
                  <PawAvatar src={contact.avatar_url} />

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
          <button className="btn-primary px-6 py-2.5 text-[13px]">
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
          <div className="space-y-1">
            {messages.map((msg, i) => {
              const isMe = msg.sender_id === group.current_user_id
              const prevMsg = i > 0 ? messages[i - 1] : null
              const sameSender = prevMsg?.sender_id === msg.sender_id
              const showDateSep = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()
              const isUnreadLine = i === unreadStartIndex

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex justify-center my-3">
                      <span className="text-[10px] font-semibold text-muted bg-surface px-3 py-1 rounded-full">
                        {formatDateSeparator(msg.created_at)}
                      </span>
                    </div>
                  )}
                  {/* Unread divider */}
                  {isUnreadLine && (
                    <div ref={catchUpRef} className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-primary/40" />
                      <span className="text-[11px] font-bold text-primary whitespace-nowrap">New messages</span>
                      <div className="flex-1 h-px bg-primary/40" />
                    </div>
                  )}
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${sameSender && !showDateSep && !isUnreadLine ? 'mt-0.5' : 'mt-3'}`}>
                    {!isMe && !sameSender && (
                      <div className="mr-2 mt-0.5">
                        <PawAvatar size="sm" src={msg.sender?.avatar_url} />
                      </div>
                    )}
                    {!isMe && sameSender && !showDateSep && <div className="w-7 mr-2 flex-shrink-0" />}

                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && !sameSender && (
                        <p className="text-[10px] font-semibold text-primary mb-0.5 ml-1">
                          {msg.sender?.first_name} {msg.sender?.last_name}
                        </p>
                      )}
                      <div
                        className={`px-3 py-1.5 rounded-2xl text-[14px] leading-relaxed ${
                          isMe
                            ? 'bg-primary text-white rounded-br-md'
                            : 'bg-background border border-border/50 text-foreground rounded-bl-md'
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
