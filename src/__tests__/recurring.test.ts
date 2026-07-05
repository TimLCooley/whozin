import { nextDateFor, nextFutureDate, spawnNextDraft, cleanupStaleDrafts } from '@/lib/recurring'

// ── In-memory fake of the Supabase admin client ─────────────────────────────
// Supports just the chainable operations the recurring code uses, backed by
// plain arrays so we can assert on the resulting rows. Exposed via __db so
// tests can seed and inspect the "database".
jest.mock('@/lib/supabase/admin', () => {
  const db: Record<string, Record<string, unknown>[]> = {}
  let idSeq = 1
  const genId = () => `id-${idSeq++}`

  type Row = Record<string, unknown>
  class Query {
    private filters: [string, string, unknown][] = []
    private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
    private payload: Row | Row[] | null = null
    private opts: { onConflict?: string } = {}
    private lim: number | null = null
    constructor(private table: string) {}
    private rows(): Row[] { return (db[this.table] ??= []) }
    select() { return this }
    order() { return this }
    limit(n: number) { this.lim = n; return this }
    insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this }
    upsert(p: Row | Row[], opts?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.opts = opts ?? {}; return this }
    update(p: Row) { this.op = 'update'; this.payload = p; return this }
    delete() { this.op = 'delete'; return this }
    eq(c: string, v: unknown) { this.filters.push(['eq', c, v]); return this }
    neq(c: string, v: unknown) { this.filters.push(['neq', c, v]); return this }
    lt(c: string, v: unknown) { this.filters.push(['lt', c, v]); return this }
    in(c: string, v: unknown) { this.filters.push(['in', c, v]); return this }
    private match(r: Row) {
      return this.filters.every(([op, c, v]) =>
        op === 'eq' ? r[c] === v
          : op === 'neq' ? r[c] !== v
          : op === 'lt' ? (r[c] as string) < (v as string)
          : op === 'in' ? (v as unknown[]).includes(r[c])
          : true)
    }
    single() { return this.run(true) }
    maybeSingle() { return this.run(true) }
    then<T>(res: (v: { data: unknown; error: null }) => T) { return Promise.resolve(this.run(false)).then(res) }
    private run(single: boolean): { data: unknown; error: null } {
      const rows = this.rows()
      if (this.op === 'select') {
        let out = rows.filter((r) => this.match(r))
        if (this.lim != null) out = out.slice(0, this.lim)
        return { data: single ? (out[0] ?? null) : out, error: null }
      }
      if (this.op === 'insert') {
        const items = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((it) => ({ id: it.id ?? genId(), ...it }))
        rows.push(...items)
        return { data: single ? items[0] : items, error: null }
      }
      if (this.op === 'upsert') {
        const keys = (this.opts.onConflict ?? '').split(',').map((s) => s.trim()).filter(Boolean)
        const items = Array.isArray(this.payload) ? this.payload : [this.payload!]
        for (const it of items) {
          const existing = keys.length ? rows.find((r) => keys.every((k) => r[k] === it[k])) : undefined
          if (existing) Object.assign(existing, it)
          else rows.push({ id: it.id ?? genId(), ...it })
        }
        return { data: items, error: null }
      }
      if (this.op === 'update') {
        const hit = rows.filter((r) => this.match(r))
        hit.forEach((r) => Object.assign(r, this.payload))
        return { data: hit, error: null }
      }
      // delete
      db[this.table] = rows.filter((r) => !this.match(r))
      return { data: null, error: null }
    }
  }

  return {
    getAdminClient: () => ({ from: (t: string) => new Query(t) }),
    __db: db,
    __reset: () => { for (const k of Object.keys(db)) delete db[k] },
  }
})

// Handles to the fake DB.
const admin = jest.requireMock('@/lib/supabase/admin') as {
  __db: Record<string, Record<string, unknown>[]>
  __reset: () => void
}
const db = admin.__db
const membersOf = (activityId: string) =>
  (db['whozin_activity_member'] ?? []).filter((m) => m.activity_id === activityId)

beforeEach(() => admin.__reset())

// ── Pure date helpers ───────────────────────────────────────────────────────
describe('nextDateFor', () => {
  test('weekly adds 7 days', () => expect(nextDateFor('2026-07-01', 'weekly')).toBe('2026-07-08'))
  test('biweekly adds 14 days', () => expect(nextDateFor('2026-07-01', 'biweekly')).toBe('2026-07-15'))
  test('monthly keeps day-of-month', () => expect(nextDateFor('2026-07-15', 'monthly')).toBe('2026-08-15'))
  test('monthly clamps to end of shorter month', () => expect(nextDateFor('2026-01-31', 'monthly')).toBe('2026-02-28'))
  test('none returns null', () => expect(nextDateFor('2026-07-01', 'none')).toBeNull())
})

