import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { name, email, message } = await req.json()

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const apiKey = process.env.SENDGRID_API_KEY?.trim()
  const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim()

  if (!apiKey || !fromEmail) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const trimmedName = name.trim()
  const trimmedEmail = email.trim()
  const trimmedMessage = message.trim()

  // Send to Tim
  const adminEmail = fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: 'TimLCooley@gmail.com' }] }],
      from: { email: fromEmail, name: 'Whozin' },
      reply_to: { email: trimmedEmail, name: trimmedName },
      subject: 'Whozin Contact Form',
      content: [{
        type: 'text/html',
        value: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4285F4 0%, #3367D6 100%); border-radius: 16px 16px 0 0; padding: 24px 28px;">
              <h1 style="color: white; font-size: 20px; font-weight: 700; margin: 0;">New Contact Form Submission</h1>
            </div>
            <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px; padding: 28px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px; font-weight: 600; width: 80px; vertical-align: top;">Name</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px;">${trimmedName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px; font-weight: 600; vertical-align: top;">Email</td>
                  <td style="padding: 8px 0; color: #1a1a2e; font-size: 14px;"><a href="mailto:${trimmedEmail}" style="color: #4285F4;">${trimmedEmail}</a></td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 16px 0 8px; border-top: 1px solid #f3f4f6;">
                    <div style="color: #6b7280; font-size: 13px; font-weight: 600; margin-bottom: 8px;">Message</div>
                    <div style="color: #1a1a2e; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${trimmedMessage}</div>
                  </td>
                </tr>
              </table>
            </div>
          </div>
        `,
      }],
    }),
  })

  // Send confirmation to user
  const userEmail = fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: trimmedEmail }] }],
      from: { email: fromEmail, name: 'Whozin' },
      subject: 'We got your message!',
      content: [{
        type: 'text/html',
        value: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4285F4 0%, #3367D6 100%); border-radius: 16px 16px 0 0; padding: 32px 28px; text-align: center;">
              <div style="font-size: 36px; margin-bottom: 8px;">🐾</div>
              <h1 style="color: white; font-size: 22px; font-weight: 700; margin: 0;">Thanks for reaching out!</h1>
            </div>
            <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px; padding: 28px;">
              <p style="color: #1a1a2e; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                Hey ${trimmedName},
              </p>
              <p style="color: #4b5563; font-size: 14px; line-height: 1.7; margin: 0 0 20px;">
                We received your message and we're on it! A member of the Whozin team will get back to you shortly. In the meantime, here's a copy of what you sent:
              </p>
              <div style="background: #f8f9fc; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
                <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">Your message</p>
                <p style="color: #1a1a2e; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${trimmedMessage}</p>
              </div>
              <div style="border-top: 1px solid #f3f4f6; padding-top: 20px; text-align: center;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  — The Whozin Team 🐾
                </p>
                <p style="color: #d1d5db; font-size: 11px; margin: 8px 0 0;">
                  Whoz<span style="color: #4285F4; font-weight: 800;">in</span>? You are.
                </p>
              </div>
            </div>
          </div>
        `,
      }],
    }),
  })

  const [adminRes, userRes] = await Promise.all([adminEmail, userEmail])

  if (!adminRes.ok) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
