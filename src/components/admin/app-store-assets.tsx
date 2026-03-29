'use client'

import { useState, useEffect, useCallback } from 'react'
import CropUpload from '@/components/admin/crop-upload'

interface AssetSpec {
  key: string
  label: string
  dimensions: string
  width: number
  height: number
  format: string
  required: boolean
  note?: string
}

interface AssetGroup {
  id: string
  title: string
  icon: string
  description: string
  assets: AssetSpec[]
}

const ASSET_GROUPS: AssetGroup[] = [
  {
    id: 'source',
    title: 'Source Assets',
    icon: '🎨',
    description: 'High-resolution source files. Upload these first — they are used to generate all platform-specific sizes.',
    assets: [
      { key: 'store_icon_source', label: 'App Icon (Master)', dimensions: '1024 × 1024', width: 1024, height: 1024, format: 'PNG', required: true, note: 'No alpha/transparency. Used to generate all icon sizes.' },
      { key: 'store_icon_foreground', label: 'Adaptive Icon Foreground', dimensions: '432 × 432', width: 432, height: 432, format: 'PNG with transparency', required: true, note: 'Android only. Logo centered in inner 66% safe zone (288×288). Outer area may be cropped.' },
      { key: 'store_splash_source', label: 'Splash / Launch Screen', dimensions: '2732 × 2732', width: 2732, height: 2732, format: 'PNG', required: true, note: 'Centered logo on solid background. Used for both iOS and Android launch screens.' },
    ],
  },
  {
    id: 'android',
    title: 'Google Play Store',
    icon: '🤖',
    description: 'Required assets for Google Play Console listing and the Android app binary.',
    assets: [
      { key: 'store_android_icon', label: 'Hi-res App Icon', dimensions: '512 × 512', width: 512, height: 512, format: 'PNG, 32-bit', required: true, note: 'No alpha channel. Displayed on Play Store listing.' },
      { key: 'store_android_feature', label: 'Feature Graphic', dimensions: '1024 × 500', width: 1024, height: 500, format: 'PNG or JPG', required: true, note: 'Shown at top of Play Store listing. No text in top/bottom 15%.' },
      { key: 'store_android_phone_1', label: 'Phone Screenshot 1', dimensions: '1080 × 1920', width: 1080, height: 1920, format: 'PNG or JPG', required: true, note: 'Min 2 screenshots required. 16:9 portrait.' },
      { key: 'store_android_phone_2', label: 'Phone Screenshot 2', dimensions: '1080 × 1920', width: 1080, height: 1920, format: 'PNG or JPG', required: true },
      { key: 'store_android_phone_3', label: 'Phone Screenshot 3', dimensions: '1080 × 1920', width: 1080, height: 1920, format: 'PNG or JPG', required: false },
      { key: 'store_android_phone_4', label: 'Phone Screenshot 4', dimensions: '1080 × 1920', width: 1080, height: 1920, format: 'PNG or JPG', required: false },
      { key: 'store_android_phone_5', label: 'Phone Screenshot 5', dimensions: '1080 × 1920', width: 1080, height: 1920, format: 'PNG or JPG', required: false },
      { key: 'store_android_phone_6', label: 'Phone Screenshot 6', dimensions: '1080 × 1920', width: 1080, height: 1920, format: 'PNG or JPG', required: false },
      { key: 'store_android_phone_7', label: 'Phone Screenshot 7', dimensions: '1080 × 1920', width: 1080, height: 1920, format: 'PNG or JPG', required: false },
      { key: 'store_android_phone_8', label: 'Phone Screenshot 8', dimensions: '1080 × 1920', width: 1080, height: 1920, format: 'PNG or JPG', required: false },
      { key: 'store_android_tablet_7_1', label: '7" Tablet Screenshot 1', dimensions: '1200 × 1920', width: 1200, height: 1920, format: 'PNG or JPG', required: false, note: 'Optional. Required if targeting tablets.' },
      { key: 'store_android_tablet_7_2', label: '7" Tablet Screenshot 2', dimensions: '1200 × 1920', width: 1200, height: 1920, format: 'PNG or JPG', required: false },
      { key: 'store_android_tablet_10_1', label: '10" Tablet Screenshot 1', dimensions: '1600 × 2560', width: 1600, height: 2560, format: 'PNG or JPG', required: false, note: 'Optional. Required if targeting tablets.' },
      { key: 'store_android_tablet_10_2', label: '10" Tablet Screenshot 2', dimensions: '1600 × 2560', width: 1600, height: 2560, format: 'PNG or JPG', required: false },
    ],
  },
  {
    id: 'ios',
    title: 'Apple App Store',
    icon: '🍎',
    description: 'Required assets for App Store Connect listing and the iOS app binary.',
    assets: [
      { key: 'store_ios_icon', label: 'App Store Icon', dimensions: '1024 × 1024', width: 1024, height: 1024, format: 'PNG, no alpha', required: true, note: 'No transparency, no rounded corners (Apple adds them). sRGB or Display P3.' },
      { key: 'store_ios_67_1', label: 'iPhone 6.7" Screenshot 1', dimensions: '1290 × 2796', width: 1290, height: 2796, format: 'PNG or JPG', required: true, note: 'iPhone 15 Pro Max / 14 Pro Max. Min 2 required.' },
      { key: 'store_ios_67_2', label: 'iPhone 6.7" Screenshot 2', dimensions: '1290 × 2796', width: 1290, height: 2796, format: 'PNG or JPG', required: true },
      { key: 'store_ios_67_3', label: 'iPhone 6.7" Screenshot 3', dimensions: '1290 × 2796', width: 1290, height: 2796, format: 'PNG or JPG', required: false },
      { key: 'store_ios_67_4', label: 'iPhone 6.7" Screenshot 4', dimensions: '1290 × 2796', width: 1290, height: 2796, format: 'PNG or JPG', required: false },
      { key: 'store_ios_67_5', label: 'iPhone 6.7" Screenshot 5', dimensions: '1290 × 2796', width: 1290, height: 2796, format: 'PNG or JPG', required: false },
      { key: 'store_ios_67_6', label: 'iPhone 6.7" Screenshot 6', dimensions: '1290 × 2796', width: 1290, height: 2796, format: 'PNG or JPG', required: false },
      { key: 'store_ios_65_1', label: 'iPhone 6.5" Screenshot 1', dimensions: '1242 × 2688', width: 1242, height: 2688, format: 'PNG or JPG', required: false, note: 'iPhone 11 Pro Max / XS Max. Optional if 6.7" provided.' },
      { key: 'store_ios_65_2', label: 'iPhone 6.5" Screenshot 2', dimensions: '1242 × 2688', width: 1242, height: 2688, format: 'PNG or JPG', required: false },
      { key: 'store_ios_65_3', label: 'iPhone 6.5" Screenshot 3', dimensions: '1242 × 2688', width: 1242, height: 2688, format: 'PNG or JPG', required: false },
      { key: 'store_ios_55_1', label: 'iPhone 5.5" Screenshot 1', dimensions: '1242 × 2208', width: 1242, height: 2208, format: 'PNG or JPG', required: false, note: 'iPhone 8 Plus / 7 Plus. Optional.' },
      { key: 'store_ios_55_2', label: 'iPhone 5.5" Screenshot 2', dimensions: '1242 × 2208', width: 1242, height: 2208, format: 'PNG or JPG', required: false },
      { key: 'store_ios_ipad_1', label: 'iPad 12.9" Screenshot 1', dimensions: '2048 × 2732', width: 2048, height: 2732, format: 'PNG or JPG', required: false, note: 'Required if app supports iPad.' },
      { key: 'store_ios_ipad_2', label: 'iPad 12.9" Screenshot 2', dimensions: '2048 × 2732', width: 2048, height: 2732, format: 'PNG or JPG', required: false },
    ],
  },
]

