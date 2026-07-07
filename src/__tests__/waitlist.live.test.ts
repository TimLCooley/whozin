/**
 * Live check against the real Supabase DB for the "wait-lister drops → someone
 * gets over-promoted past capacity" bug. Reproduces a FULL activity with people
 * still on the wait list and asserts the real promoteFromWaitlist refuses to
 * promote (no 5th confirmed). Creates isolated throwaway data and cleans up.
 * promoteFromWaitlist sends nothing when it declines to promote, so this is safe.
 *
 * Skipped by default. Run explicitly:  RUN_DB_TESTS=1 npx jest waitlist.live
 */
import fs from 'fs'
import path from 'path'

try {
  const envPath = path.resolve(process.cwd(), '.env.local')
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch { /* skip below if unset */ }

const RUN = process.env.RUN_DB_TESTS === '1' && !!process.env.SUPABASE_SERVICE_ROLE_KEY
const d = RUN ? describe : describe.skip

d('promoteFromWaitlist (live DB)', () => {
  test('a full activity does not over-promote from the wait list', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin')
    const { promoteFromWaitlist } = await import('@/lib/waitlist')
    const admin = getAdminClient()

    const tag = `ZZTEST_${Date.now()}`
    let activityId: string | null = null
    let groupId: string | null = null
    let userIds: string[] = []

    try {
      // 6 throwaway users: host + 5 players.
      const { data: users } = await admin.from('whozin_users').insert(
        Array.from({ length: 6 }, (_, i) => ({
          phone: `999100${Date.now().toString().slice(-4)}${i}`,
          country_code: '1', first_name: `${tag}_u${i}`, last_name: 'Test',
          status: 'invited', membership_tier: 'free', text_notifications_enabled: false,
        })),
      ).select('id')
      userIds = users!.map((u: { id: string }) => u.id)

      const { data: group } = await admin.from('whozin_groups')
        .insert({ name: `${tag}_g`, creator_id: userIds[0] }).select('id').single()
      groupId = group!.id

      // FULL activity: capacity 4, 4 confirmed, 2 on the wait list.
      const { data: act } = await admin.from('whozin_activity').insert({
        creator_id: userIds[0], group_id: groupId, activity_type: 'sport',
        activity_name: `${tag}_Pickleball`, activity_date: '2026-08-01', activity_time: '18:00:00',
        status: 'full', max_capacity: 4, waitlist_enabled: true, priority_invite: true,
      }).select('id').single()
      activityId = act!.id

      await admin.from('whozin_activity_member').insert([
        ...userIds.slice(0, 4).map((uid) => ({ activity_id: activityId, user_id: uid, status: 'confirmed' })),
        { activity_id: activityId, user_id: userIds[4], status: 'waitlist', responded_at: '2026-07-07T10:00:00Z' },
        { activity_id: activityId, user_id: userIds[5], status: 'waitlist', responded_at: '2026-07-07T11:00:00Z' },
      ])

      // ── Real code under test: this must NOT promote (already full). ───────
      const promoted = await promoteFromWaitlist(activityId!)

      const { count: confirmedNow } = await admin.from('whozin_activity_member')
        .select('id', { count: 'exact', head: true }).eq('activity_id', activityId!).eq('status', 'confirmed')
      // eslint-disable-next-line no-console
      console.log('LIVE promoteFromWaitlist returned:', promoted, '| confirmed after:', confirmedNow)

      expect(promoted).toBe(false)
      expect(confirmedNow).toBe(4) // still 4 — never 5
    } finally {
      if (activityId) {
        await admin.from('whozin_activity_member').delete().eq('activity_id', activityId)
        await admin.from('whozin_activity').delete().eq('id', activityId)
      }
      if (groupId) {
        await admin.from('whozin_group_members').delete().eq('group_id', groupId)
        await admin.from('whozin_groups').delete().eq('id', groupId)
      }
      if (userIds.length) await admin.from('whozin_users').delete().in('id', userIds)
    }
  }, 30000)
})
