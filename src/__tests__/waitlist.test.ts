import { promoteFromWaitlist } from '@/lib/waitlist'

// Notifications are side effects we don't want in a unit test — stub them out.
jest.mock('@/lib/sms', () => ({ sendSms: jest.fn(() => Promise.resolve()), isTestNumber: () => false }))
jest.mock('@/lib/alerts', () => ({ createAlert: jest.fn(() => Promise.resolve()) }))
jest.mock('@/lib/notification-templates', () => ({ renderTemplate: jest.fn(() => Promise.resolve({ title: 't', body: 'b' })) }))
jest.mock('@/lib/push', () => ({ hasReachablePush: jest.fn(() => Promise.resolve(false)) }))

// In-memory fake of the Supabase admin client (supports the ops waitlist uses,
// including count/head selects and ordered single()).
jest.mock('@/lib/supabase/admin', () => {
  const db: Record<string, Record<string, unknown>[]> = {}
  let idSeq = 1
  type Row = Record<string, unknown>
  class Query {
    private filters: [string, string, unknown][] = []
    private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
    private payload: Row | Row[] | null = null
    private opts: { onConflict?: string } = {}
    private lim: number | null = null
    private countMode = false
    private orderBy: { col: string; asc: boolean } | null = null
    constructor(private table: string) {}
    private rows(): Row[] { return (db[this.table] ??= []) }
    select(_c?: unknown, o?: { count?: string; head?: boolean }) { if (o?.count || o?.head) this.countMode = true; return this }
    order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending !== false }; return this }
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
        op === 'eq' ? r[c] === v : op === 'neq' ? r[c] !== v
          : op === 'lt' ? (r[c] as string) < (v as string)
          : op === 'in' ? (v as unknown[]).includes(r[c]) : true)
    }
    single() { return this.run(true) }
    maybeSingle() { return this.run(true) }
    then<T>(res: (v: unknown) => T) { return Promise.resolve(this.run(false)).then(res) }
    private run(single: boolean): { data: unknown; error: null; count?: number } {
      const rows = this.rows()
      if (this.op === 'select') {
        let out = rows.filter((r) => this.match(r))
        if (this.orderBy) {
          const { col, asc } = this.orderBy
          out = [...out].sort((a, b) => ((a[col] as string) < (b[col] as string) ? -1 : 1) * (asc ? 1 : -1))
        }
        if (this.countMode) return { data: null, count: out.length, error: null }
        if (this.lim != null) out = out.slice(0, this.lim)
        return { data: single ? (out[0] ?? null) : out, error: null }
      }
      if (this.op === 'insert') {
        const items = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((it) => ({ id: it.id ?? `id-${idSeq++}`, ...it }))
        rows.push(...items)
        return { data: single ? items[0] : items, error: null }
      }
      if (this.op === 'update') {
        const hit = rows.filter((r) => this.match(r))
        hit.forEach((r) => Object.assign(r, this.payload))
        return { data: hit, error: null }
      }
      if (this.op === 'upsert') {
        const keys = (this.opts.onConflict ?? '').split(',').map((s) => s.trim()).filter(Boolean)
        for (const it of (Array.isArray(this.payload) ? this.payload : [this.payload!])) {
          const ex = keys.length ? rows.find((r) => keys.every((k) => r[k] === it[k])) : undefined
          if (ex) Object.assign(ex, it); else rows.push({ id: it.id ?? `id-${idSeq++}`, ...it })
        }
        return { data: null, error: null }
      }
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

const mock = jest.requireMock('@/lib/supabase/admin') as {
  __db: Record<string, Record<string, unknown>[]>
  __reset: () => void
}
const db = mock.__db
const confirmedCount = (activityId: string) =>
  (db['whozin_activity_member'] ?? []).filter((m) => m.activity_id === activityId && m.status === 'confirmed').length

function seed(maxCapacity: number, confirmed: number, waitlist: { user_id: string; responded_at: string }[]) {
  db['whozin_activity'] = [{ id: 'act-1', activity_name: 'Pickleball', max_capacity: maxCapacity }]
  db['whozin_activity_member'] = [
    ...Array.from({ length: confirmed }, (_, i) => ({ id: `c${i}`, activity_id: 'act-1', user_id: `conf-${i}`, status: 'confirmed' })),
    ...waitlist.map((w, i) => ({ id: `w${i}`, activity_id: 'act-1', user_id: w.user_id, status: 'waitlist', responded_at: w.responded_at })),
  ]
  db['whozin_users'] = waitlist.map((w) => ({ id: w.user_id, phone: '', country_code: '1', text_notifications_enabled: false }))
}

beforeEach(() => mock.__reset())

describe('promoteFromWaitlist capacity guard', () => {
  test('does NOT promote when the activity is already full (the reported bug)', async () => {
    // 4 confirmed of 4, one person still on the wait list.
    seed(4, 4, [{ user_id: 'waiter-1', responded_at: '2026-07-07T10:00:00Z' }])
    const promoted = await promoteFromWaitlist('act-1')
    expect(promoted).toBe(false)
    expect(confirmedCount('act-1')).toBe(4) // stays at capacity — no 5th confirmed
    expect(db['whozin_activity_member'].find((m) => m.user_id === 'waiter-1')!.status).toBe('waitlist')
  })

  test('promotes the earliest wait-lister when a spot is open', async () => {
    seed(4, 3, [
      { user_id: 'later', responded_at: '2026-07-07T12:00:00Z' },
      { user_id: 'earliest', responded_at: '2026-07-07T09:00:00Z' },
    ])
    const promoted = await promoteFromWaitlist('act-1')
    expect(promoted).toBe(true)
    expect(confirmedCount('act-1')).toBe(4)
    // The earliest (by responded_at) is the one promoted.
    expect(db['whozin_activity_member'].find((m) => m.user_id === 'earliest')!.status).toBe('confirmed')
    expect(db['whozin_activity_member'].find((m) => m.user_id === 'later')!.status).toBe('waitlist')
  })

  test('returns false when nobody is on the wait list', async () => {
    seed(4, 2, [])
    expect(await promoteFromWaitlist('act-1')).toBe(false)
  })
})
