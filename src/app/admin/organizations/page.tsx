'use client'

import { useEffect, useState } from 'react'

interface OrgRow {
  id: string
  name: string
  created_at: string
  owner: {
    first_name: string
    last_name: string
    phone: string
    email: string | null
  } | null
  member_count: number
  group_count: number
  activity_count: number
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/organizations')
      .then((res) => res.json())
      .then((data) => {
        setOrgs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = orgs.filter((org) =>
    org.name.toLowerCase().includes(search.toLowerCase()) ||
    (org.owner && `${org.owner.first_name} ${org.owner.last_name}`.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold">Organizations</h2>
        <input
          type="text"
          placeholder="Search organizations..."
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
          {search ? 'No organizations match your search.' : 'No organizations yet.'}
        </div>
      ) : (
        <>
          {/* Mobile: Card view */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((org) => (
              <div key={org.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-base">{org.name}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      Owner: {org.owner ? `${org.owner.first_name} ${org.owner.last_name}` : 'Unknown'}
                    </p>
                  </div>
                  <span className="text-xs text-muted">
                    {new Date(org.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center rounded-xl bg-surface py-2">
                    <p className="text-lg font-bold">{org.member_count}</p>
                    <p className="text-xs text-muted">Members</p>
                  </div>
                  <div className="text-center rounded-xl bg-surface py-2">
                    <p className="text-lg font-bold">{org.group_count}</p>
                    <p className="text-xs text-muted">Groups</p>
                  </div>
                  <div className="text-center rounded-xl bg-surface py-2">
                    <p className="text-lg font-bold">{org.activity_count}</p>
                    <p className="text-xs text-muted">Activities</p>
                  </div>
                </div>
                {org.owner && (
                  <p className="text-xs text-muted mt-3">
                    {org.owner.phone}
                    {org.owner.email && ` | ${org.owner.email}`}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: Table view */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted">Organization</th>
                  <th className="px-4 py-3 font-medium text-muted">Owner</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Members</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Groups</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Activities</th>
                  <th className="px-4 py-3 font-medium text-muted">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((org) => (
                  <tr key={org.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium">{org.name}</td>
                    <td className="px-4 py-3">
                      {org.owner ? (
                        <div>
                          <p>{org.owner.first_name} {org.owner.last_name}</p>
                          <p className="text-xs text-muted">{org.owner.phone}</p>
                        </div>
                      ) : (
                        <span className="text-muted">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">{org.member_count}</td>
                    <td className="px-4 py-3 text-center">{org.group_count}</td>
                    <td className="px-4 py-3 text-center">{org.activity_count}</td>
                    <td className="px-4 py-3 text-muted">{new Date(org.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-muted mt-4">{filtered.length} organization{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
