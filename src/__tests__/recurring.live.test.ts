/**
 * Live end-to-end check against the real Supabase database. Creates fully
 * isolated throwaway data (users + group + a recurring parent), runs the REAL
 * spawnNextDraft, asserts the group came through into the spawned draft, then
 * deletes everything it created. spawnNextDraft sends no SMS/push, so this is
 * safe to run against production.
 *
 * Skipped by default. Run explicitly:
 *   RUN_DB_TESTS=1 npx jest recurring.live
 */
import fs from 'fs'
import path from 'path'

// Load .env.local into process.env before anything reads it.
try {
  const envPath = path.resolve(process.cwd(), '.env.local')
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch { /* no .env.local — the guard below will skip */ }

const RUN = process.env.RUN_DB_TESTS === '1' && !!process.env.SUPABASE_SERVICE_ROLE_KEY
const d = RUN ? describe : describe.skip

d('spawnNextDraft (live DB)', () => {
  test('brings the whole group through into the spawned draft', async () => {
    // Import lazily so the mocked unit tests never touch the real client.
    const { getAdminClient } = await import('@/lib/supabase/admin')
    const { spawnNextDraft } = await import('@/lib/recurring')
    const admin = getAdminClient()

    const tag = `ZZTEST_${Date.now()}`
    const created: { table: string; ids: string[] }[] = []
    const track = (table: string, ids: string[]) => created.push({ table, ids })

    try {
      // 3 throwaway users (host + 2 friends).
      const { data: users } = await admin.from('whozin_users').insert(
        ['host', 'friendA', 'friendB'].map((r, i) => ({
          phone: `999000${Date.now().toString().slice(-4)}${i}`,
          country_code: '1',
          first_name: `${tag}_${r}`,
          last_name: 'Test',
          status: 'invited',
          membership_tier: 'free',
        })),
      ).select('id')
      const [host, friendA, friendB] = users!.map((u: { id: string }) => u.id)
      track('whozin_users', [host, friendA, friendB])

      // A group containing all three.
      const { data: group } = await admin.from('whozin_groups')
        .insert({ name: `${tag}_group`, creator_id: host }).select('id').single()
      track('whozin_groups', [group!.id])
      await admin.from('whozin_group_members').insert([
        { group_id: group!.id, user_id: host, priority_order: 0 },
        { group_id: group!.id, user_id: friendA, priority_order: 1 },
        { group_id: group!.id, user_id: friendB, priority_order: 2 },
      ])

      // A recurring parent that already happened (so the next occurrence is due).
      const { data: parent } = await admin.from('whozin_activity').insert({
        creator_id: host, group_id: group!.id,
        activity_type: 'sport', activity_name: `${tag}_Pickleball`,
        activity_date: '2026-01-01', activity_time: '18:00:00', duration_hours: 2,
        repeat_interval: 'weekly', status: 'full', priority_invite: true, max_capacity: 4,
      }).select('id').single()
      track('whozin_activity', [parent!.id])

      // ── Run the real code under test ─────────────────────────────────────
      const draftId = await spawnNextDraft(parent!.id)
      expect(draftId).toBeTruthy()
      track('whozin_activity', [draftId!])

      const { data: draft } = await admin.from('whozin_activity')
        .select('status, group_id, repeat_interval, parent_activity_id, activity_date')
        .eq('id', draftId!).single()
      const { data: members } = await admin.from('whozin_activity_member')
        .select('user_id, status').eq('activity_id', draftId!)

      // eslint-disable-next-line no-console
      console.log('LIVE spawned draft:', draft, 'members:', members)

      expect(draft!.status).toBe('draft')
      expect(draft!.group_id).toBe(group!.id)
      expect(draft!.repeat_interval).toBe('weekly')
      expect((draft!.activity_date as string) > '2026-01-01').toBe(true)

      const byUser = new Map((members as { user_id: string; status: string }[]).map((m) => [m.user_id, m.status]))
      expect(byUser.get(host)).toBe('confirmed')
      expect(byUser.get(friendA)).toBe('tbd')   // the group came through
      expect(byUser.get(friendB)).toBe('tbd')
    } finally {
      // Best-effort cleanup, children before parents.
      const activityIds = created.filter((c) => c.table === 'whozin_activity').flatMap((c) => c.ids)
      if (activityIds.length) {
        await admin.from('whozin_activity_member').delete().in('activity_id', activityIds)
        await admin.from('whozin_activity').delete().in('id', activityIds)
      }
      const groupIds = created.filter((c) => c.table === 'whozin_groups').flatMap((c) => c.ids)
      if (groupIds.length) {
        await admin.from('whozin_group_members').delete().in('group_id', groupIds)
        await admin.from('whozin_groups').delete().in('id', groupIds)
      }
      const userIds = created.filter((c) => c.table === 'whozin_users').flatMap((c) => c.ids)
      if (userIds.length) await admin.from('whozin_users').delete().in('id', userIds)
    }
  }, 30000)
})
