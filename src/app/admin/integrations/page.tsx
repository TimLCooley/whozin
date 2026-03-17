'use client'

import { useState, useEffect, useCallback } from 'react'
import AppStoreAssets from '@/components/admin/app-store-assets'

interface HealthResult {
  id: string // integration name
  status: 'healthy' | 'degraded' | 'down' | 'unchecked'
  message: string
  checked_at: string
}

interface EnvVar {
  key: string
  label: string
  secret?: boolean
}

interface Integration {
  name: string
  description: string
  icon: string
  envVars: EnvVar[]
  docsUrl: string
}

const INTEGRATIONS: Integration[] = [
  {
    name: 'Supabase',
    description: 'Database, auth, storage, and real-time subscriptions.',
    icon: '🟢',
    envVars: [
      { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'API URL' },
      { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Anon Key' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', secret: true },
    ],
    docsUrl: 'https://supabase.com/dashboard/project/ooqdkonjcztjankkvejh',
  },
  {
    name: 'Twilio',
    description: 'SMS OTP, activity invites, and broadcast messaging.',
    icon: '📱',
    envVars: [
      { key: 'TWILIO_ACCOUNT_SID', label: 'Account SID' },
      { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', secret: true },
      { key: 'TWILIO_PHONE_NUMBER', label: 'Phone Number' },
    ],
    docsUrl: 'https://console.twilio.com/',
  },
  {
    name: 'SendGrid',
    description: 'Transactional and broadcast email delivery.',
    icon: '📧',
    envVars: [
      { key: 'SENDGRID_API_KEY', label: 'API Key', secret: true },
      { key: 'SENDGRID_FROM_EMAIL', label: 'From Email' },
    ],
    docsUrl: 'https://app.sendgrid.com/',
  },
  {
    name: 'Stripe',
    description: 'Membership payments and subscription management.',
    icon: '💳',
    envVars: [
      { key: 'STRIPE_TEST_SECRET_KEY', label: 'Test Secret Key', secret: true },
      { key: 'STRIPE_TEST_PUBLISHABLE_KEY', label: 'Test Publishable Key' },
      { key: 'STRIPE_LIVE_SECRET_KEY', label: 'Live Secret Key', secret: true },
      { key: 'STRIPE_LIVE_PUBLISHABLE_KEY', label: 'Live Publishable Key' },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Secret', secret: true },
    ],
    docsUrl: 'https://dashboard.stripe.com/',
  },
  {
    name: 'Vercel',
    description: 'Hosting, deployments, and serverless functions.',
    icon: '▲',
    envVars: [
      { key: 'NEXT_PUBLIC_SITE_URL', label: 'Site URL' },
    ],
    docsUrl: 'https://vercel.com/tim-cooleys-projects-41557754/whozin',
  },
  {
    name: 'Apple Developer',
    description: 'iOS app, Sign in with Apple, push notifications. Team: 3QM6SDB8NG',
    icon: '🍎',
    envVars: [
      { key: 'APPLE_TEAM_ID', label: 'Team ID' },
      { key: 'APPLE_KEY_ID', label: 'Key ID (Push: 96S7QHD6MQ, SIWA: CBRF43DM33)' },
      { key: 'APPLE_PRIVATE_KEY', label: 'Private Key (.p8)', secret: true },
    ],
    docsUrl: 'https://developer.apple.com/account/',
  },
  {
    name: 'Google Play Console',
    description: 'Android app distribution via GitHub Actions CI/CD. Service account configured in GitHub Secrets.',
    icon: '🤖',
    envVars: [],
    docsUrl: 'https://play.google.com/console/',
  },
  {
    name: 'Firebase (Push Notifications)',
    description: 'Push notifications via FCM v1 API. Required — reduces SMS costs by using push for invites and alerts.',
    icon: '🔔',
    envVars: [
      { key: 'FIREBASE_PROJECT_ID', label: 'Project ID' },
      { key: 'FIREBASE_CLIENT_EMAIL', label: 'Service Account Email', secret: true },
      { key: 'FIREBASE_PRIVATE_KEY', label: 'Service Account Private Key', secret: true },
    ],
    docsUrl: 'https://console.firebase.google.com/',
  },
  {
    name: 'Google Cloud',
    description: 'Maps, Places autocomplete, AI image generation, and OAuth.',
    icon: '🌐',
    envVars: [
      { key: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', label: 'Maps API Key' },
      { key: 'GOOGLE_AI_API_KEY', label: 'Gemini / AI API Key', secret: true },
    ],
    docsUrl: 'https://console.cloud.google.com/',
  },
  {
    name: 'Google OAuth',
    description: 'Sign in with Google + Contacts search. Client: 85647149825-ppb...lbq',
    icon: '🔑',
    envVars: [],
    docsUrl: 'https://supabase.com/dashboard/project/ooqdkonjcztjankkvejh/auth/providers',
  },
  {
    name: 'RevenueCat',
    description: 'iOS/Android in-app purchases and subscription management.',
    icon: '🧾',
    envVars: [
      { key: 'REVENUECAT_WEBHOOK_SECRET', label: 'Webhook Secret', secret: true },
    ],
    docsUrl: 'https://app.revenuecat.com',
  },
  {
    name: 'CI/CD (GitHub Actions)',
    description: 'Automated Android builds, deploy to Google Play, build status webhooks.',
    icon: '⚙️',
    envVars: [
      { key: 'WHOZIN_BUILD_SECRET', label: 'Build Webhook Secret', secret: true },
    ],
    docsUrl: 'https://github.com/TimLCooley/whozin/actions',
  },
  {
    name: 'Capacitor (Native Apps)',
    description: 'iOS: io.whozin.app / Android: io.whozin.app — remote URL pattern.',
    icon: '📱',
    envVars: [],
    docsUrl: 'https://capacitorjs.com/docs',
  },
]

const API_ENDPOINTS = [
  { method: 'POST', path: '/api/auth/send-otp', desc: 'Send OTP code via SMS' },
  { method: 'POST', path: '/api/auth/verify-otp', desc: 'Verify OTP and create/link account' },
  { method: 'POST', path: '/api/auth/sign-up', desc: 'Legacy password sign-up' },
  { method: 'GET', path: '/auth/callback', desc: 'OAuth callback (Google/Apple)' },
  { method: 'GET', path: '/api/user/profile', desc: 'Current user profile' },
  { method: 'POST', path: '/api/user/verify-email', desc: 'Send email verification code' },
  { method: 'PUT', path: '/api/user/verify-email', desc: 'Verify and update email' },
  { method: 'POST', path: '/api/user/push-token', desc: 'Register push notification token' },
  { method: 'DELETE', path: '/api/user/push-token', desc: 'Unregister push token' },
  { method: 'GET', path: '/api/groups', desc: 'List user groups' },
  { method: 'POST', path: '/api/groups', desc: 'Create group' },
  { method: 'GET', path: '/api/groups/[id]', desc: 'Group detail with members' },
  { method: 'POST', path: '/api/groups/[id]/members', desc: 'Add member to group' },
  { method: 'GET', path: '/api/groups/contacts', desc: 'Contacts from user groups' },
  { method: 'GET', path: '/api/friends', desc: 'Friends list (from all groups)' },
  { method: 'GET', path: '/api/activities', desc: 'List activities' },
  { method: 'POST', path: '/api/activities', desc: 'Create activity' },
  { method: 'GET', path: '/api/activities/presets', desc: 'Activity presets' },
  { method: 'POST', path: '/api/activities/upload-image', desc: 'Upload activity image' },
  { method: 'POST', path: '/api/activities/generate-image', desc: 'AI-generate activity image' },
  { method: 'GET', path: '/api/google/contacts', desc: 'Search Google Contacts' },
  { method: 'POST', path: '/api/contact', desc: 'Contact form submission' },
  { method: 'GET', path: '/api/admin/settings', desc: 'Fetch all app settings' },
  { method: 'PUT', path: '/api/admin/settings', desc: 'Update app settings' },
  { method: 'POST', path: '/api/admin/upload', desc: 'Upload branding assets' },
  { method: 'GET', path: '/api/admin/env-status', desc: 'Check env var status' },
  { method: 'GET', path: '/api/admin/stats', desc: 'Dashboard stats' },
  { method: 'GET', path: '/api/admin/users', desc: 'All users (admin)' },
  { method: 'GET', path: '/api/admin/groups', desc: 'All groups (admin)' },
  { method: 'GET', path: '/api/admin/activities', desc: 'All activities (admin)' },
  { method: 'GET', path: '/api/admin/organizations', desc: 'All organizations (admin)' },
  { method: 'GET', path: '/api/admin/builds', desc: 'Build history (admin)' },
  { method: 'POST', path: '/api/admin/builds', desc: 'Record build event (CI webhook)' },
  { method: 'POST', path: '/api/admin/builds/setup', desc: 'Create app_builds table' },
  { method: 'POST', path: '/api/webhooks/revenuecat', desc: 'RevenueCat subscription events' },
  { method: 'POST', path: '/api/webhooks/stripe', desc: 'Stripe subscription events' },
  { method: 'POST', path: '/api/twilio/webhook', desc: 'Twilio SMS status callback' },
  { method: 'POST', path: '/api/messaging/test', desc: 'Send test SMS/email' },
  { method: 'GET', path: '/api/favicon', desc: 'Dynamic favicon' },
  { method: 'GET', path: '/api/locations', desc: 'Allowed country codes' },
  { method: 'GET', path: '/api/alerts', desc: 'User alerts/notifications' },
  { method: 'POST', path: '/api/cron/process-invites', desc: 'Process invite queue (cron)' },
]

interface PlatformStatus {
  platform: 'android' | 'ios'
  latestBuild: {
    version_code: number | null
    version_name: string | null
    status: string
    track: string | null
    commit_sha: string | null
    created_at: string
    run_url: string | null
  } | null
  productionBuild: {
    version_code: number | null
    version_name: string | null
    status: string
    created_at: string
  } | null
  totalBuilds: number
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function BuildStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    deployed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Live' },
    built: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Built' },
    building: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Building' },
    pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Pending' },
    failed: { bg: 'bg-red-100', text: 'text-red-600', label: 'Failed' },
  }
  const c = config[status] || config.pending
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

function StoreStatusCard({ platform, onTrigger, triggering }: { platform: PlatformStatus; onTrigger: (p: 'android' | 'ios', track: string) => void; triggering: boolean }) {
  const isAndroid = platform.platform === 'android'
  const icon = isAndroid ? '🤖' : '🍎'
  const name = isAndroid ? 'Google Play' : 'App Store'
  const latest = platform.latestBuild
  const prod = platform.productionBuild

  return (
    <div className="bg-background border border-border/50 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-[13px] font-bold text-foreground">{name}</span>
        {platform.totalBuilds > 0 && (
          <span className="text-[10px] text-muted ml-auto">{platform.totalBuilds} builds</span>
        )}
      </div>

      {!latest ? (
        <div className="text-[12px] text-muted mb-3">No builds tracked yet.</div>
      ) : (
        <div className="space-y-2.5 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted uppercase font-semibold tracking-wide">Latest Build</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[13px] font-semibold text-foreground">
                  v{latest.version_name || '1.0.0'}{latest.version_code ? ` (${latest.version_code})` : ''}
                </span>
                <BuildStatusBadge status={latest.status} />
              </div>
              <p className="text-[10px] text-muted mt-0.5">
                {latest.track && <span className="capitalize">{latest.track} track</span>}
                {latest.track && ' · '}{timeAgo(latest.created_at)}
                {latest.commit_sha && ` · ${latest.commit_sha.slice(0, 7)}`}
              </p>
            </div>
            {latest.run_url && (
              <a href={latest.run_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary font-semibold hover:underline">
                View
              </a>
            )}
          </div>

          <div className="border-t border-border/30 pt-2">
            <p className="text-[11px] text-muted uppercase font-semibold tracking-wide">Production</p>
            {prod ? (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[13px] font-semibold text-foreground">
                  v{prod.version_name || '1.0.0'}{prod.version_code ? ` (${prod.version_code})` : ''}
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  Live
                </span>
                <span className="text-[10px] text-muted">{timeAgo(prod.created_at)}</span>
              </div>
            ) : (
              <p className="text-[12px] text-muted mt-0.5">Not yet deployed to production</p>
            )}
          </div>
        </div>
      )}

      {/* Build & Deploy button */}
      <button
        onClick={() => onTrigger(platform.platform, 'production')}
        disabled={triggering}
        className="w-full text-[12px] font-bold text-white bg-primary hover:bg-primary/90 active:scale-[0.98] px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
      >
        {triggering ? 'Triggering...' : `Build & Deploy to ${isAndroid ? 'Google Play' : 'App Store'}`}
      </button>
    </div>
  )
}

function HealthStatusBadge({ status, message }: { status: string; message?: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    healthy: { bg: 'bg-green-100', text: 'text-green-700', label: 'Healthy' },
    degraded: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Degraded' },
    down: { bg: 'bg-red-100', text: 'text-red-600', label: 'Down' },
    unchecked: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Unchecked' },
  }
  const s = styles[status] || styles.unchecked
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    </div>
  )
}

export default function IntegrationsPage() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({})
  const [healthResults, setHealthResults] = useState<HealthResult[]>([])
  const [storeStatus, setStoreStatus] = useState<PlatformStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)

  // Load cached health data + env status on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/env-status').then((r) => r.json()),
      fetch('/api/admin/health-check/cached').then((r) => r.json()).catch(() => ({ results: [] })),
      fetch('/api/admin/store-status').then((r) => r.json()).catch(() => []),
    ]).then(([env, health, stores]) => {
      setEnvStatus(env)
      if (health.results?.length > 0) {
        setHealthResults(health.results)
        // Find most recent check time
        const latest = health.results.reduce((max: string, r: HealthResult) =>
          r.checked_at > max ? r.checked_at : max, '')
        if (latest) setLastChecked(latest)
      }
      if (Array.isArray(stores)) setStoreStatus(stores)
    }).finally(() => setLoading(false))
  }, [])

  const runHealthCheck = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/admin/health-check')
      const data = await res.json()
      if (data.results) {
        // Map from health check response format to cached format
        const mapped = data.results.map((r: { integration: string; status: string; message: string; checked_at: string }) => ({
          id: r.integration,
          status: r.status,
          message: r.message,
          checked_at: r.checked_at,
        }))
        setHealthResults(mapped)
        setLastChecked(data.checked_at)
      }
    } catch {
      // Failed to run check
    } finally {
      setChecking(false)
    }
  }, [])

  const triggerBuild = useCallback(async (platform: 'android' | 'ios', track: string) => {
    setTriggering(true)
    setTriggerMsg(null)
    try {
      const res = await fetch('/api/admin/builds/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, track }),
      })
      const data = await res.json()
      if (res.ok) {
        setTriggerMsg(`Build triggered! ${data.message}`)
      } else {
        setTriggerMsg(`Error: ${data.error}`)
      }
    } catch {
      setTriggerMsg('Failed to trigger build.')
    } finally {
      setTriggering(false)
    }
  }, [])

  const syncBuilds = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/builds/sync', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.synced > 0) {
        // Reload store status
        const stores = await fetch('/api/admin/store-status').then((r) => r.json()).catch(() => [])
        if (Array.isArray(stores)) setStoreStatus(stores)
        setTriggerMsg(`Synced ${data.synced} builds from GitHub Actions.`)
      } else if (res.ok) {
        setTriggerMsg('Already up to date — no new builds to sync.')
      } else {
        setTriggerMsg(`Sync error: ${data.error}`)
      }
    } catch {
      setTriggerMsg('Failed to sync builds.')
    } finally {
      setSyncing(false)
    }
  }, [])

  function getHealthForIntegration(name: string): HealthResult | undefined {
    return healthResults.find((r) => r.id === name)
  }

  function getDisplayStatus(integration: Integration): { status: string; message?: string; checkedAt?: string } {
    const health = getHealthForIntegration(integration.name)
    if (health) {
      return { status: health.status, message: health.message, checkedAt: health.checked_at }
    }
    // Fallback to env var check
    if (integration.envVars.length === 0) return { status: 'healthy', message: 'No server credentials needed' }
    const set = integration.envVars.filter((v) => envStatus[v.key])
    if (set.length === integration.envVars.length) return { status: 'healthy' }
    if (set.length > 0) return { status: 'degraded' }
    return { status: 'down' }
  }

  const healthyCount = INTEGRATIONS.filter((i) => getDisplayStatus(i).status === 'healthy').length

  const android = storeStatus.find((s) => s.platform === 'android')
  const ios = storeStatus.find((s) => s.platform === 'ios')

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground">API & Integrations</h2>
        <button
          onClick={runHealthCheck}
          disabled={checking}
          className="text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Run Health Check'}
        </button>
      </div>
      <p className="text-[13px] text-muted mb-4">
        {loading ? '...' : `${healthyCount}/${INTEGRATIONS.length}`} integrations healthy.
        {lastChecked && ` Last checked ${timeAgo(lastChecked)}.`}
        {!lastChecked && !loading && ' No health check run yet — click "Run Health Check" to start.'}
      </p>

      {/* Store Status Banner */}
      {!loading && (
        <div className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {android && <StoreStatusCard platform={android} onTrigger={triggerBuild} triggering={triggering} />}
            {ios && <StoreStatusCard platform={ios} onTrigger={triggerBuild} triggering={triggering} />}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={syncBuilds}
              disabled={syncing}
              className="text-[11px] font-semibold text-muted hover:text-foreground bg-surface hover:bg-surface/80 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync Build History from GitHub'}
            </button>
            {triggerMsg && (
              <p className={`text-[11px] font-medium ${triggerMsg.startsWith('Error') || triggerMsg.startsWith('Failed') ? 'text-red-500' : 'text-green-600'}`}>
                {triggerMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {/* App Store Assets */}
      <AppStoreAssets />

      <h3 className="text-sm font-bold text-foreground mt-8 mb-3">Integrations</h3>
      <div className="space-y-3">
        {INTEGRATIONS.map((integration) => {
          const display = loading ? { status: 'unchecked' } : getDisplayStatus(integration)
          const health = getHealthForIntegration(integration.name)
          return (
            <div key={integration.name} className="bg-background border border-border/50 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === integration.name ? null : integration.name)}
                className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-surface/50 transition-colors"
              >
                <span className="text-xl">{integration.icon}</span>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{integration.name}</p>
                  <p className="text-[11px] text-muted truncate">{integration.description}</p>
                </div>
                <HealthStatusBadge status={display.status} />
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8892a7" strokeWidth={2.5}
                  strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform duration-200 ${expanded === integration.name ? 'rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {expanded === integration.name && (
                <div className="px-4 pb-4 border-t border-border/40 pt-3">
                  {/* Health check result */}
                  {health && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-surface/50 border border-border/30">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] text-foreground font-medium">{health.message}</p>
                        <span className="text-[10px] text-muted">{timeAgo(health.checked_at)}</span>
                      </div>
                    </div>
                  )}

                  {/* Env vars */}
                  {integration.envVars.length > 0 && (
                    <div className="space-y-2.5 mb-4">
                      {integration.envVars.map((envVar) => (
                        <div key={envVar.key} className="flex items-center justify-between">
                          <div>
                            <p className="text-[12px] font-medium text-foreground">{envVar.label}</p>
                            <p className="text-[10px] font-mono text-muted">{envVar.key}</p>
                          </div>
                          {envStatus[envVar.key] ? (
                            <span className="text-[11px] font-semibold text-green-600 bg-green-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                              Set
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                              Missing
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {integration.envVars.length === 0 && !health && (
                    <p className="text-[12px] text-muted mb-4">No server credentials required — configured in external dashboard.</p>
                  )}

                  <a
                    href={integration.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12px] text-primary font-semibold hover:underline"
                  >
                    Open Dashboard
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* API Reference */}
      <h3 className="text-sm font-bold text-foreground mt-8 mb-3">API Endpoints</h3>
      <div className="bg-background border border-border/50 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="space-y-2">
          {API_ENDPOINTS.map((endpoint) => (
            <div key={`${endpoint.method}-${endpoint.path}`} className="flex items-center gap-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                endpoint.method === 'GET' ? 'bg-green-100 text-green-600' :
                endpoint.method === 'POST' ? 'bg-blue-100 text-blue-600' :
                'bg-yellow-100 text-yellow-600'
              }`}>
                {endpoint.method}
              </span>
              <code className="text-[12px] font-mono text-foreground">{endpoint.path}</code>
              <span className="text-[11px] text-muted ml-auto hidden sm:block">{endpoint.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
