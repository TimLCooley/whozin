import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// In-memory store for verification codes (per user)
// In production, use a DB table or Redis — this works fine for a single-instance app
const pendingCodes = new Map<string, { code: string; email: string; expires: number }>()

// POST: send verification code to new email
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email } = await req.json()
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const trimmedEmail = email.trim().toLowerCase()

  // Generate a 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000))
  pendingCodes.set(user.id, { code, email: trimmedEmail, expires: Date.now() + 10 * 60 * 1000 }) // 10 min

  // Send via SendGrid
  const apiKey = process.env.SENDGRID_API_KEY?.trim()
  const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim()

  if (!apiKey || !fromEmail) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: trimmedEmail }] }],
      from: { email: fromEmail, name: 'Whozin' },
      subject: 'Your Whozin verification code',
      content: [{
        type: 'text/html',
        value: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="color: #1a1a2e; margin: 0 0 8px;">Verify your email</h2>
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Enter this code in the Whozin app to update your email address:</p>
            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1a1a2e;">${code}</span>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This code expires in 10 minutes. If you didn't request this, you can safely ignore it.</p>
          </div>
        `,
      }],
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// PUT: verify code and update email
export async function PUT(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const pending = pendingCodes.get(user.id)
  if (!pending) {
    return NextResponse.json({ error: 'No pending verification. Please request a new code.' }, { status: 400 })
  }

  if (Date.now() > pending.expires) {
    pendingCodes.delete(user.id)
    return NextResponse.json({ error: 'Code expired. Please request a new code.' }, { status: 400 })
  }

  if (pending.code !== code.trim()) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  // Code is valid — update email
  const admin = getAdminClient()
  const { error } = await admin
    .from('whozin_users')
    .update({ email: pending.email })
    .eq('auth_user_id', user.id)

  pendingCodes.delete(user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, email: pending.email })
}
