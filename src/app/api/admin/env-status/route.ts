import { NextResponse } from 'next/server'

const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SENDGRID_API_KEY',
  'SENDGRID_FROM_EMAIL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'STRIPE_TEST_SECRET_KEY',
  'STRIPE_TEST_PUBLISHABLE_KEY',
  'STRIPE_LIVE_SECRET_KEY',
  'STRIPE_LIVE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_SITE_URL',
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_PRIVATE_KEY',
  'GOOGLE_PLAY_SERVICE_ACCOUNT',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_SERVER_KEY',
  'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
]

export async function GET() {
  const status: Record<string, boolean> = {}
  for (const key of ENV_KEYS) {
    status[key] = !!process.env[key]?.trim()
  }
  return NextResponse.json(status)
}
