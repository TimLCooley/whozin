'use client'

import { useEffect, useState } from 'react'
import ImageUpload from '@/components/admin/image-upload'

interface BrandingSettings {
  // Core branding
  app_name: string
  app_tagline: string
  brand_color: string
  logo_full: string
  logo_icon: string
  logo_dark: string
  favicon: string

  // PWA / Mobile
  pwa_name: string
  pwa_short_name: string
  pwa_theme_color: string
  pwa_background_color: string
  pwa_display: string
  app_icon_192: string
  app_icon_512: string
  splash_screen: string

  // iOS App Store
  ios_bundle_id: string
  ios_app_name: string
  ios_subtitle: string
  ios_keywords: string
  ios_description: string
  ios_app_store_url: string
  ios_app_icon: string
  ios_screenshots: string

  // Google Play Store
  android_package_name: string
  android_app_name: string
  android_short_description: string
  android_full_description: string
  android_play_store_url: string
  android_feature_graphic: string
  android_app_icon: string
  android_screenshots: string

  // Social / OG
  og_image: string
  og_title: string
  og_description: string
  twitter_handle: string
  instagram_url: string
  facebook_url: string
  linkedin_url: string
  tiktok_url: string
}

const DEFAULTS: BrandingSettings = {
  app_name: 'Whozin',
  app_tagline: "Who's In?",
  brand_color: '#4285F4',
  logo_full: '', logo_icon: '', logo_dark: '', favicon: '',
  pwa_name: 'Whozin', pwa_short_name: 'Whozin', pwa_theme_color: '#4285F4',
  pwa_background_color: '#ffffff', pwa_display: 'standalone',
  app_icon_192: '', app_icon_512: '', splash_screen: '',
  ios_bundle_id: 'io.whozin.app', ios_app_name: 'Whozin', ios_subtitle: "Who's In?",
  ios_keywords: 'groups, activities, social, planning, events',
  ios_description: '', ios_app_store_url: '', ios_app_icon: '', ios_screenshots: '',
  android_package_name: 'io.whozin.app', android_app_name: 'Whozin',
  android_short_description: "The smarter way to organize group activities.",
  android_full_description: '', android_play_store_url: '',
  android_feature_graphic: '', android_app_icon: '', android_screenshots: '',
  og_image: '', og_title: "Whozin - Who's In?",
  og_description: 'The smarter way to organize group activities.',
  twitter_handle: '', instagram_url: '', facebook_url: '', linkedin_url: '', tiktok_url: '',
}

type Tab = 'branding' | 'pwa' | 'ios' | 'android' | 'social'

