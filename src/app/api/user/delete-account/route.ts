import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'

/**
 * DELETE /api/user/delete-account
 * Permanently deletes the user's account and all associated data.
 */
export async function DELETE() {
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

  const admin = getAdminClient()

  // Get the whozin_user record
  const { data: whozinUser } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (whozinUser) {
    // Delete group memberships
    await admin
      .from('whozin_group_members')
      .delete()
      .eq('user_id', whozinUser.id)

    // Delete activities created by user
    await admin
      .from('whozin_activities')
      .delete()
      .eq('creator_id', whozinUser.id)

    // Delete groups owned by user
    await admin
      .from('whozin_groups')
      .delete()
      .eq('creator_id', whozinUser.id)

    // Delete chat messages
    await admin
      .from('whozin_chat_messages')
      .delete()
      .eq('sender_id', whozinUser.id)

    // Delete activity responses
    await admin
      .from('whozin_activity_members')
      .delete()
      .eq('user_id', whozinUser.id)

    // Delete OTP codes
    if (whozinUser) {
      const { data: userData } = await admin
        .from('whozin_users')
        .select('phone')
        .eq('id', whozinUser.id)
        .single()
      if (userData?.phone) {
        await admin
          .from('whozin_otp_codes')
          .delete()
          .eq('phone', userData.phone)
      }
    }

    // Delete the whozin_users record
    await admin
      .from('whozin_users')
      .delete()
      .eq('id', whozinUser.id)
  }

  // Delete the Supabase auth user
  await admin.auth.admin.deleteUser(user.id)

  return NextResponse.json({ success: true })
}