function AssetPreview({ url, width, height }: { url: string; width: number; height: number }) {
  // Show preview with correct aspect ratio, max 120px tall
  const aspect = width / height
  const previewH = Math.min(120, 120)
  const previewW = Math.round(previewH * aspect)

  return (
    <div
      className="rounded-lg border border-border overflow-hidden shrink-0"
      style={{
        width: previewW,
        height: previewH,
        background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 0 0 / 12px 12px',
      }}
    >
      <img src={url} alt="" className="w-full h-full object-contain" />
    </div>
  )
}

function DimensionBadge({ dimensions, required }: { dimensions: string; required: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
        {dimensions}
      </span>
      {required && (
        <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
          Required
        </span>
      )}
    </div>
  )
}

export default function AppStoreAssets() {
  const [assets, setAssets] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        const storeAssets: Record<string, string> = {}

        // Pull in existing store_* keys
        for (const key of Object.keys(data)) {
          if (key.startsWith('store_') && data[key]) {
            storeAssets[key] = data[key]
          }
        }

        // Map existing branding page assets as fallbacks
        const fallbacks: Record<string, string> = {
          store_icon_source: data.ios_app_icon || data.app_icon_512 || '',
          store_ios_icon: data.ios_app_icon || '',
          store_android_icon: data.android_app_icon || data.app_icon_512 || '',
          store_android_feature: data.android_feature_graphic || '',
          store_splash_source: data.splash_screen || '',
        }
        for (const [key, val] of Object.entries(fallbacks)) {
          if (!storeAssets[key] && val) {
            storeAssets[key] = val
          }
        }

        setAssets(storeAssets)
      })
      .finally(() => setLoading(false))
  }, [])

  function handleUploaded(key: string, url: string) {
    setAssets((prev) => ({ ...prev, [key]: url }))
    // Auto-save this setting
    fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: url }),
    })
  }

  function getGroupProgress(group: AssetGroup) {
    const required = group.assets.filter((a) => a.required)
    const uploaded = required.filter((a) => assets[a.key])
    const total = group.assets.filter((a) => assets[a.key]).length
    return { required: required.length, requiredDone: uploaded.length, total }
  }

  if (loading) {
    return (
      <div className="bg-background border border-border/50 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-surface rounded w-48" />
          <div className="h-3 bg-surface rounded w-72" />
          <div className="h-20 bg-surface rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-foreground">App Store Assets</h3>
        <span className="text-[11px] text-muted">
          Upload required images for store listings &amp; native app builds
        </span>
      </div>

      {ASSET_GROUPS.map((group) => {
        const progress = getGroupProgress(group)
        const isExpanded = expandedGroup === group.id

        return (
          <div
            key={group.id}
            className="bg-background border border-border/50 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            {/* Group header */}
            <button
              onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-surface/50 transition-colors"
            >
              <span className="text-xl">{group.icon}</span>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-semibold text-foreground">{group.title}</p>
                <p className="text-[11px] text-muted truncate">{group.description}</p>
              </div>
              {/* Progress indicator */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  progress.requiredDone === progress.required
                    ? 'bg-green-100 text-green-700'
                    : progress.requiredDone > 0
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-50 text-red-500'
                }`}>
                  {progress.requiredDone}/{progress.required} required
                </span>
                {progress.total > progress.requiredDone && (
                  <span className="text-[10px] text-muted">+{progress.total - progress.requiredDone} optional</span>
                )}
              </div>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8892a7" strokeWidth={2.5}
                strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Expanded asset list */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-4">
                {group.assets.map((asset) => (
                  <div
                    key={asset.key}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      assets[asset.key]
                        ? 'border-green-200 bg-green-50/30'
                        : asset.required
                          ? 'border-red-200 bg-red-50/20'
                          : 'border-border/40 bg-surface/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Preview or placeholder */}
                      {assets[asset.key] ? (
                        <AssetPreview url={assets[asset.key]} width={asset.width} height={asset.height} />
                      ) : (
                        <div
                          className="rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center shrink-0 bg-surface/30"
                          style={{
                            width: Math.round(Math.min(120, 120) * (asset.width / asset.height)),
                            height: Math.min(120, 120),
                          }}
                        >
                          <div className="text-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c0c8d8" strokeWidth={1.5} strokeLinecap="round" className="mx-auto mb-0.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                            <span className="text-[8px] text-muted font-mono">{asset.dimensions}</span>
                          </div>
                        </div>
                      )}

                      {/* Info + upload */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[13px] font-semibold text-foreground">{asset.label}</p>
                          <DimensionBadge dimensions={asset.dimensions} required={asset.required} />
                        </div>
                        <p className="text-[11px] text-muted mb-2">
                          {asset.format}
                          {asset.note && <span> — {asset.note}</span>}
                        </p>
                        <CropUpload
                          settingKey={asset.key}
                          currentUrl={assets[asset.key] || ''}
                          targetWidth={asset.width}
                          targetHeight={asset.height}
                          label={asset.label}
                          onUploaded={(url) => handleUploaded(asset.key, url)}
                        />
                      </div>

                      {/* Status check */}
                      <div className="shrink-0 pt-1">
                        {assets[asset.key] ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : asset.required ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4M12 16h.01" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c0c8d8" strokeWidth={2} strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 12h8" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Sync + Help */}
      <SyncToStores />
      <div className="bg-surface/50 border border-border/30 rounded-xl p-4 mt-2">
        <p className="text-[12px] text-muted leading-relaxed">
          <strong className="text-foreground">How to use:</strong> Upload screenshots here, then click &quot;Sync to Stores&quot; above
          to push them to App Store Connect and Google Play automatically. Screenshots also sync during every native build.
        </p>
      </div>
    </div>
  )
}

function SyncToStores() {
  const [syncing, setSyncing] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const triggerSync = useCallback(async (platforms: string) => {
    setSyncing(platforms)
    setResult(null)
    try {
      const res = await fetch('/api/admin/builds/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-assets', platform: platforms }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, msg: data.message || 'Sync triggered!' })
      } else {
        setResult({ ok: false, msg: data.error || 'Failed to trigger sync' })
      }
    } catch {
      setResult({ ok: false, msg: 'Network error' })
    } finally {
      setSyncing(null)
    }
  }, [])

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-3 flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground">Push to App Stores</p>
        <p className="text-[11px] text-muted">Sync uploaded screenshots &amp; assets to store listings</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => triggerSync('both')}
          disabled={!!syncing}
          className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold
                     hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {syncing === 'both' ? 'Syncing...' : 'Sync Both'}
        </button>
        <button
          onClick={() => triggerSync('ios')}
          disabled={!!syncing}
          className="px-3 py-2 rounded-xl bg-surface border border-border text-xs font-semibold
                     hover:bg-border active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {syncing === 'ios' ? '...' : 'iOS Only'}
        </button>
        <button
          onClick={() => triggerSync('android')}
          disabled={!!syncing}
          className="px-3 py-2 rounded-xl bg-surface border border-border text-xs font-semibold
                     hover:bg-border active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {syncing === 'android' ? '...' : 'Android Only'}
        </button>
      </div>
      {result && (
        <p className={`w-full text-[11px] font-medium ${result.ok ? 'text-green-600' : 'text-red-500'}`}>
          {result.msg}
        </p>
      )}
    </div>
  )
}
