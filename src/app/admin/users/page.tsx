'use client'

import { useEffect, useState } from 'react'

interface UserRow {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  status: string
  membership_tier: string
  created_at: string
  auth_user_id: string | null
  push_token: string | null
}

type FilterMode = 'all' | 'active' | 'invited'

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [reinviting, setReinviting] = useState(false)
  const [reinviteResult, setReinviteResult] = useState<{ sent: number; total: number } | null>(null)

  useEffect(() => {
    fetch('/api/admin/users')
      .then((res) => res.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = users.filter((u) => {
    const matchesSearch =
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase()))

    if (filterMode === 'active') return matchesSearch && u.auth_user_id !== null
    if (filterMode === 'invited') return matchesSearch && u.auth_user_id === null
    return matchesSearch
  })

  const invitedOnlyCount = users.filter((u) => u.auth_user_id === null).length
  const activeCount = users.filter((u) => u.auth_user_id !== null).length

  // Only invited-only users can be re-invited
  const invitedOnlyInFiltered = filtered.filter((u) => u.auth_user_id === null)
  const selectedInvitedIds = [...selectedIds].filter((id) => invitedOnlyInFiltered.some((u) => u.id === id))

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllInvited() {
    if (selectedInvitedIds.length === invitedOnlyInFiltered.length) {
      // Deselect all
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(invitedOnlyInFiltered.map((u) => u.id)))
    }
  }

  async function handleReinvite() {
    if (selectedInvitedIds.length === 0) return
    setReinviting(true)
    setReinviteResult(null)
    try {
      const res = await fetch('/api/admin/users/reinvite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedInvitedIds }),
      })
      const data = await res.json()
      if (res.ok) {
        setReinviteResult({ sent: data.sent, total: data.total })
        setSelectedIds(new Set())
      }
    } catch {
      // ignore
    }
    setReinviting(false)
  }

  async function toggleTier(user: UserRow) {
    const newTier = user.membership_tier === 'pro' ? 'free' : 'pro'
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, membership_tier: newTier } : u))
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, membership_tier: newTier }),
    })
    if (!res.ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, membership_tier: user.membership_tier } : u))
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteConfirm.id, auth_user_id: deleteConfirm.auth_user_id }),
    })
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== deleteConfirm.id))
    }
    setDeleting(false)
    setDeleteConfirm(null)
  }

  function openEdit(user: UserRow) {
    setEditUser(user)
    setEditFirst(user.first_name)
    setEditLast(user.last_name)
  }

  async function handleSaveEdit() {
    if (!editUser) return
    setSaving(true)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editUser.id, first_name: editFirst, last_name: editLast }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === editUser.id ? { ...u, first_name: editFirst, last_name: editLast } : u))
      setEditUser(null)
    }
    setSaving(false)
  }

  function UserStatusBadge({ user }: { user: UserRow }) {
    if (user.auth_user_id) {
      return (
        <span className="text-xs px-2 py-1 rounded-full font-medium bg-success/10 text-success" title="Has app account">
          active
        </span>
      )
    }
    return (
      <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-700" title="Text only — no app account">
        invited
      </span>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-2xl font-bold">Users</h2>
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 px-4 rounded-xl border border-border bg-background text-sm
                     placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                     focus:border-primary w-full sm:w-64"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { mode: 'all' as FilterMode, label: `All (${users.length})` },
          { mode: 'active' as FilterMode, label: `App Users (${activeCount})` },
          { mode: 'invited' as FilterMode, label: `Text Only (${invitedOnlyCount})` },
        ]).map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => { setFilterMode(mode); setSelectedIds(new Set()) }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterMode === mode
                ? 'bg-primary text-white'
                : 'bg-surface text-muted hover:text-foreground border border-border/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Re-invite bar (shown when invited users are in view) */}
      {invitedOnlyInFiltered.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={selectAllInvited}
              className="text-xs px-2.5 py-1 rounded-lg font-medium bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              {selectedInvitedIds.length === invitedOnlyInFiltered.length ? 'Deselect All' : `Select All ${invitedOnlyInFiltered.length} Text-Only`}
            </button>
            {selectedInvitedIds.length > 0 && (
              <span className="text-xs text-amber-700 font-medium">{selectedInvitedIds.length} selected</span>
            )}
          </div>
          <button
            onClick={handleReinvite}
            disabled={selectedInvitedIds.length === 0 || reinviting}
            className="text-xs px-4 py-2 rounded-lg font-bold bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {reinviting ? 'Sending...' : `Re-Send Invite (${selectedInvitedIds.length})`}
          </button>
        </div>
      )}

      {/* Re-invite result toast */}
      {reinviteResult && (
        <div className="mb-4 p-3 rounded-xl bg-success/10 border border-success/20 text-sm text-success font-medium flex items-center justify-between">
          <span>Sent {reinviteResult.sent} of {reinviteResult.total} re-invite texts.</span>
          <button onClick={() => setReinviteResult(null)} className="text-success/60 hover:text-success text-lg leading-none">&times;</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted">
          {search ? 'No users match your search.' : 'No users yet.'}
        </div>
      ) : (
        <>
          {/* Mobile: Card view */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((user) => (
              <div key={user.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    {/* Checkbox for invited-only users */}
                    {user.auth_user_id === null && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        className="mt-1 w-4 h-4 rounded border-border accent-primary"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold cursor-pointer hover:text-primary" onClick={() => openEdit(user)}>
                        {user.first_name || user.last_name ? `${user.first_name} ${user.last_name}`.trim() : <span className="text-muted italic">No name</span>}
                      </h3>
                      <p className="text-sm text-muted mt-0.5">{user.phone}</p>
                      {user.email && <p className="text-sm text-muted">{user.email}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <UserStatusBadge user={user} />
                    <button
                      onClick={() => toggleTier(user)}
                      className={`text-xs px-2 py-1 rounded-full font-medium cursor-pointer active:opacity-70 transition-opacity
                        ${user.membership_tier === 'pro' ? 'bg-primary/10 text-primary' : 'bg-surface text-muted'}`}
                    >
                      {user.membership_tier}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted">
                    Joined {new Date(user.created_at).toLocaleDateString()}
                  </p>
                  <button
                    onClick={() => setDeleteConfirm(user)}
                    className="text-xs text-danger/70 hover:text-danger font-medium px-2 py-1 rounded-lg hover:bg-danger/5 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table view */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-3 w-8"></th>
                  <th className="px-4 py-3 font-medium text-muted">Name</th>
                  <th className="px-4 py-3 font-medium text-muted">Phone</th>
                  <th className="px-4 py-3 font-medium text-muted">Email</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Tier</th>
                  <th className="px-4 py-3 font-medium text-muted">Joined</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-3 py-3">
                      {user.auth_user_id === null && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(user.id)}
                          onChange={() => toggleSelect(user.id)}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium cursor-pointer hover:text-primary" onClick={() => openEdit(user)}>
                      {user.first_name || user.last_name ? `${user.first_name} ${user.last_name}`.trim() : <span className="text-muted italic">No name</span>}
                    </td>
                    <td className="px-4 py-3">{user.phone}</td>
                    <td className="px-4 py-3 text-muted">{user.email ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <UserStatusBadge user={user} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleTier(user)}
                        className={`text-xs px-2 py-1 rounded-full font-medium cursor-pointer hover:opacity-80 active:opacity-70 transition-opacity
                          ${user.membership_tier === 'pro' ? 'bg-primary/10 text-primary' : 'bg-surface text-muted'}`}
                      >
                        {user.membership_tier}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setDeleteConfirm(user)}
                        className="text-xs text-danger/70 hover:text-danger font-medium px-2 py-1 rounded-lg hover:bg-danger/5 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-muted mt-4">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>

      {/* Edit Name Modal */}
      {editUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => !saving && setEditUser(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[17px] font-bold text-foreground text-center mb-1">Edit Name</h3>
            <p className="text-[13px] text-muted text-center mb-4">{editUser.phone}</p>
            <div className="space-y-3">
              <input
                type="text"
                value={editFirst}
                onChange={(e) => setEditFirst(e.target.value)}
                placeholder="First name"
                autoFocus
                className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-[15px]
                           placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <input
                type="text"
                value={editLast}
                onChange={(e) => setEditLast(e.target.value)}
                placeholder="Last name"
                className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-[15px]
                           placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditUser(null)}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-surface text-foreground border border-border/50 active:opacity-80 transition-opacity disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-primary text-white active:opacity-80 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <h3 className="text-[17px] font-bold text-foreground">Delete User</h3>
              <p className="text-[14px] text-foreground/70 mt-2 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold">{deleteConfirm.first_name} {deleteConfirm.last_name}</span>?
              </p>
              <p className="text-[13px] text-muted mt-1.5">
                This will remove them from all groups, activities, and messages. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-surface text-foreground border border-border/50 active:opacity-80 transition-opacity disabled:opacity-50"
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
    </div>
  )
}
