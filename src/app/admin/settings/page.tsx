'use client'

import { useEffect, useState, useCallback } from 'react'
import ImageUpload from '@/components/admin/image-upload'

type Settings = Record<string, string>

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('general')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load settings.')
        setLoading(false)
      })
  }, [])

  const update = useCallback((key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setError('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const sections = [
    { id: 'general', label: 'General' },
    { id: 'contact', label: 'Contact' },
    { id: 'branding', label: 'Branding' },
    { id: 'legal', label: 'Legal' },
    { id: 'social', label: 'Social' },
    { id: 'app-stores', label: 'App Stores' },
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-success font-medium">Saved!</span>}
          {error && <span className="text-sm text-danger">{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold
                       hover:bg-primary-dark active:scale-[0.98] transition-all
                       disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Section tabs - horizontally scrollable on mobile */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6 -mx-4 px-4 lg:mx-0 lg:px-0">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors
              ${activeSection === s.id
                ? 'bg-primary text-white'
                : 'bg-surface text-foreground/70 hover:bg-border'
              }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="rounded-2xl border border-border bg-background p-4 lg:p-6">
        {activeSection === 'general' && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold mb-4">General</h3>
            <SettingInput label="App Name" value={settings.app_name} onChange={(v) => update('app_name', v)} />
            <SettingInput label="Tagline" value={settings.app_tagline} onChange={(v) => update('app_tagline', v)} />
            <SettingTextarea
              label="Description"
              value={settings.app_description}
              onChange={(v) => update('app_description', v)}
              rows={3}
            />
          </div>
        )}

        {activeSection === 'contact' && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold mb-4">Contact & Email</h3>
            <SettingInput
              label="Support Email"
              value={settings.support_email}
              onChange={(v) => update('support_email', v)}
              type="email"
              hint="Displayed to users for support inquiries"
            />
            <SettingInput
              label="Return/From Email"
              value={settings.return_email}
              onChange={(v) => update('return_email', v)}
              type="email"
              hint="The 'from' address for transactional emails (must be verified in SendGrid)"
            />
            <SettingInput
              label="Reply-To Email"
              value={settings.reply_to_email}
              onChange={(v) => update('reply_to_email', v)}
              type="email"
              hint="Where replies to system emails go"
            />
            <SettingInput
              label="From Name"
              value={settings.from_name}
              onChange={(v) => update('from_name', v)}
              hint="Display name for outgoing emails"
            />
            <SettingInput
              label="Phone Number"
              value={settings.phone_number}
              onChange={(v) => update('phone_number', v)}
              type="tel"
              hint="Business phone number (displayed in footer/contact pages)"
            />
            <SettingTextarea
              label="Physical Address"
              value={settings.physical_address}
              onChange={(v) => update('physical_address', v)}
              rows={3}
              hint="Required for CAN-SPAM compliance in emails"
            />
          </div>
        )}

        {activeSection === 'branding' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Branding & Logos</h3>
            <ImageUpload
              settingKey="logo_full"
              currentUrl={settings.logo_full}
              label="Full Logo"
              hint="Main logo with wordmark (recommended: SVG or PNG, 400x100px)"
              onUploaded={(url) => update('logo_full', url)}
            />
            <ImageUpload
              settingKey="logo_icon"
              currentUrl={settings.logo_icon}
              label="Icon / App Icon"
              hint="Square icon for app icon, social sharing (recommended: PNG, 512x512px)"
              onUploaded={(url) => update('logo_icon', url)}
            />
            <ImageUpload
              settingKey="logo_dark"
              currentUrl={settings.logo_dark}
              label="Dark Mode Logo"
              hint="Logo variant for dark backgrounds (recommended: SVG or PNG)"
              onUploaded={(url) => update('logo_dark', url)}
            />
            <ImageUpload
              settingKey="logo_favicon"
              currentUrl={settings.logo_favicon}
              label="Favicon"
              hint="Browser tab icon (recommended: ICO or 32x32 PNG)"
              onUploaded={(url) => update('logo_favicon', url)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <SettingColor
                label="Primary Brand Color"
                value={settings.brand_color_primary}
                onChange={(v) => update('brand_color_primary', v)}
              />
              <SettingColor
                label="Secondary Brand Color"
                value={settings.brand_color_secondary}
                onChange={(v) => update('brand_color_secondary', v)}
              />
            </div>
          </div>
        )}

        {activeSection === 'legal' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Legal Documents</h3>
            <p className="text-sm text-muted -mt-2 mb-4">
              Paste or write your legal documents below. Supports plain text or Markdown.
            </p>
            <SettingTextarea
              label="Terms of Service"
              value={settings.terms_of_service}
              onChange={(v) => update('terms_of_service', v)}
              rows={12}
            />
            <SettingTextarea
              label="Privacy Policy"
              value={settings.privacy_policy}
              onChange={(v) => update('privacy_policy', v)}
              rows={12}
            />
            <SettingTextarea
              label="Acceptable Use Policy"
              value={settings.acceptable_use_policy}
              onChange={(v) => update('acceptable_use_policy', v)}
              rows={8}
            />
            <SettingTextarea
              label="Cookie Policy"
              value={settings.cookie_policy}
              onChange={(v) => update('cookie_policy', v)}
              rows={8}
            />
          </div>
        )}

        {activeSection === 'social' && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold mb-4">Social Media</h3>
            <SettingInput label="Twitter / X" value={settings.social_twitter} onChange={(v) => update('social_twitter', v)} placeholder="https://x.com/whozin" />
            <SettingInput label="Instagram" value={settings.social_instagram} onChange={(v) => update('social_instagram', v)} placeholder="https://instagram.com/whozin" />
            <SettingInput label="Facebook" value={settings.social_facebook} onChange={(v) => update('social_facebook', v)} placeholder="https://facebook.com/whozin" />
            <SettingInput label="LinkedIn" value={settings.social_linkedin} onChange={(v) => update('social_linkedin', v)} placeholder="https://linkedin.com/company/whozin" />
            <SettingInput label="TikTok" value={settings.social_tiktok} onChange={(v) => update('social_tiktok', v)} placeholder="https://tiktok.com/@whozin" />
          </div>
        )}

        {activeSection === 'app-stores' && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold mb-4">App Store Links</h3>
            <SettingInput
              label="Apple App Store URL"
              value={settings.app_store_url}
              onChange={(v) => update('app_store_url', v)}
              placeholder="https://apps.apple.com/app/whozin/id..."
            />
            <SettingInput
              label="Google Play Store URL"
              value={settings.play_store_url}
              onChange={(v) => update('play_store_url', v)}
              placeholder="https://play.google.com/store/apps/details?id=..."
            />
          </div>
        )}
      </div>
    </div>
  )
}

// --- Reusable setting field components ---

function SettingInput({
  label, value, onChange, type = 'text', hint, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; hint?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {hint && <p className="text-xs text-muted mb-1.5">{hint}</p>}
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm
                   placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                   focus:border-primary"
      />
    </div>
  )
}

function SettingTextarea({
  label, value, onChange, rows = 4, hint,
}: {
  label: string; value: string; onChange: (v: string) => void
  rows?: number; hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {hint && <p className="text-xs text-muted mb-1.5">{hint}</p>}
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm
                   placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30
                   focus:border-primary resize-y"
      />
    </div>
  )
}

function SettingColor({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value || '#6366f1'}
          onChange={(e) => onChange(e.target.value)}
          className="w-11 h-11 rounded-xl border border-border cursor-pointer p-1"
        />
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6366f1"
          className="flex-1 h-11 px-4 rounded-xl border border-border bg-background text-sm
                     font-mono placeholder:text-muted focus:outline-none focus:ring-2
                     focus:ring-primary/30 focus:border-primary"
        />
      </div>
    </div>
  )
}