export default function BrandingPage() {
  const [settings, setSettings] = useState<BrandingSettings>(DEFAULTS)
  const [tab, setTab] = useState<Tab>('branding')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings').then((r) => r.json()).then((data) => {
      setSettings((prev) => ({ ...prev, ...data }))
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
  }

  function update(key: keyof BrandingSettings, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'branding', label: 'Core' },
    { key: 'pwa', label: 'PWA' },
    { key: 'ios', label: 'iOS' },
    { key: 'android', label: 'Android' },
    { key: 'social', label: 'Social' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Branding & App</h2>
          <p className="text-[13px] text-muted">Logos, app store assets, PWA config, and social links.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2.5">
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-primary text-white' : 'bg-background border border-border text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-background border border-border/50 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {tab === 'branding' && (
          <div className="space-y-5">
            <Field label="App Name">
              <input className="input-field" value={settings.app_name} onChange={(e) => update('app_name', e.target.value)} />
            </Field>
            <Field label="Tagline">
              <input className="input-field" value={settings.app_tagline} onChange={(e) => update('app_tagline', e.target.value)} />
            </Field>
            <Field label="Brand Color">
              <div className="flex gap-2 items-center">
                <input type="color" value={settings.brand_color} onChange={(e) => update('brand_color', e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <input className="input-field flex-1" value={settings.brand_color} onChange={(e) => update('brand_color', e.target.value)} />
              </div>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Logo"><ImageUpload settingKey="logo_full" currentUrl={settings.logo_full} label="Full Logo" onUploaded={(url) => update('logo_full', url)} /></Field>
              <Field label="Icon Logo"><ImageUpload settingKey="logo_icon" currentUrl={settings.logo_icon} label="Icon Logo" onUploaded={(url) => update('logo_icon', url)} /></Field>
              <Field label="Dark Logo"><ImageUpload settingKey="logo_dark" currentUrl={settings.logo_dark} label="Dark Logo" onUploaded={(url) => update('logo_dark', url)} /></Field>
              <Field label="Favicon"><ImageUpload settingKey="favicon" currentUrl={settings.favicon} label="Favicon" onUploaded={(url) => update('favicon', url)} /></Field>
            </div>
          </div>
        )}

        {tab === 'pwa' && (
          <div className="space-y-5">
            <p className="text-[12px] text-muted bg-surface p-3 rounded-lg">
              PWA settings for the web app manifest. These control how the app appears when installed on a device.
            </p>
            <Field label="App Name"><input className="input-field" value={settings.pwa_name} onChange={(e) => update('pwa_name', e.target.value)} /></Field>
            <Field label="Short Name"><input className="input-field" value={settings.pwa_short_name} onChange={(e) => update('pwa_short_name', e.target.value)} /></Field>
            <Field label="Theme Color">
              <div className="flex gap-2 items-center">
                <input type="color" value={settings.pwa_theme_color} onChange={(e) => update('pwa_theme_color', e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <input className="input-field flex-1" value={settings.pwa_theme_color} onChange={(e) => update('pwa_theme_color', e.target.value)} />
              </div>
            </Field>
            <Field label="Background Color">
              <div className="flex gap-2 items-center">
                <input type="color" value={settings.pwa_background_color} onChange={(e) => update('pwa_background_color', e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <input className="input-field flex-1" value={settings.pwa_background_color} onChange={(e) => update('pwa_background_color', e.target.value)} />
              </div>
            </Field>
            <Field label="Display Mode">
              <select className="input-field" value={settings.pwa_display} onChange={(e) => update('pwa_display', e.target.value)}>
                <option value="standalone">Standalone</option>
                <option value="fullscreen">Fullscreen</option>
                <option value="minimal-ui">Minimal UI</option>
              </select>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="App Icon 192x192"><ImageUpload settingKey="app_icon_192" currentUrl={settings.app_icon_192} label="App Icon 192x192" onUploaded={(url) => update('app_icon_192', url)} /></Field>
              <Field label="App Icon 512x512"><ImageUpload settingKey="app_icon_512" currentUrl={settings.app_icon_512} label="App Icon 512x512" onUploaded={(url) => update('app_icon_512', url)} /></Field>
              <Field label="Splash Screen"><ImageUpload settingKey="splash_screen" currentUrl={settings.splash_screen} label="Splash Screen" onUploaded={(url) => update('splash_screen', url)} /></Field>
            </div>
          </div>
        )}

        {tab === 'ios' && (
          <div className="space-y-5">
            <p className="text-[12px] text-muted bg-surface p-3 rounded-lg">
              Apple App Store listing details. Bundle ID and app name are required for Xcode builds.
            </p>
            <Field label="Bundle ID"><input className="input-field" value={settings.ios_bundle_id} onChange={(e) => update('ios_bundle_id', e.target.value)} placeholder="io.whozin.app" /></Field>
            <Field label="App Name (30 chars)"><input className="input-field" maxLength={30} value={settings.ios_app_name} onChange={(e) => update('ios_app_name', e.target.value)} /></Field>
            <Field label="Subtitle (30 chars)"><input className="input-field" maxLength={30} value={settings.ios_subtitle} onChange={(e) => update('ios_subtitle', e.target.value)} /></Field>
            <Field label="Keywords (100 chars, comma-separated)"><input className="input-field" maxLength={100} value={settings.ios_keywords} onChange={(e) => update('ios_keywords', e.target.value)} /></Field>
            <Field label="Description (4000 chars)"><textarea className="input-field resize-none" rows={4} maxLength={4000} value={settings.ios_description} onChange={(e) => update('ios_description', e.target.value)} /></Field>
            <Field label="App Store URL"><input className="input-field" value={settings.ios_app_store_url} onChange={(e) => update('ios_app_store_url', e.target.value)} placeholder="https://apps.apple.com/..." /></Field>
            <Field label="App Icon (1024x1024, no alpha)"><ImageUpload settingKey="ios_app_icon" currentUrl={settings.ios_app_icon} label="iOS App Icon" onUploaded={(url) => update('ios_app_icon', url)} /></Field>
          </div>
        )}

        {tab === 'android' && (
          <div className="space-y-5">
            <p className="text-[12px] text-muted bg-surface p-3 rounded-lg">
              Google Play Store listing details. Package name is required for Android builds.
            </p>
            <Field label="Package Name"><input className="input-field" value={settings.android_package_name} onChange={(e) => update('android_package_name', e.target.value)} placeholder="io.whozin.app" /></Field>
            <Field label="App Name (50 chars)"><input className="input-field" maxLength={50} value={settings.android_app_name} onChange={(e) => update('android_app_name', e.target.value)} /></Field>
            <Field label="Short Description (80 chars)"><input className="input-field" maxLength={80} value={settings.android_short_description} onChange={(e) => update('android_short_description', e.target.value)} /></Field>
            <Field label="Full Description (4000 chars)"><textarea className="input-field resize-none" rows={4} maxLength={4000} value={settings.android_full_description} onChange={(e) => update('android_full_description', e.target.value)} /></Field>
            <Field label="Play Store URL"><input className="input-field" value={settings.android_play_store_url} onChange={(e) => update('android_play_store_url', e.target.value)} placeholder="https://play.google.com/store/apps/..." /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="App Icon (512x512)"><ImageUpload settingKey="android_app_icon" currentUrl={settings.android_app_icon} label="Android App Icon" onUploaded={(url) => update('android_app_icon', url)} /></Field>
              <Field label="Feature Graphic (1024x500)"><ImageUpload settingKey="android_feature_graphic" currentUrl={settings.android_feature_graphic} label="Feature Graphic" onUploaded={(url) => update('android_feature_graphic', url)} /></Field>
            </div>
          </div>
        )}

        {tab === 'social' && (
          <div className="space-y-5">
            <p className="text-[12px] text-muted bg-surface p-3 rounded-lg">
              Social media links and Open Graph settings for link previews.
            </p>
            <Field label="OG Image (1200x630)"><ImageUpload settingKey="og_image" currentUrl={settings.og_image} label="OG Image" onUploaded={(url) => update('og_image', url)} /></Field>
            <Field label="OG Title"><input className="input-field" value={settings.og_title} onChange={(e) => update('og_title', e.target.value)} /></Field>
            <Field label="OG Description"><textarea className="input-field resize-none" rows={2} value={settings.og_description} onChange={(e) => update('og_description', e.target.value)} /></Field>
            <hr className="border-border" />
            <Field label="Twitter / X"><input className="input-field" value={settings.twitter_handle} onChange={(e) => update('twitter_handle', e.target.value)} placeholder="@whozin" /></Field>
            <Field label="Instagram"><input className="input-field" value={settings.instagram_url} onChange={(e) => update('instagram_url', e.target.value)} placeholder="https://instagram.com/whozin" /></Field>
            <Field label="Facebook"><input className="input-field" value={settings.facebook_url} onChange={(e) => update('facebook_url', e.target.value)} placeholder="https://facebook.com/whozin" /></Field>
            <Field label="LinkedIn"><input className="input-field" value={settings.linkedin_url} onChange={(e) => update('linkedin_url', e.target.value)} placeholder="https://linkedin.com/company/whozin" /></Field>
            <Field label="TikTok"><input className="input-field" value={settings.tiktok_url} onChange={(e) => update('tiktok_url', e.target.value)} placeholder="https://tiktok.com/@whozin" /></Field>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
