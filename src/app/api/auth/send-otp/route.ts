import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/auth'

const ADMIN_PHONE = '+16193019180'
const TEST_AREA_CODES = ['999']

// Dev access account — no SMS, fixed code
const DEV_PHONE = '+11111111111'
const DEV_CODE = '111111'

function isDevPhone(phone: string): boolean {
  return phone === DEV_PHONE
}

function isTestNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('1') && digits.length >= 4) {
    return TEST_AREA_CODES.includes(digits.substring(1, 4))
  }
  return false
}

export async function POST(req: NextRequest) {
  const { phone, country_code } = await req.json()

  if (!phone?.trim()) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(phone, country_code || '1')
  const admin = getAdminClient()

  // Dev account: fixed code, no SMS
  const isDev = isDevPhone(normalizedPhone)
  const code = isDev ? DEV_CODE : String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + (isDev ? 365 * 24 * 60 : 5) * 60 * 1000) // dev: 1 year, normal: 5 min

  // Invalidate previous unused codes for this phone
  await admin
    .from('whozin_otp_codes')
    .update({ used: true })
    .eq('phone', normalizedPhone)
    .eq('used', false)

  // Store OTP
  const { error: insertError } = await admin
    .from('whozin_otp_codes')
    .insert({ phone: normalizedPhone, code, expires_at: expiresAt.toISOString() })

  if (insertError) {
    return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
  }

  // Dev account: skip SMS entirely, return code for auto-fill
  if (isDev) {
    console.log(`[OTP] Dev account ${normalizedPhone}: ${code}`)
    return NextResponse.json({ success: true, dev_code: code })
  }

  // Send via Twilio
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim()

  if (!accountSid || !authToken || !fromNumber) {
    // Dev fallback: log to console
    console.log(`[OTP] Code for ${normalizedPhone}: ${code}`)
    return NextResponse.json({ success: true, dev_code: process.env.NODE_ENV === 'development' ? code : undefined })
  }

  const smsTo = isTestNumber(normalizedPhone) ? ADMIN_PHONE : normalizedPhone
  const testNote = isTestNumber(normalizedPhone) ? ` [TEST for ${normalizedPhone}]` : ''
  const message = `Your Whozin code is: ${code}. It expires in 5 minutes.${testNote}`

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const res = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: smsTo, From: fromNumber, Body: message }),
    })

    if (!res.ok) {
      const data = await res.json()
      console.error('Twilio OTP error:', data)
      // Still return success — code is in DB, user can retry
      return NextResponse.json({ success: true, warning: 'SMS delivery may have failed' })
    }
  } catch (err) {
    console.error('OTP SMS error:', err)
  }

  return NextResponse.json({ success: true })
}
