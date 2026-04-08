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
    return twimlResponse('Sorry, we could not find your account. Visit whozin.io to get started!')
  }

  const reply = body.trim().toLowerCase()

  // Check for FILL command (host triggering emergency fill)
  const isFill = /^(fill|fill it|send it|blast|emergency)$/i.test(reply)

  if (isFill) {
    return await handleFillCommand(whozinUser.id)
  }

  // Parse IN/OUT replies
  const isIn = /^(in|yes|y|i'm in|im in|i am in)$/i.test(reply)
  const isOut = /^(out|no|n|i'm out|im out|i am out|pass|nah)$/i.test(reply)

  if (!isIn && !isOut) {
    return twimlResponse(
      'Reply IN to confirm, OUT to pass, or FILL to send an emergency invite. Visit whozin.io for more!'
    )
  }

  // Find the most recent pending or expired invite for this user
  // (expired = timer ran out but user can still respond)
  const { data: invite } = await admin
    .from('whozin_invite')
    .select('id, activity_id, status')
    .eq('user_id', whozinUser.id)
    .in('status', ['pending', 'expired'])
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
    .update({ status: 'responded', response: isIn ? 'in' : 'out' })
    .eq('id', invite.id)

  // Get activity details for reply message and host notification
  const { data: activityData } = await admin
    .from('whozin_activity')
    .select('activity_name, creator_id')
    .eq('id', invite.activity_id)
    .single()

  // Update the activity member status (works even if they were 'missed' from expired timer)
  const newStatus = isIn ? 'confirmed' : 'out'
  await admin
    .from('whozin_activity_member')
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq('activity_id', invite.activity_id)
    .eq('user_id', whozinUser.id)

  // Update capacity count
  const { count: confirmedCount } = await admin
    .from('whozin_activity_member')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', invite.activity_id)
    .eq('status', 'confirmed')

  await admin
    .from('whozin_activity')
    .update({ capacity_current: confirmedCount ?? 0, status: 'open' })
    .eq('id', invite.activity_id)

  const activityName = activityData?.activity_name ?? 'the activity'

  // Notify the host when someone confirms
  if (isIn && activityData?.creator_id && activityData.creator_id !== whozinUser.id) {
    const { data: responder } = await admin
      .from('whozin_users')
      .select('first_name, last_name')
      .eq('id', whozinUser.id)
      .single()

    const responderName = responder ? `${responder.first_name} ${responder.last_name}`.trim() : 'Someone'
    const { createAlert } = await import('@/lib/alerts')
    await createAlert({
      user_id: activityData.creator_id,
      type: 'activity_invite',
      title: `${responderName} is in!`,
      body: `${responderName} confirmed for ${activityName}.`,
      link: `/app/activities/${invite.activity_id}`,
    })
  }

  // Normal queue processing
  if (isOut || isIn) {
    const { processActivityInvites } = await import('@/lib/invite-processor')
    await processActivityInvites(invite.activity_id)
  }

  if (isIn) {
    return twimlResponse(`Nice! You're on the list. Get the Whozin app to see all event details: https://whozin.io/dl`)
  } else {
    return twimlResponse(`Got it, maybe next time! If your plans change, you can update your status in the Whozin app: https://whozin.io/dl`)
  }
}

/** Handle FILL command from host */
async function handleFillCommand(userId: string) {
  const admin = getAdminClient()

  // Find the most recent open activity this user created that has open spots
  const { data: activity } = await admin
    .from('whozin_activity')
    .select('id, activity_name')
    .eq('creator_id', userId)
    .eq('status', 'open')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!activity) {
    return twimlResponse("You don't have any activities that need filling right now.")
  }

  const { sendEmergencyFill } = await import('@/lib/emergency-fill')
  const result = await sendEmergencyFill(activity.id)

  if (result.success) {
    return twimlResponse(
      `Emergency fill sent for ${activity.activity_name}! ${result.notified} people notified. First to reply IN gets the spot.`
    )
  } else {
    return twimlResponse(`Could not send emergency fill: ${result.reason}`)
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
