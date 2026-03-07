'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ActivityRow {
  id: string
  activity_name: string
  activity_type: string
  activity_date: string | null
  status: string
  max_capacity: number | null
  capacity_current: number
  created_at: string
  creator: {
    first_name: string
    last_name: string
  } | null
  group: {
    name: string
  } | null
  member_count: number
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data } = await supabase
        .from('whozin_activity')
        .select(`
          id, activity_name, activity_type, activity_date, status,
          max_capacity, capacity_current, created_at, creator_id, group_id,
          whozin_users!whozin_activity_creator_id_fkey ( first_name, last_name ),
          whozin_groups!whozin_activity_group_id_fkey ( name )
        `)
        .order('created_at', { ascending: false })

      if (!data) {
        setLoading(false)
        return
      }

      const activitiesWithCounts: ActivityRow[] = await Promise.all(
        data.map(async (a) => {
          const { count } = await supabase
            .from('whozin_activity_member')
            .select('id', { count: 'exact', head: true })
            .eq('activity_id', a.id)

          const creator = Array.isArray(a.whozin_users) ? a.whozin_users[0] : a.whozin_users
          const group = Array.isArray(a.whozin_groups) ? a.whozin_groups[0] : a.whozin_groups

          return {
            id: a.id,
            activity_name: a.activity_name,
            activity_type: a.activity_type,
            activity_date: a.activity_date,
            status: a.status,
            max_capacity: a.max_capacity,
            capacity_current: a.capacity_current,
            created_at: a.created_at,
            creator: creator ?? null,
            group: group ?? null,
            member_count: count ?? 0,
          }
        })
      )

      setActivities(activitiesWithCounts)
      setLoading(false)
    }

    load()
  }, [])

  const filtered = activities.filter((a) => {
    const matchesSearch =
      a.activity_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.group?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusColors: Record<string, string> = {
    open: 'bg-success/10 text-success',
    full: 'bg-primary/10 text-primary',
    past: 'bg-surface text-muted',
    cancelled: 'bg-danger/10 text-danger',
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold">Activities</h2>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-border bg-background text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="full">Full</option>
            <option value="past">Past</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 px-4 rounded-xl border border-border bg-background text-sm
                       placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                       focus:border-primary w-full sm:w-48"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted">
          {search || statusFilter !== 'all' ? 'No activities match your filters.' : 'No activities yet.'}
        </div>
      ) : (
        <>
          {/* Mobile: Card view */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-base">{a.activity_name}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      {a.group?.name ?? 'No group'} &middot; {a.activity_type}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[a.status] ?? 'bg-surface text-muted'}`}>
                    {a.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center rounded-xl bg-surface py-2">
                    <p className="text-lg font-bold">{a.member_count}</p>
                    <p className="text-xs text-muted">Responses</p>
                  </div>
                  <div className="text-center rounded-xl bg-surface py-2">
                    <p className="text-lg font-bold">{a.capacity_current}</p>
                    <p className="text-xs text-muted">Confirmed</p>
                  </div>
                  <div className="text-center rounded-xl bg-surface py-2">
                    <p className="text-lg font-bold">{a.max_capacity ?? '--'}</p>
                    <p className="text-xs text-muted">Max</p>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-3 text-xs text-muted">
                  <span>{a.creator ? `${a.creator.first_name} ${a.creator.last_name}` : 'Unknown'}</span>
                  <span>{a.activity_date ? new Date(a.activity_date).toLocaleDateString() : 'No date'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table view */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted">Activity</th>
                  <th className="px-4 py-3 font-medium text-muted">Group</th>
                  <th className="px-4 py-3 font-medium text-muted">Created By</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Responses</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Capacity</th>
                  <th className="px-4 py-3 font-medium text-muted">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{a.activity_name}</p>
                      <p className="text-xs text-muted">{a.activity_type}</p>
                    </td>
                    <td className="px-4 py-3">{a.group?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {a.creator ? `${a.creator.first_name} ${a.creator.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[a.status] ?? 'bg-surface text-muted'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{a.member_count}</td>
                    <td className="px-4 py-3 text-center">
                      {a.capacity_current}{a.max_capacity ? `/${a.max_capacity}` : ''}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {a.activity_date ? new Date(a.activity_date).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-muted mt-4">{filtered.length} activit{filtered.length !== 1 ? 'ies' : 'y'}</p>
    </div>
  )
}
