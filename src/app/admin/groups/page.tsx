'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface GroupRow {
  id: string
  name: string
  chat_enabled: boolean
  created_at: string
  creator: {
    first_name: string
    last_name: string
    phone: string
  } | null
  member_count: number
  activity_count: number
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: groupData } = await supabase
        .from('whozin_groups')
        .select(`
          id, name, chat_enabled, created_at, creator_id,
          whozin_users!whozin_groups_creator_id_fkey (
            first_name, last_name, phone
          )
        `)
        .order('created_at', { ascending: false })

      if (!groupData) {
        setLoading(false)
        return
      }

      const groupsWithCounts: GroupRow[] = await Promise.all(
        groupData.map(async (group) => {
          const [members, activities] = await Promise.all([
            supabase
              .from('whozin_group_members')
              .select('id', { count: 'exact', head: true })
              .eq('group_id', group.id),
            supabase
              .from('whozin_activity')
              .select('id', { count: 'exact', head: true })
              .eq('group_id', group.id),
          ])

          const creator = Array.isArray(group.whozin_users) ? group.whozin_users[0] : group.whozin_users

          return {
            id: group.id,
            name: group.name,
            chat_enabled: group.chat_enabled,
            created_at: group.created_at,
            creator: creator ?? null,
            member_count: members.count ?? 0,
            activity_count: activities.count ?? 0,
          }
        })
      )

      setGroups(groupsWithCounts)
      setLoading(false)
    }

    load()
  }, [])

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.creator && `${g.creator.first_name} ${g.creator.last_name}`.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold">Groups</h2>
        <input
          type="text"
          placeholder="Search groups..."
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
          {search ? 'No groups match your search.' : 'No groups yet.'}
        </div>
      ) : (
        <>
          {/* Mobile: Card view */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((group) => (
              <div key={group.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-base">{group.name}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      Created by {group.creator ? `${group.creator.first_name} ${group.creator.last_name}` : 'Unknown'}
                    </p>
                  </div>
                  <span className="text-xs text-muted">
                    {new Date(group.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center rounded-xl bg-surface py-2">
                    <p className="text-lg font-bold">{group.member_count}</p>
                    <p className="text-xs text-muted">Members</p>
                  </div>
                  <div className="text-center rounded-xl bg-surface py-2">
                    <p className="text-lg font-bold">{group.activity_count}</p>
                    <p className="text-xs text-muted">Activities</p>
                  </div>
                  <div className="text-center rounded-xl bg-surface py-2">
                    <p className="text-lg font-bold">{group.chat_enabled ? 'On' : 'Off'}</p>
                    <p className="text-xs text-muted">Chat</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table view */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted">Group</th>
                  <th className="px-4 py-3 font-medium text-muted">Created By</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Members</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Activities</th>
                  <th className="px-4 py-3 font-medium text-muted text-center">Chat</th>
                  <th className="px-4 py-3 font-medium text-muted">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((group) => (
                  <tr key={group.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium">{group.name}</td>
                    <td className="px-4 py-3">
                      {group.creator ? (
                        <div>
                          <p>{group.creator.first_name} {group.creator.last_name}</p>
                          <p className="text-xs text-muted">{group.creator.phone}</p>
                        </div>
                      ) : (
                        <span className="text-muted">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">{group.member_count}</td>
                    <td className="px-4 py-3 text-center">{group.activity_count}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium
                        ${group.chat_enabled ? 'bg-success/10 text-success' : 'bg-surface text-muted'}`}>
                        {group.chat_enabled ? 'On' : 'Off'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{new Date(group.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-muted mt-4">{filtered.length} group{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
