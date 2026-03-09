import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/auth'

/**
 * POST /api/auth/verify-phone
 * Verifies OTP and adds phone number to an OAuth user's profile.
 */
export async function POST(req: NextRequest) {
  const { phone, country_code, code } = await req.json()

  if (!phone?.trim() || !code?.trim()) {
    return NextResponse.json({ error: 'Phone and code are required' }, { status: 400 })
  }

  // Get current authenticated user
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const normalizedPhone = normalizePhone(phone, country_code || '1')
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

  // Mark OTP as used
  await admin.from('whozin_otp_codes').update({ used: true }).eq('id', otpRecord.id)

  // Check if another user already has this phone
  const { data: existingUser } = await admin
    .from('whozin_users')
    .select('id, auth_user_id')
    .eq('phone', normalizedPhone)
    .maybeSingle()

  if (existingUser && existingUser.auth_user_id && existingUser.auth_user_id !== user.id) {
    return NextResponse.json({ error: 'This phone number is already linked to another account.' }, { status: 400 })
  }

  if (existingUser && !existingUser.auth_user_id) {
    // Invited user with this phone — link the OAuth account to them
    // First delete the OAuth user's empty profile
    await admin.from('whozin_users').delete().eq('auth_user_id', user.id)
    // Then link the invited record
    await admin
      .from('whozin_users')
      .update({
        auth_user_id: user.id,
        phone: normalizedPhone,
        country_code: country_code || '1',
        status: 'active',
      })
      .eq('id', existingUser.id)
  } else {
    // Update the OAuth user's profile with the phone
    await admin
      .from('whozin_users')
      .update({
        phone: normalizedPhone,
        country_code: country_code || '1',
      })
      .eq('auth_user_id', user.id)
  }

  return NextResponse.json({ success: true })
}
