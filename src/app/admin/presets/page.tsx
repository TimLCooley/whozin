'use client'

import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_ACTIVITY_PRESETS, ACTIVITY_CATEGORIES, suggestEmoji, type ActivityPreset } from '@/lib/activity-presets'

export default function PresetsPage() {
  const [presets, setPresets] = useState<ActivityPreset[]>(DEFAULT_ACTIVITY_PRESETS)
  const [filter, setFilter] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newPreset, setNewPreset] = useState({ name: '', icon: '', category: 'Sports', image_url: '' })
  const [emojiManual, setEmojiManual] = useState(false)
  const [editingImage, setEditingImage] = useState<string | null>(null)
  const [editImageUrl, setEditImageUrl] = useState('')
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')

  // Load saved presets from admin settings
  const loadPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        const raw = data.activity_presets
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPresets(parsed)
          }
        }
      }
    } catch { /* use defaults */ }
  }, [])

  useEffect(() => { loadPresets() }, [loadPresets])

  async function savePresets(updated: ActivityPreset[]) {
    setSaving(true)
    setPresets(updated)
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_presets: JSON.stringify(updated) }),
    })
    setSaving(false)
  }

  function togglePreset(id: string) {
    const updated = presets.map((p) =>
      p.id === id ? { ...p, enabled: !p.enabled } : p
    )
    savePresets(updated)
  }

  function removePreset(id: string) {
    if (!confirm('Remove this preset?')) return
    savePresets(presets.filter((p) => p.id !== id))
  }

  function handleAddPreset() {
    if (!newPreset.name.trim()) return
    const icon = newPreset.icon.trim() || suggestEmoji(newPreset.name) || '📌'
    const id = newPreset.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (presets.some((p) => p.id === id)) {
      alert('A preset with this name already exists')
      return
    }
    const preset: ActivityPreset = { id, name: newPreset.name.trim(), icon, category: newPreset.category, enabled: true }
    if (newPreset.image_url.trim()) preset.image_url = newPreset.image_url.trim()
    const updated = [...presets, preset]
    savePresets(updated)
    setNewPreset({ name: '', icon: '', category: 'Sports', image_url: '' })
    setShowAdd(false)
  }

  function startEditImage(preset: ActivityPreset) {
    setEditingImage(preset.id)
    setEditImageUrl(preset.image_url || '')
    setImagePrompt('')
  }

  function saveImageUrl(id: string) {
    const updated = presets.map((p) =>
      p.id === id ? { ...p, image_url: editImageUrl.trim() || undefined } : p
    )
    savePresets(updated)
    setEditingImage(null)
    setEditImageUrl('')
  }

  function resetToDefaults() {
    if (!confirm('Reset all presets to defaults? Custom presets will be removed.')) return
    savePresets(DEFAULT_ACTIVITY_PRESETS)
  }

  const categories = ['All', ...ACTIVITY_CATEGORIES]
  const enabledCount = presets.filter((p) => p.enabled).length

  const filtered = presets.filter((p) => {
    const matchesCategory = filter === 'All' || p.category === filter
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Activity Presets</h2>
          <p className="text-sm text-muted mt-1">
            {enabledCount} of {presets.length} presets active · These appear when users create activities
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowAdd(true); setEmojiManual(false); setNewPreset({ name: '', icon: '', category: 'Sports', image_url: '' }) }}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
          >
            + Add Preset
          </button>
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Search + Category filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search presets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 px-4 rounded-xl border border-border bg-background text-sm
                     placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                     focus:border-primary flex-1 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === cat
                  ? 'bg-primary text-white'
                  : 'bg-surface text-muted hover:text-foreground border border-border/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="mb-3 text-xs text-primary font-medium flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Saving...
        </div>
      )}

      {/* Presets grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map((preset) => (
          <div
            key={preset.id}
            className={`relative group rounded-2xl border overflow-hidden transition-all ${
              preset.enabled
                ? 'bg-background border-primary/20 shadow-[0_1px_4px_rgba(66,133,244,0.08)]'
                : 'bg-surface/50 border-border/40 opacity-60'
            }`}
          >
            {/* Image area */}
            <div
              className="relative aspect-video bg-surface cursor-pointer"
              onClick={() => startEditImage(preset)}
              title="Click to edit image"
            >
              {preset.image_url ? (
                <img src={preset.image_url} alt={preset.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl opacity-40">
                  {preset.icon}
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <span className="text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded-lg">
                  {preset.image_url ? 'Change Image' : 'Add Image'}
                </span>
              </div>
            </div>

            {/* Toggle + Remove buttons */}
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={() => removePreset(preset.id)}
                className="w-6 h-6 rounded-full bg-danger/80 text-white flex items-center justify-center hover:bg-danger"
                title="Remove"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Info */}
            <div className="p-3 text-center">
              <div className="text-2xl mb-1">{preset.icon}</div>
              <p className="text-[12px] font-semibold text-foreground mb-0.5 truncate">{preset.name}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider mb-2">{preset.category}</p>

              <button
                onClick={() => togglePreset(preset.id)}
                className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  preset.enabled
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'bg-surface text-muted hover:bg-border/50'
                }`}
              >
                {preset.enabled ? 'Active' : 'Disabled'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted mt-4">{filtered.length} preset{filtered.length !== 1 ? 's' : ''} shown</p>

      {/* Edit Image Modal */}
      {editingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingImage(null)}>
          <div className="bg-background rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Edit Image</h3>
            <p className="text-sm text-muted mb-4">{presets.find(p => p.id === editingImage)?.name}</p>

            {editImageUrl && (
              <div className="mb-3 rounded-xl overflow-hidden border border-border">
                <img src={editImageUrl} alt="Preview" className="w-full aspect-video object-cover" />
              </div>
            )}

            <div className="mb-3">
              <label className="block text-sm font-medium text-muted mb-1">Image URL</label>
              <input
                type="url"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="input-field text-sm"
                autoFocus
              />
              <p className="text-[11px] text-muted mt-1">Paste a URL or generate with AI. Leave empty to remove.</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-muted mb-1">AI Prompt</label>
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder={`e.g. "Friends playing ${presets.find(p => p.id === editingImage)?.name || 'sports'} outdoors, vibrant colors"`}
                rows={2}
                className="input-field text-sm resize-none mb-2"
              />
              <button
                onClick={async () => {
                  const name = presets.find(p => p.id === editingImage)?.name || 'activity'
                  const prompt = imagePrompt.trim() || `A vibrant, inviting photo for a group activity: ${name}. No text overlays.`
                  setGeneratingImage(true)
                  try {
                    const res = await fetch('/api/activities/generate-image', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ prompt }),
                    })
                    const data = await res.json()
                    if (res.ok && data.url) {
                      setEditImageUrl(data.url)
                      // Auto-save immediately so the image persists
                      const updated = presets.map((p) =>
                        p.id === editingImage ? { ...p, image_url: data.url } : p
                      )
                      await savePresets(updated)
                    }
                    else alert(data.error || 'Generation failed')
                  } catch { alert('Generation failed') }
                  setGeneratingImage(false)
                }}
                disabled={generatingImage}
                className="w-full py-2.5 rounded-xl border border-primary/40 text-primary text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/5 disabled:opacity-60"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                {generatingImage ? 'Generating...' : 'Generate'}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingImage(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => saveImageUrl(editingImage)}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Preset Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/40" onClick={() => setShowAdd(false)}>
          <div
            className="modal-panel bg-background rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">Add Custom Preset</h3>

            <div className="mb-3">
              <label className="block text-sm font-medium text-muted mb-1">Activity Name</label>
              <input
                type="text"
                value={newPreset.name}
                onChange={(e) => {
                  const name = e.target.value
                  const updates: typeof newPreset = { ...newPreset, name }
                  if (!emojiManual) {
                    updates.icon = suggestEmoji(name) || newPreset.icon
                  }
                  setNewPreset(updates)
                }}
                placeholder="e.g. Disc Golf"
                className="input-field"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-muted mb-1">Emoji Icon</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newPreset.icon}
                  onChange={(e) => {
                    setNewPreset({ ...newPreset, icon: e.target.value })
                    setEmojiManual(true)
                  }}
                  placeholder="Auto"
                  className="input-field text-center text-2xl flex-1"
                  maxLength={4}
                />
                {emojiManual && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmojiManual(false)
                      setNewPreset({ ...newPreset, icon: suggestEmoji(newPreset.name) })
                    }}
                    className="text-xs text-primary font-medium whitespace-nowrap hover:underline"
                  >
                    Auto
                  </button>
                )}
              </div>
              {!emojiManual && newPreset.icon && (
                <p className="text-[11px] text-muted mt-1">Auto-suggested from name</p>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-muted mb-1">Category</label>
              <select
                value={newPreset.category}
                onChange={(e) => setNewPreset({ ...newPreset, category: e.target.value })}
                className="input-field"
              >
                {ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-muted mb-1">Image URL (optional)</label>
              <input
                type="url"
                value={newPreset.image_url}
                onChange={(e) => setNewPreset({ ...newPreset, image_url: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="input-field text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPreset}
                disabled={!newPreset.name.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
              >
                Add Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
