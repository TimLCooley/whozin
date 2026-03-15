'use client'

import { useState, useEffect, useCallback } from 'react'

interface Build {
  id: string
  platform: 'android' | 'ios'
  version_code: number | null
  version_name: string | null
  status: 'pending' | 'building' | 'built' | 'deployed' | 'failed'
  track: string | null
  commit_sha: string | null
  commit_message: string | null
  run_id: number | null
  run_url: string | null
  created_at: string
  updated_at: string
}

type Platform = 'all' | 'android' | 'ios'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  building: { label: 'Building', color: 'text-blue-700', bg: 'bg-blue-100' },
  built: { label: 'Built', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  deployed: { label: 'Deployed', color: 'text-green-700', bg: 'bg-green-100' },
  failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-100' },
}

const SETUP_STEPS = {
  android: [
    {
      title: 'Encode your keystore as base64',
      description: 'Run this in your terminal where the keystore file is:',
      command: 'base64 -i whozin-keystore3.jks | pbcopy',
      commandWin: 'certutil -encode whozin-keystore3.jks encoded.txt && type encoded.txt | clip',
    },
    {
      title: 'Add GitHub Secrets',
      description: 'Go to your repo Settings > Secrets and variables > Actions, and add:',
      secrets: [
        { name: 'ANDROID_KEYSTORE', hint: 'The base64 string from step 1' },
        { name: 'ANDROID_KEYSTORE_PASSWORD', hint: 'Your keystore password' },
        { name: 'ANDROID_KEY_ALIAS', hint: 'whozin' },
        { name: 'ANDROID_KEY_PASSWORD', hint: 'Same as keystore password' },
        { name: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON', hint: 'Full JSON from Google Cloud service account' },
        { name: 'WHOZIN_API_URL', hint: 'https://whozin.io' },
        { name: 'WHOZIN_BUILD_SECRET', hint: 'A random secret string for CI to report builds' },
      ],
    },
    {
      title: 'Google Play service account',
      description: 'In Google Cloud Console, create a service account key (JSON) and grant it access in Google Play Console > Setup > API access.',
      link: 'https://console.cloud.google.com/iam-admin/serviceaccounts?project=whozin-469312',
    },
    {
      title: 'Set WHOZIN_BUILD_SECRET env var',
      description: 'Add WHOZIN_BUILD_SECRET to your Vercel environment variables (same value as the GitHub secret) so the API can authenticate CI requests.',
      link: 'https://vercel.com/tim-cooleys-projects-41557754/whozin/settings/environment-variables',
    },
    {
      title: 'Trigger a build',
      description: 'Push to master with android/ changes, or go to Actions > Android Build & Deploy > Run workflow.',
      link: 'https://github.com/TimLCooley/whozin/actions',
    },
  ],
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function BuildsPage() {
  const [builds, setBuilds] = useState<Build[]>([])
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState<Platform>('all')
  const [tableExists, setTableExists] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  const loadBuilds = useCallback(async () => {
    const params = platform !== 'all' ? `?platform=${platform}` : ''
    const res = await fetch(`/api/admin/builds${params}`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        setBuilds(data)
        setTableExists(true)
      }
    } else {
      const err = await res.json().catch(() => ({}))
      if (err.error?.includes('app_builds') || err.error?.includes('relation')) {
        setTableExists(false)
      }
    }
    setLoading(false)
  }, [platform])

  useEffect(() => { loadBuilds() }, [loadBuilds])

  async function createTable() {
    setCreating(true)
    const res = await fetch('/api/admin/builds/setup', { method: 'POST' })
    if (res.ok) {
      setTableExists(true)
      loadBuilds()
    } else {
      const data = await res.json()
      alert(data.hint || data.error || 'Failed to create table')
    }
    setCreating(false)
  }

  const filters: { key: Platform; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'android', label: 'Android' },
    { key: 'ios', label: 'iOS' },
  ]

  const androidBuilds = builds.filter((b) => b.platform === 'android')
  const iosBuilds = builds.filter((b) => b.platform === 'ios')
  const lastAndroid = androidBuilds[0]
  const lastIos = iosBuilds[0]

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground">Builds & Releases</h2>
        <a
          href="https://github.com/TimLCooley/whozin/actions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-primary font-semibold hover:underline flex items-center gap-1"
        >
          GitHub Actions
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>
      </div>
      <p className="text-[13px] text-muted mb-6">
        Automated CI/CD builds via GitHub Actions. Builds are triggered on push to master or manually.
      </p>

      {!tableExists && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-[13px] font-semibold text-yellow-800 mb-2">Database table not found</p>
          <p className="text-[12px] text-yellow-700 mb-3">
            The <code className="bg-yellow-100 px-1 rounded">app_builds</code> table needs to be created to track build history.
          </p>
          <button
            onClick={createTable}
            disabled={creating}
            className="text-[12px] font-bold bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Table'}
          </button>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <PlatformCard
          platform="Android"
          icon="🤖"
          lastBuild={lastAndroid}
          totalBuilds={androidBuilds.length}
          actionUrl="https://github.com/TimLCooley/whozin/actions/workflows/android-build.yml"
          storeUrl="https://play.google.com/console/"
        />
        <PlatformCard
          platform="iOS"
          icon="🍎"
          lastBuild={lastIos}
          totalBuilds={iosBuilds.length}
          actionUrl={undefined}
          storeUrl="https://appstoreconnect.apple.com"
        />
      </div>

      {/* Setup Guide */}
      <button
        onClick={() => setShowSetup(!showSetup)}
        className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 flex items-center justify-between mb-6 hover:bg-surface/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔧</span>
          <span className="text-[13px] font-semibold text-foreground">Setup Guide</span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8892a7" strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${showSetup ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {showSetup && (
        <div className="bg-background border border-border/50 rounded-xl p-4 mb-6 space-y-4">
          <h3 className="text-[14px] font-bold text-foreground">Android CI/CD Setup</h3>
          {SETUP_STEPS.android.map((step, i) => (
            <div key={i} className="border-l-2 border-primary/30 pl-4">
              <p className="text-[13px] font-semibold text-foreground">
                {i + 1}. {step.title}
              </p>
              <p className="text-[12px] text-muted mt-0.5">{step.description}</p>
              {step.command && (
                <code className="block mt-1.5 text-[11px] bg-surface px-3 py-2 rounded-lg font-mono text-foreground/80 break-all">
                  {step.command}
                </code>
              )}
              {step.commandWin && (
                <p className="text-[10px] text-muted mt-1">
                  Windows: <code className="bg-surface px-1.5 py-0.5 rounded font-mono">{step.commandWin}</code>
                </p>
              )}
              {step.secrets && (
                <div className="mt-2 space-y-1.5">
                  {step.secrets.map((s) => (
                    <div key={s.name} className="flex items-start gap-2">
                      <code className="text-[11px] bg-surface px-2 py-0.5 rounded font-mono text-primary flex-shrink-0">
                        {s.name}
                      </code>
                      <span className="text-[11px] text-muted">{s.hint}</span>
                    </div>
                  ))}
                </div>
              )}
              {step.link && (
                <a
                  href={step.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-primary font-semibold hover:underline"
                >
                  Open
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 mb-4 bg-background rounded-xl border border-border/50 overflow-hidden">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setPlatform(f.key)}
            className={`flex-1 py-2 text-[12px] font-semibold text-center transition-colors ${
              platform === f.key ? 'text-primary bg-primary/8' : 'text-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Build History */}
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-background border border-border/50 rounded-xl p-4 h-16 animate-pulse" />
            ))}
          </div>
        ) : builds.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[14px] text-muted">No builds recorded yet.</p>
            <p className="text-[12px] text-muted mt-1">Builds will appear here once the CI pipeline runs.</p>
          </div>
        ) : (
          builds.map((build) => (
            <div
              key={build.id}
              className="bg-background border border-border/50 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <span className="text-lg flex-shrink-0">
                {build.platform === 'android' ? '🤖' : '🍎'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-foreground">
                    {build.platform === 'android' ? 'Android' : 'iOS'}
                    {build.version_code && ` #${build.version_code}`}
                    {build.version_name && ` (${build.version_name})`}
                  </p>
                  <StatusBadge status={build.status} />
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {build.commit_message && (
                    <p className="text-[11px] text-muted truncate max-w-[200px]">{build.commit_message}</p>
                  )}
                  {build.track && (
                    <span className="text-[10px] font-bold text-muted bg-surface px-1.5 py-0.5 rounded">
                      {build.track}
                    </span>
                  )}
                  <span className="text-[10px] text-muted/70 flex-shrink-0">{timeAgo(build.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {build.commit_sha && (
                  <a
                    href={`https://github.com/TimLCooley/whozin/commit/${build.commit_sha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-primary hover:underline"
                  >
                    {build.commit_sha.slice(0, 7)}
                  </a>
                )}
                {build.run_url && (
                  <a
                    href={build.run_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-muted hover:text-primary transition-colors"
                    title="View GitHub Action"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function PlatformCard({
  platform,
  icon,
  lastBuild,
  totalBuilds,
  actionUrl,
  storeUrl,
}: {
  platform: string
  icon: string
  lastBuild: Build | undefined
  totalBuilds: number
  actionUrl: string | undefined
  storeUrl: string
}) {
  return (
    <div className="bg-background border border-border/50 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className="text-[14px] font-bold text-foreground">{platform}</h3>
        {lastBuild && <StatusBadge status={lastBuild.status} />}
      </div>
      <div className="space-y-1.5 text-[12px]">
        <div className="flex justify-between">
          <span className="text-muted">Last build</span>
          <span className="font-medium text-foreground">
            {lastBuild ? timeAgo(lastBuild.created_at) : 'Never'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Version</span>
          <span className="font-medium text-foreground">
            {lastBuild?.version_name || '—'}{lastBuild?.version_code ? ` (${lastBuild.version_code})` : ''}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Total builds</span>
          <span className="font-medium text-foreground">{totalBuilds}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Track</span>
          <span className="font-medium text-foreground">{lastBuild?.track || '—'}</span>
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
        {actionUrl && (
          <a
            href={actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-[11px] font-bold text-primary bg-primary/8 py-2 rounded-lg hover:bg-primary/15 transition-colors"
          >
            Run Build
          </a>
        )}
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-[11px] font-bold text-foreground bg-surface py-2 rounded-lg hover:bg-border/30 transition-colors"
        >
          Store Console
        </a>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  )
}
