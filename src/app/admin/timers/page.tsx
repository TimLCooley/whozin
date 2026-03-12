'use client'

import { useState, useEffect, useCallback } from 'react'

interface TimerOption {
  id: string
  value: number
  label: string
  pro_fill: boolean    // requires pro in Fill a Spot
  pro_group: boolean   // requires pro in Build Group
  test_only: boolean
  modes: ('fill' | 'group')[]
  enabled: boolean
}

const DEFAULT_TIMERS: TimerOption[] = [
  { id: 'test-10s', value: 0.167, label: '10 sec (test)', pro_fill: false, pro_group: false, test_only: true, modes: ['fill', 'group'], enabled: true },
  { id: 'free-5m', value: 5, label: '5 min', pro_fill: false, pro_group: false, test_only: false, modes: ['fill', 'group'], enabled: true },
  { id: 'pro-15m', value: 15, label: '15 min', pro_fill: true, pro_group: true, test_only: false, modes: ['fill', 'group'], enabled: true },
  { id: 'pro-30m', value: 30, label: '30 min', pro_fill: true, pro_group: true, test_only: false, modes: ['fill', 'group'], enabled: true },
  { id: 'pro-1h', value: 60, label: '1 hour', pro_fill: true, pro_group: true, test_only: false, modes: ['fill', 'group'], enabled: true },
  { id: 'pro-2h', value: 120, label: '2 hours', pro_fill: true, pro_group: true, test_only: false, modes: ['fill', 'group'], enabled: true },
]

