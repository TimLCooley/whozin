'use client'

import { useState } from 'react'

type Channel = 'email' | 'sms'
type Audience = 'all' | 'active' | 'free' | 'pro'

export default function MessagingPage() {
  const [channel, setChannel] = useState<Channel>('email')
  const [audience, setAudience] = useState<Audience>('all')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sentHistory] = useState<{ date: string; channel: string; audience: string; subject: string }[]>([])

  async function handleSend() {
    setSending(true)
    // TODO: call API to send broadcast via SendGrid/Twilio
    await new Promise((r) => setTimeout(r, 1500))
    setSending(false)
    setShowConfirm(false)
    setSubject('')
    setBody('')
    alert('Broadcast sent successfully!')
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">Messaging</h2>
      <p className="text-[13px] text-muted mb-6">Send broadcast emails or SMS to your users.</p>

      <div className="bg-background border border-border/50 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Channel selector */}
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-foreground/70 mb-2">Channel</label>
          <div className="flex gap-2">
            <button
              onClick={() => setChannel('email')}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-colors ${
                channel === 'email' ? 'bg-primary text-white' : 'bg-surface text-foreground border border-border'
              }`}
            >
              Email (SendGrid)
            </button>
            <button
              onClick={() => setChannel('sms')}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-colors ${
                channel === 'sms' ? 'bg-primary text-white' : 'bg-surface text-foreground border border-border'
              }`}
            >
              SMS (Twilio)
            </button>
          </div>
        </div>

        {/* Audience selector */}
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-foreground/70 mb-2">Audience</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
            className="input-field"
          >
            <option value="all">All Users</option>
            <option value="active">Active Users Only</option>
            <option value="free">Free Tier Users</option>
            <option value="pro">Pro Tier Users</option>
          </select>
        </div>

        {/* Subject (email only) */}
        {channel === 'email' && (
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-foreground/70 mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="input-field"
            />
          </div>
        )}

        {/* Message body */}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-foreground/70 mb-2">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={channel === 'email' ? 'HTML or plain text email body...' : 'SMS message (160 char recommended)...'}
            rows={6}
            className="input-field resize-none"
          />
          {channel === 'sms' && (
            <p className="text-[11px] text-muted mt-1">{body.length}/160 characters</p>
          )}
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={!body.trim() || (channel === 'email' && !subject.trim())}
          className="btn-primary w-full py-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          Preview & Send
        </button>
      </div>

      {/* Quick Test */}
      <TestMessage />

      {/* Send history */}
      <h3 className="text-sm font-bold text-foreground mt-8 mb-3">Send History</h3>
      {sentHistory.length === 0 ? (
        <p className="text-[13px] text-muted bg-background border border-border/50 rounded-xl p-4 text-center">
          No broadcasts sent yet.
        </p>
      ) : (
        <div className="space-y-2">
          {sentHistory.map((item, i) => (
            <div key={i} className="bg-background border border-border/50 rounded-xl p-3 text-[13px]">
              <p className="font-medium text-foreground">{item.subject}</p>
              <p className="text-muted text-[11px]">{item.channel} to {item.audience} &middot; {item.date}</p>
            </div>
          ))}
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-black/40 px-4">
          <div className="modal-panel bg-background rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-2">Confirm Broadcast</h3>
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-[13px]">
                <span className="text-muted">Channel</span>
                <span className="font-medium text-foreground">{channel === 'email' ? 'Email' : 'SMS'}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-muted">Audience</span>
                <span className="font-medium text-foreground capitalize">{audience} users</span>
              </div>
              {channel === 'email' && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted">Subject</span>
                  <span className="font-medium text-foreground">{subject}</span>
                </div>
              )}
              <div className="bg-surface rounded-lg p-3 mt-2 text-[12px] text-foreground/80 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {body}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border border-border text-foreground font-semibold text-[13px] py-2.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="btn-primary flex-1 py-2.5"
              >
                {sending ? 'Sending...' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TestMessage() {
  const [testChannel, setTestChannel] = useState<'sms' | 'email'>('sms')
  const [testTo, setTestTo] = useState('+16193019180')
  const [testSubject, setTestSubject] = useState('Whozin Test')
  const [testBody, setTestBody] = useState('This is a test message from Whozin admin.')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleTestSend() {
    setTestSending(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/messaging/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: testChannel,
          to: testTo,
          message: testBody,
          subject: testSubject,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTestResult({ ok: true, msg: `Sent! ${data.sid ? `SID: ${data.sid}` : ''}` })
      } else {
        setTestResult({ ok: false, msg: data.error || 'Failed to send' })
      }
    } catch (err) {
      setTestResult({ ok: false, msg: String(err) })
    }
    setTestSending(false)
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold text-foreground mb-3">Send Test Message</h3>
      <div className="bg-background border border-border/50 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="text-[12px] text-muted mb-3">
          Send a test to your own phone or email to verify Twilio/SendGrid are working.
        </p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { setTestChannel('sms'); setTestTo('+16193019180') }}
            className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
              testChannel === 'sms' ? 'bg-primary text-white' : 'bg-surface text-foreground border border-border'
            }`}
          >
            SMS
          </button>
          <button
            onClick={() => { setTestChannel('email'); setTestTo('timlcooley@gmail.com') }}
            className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
              testChannel === 'email' ? 'bg-primary text-white' : 'bg-surface text-foreground border border-border'
            }`}
          >
            Email
          </button>
        </div>

        <div className="mb-3">
          <label className="block text-[12px] font-medium text-foreground/70 mb-1">
            {testChannel === 'sms' ? 'Phone Number' : 'Email Address'}
          </label>
          <input
            type={testChannel === 'sms' ? 'tel' : 'email'}
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            className="input-field text-[13px]"
          />
        </div>

        {testChannel === 'email' && (
          <div className="mb-3">
            <label className="block text-[12px] font-medium text-foreground/70 mb-1">Subject</label>
            <input
              type="text"
              value={testSubject}
              onChange={(e) => setTestSubject(e.target.value)}
              className="input-field text-[13px]"
            />
          </div>
        )}

        <div className="mb-3">
          <label className="block text-[12px] font-medium text-foreground/70 mb-1">Message</label>
          <textarea
            value={testBody}
            onChange={(e) => setTestBody(e.target.value)}
            rows={2}
            className="input-field text-[13px] resize-none"
          />
        </div>

        <button
          onClick={handleTestSend}
          disabled={testSending || !testTo || !testBody}
          className="btn-primary w-full py-2.5 text-[13px] disabled:opacity-50"
        >
          {testSending ? 'Sending...' : `Send Test ${testChannel.toUpperCase()}`}
        </button>

        {testResult && (
          <p className={`text-[12px] mt-2 font-medium ${testResult.ok ? 'text-success' : 'text-danger'}`}>
            {testResult.msg}
          </p>
        )}
      </div>
    </div>
  )
}
