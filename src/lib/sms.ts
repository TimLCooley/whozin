const ADMIN_PHONE = '+16193019180'

/** Area codes that are test numbers — SMS routes to admin phone instead */
const TEST_AREA_CODES = ['999']

export function isTestNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('1') && digits.length >= 4) {
    return TEST_AREA_CODES.includes(digits.substring(1, 4))
  }
  return false
}

/** Core SMS/MMS sender via Twilio */
export async function sendSms(to: string, body: string, mediaUrl?: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim()

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio not configured, skipping SMS')
    return { success: false, reason: 'twilio_not_configured' }
  }

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const res = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: body,
        ...(mediaUrl ? { MediaUrl: mediaUrl } : {}),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Twilio SMS error:', data)
      return { success: false, reason: data.message || 'twilio_error' }
    }

    return { success: true, sid: data.sid }
  } catch (err) {
    console.error('SMS send error:', err)
    return { success: false, reason: String(err) }
  }
}

/** Route test numbers to admin phone, append test note */
function resolveRecipient(toPhone: string) {
  const actualTo = isTestNumber(toPhone) ? ADMIN_PHONE : toPhone
  const testNote = isTestNumber(toPhone) ? ` [TEST: originally to ${toPhone}]` : ''
  return { actualTo, testNote }
}

/** Send a group invite SMS */
export async function sendSmsInvite(toPhone: string, inviterName: string) {
  const { actualTo, testNote } = resolveRecipient(toPhone)
  const message =
    `${inviterName} added you to a group on Whozin! Are you in? ` +
    `Download the app to see what's happening: https://whozin.io/dl` +
    testNote
  return sendSms(actualTo, message)
}

/** Send an activity invite SMS/MMS — branded "Are you in?" */
export async function sendActivityInvite(
  toPhone: string,
  inviterName: string,
  activityName: string,
  dateTime: string,
  imageUrl?: string
) {
  const { actualTo, testNote } = resolveRecipient(toPhone)
  const message =
    `${inviterName} is inviting you to ${activityName} on ${dateTime}. ` +
    `Are you in? Reply IN or OUT` +
    testNote
  return sendSms(actualTo, message, imageUrl)
}