export default function TimersPage() {
  const [timers, setTimers] = useState<TimerOption[]>(DEFAULT_TIMERS)
  const [defaultFill, setDefaultFill] = useState('free-5m')
  const [defaultGroup, setDefaultGroup] = useState('free-5m')
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    value: '', label: '', pro_fill: false, pro_group: false, test_only: false,
    modes: ['fill', 'group'] as ('fill' | 'group')[],
  })

  const loadTimers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        const raw = data.response_timers
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (Array.isArray(parsed) && parsed.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const migrated = parsed.map((t: any) => {
              if ('pro' in t && !('pro_fill' in t)) {
                return { ...t, pro_fill: t.pro, pro_group: t.pro, pro: undefined }
              }
              return t
            }) as TimerOption[]
            setTimers(migrated)
          }
        }
        if (data.default_timer_fill) setDefaultFill(data.default_timer_fill)
        if (data.default_timer_group) setDefaultGroup(data.default_timer_group)
      }
    } catch { /* use defaults */ }
  }, [])

  useEffect(() => { loadTimers() }, [loadTimers])

  async function saveTimers(updated: TimerOption[]) {
    setSaving(true)
    setTimers(updated)
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_timers: JSON.stringify(updated) }),
    })
    setSaving(false)
  }

  async function saveDefault(mode: 'fill' | 'group', timerId: string) {
    const key = mode === 'fill' ? 'default_timer_fill' : 'default_timer_group'
    if (mode === 'fill') setDefaultFill(timerId)
    else setDefaultGroup(timerId)
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: timerId }),
    })
  }

  function openAdd() {
    setEditingId(null)
    setForm({ value: '', label: '', pro_fill: false, pro_group: false, test_only: false, modes: ['fill', 'group'] })
    setShowAdd(true)
  }

  function openEdit(timer: TimerOption) {
    setEditingId(timer.id)
    setForm({
      value: String(timer.value),
      label: timer.label,
      pro_fill: timer.pro_fill,
      pro_group: timer.pro_group,
      test_only: timer.test_only,
      modes: [...timer.modes],
    })
    setShowAdd(true)
  }

  function handleSave() {
    const val = parseFloat(form.value)
    if (!form.label.trim() || isNaN(val) || val <= 0) {
      alert('Please enter a valid label and time value')
      return
    }
    if (form.modes.length === 0) {
      alert('Select at least one mode')
      return
    }

    if (editingId) {
      const updated = timers.map((t) =>
        t.id === editingId
          ? { ...t, value: val, label: form.label.trim(), pro_fill: form.pro_fill, pro_group: form.pro_group, test_only: form.test_only, modes: form.modes }
          : t
      )
      saveTimers(updated)
    } else {
      const id = `custom-${Date.now()}`
      const newTimer: TimerOption = {
        id, value: val, label: form.label.trim(),
        pro_fill: form.pro_fill, pro_group: form.pro_group,
        test_only: form.test_only, modes: form.modes, enabled: true,
      }
      saveTimers([...timers, newTimer])
    }
    setShowAdd(false)
    setEditingId(null)
  }

  function toggleEnabled(id: string) {
    saveTimers(timers.map((t) => t.id === id ? { ...t, enabled: !t.enabled } : t))
  }

  function removeTimer(id: string) {
    if (!confirm('Remove this timer?')) return
    saveTimers(timers.filter((t) => t.id !== id))
  }

  function resetDefaults() {
    if (!confirm('Reset all timers to defaults?')) return
    saveTimers(DEFAULT_TIMERS)
  }

  function toggleMode(mode: 'fill' | 'group') {
    setForm((prev) => ({
      ...prev,
      modes: prev.modes.includes(mode) ? prev.modes.filter((m) => m !== mode) : [...prev.modes, mode],
    }))
  }

  function formatValue(v: number): string {
    if (v < 1) return `${Math.round(v * 60)}s`
    if (v >= 60) return `${v / 60}h`
    return `${v}m`
  }

  const enabledCount = timers.filter((t) => t.enabled).length

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Response Timers</h2>
          <p className="text-sm text-muted mt-1">
            {enabledCount} of {timers.length} timers active · These appear when users set response time per invite
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAdd}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors">
            + Add Timer
          </button>
          <button onClick={resetDefaults}
            className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground hover:border-foreground/30 transition-colors">
            Reset Defaults
          </button>
        </div>
      </div>

      {saving && (
        <div className="mb-3 text-xs text-primary font-medium flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Saving...
        </div>
      )}

      {/* Timers list */}
      <div className="space-y-2">
        {timers.map((timer) => (
          <div
            key={timer.id}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              timer.enabled
                ? 'bg-background border-primary/20 shadow-[0_1px_4px_rgba(66,133,244,0.08)]'
                : 'bg-surface/50 border-border/40 opacity-60'
            }`}
          >
            {/* Time badge */}
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-primary">{formatValue(timer.value)}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] font-bold text-foreground">{timer.label}</h3>
                {timer.test_only && (
                  <span className="px-1.5 py-0.5 rounded-md bg-red-100 text-red-600 text-[10px] font-bold uppercase">Test</span>
                )}
                {defaultFill === timer.id && timer.modes.includes('fill') && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[#34c759]/15 text-[#34c759] text-[10px] font-bold uppercase">Default Fill</span>
                )}
                {defaultGroup === timer.id && timer.modes.includes('group') && (
                  <span className="px-1.5 py-0.5 rounded-md bg-primary/15 text-primary text-[10px] font-bold uppercase">Default Group</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {timer.modes.includes('fill') && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    timer.pro_fill
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-[#34c759]/10 text-[#34c759]'
                  }`}>
                    Fill {timer.pro_fill ? '(Pro)' : '(Free)'}
                  </span>
                )}
                {timer.modes.includes('group') && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    timer.pro_group
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    Group {timer.pro_group ? '(Pro)' : '(Free)'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted mt-0.5">{timer.value} minute{timer.value !== 1 ? 's' : ''}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => openEdit(timer)}
                className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-muted hover:text-foreground transition-colors"
                title="Edit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button onClick={() => toggleEnabled(timer.id)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  timer.enabled ? 'bg-primary/10 text-primary' : 'bg-surface text-muted'
                }`}
                title={timer.enabled ? 'Disable' : 'Enable'}>
                {timer.enabled ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                )}
              </button>
              <button onClick={() => removeTimer(timer.id)}
                className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-muted hover:text-danger transition-colors"
                title="Remove">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Default Timer Selectors */}
      {timers.length > 0 && (
        <div className="mt-6 p-4 rounded-2xl border border-border/50 bg-surface/30">
          <h3 className="text-sm font-bold text-foreground mb-3">Default Timers</h3>
          <p className="text-[11px] text-muted mb-3">The pre-selected timer when a user creates an activity.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#34c759] mb-1">Fill a Spot</label>
              <select
                value={defaultFill}
                onChange={(e) => saveDefault('fill', e.target.value)}
                className="input-field text-sm w-full"
              >
                {timers
                  .filter((t) => t.enabled && t.modes.includes('fill') && !t.test_only)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.label}{t.pro_fill ? ' (Pro)' : ''}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-primary mb-1">Build Group</label>
              <select
                value={defaultGroup}
                onChange={(e) => saveDefault('group', e.target.value)}
                className="input-field text-sm w-full"
              >
                {timers
                  .filter((t) => t.enabled && t.modes.includes('group') && !t.test_only)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.label}{t.pro_group ? ' (Pro)' : ''}</option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {timers.length === 0 && (
        <div className="text-center py-12 text-muted">
          <p className="text-lg font-semibold mb-1">No timers configured</p>
          <p className="text-sm">Add a timer or reset to defaults.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowAdd(false); setEditingId(null) }}>
          <div className="bg-background rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit Timer' : 'Add Timer'}</h3>

            <div className="mb-3">
              <label className="block text-sm font-medium text-muted mb-1">Label</label>
              <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. 5 min" className="input-field" autoFocus />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-muted mb-1">Value (minutes)</label>
              <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="e.g. 5, 0.167 for 10 sec" className="input-field" step="any" min="0" />
              <p className="text-[11px] text-muted mt-1">Use decimals for seconds (0.167 = 10 sec)</p>
            </div>

            {/* Mode toggles with per-mode Pro checkboxes */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-muted mb-2">Available In</label>
              <div className="space-y-2">
                {/* Fill a Spot */}
                <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  form.modes.includes('fill')
                    ? 'bg-[#34c759]/5 border-[#34c759]/30'
                    : 'bg-surface/50 border-border/50'
                }`}>
                  <button type="button" onClick={() => toggleMode('fill')}
                    className="flex items-center gap-2 flex-1">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      form.modes.includes('fill') ? 'bg-[#34c759] border-[#34c759]' : 'border-border'
                    }`}>
                      {form.modes.includes('fill') && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[13px] font-semibold">Fill a Spot</span>
                  </button>
                  {form.modes.includes('fill') && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.pro_fill}
                        onChange={(e) => setForm({ ...form, pro_fill: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-border accent-amber-500" />
                      <span className="text-[11px] font-bold text-amber-600">Pro</span>
                    </label>
                  )}
                </div>

                {/* Build Group */}
                <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  form.modes.includes('group')
                    ? 'bg-primary/5 border-primary/30'
                    : 'bg-surface/50 border-border/50'
                }`}>
                  <button type="button" onClick={() => toggleMode('group')}
                    className="flex items-center gap-2 flex-1">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      form.modes.includes('group') ? 'bg-primary border-primary' : 'border-border'
                    }`}>
                      {form.modes.includes('group') && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[13px] font-semibold">Build Group</span>
                  </button>
                  {form.modes.includes('group') && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={form.pro_group}
                        onChange={(e) => setForm({ ...form, pro_group: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-border accent-amber-500" />
                      <span className="text-[11px] font-bold text-amber-600">Pro</span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.test_only}
                  onChange={(e) => setForm({ ...form, test_only: e.target.checked })}
                  className="w-4 h-4 rounded border-border accent-red-500" />
                <span className="text-sm font-medium">Test Only (999)</span>
              </label>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAdd(false); setEditingId(null) }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted">
                Cancel
              </button>
              <button onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold">
                {editingId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
