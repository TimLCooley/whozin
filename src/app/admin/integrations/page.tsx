'use client'

import { useState, useEffect } from 'react'

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
    description: 'Android app distribution and in-app billing.',
    icon: '🤖',
    envVars: [
      { key: 'GOOGLE_PLAY_SERVICE_ACCOUNT', label: 'Service Account JSON', secret: true },
    ],
    docsUrl: 'https://play.google.com/console/',
  },
  {
    name: 'Firebase (Push Notifications)',
    description: 'Cross-platform push notifications via FCM.',
    icon: '🔔',
    envVars: [
      { key: 'FIREBASE_PROJECT_ID', label: 'Project ID' },
      { key: 'FIREBASE_SERVER_KEY', label: 'Server Key', secret: true },
      { key: 'NEXT_PUBLIC_FIREBASE_VAPID_KEY', label: 'VAPID Key' },
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
    name: 'Capacitor (Native Apps)',
    description: 'iOS: io.whozin.app / Android: io.whozin.app — CI/CD via GitHub Actions',
    icon: '📱',
    envVars: [],
    docsUrl: 'https://capacitorjs.com/docs',
  },
]

const API_ENDPOINTS = [
  // Auth
  { method: 'POST', path: '/api/auth/send-otp', desc: 'Send OTP code via SMS' },
  { method: 'POST', path: '/api/auth/verify-otp', desc: 'Verify OTP and create/link account' },
  { method: 'POST', path: '/api/auth/sign-up', desc: 'Legacy password sign-up' },
  { method: 'GET', path: '/auth/callback', desc: 'OAuth callback (Google/Apple)' },
  // User
  { method: 'GET', path: '/api/user/profile', desc: 'Current user profile' },
  { method: 'POST', path: '/api/user/verify-email', desc: 'Send email verification code' },
  { method: 'PUT', path: '/api/user/verify-email', desc: 'Verify and update email' },
  // Groups
  { method: 'GET', path: '/api/groups', desc: 'List user groups' },
  { method: 'POST', path: '/api/groups', desc: 'Create group' },
  { method: 'GET', path: '/api/groups/[id]', desc: 'Group detail with members' },
  { method: 'POST', path: '/api/groups/[id]/members', desc: 'Add member to group' },
  { method: 'GET', path: '/api/groups/contacts', desc: 'Contacts from user groups' },
  { method: 'GET', path: '/api/friends', desc: 'Friends list (from all groups)' },
  // Activities
  { method: 'GET', path: '/api/activities', desc: 'List activities' },
  { method: 'POST', path: '/api/activities', desc: 'Create activity' },
  { method: 'GET', path: '/api/activities/presets', desc: 'Activity presets' },
  { method: 'POST', path: '/api/activities/upload-image', desc: 'Upload activity image' },
  { method: 'POST', path: '/api/activities/generate-image', desc: 'AI-generate activity image' },
  // Google
  { method: 'GET', path: '/api/google/contacts', desc: 'Search Google Contacts' },
  // Contact
  { method: 'POST', path: '/api/contact', desc: 'Contact form submission' },
  // Admin
  { method: 'GET', path: '/api/admin/settings', desc: 'Fetch all app settings' },
  { method: 'PUT', path: '/api/admin/settings', desc: 'Update app settings' },
  { method: 'POST', path: '/api/admin/upload', desc: 'Upload branding assets' },
  { method: 'GET', path: '/api/admin/env-status', desc: 'Check env var status' },
  { method: 'GET', path: '/api/admin/stats', desc: 'Dashboard stats' },
  { method: 'GET', path: '/api/admin/users', desc: 'All users (admin)' },
  { method: 'GET', path: '/api/admin/groups', desc: 'All groups (admin)' },
  { method: 'GET', path: '/api/admin/activities', desc: 'All activities (admin)' },
  { method: 'GET', path: '/api/admin/organizations', desc: 'All organizations (admin)' },
  // Builds
  { method: 'GET', path: '/api/admin/builds', desc: 'Build history (admin)' },
  { method: 'POST', path: '/api/admin/builds', desc: 'Record build event (CI webhook)' },
  { method: 'POST', path: '/api/admin/builds/setup', desc: 'Create app_builds table' },
  // Webhooks
  { method: 'POST', path: '/api/webhooks/revenuecat', desc: 'RevenueCat subscription events' },
  { method: 'POST', path: '/api/webhooks/stripe', desc: 'Stripe subscription events' },
  // Twilio
  { method: 'POST', path: '/api/twilio/webhook', desc: 'Twilio SMS status callback' },
  // Misc
  { method: 'POST', path: '/api/messaging/test', desc: 'Send test SMS/email' },
  { method: 'GET', path: '/api/favicon', desc: 'Dynamic favicon' },
  { method: 'GET', path: '/api/locations', desc: 'Allowed country codes' },
  { method: 'GET', path: '/api/alerts', desc: 'User alerts/notifications' },
  { method: 'POST', path: '/api/cron/process-invites', desc: 'Process invite queue (cron)' },
]

function getStatus(integration: Integration, envStatus: Record<string, boolean>): 'configured' | 'partial' | 'missing' {
  const set = integration.envVars.filter((v) => envStatus[v.key])
  if (set.length === integration.envVars.length) return 'configured'
  if (set.length > 0) return 'partial'
  return 'missing'
}

export default function IntegrationsPage() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/env-status')
      .then((r) => r.json())
      .then(setEnvStatus)
      .finally(() => setLoading(false))
  }, [])

  const configured = INTEGRATIONS.filter((i) => getStatus(i, envStatus) === 'configured').length

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">API & Integrations</h2>
      <p className="text-[13px] text-muted mb-6">
        {loading ? '...' : `${configured}/${INTEGRATIONS.length}`} integrations fully configured.
        Environment variables are managed in Vercel project settings.
      </p>

      <div className="space-y-3">
        {INTEGRATIONS.map((integration) => {
          const status = loading ? 'missing' : getStatus(integration, envStatus)
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
                <StatusBadge status={status} />
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

function StatusBadge({ status }: { status: string }) {
  const styles = {
    configured: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    missing: 'bg-red-100 text-red-600',
  }
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${styles[status as keyof typeof styles]}`}>
      {status}
    </span>
  )
}
