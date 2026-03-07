'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserRow {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  status: string
  membership_tier: string
  created_at: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('whozin_users')
        .select('id, first_name, last_name, phone, email, status, membership_tier, created_at')
        .order('created_at', { ascending: false })

      setUsers(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = users.filter((u) =>
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search) ||
    (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
  )

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
                    <span className={`text-xs px-2 py-1 rounded-full font-medium
                      ${user.membership_tier === 'pro' ? 'bg-primary/10 text-primary' : 'bg-surface text-muted'}`}>
                      {user.membership_tier}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted mt-2">
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </p>
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
                      <span className={`text-xs px-2 py-1 rounded-full font-medium
                        ${user.membership_tier === 'pro' ? 'bg-primary/10 text-primary' : 'bg-surface text-muted'}`}>
                        {user.membership_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{new Date(user.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-muted mt-4">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