describe('nextFutureDate', () => {
  test('advances at least one interval', () =>
    expect(nextFutureDate('2026-07-01', 'weekly', '2026-07-01')).toBe('2026-07-08'))
  test('rolls forward past a big gap to a future date', () => {
    // Started 2026-01-01 weekly, "today" is 2026-03-01 → first occurrence >= today
    const next = nextFutureDate('2026-01-01', 'weekly', '2026-03-01')
    expect(next).not.toBeNull()
    expect(next! >= '2026-03-01').toBe(true)
  })
})

// ── The core fix: spawned draft carries the group ───────────────────────────
describe('spawnNextDraft', () => {
  function seedRecurringParent() {
    db['whozin_activity'] = [{
      id: 'parent-1', creator_id: 'host-1', group_id: 'group-1',
      activity_name: 'Pickleball', activity_type: 'sport',
      activity_date: '2026-01-01', activity_time: '18:00:00', duration_hours: 2,
      repeat_interval: 'weekly', status: 'full', priority_invite: true,
      location: 'Court', max_capacity: 4,
    }]
    db['whozin_group_members'] = [
      { group_id: 'group-1', user_id: 'host-1', priority_order: 0 },
      { group_id: 'group-1', user_id: 'friend-a', priority_order: 1 },
      { group_id: 'group-1', user_id: 'friend-b', priority_order: 2 },
    ]
    db['whozin_activity_member'] = []
  }

  test('spawns a future draft that copies group + repeat interval', async () => {
    seedRecurringParent()
    const draftId = await spawnNextDraft('parent-1')
    expect(draftId).toBeTruthy()
    const draft = db['whozin_activity'].find((a) => a.id === draftId)!
    expect(draft.status).toBe('draft')
    expect(draft.group_id).toBe('group-1')          // same group
    expect(draft.repeat_interval).toBe('weekly')    // chain continues
    expect(draft.parent_activity_id).toBe('parent-1')
    expect(draft.activity_date as string > '2026-01-01').toBe(true) // future
  })

  test('brings the group through into the draft (creator confirmed + group tbd)', async () => {
    seedRecurringParent()
    const draftId = (await spawnNextDraft('parent-1'))!
    const members = membersOf(draftId)
    // Host is confirmed; the two other group members are pre-loaded as tbd.
    expect(members.find((m) => m.user_id === 'host-1')?.status).toBe('confirmed')
    expect(members.find((m) => m.user_id === 'friend-a')?.status).toBe('tbd')
    expect(members.find((m) => m.user_id === 'friend-b')?.status).toBe('tbd')
    expect(members).toHaveLength(3) // the whole group came through
  })

  test('is idempotent — no duplicate draft if a child already exists', async () => {
    seedRecurringParent()
    db['whozin_activity'].push({ id: 'existing-child', parent_activity_id: 'parent-1', status: 'draft' })
    const before = db['whozin_activity'].length
    const result = await spawnNextDraft('parent-1')
    expect(result).toBeNull()
    expect(db['whozin_activity'].length).toBe(before) // nothing added
  })

  test('non-recurring parent does not spawn', async () => {
    seedRecurringParent()
    db['whozin_activity'][0].repeat_interval = 'none'
    expect(await spawnNextDraft('parent-1')).toBeNull()
  })
})

// ── Chain survival: a missed draft rolls forward, it is not deleted ──────────
describe('cleanupStaleDrafts', () => {
  test('rolls a stale recurring draft forward instead of killing the series', async () => {
    db['whozin_activity'] = [{
      id: 'draft-1', creator_id: 'host-1', status: 'draft',
      activity_date: '2026-06-01', repeat_interval: 'weekly',
    }]
    await cleanupStaleDrafts('host-1', '2026-07-05')
    const draft = db['whozin_activity'].find((a) => a.id === 'draft-1')
    expect(draft).toBeTruthy()                       // NOT deleted
    expect(draft!.activity_date as string >= '2026-07-05').toBe(true) // rolled to future
    expect(draft!.repeat_interval).toBe('weekly')    // still recurring
  })

  test('deletes a stale draft that no longer repeats', async () => {
    db['whozin_activity'] = [{
      id: 'draft-2', creator_id: 'host-1', status: 'draft',
      activity_date: '2026-06-01', repeat_interval: 'none',
    }]
    await cleanupStaleDrafts('host-1', '2026-07-05')
    expect(db['whozin_activity'].find((a) => a.id === 'draft-2')).toBeUndefined()
  })
})
