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
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch('/api/admin/users')
      .then((res) => res.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = users.filter((u) =>
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search) ||
    (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
  )

  async function toggleTier(user: UserRow) {
    const newTier = user.membership_tier === 'pro' ? 'free' : 'pro'
    // Optimistic update
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, membership_tier: newTier } : u))
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, membership_tier: newTier }),
    })
    if (!res.ok) {
      // Revert on failure
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
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
                  <div>
                    <h3 className="font-semibold">{user.first_name} {user.last_name}</h3>
                    <p className="text-sm text-muted mt-0.5">{user.phone}</p>
                    {user.email && <p className="text-sm text-muted">{user.email}</p>}
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium
                      ${user.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}>
                      {user.status}
                    </span>
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
                    <td className="px-4 py-3 font-medium">{user.first_name} {user.last_name}</td>
                    <td className="px-4 py-3">{user.phone}</td>
                    <td className="px-4 py-3 text-muted">{user.email ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium
                        ${user.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}>
                        {user.status}
                      </span>
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
