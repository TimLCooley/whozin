import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { phoneToEmail, normalizePhone } from '@/lib/auth'

function friendlyError(message: string | undefined, type: string): string {
  if (!message) return 'Something went wrong. Please try again.'

  if (message.includes('already been registered') || message.includes('already exists'))
    return `An account with this ${type} already exists. Try signing in instead.`

  if (message.includes('Password'))
    return message // Supabase password errors are already clear

  if (message.includes('valid email'))
    return `Please enter a valid ${type}.`

  if (message.includes('Database error'))
    return `Unable to create account. This ${type} may already be in use, or there was a database issue. Please try again.`

  // Pass through the actual error so we can debug
  return `Sign-up failed: ${message}`
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { firstName, lastName, identifier, password, countryCode, usePhone } = body

  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  }
  if (!identifier?.trim()) {
    return NextResponse.json({ error: 'Phone or email is required.' }, { status: 400 })
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }

  const admin = getAdminClient()

  if (usePhone) {
    // Phone sign-up: create with admin client (auto-confirmed, no email sent)
    const phone = normalizePhone(identifier, countryCode || '1')
    const authEmail = phoneToEmail(phone)

    const { data, error } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true, // auto-confirm — no verification email for synthetic emails
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone,
        country_code: countryCode || '1',
      },
    })

    if (error) {
      return NextResponse.json(
        { error: friendlyError(error.message, 'phone number') },
        { status: error.message?.includes('already') ? 409 : 400 }
      )
    }

    return NextResponse.json({ success: true, userId: data.user.id })
  } else {
    // Email sign-up: use admin client but do NOT auto-confirm — Supabase sends confirmation email
    const email = identifier.trim()

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // requires email verification
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      },
    })

    if (error) {
      return NextResponse.json(
        { error: friendlyError(error.message, 'email') },
        { status: error.message?.includes('already') ? 409 : 400 }
      )
    }

    return NextResponse.json({
      success: true,
      userId: data.user.id,
      confirmEmail: true, // tell the client to show "check your email" message
    })
  }
}
