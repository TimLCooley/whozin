import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { normalizePhone, phoneToEmail } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const { phone, country_code, code, first_name, last_name } = await req.json()

  if (!phone?.trim() || !code?.trim()) {
    return NextResponse.json({ error: 'Phone and code are required' }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(phone, country_code || '1')

  // Per-phone rate limit: 10 verify attempts per 15 minutes. Makes
  // brute-forcing the 6-digit OTP impractical.
  const rl = rateLimit({ key: `otp-verify:${normalizedPhone}`, max: 10, windowMs: 15 * 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const admin = getAdminClient()

  // Verify OTP
  const { data: otpRecord } = await admin
    .from('whozin_otp_codes')
    .select('*')
    .eq('phone', normalizedPhone)
    .eq('code', code.trim())
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!otpRecord) {
    return NextResponse.json({ error: 'Invalid or expired code. Please try again.' }, { status: 400 })
  }

  // Helper to mark OTP as consumed
  async function consumeOtp() {
    await admin.from('whozin_otp_codes').update({ used: true }).eq('id', otpRecord!.id)
  }

  // Check if a whozin_user already exists with this phone
  const { data: existingUser } = await admin
    .from('whozin_users')
    .select('id, auth_user_id, first_name, last_name, status')
    .eq('phone', normalizedPhone)
    .single()

  const syntheticEmail = phoneToEmail(normalizedPhone)
  const sessionPassword = randomUUID()

  // ── RETURNING USER — already has auth account ──
  if (existingUser?.auth_user_id) {
    // Look up the actual auth email — it may be the user's real email
    // (Google/Apple OAuth) or the synthetic phone email. Using the wrong one
    // here fails signInWithPassword with "Invalid login credentials".
    const { data: authUserRes } = await admin.auth.admin.getUserById(existingUser.auth_user_id)
    const authEmail = authUserRes?.user?.email || syntheticEmail

    await admin.auth.admin.updateUserById(existingUser.auth_user_id, {
      password: sessionPassword,
    })
    await consumeOtp()

    return NextResponse.json({
      success: true,
      action: 'sign_in',
      email: authEmail,
      token: sessionPassword,
    })
  }

  // ── INVITED USER — exists but no auth account ──
  if (existingUser && !existingUser.auth_user_id) {
    const needsName = !existingUser.first_name && !first_name

    if (needsName) {
      // Don't consume OTP yet — they'll re-submit with name
      return NextResponse.json({
        success: true,
        action: 'needs_name',
        existing_first_name: existingUser.first_name,
        existing_last_name: existingUser.last_name,
      })
    }

    const finalFirstName = (first_name?.trim() || existingUser.first_name || '').trim()
    const finalLastName = (last_name?.trim() || existingUser.last_name || '').trim()

    const { error: authError } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      password: sessionPassword,
      email_confirm: true,
      user_metadata: {
        first_name: finalFirstName,
        last_name: finalLastName,
        phone: normalizedPhone,
        country_code: country_code || '1',
      },
    })

    if (authError) {
      return NextResponse.json({ error: `Account creation failed: ${authError.message}` }, { status: 500 })
    }

    await consumeOtp()
    return NextResponse.json({
      success: true,
      action: 'sign_in',
      email: syntheticEmail,
      token: sessionPassword,
      is_new: true,
    })
  }

  // ── BRAND NEW USER — no whozin_user record at all ──
  if (!first_name?.trim() || !last_name?.trim()) {
    // Don't consume OTP yet — they'll re-submit with name
    return NextResponse.json({
      success: true,
      action: 'needs_name',
    })
  }

  const { error: authError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: sessionPassword,
    email_confirm: true,
    user_metadata: {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: normalizedPhone,
      country_code: country_code || '1',
    },
  })

  if (authError) {
    return NextResponse.json({ error: `Account creation failed: ${authError.message}` }, { status: 500 })
  }

  await consumeOtp()
  return NextResponse.json({
    success: true,
    action: 'sign_in',
    email: syntheticEmail,
    token: sessionPassword,
    is_new: true,
  })
}
