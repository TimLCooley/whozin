import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { channel, to, message, subject } = await req.json()

  if (!to || !message) {
    return NextResponse.json({ error: 'Recipient and message are required' }, { status: 400 })
  }

  try {
    if (channel === 'sms') {
      // Send test SMS via Twilio
      const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
      const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
      const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim()

      if (!accountSid || !authToken || !fromNumber) {
        return NextResponse.json({ error: 'Twilio credentials not configured. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env.local' }, { status: 500 })
      }

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
          Body: message,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        return NextResponse.json({ error: data.message || 'Twilio error', details: data }, { status: 500 })
      }

      return NextResponse.json({ success: true, sid: data.sid })
    }

    if (channel === 'email') {
      // Send test email via SendGrid
      const apiKey = process.env.SENDGRID_API_KEY?.trim()
      const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim()

      if (!apiKey || !fromEmail) {
        return NextResponse.json({ error: 'SendGrid credentials not configured. Check SENDGRID_API_KEY, SENDGRID_FROM_EMAIL in .env.local' }, { status: 500 })
      }

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: 'Whozin' },
          subject: subject || 'Whozin Test Message',
          content: [{ type: 'text/plain', value: message }],
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json({ error: `SendGrid error: ${text}` }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
