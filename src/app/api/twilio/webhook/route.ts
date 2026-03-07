import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

// POST — Twilio sends incoming SMS here
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = (formData.get('From') as string) ?? ''
  const body = (formData.get('Body') as string) ?? ''

  const admin = getAdminClient()

  // Normalize the phone number — strip + and country code variations
  const fromDigits = from.replace(/\D/g, '')

  // Find the user by phone (try with and without country code)
  const phonesToTry = [from, `+${fromDigits}`, fromDigits]
  if (fromDigits.startsWith('1') && fromDigits.length === 11) {
    phonesToTry.push(`+${fromDigits}`, fromDigits.substring(1))
  }

  let whozinUser = null
  for (const phone of phonesToTry) {
    const { data } = await admin
      .from('whozin_users')
      .select('id')
      .eq('phone', phone)
      .single()
    if (data) {
      whozinUser = data
      break
    }
  }

  if (!whozinUser) {
    // Unknown number — respond politely
    return twimlResponse('Sorry, we could not find your account. Visit whozin.io to get started!')
  }

  // Parse the reply — look for "in" or "out"
  const reply = body.trim().toLowerCase()
  const isIn = /^(in|yes|y|i'm in|im in|i am in)$/i.test(reply)
  const isOut = /^(out|no|n|i'm out|im out|i am out|pass|nah)$/i.test(reply)

  if (!isIn && !isOut) {
    return twimlResponse(
      'Reply IN to confirm or OUT to pass. Visit whozin.io for more options!'
    )
  }

  // Find the most recent pending invite for this user
  const { data: invite } = await admin
    .from('whozin_invite')
    .select('id, activity_id')
    .eq('user_id', whozinUser.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!invite) {
    return twimlResponse(
      "You don't have any pending invites right now. Check whozin.io for your activities!"
    )
  }

  // Update the invite status
  await admin
    .from('whozin_invite')
    .update({
      status: 'responded',
      response: isIn ? 'in' : 'out',
    })
    .eq('id', invite.id)

  // Update the activity member status
  const newStatus = isIn ? 'confirmed' : 'out'
  await admin
    .from('whozin_activity_member')
    .update({
      status: newStatus,
      responded_at: new Date().toISOString(),
    })
    .eq('activity_id', invite.activity_id)
    .eq('user_id', whozinUser.id)

  // Update capacity_current if they're in
  if (isIn) {
    const { count } = await admin
      .from('whozin_activity_member')
      .select('id', { count: 'exact', head: true })
      .eq('activity_id', invite.activity_id)
      .eq('status', 'confirmed')

    await admin
      .from('whozin_activity')
      .update({ capacity_current: count ?? 0 })
      .eq('id', invite.activity_id)
  }

  // Get the activity name for the confirmation
  const { data: activity } = await admin
    .from('whozin_activity')
    .select('activity_name')
    .eq('id', invite.activity_id)
    .single()

  const activityName = activity?.activity_name ?? 'the activity'

  if (isIn) {
    return twimlResponse(`You're in for ${activityName}! See you there. Check whozin.io for details.`)
  } else {
    return twimlResponse(`Got it, you're out for ${activityName}. Maybe next time!`)
  }
}

/** Return a TwiML response so Twilio sends an SMS reply */
function twimlResponse(message: string) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

function escapeXml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
