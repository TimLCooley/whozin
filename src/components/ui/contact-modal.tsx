'use client'

import { useState } from 'react'
import { BrandedFavicon } from '@/components/ui/branded-logo'

export function ContactModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => !sending && onClose()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-[#3367D6] px-6 py-5 text-center">
          <div className="flex justify-center mb-2"><BrandedFavicon className="w-10 h-10 rounded-lg" /></div>
          <h3 className="text-white text-lg font-bold">
            {sent ? "Message Sent!" : "Get in Touch"}
          </h3>
          {!sent && (
            <p className="text-white/70 text-sm mt-1">We&apos;d love to hear from you</p>
          )}
        </div>

        {/* Body */}
        <div className="bg-white p-6">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00C853]/10 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00C853" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <p className="text-[#1a1a2e] text-[15px] font-medium leading-relaxed">
                Thanks for reaching out, {name.split(' ')[0] || 'friend'}!
              </p>
              <p className="text-[#6b7280] text-[14px] mt-2 leading-relaxed">
                A member of the Whozin team will get back to you shortly. We also sent a copy to your email.
              </p>
              <p className="text-[#4285F4] text-[13px] font-semibold mt-4">
                Whoz<em className="not-italic font-extrabold">in</em>? You are.
              </p>
              <button
                onClick={onClose}
                className="mt-6 w-full py-3 rounded-xl bg-[#4285F4] text-white font-semibold text-[14px] active:opacity-80 transition-opacity"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[12px] font-semibold text-[#6b7280] uppercase tracking-wide mb-1.5">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full h-11 px-4 rounded-xl border border-[#e5e7eb] bg-[#f8f9fc] text-[14px] text-[#1a1a2e]
                               placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#4285F4]/30 focus:border-[#4285F4]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#6b7280] uppercase tracking-wide mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full h-11 px-4 rounded-xl border border-[#e5e7eb] bg-[#f8f9fc] text-[14px] text-[#1a1a2e]
                               placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#4285F4]/30 focus:border-[#4285F4]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#6b7280] uppercase tracking-wide mb-1.5">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can we help?"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f8f9fc] text-[14px] text-[#1a1a2e]
                               placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#4285F4]/30 focus:border-[#4285F4] resize-none"
                  />
                </div>
              </div>

              {error && (
                <p className="text-[13px] text-red-500 mt-2">{error}</p>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  onClick={onClose}
                  disabled={sending}
                  className="flex-1 py-3 rounded-xl text-[14px] font-semibold border border-[#e5e7eb] text-[#6b7280]
                             active:bg-[#f3f4f6] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!name.trim() || !email.trim() || !message.trim()) {
                      setError('Please fill in all fields')
                      return
                    }
                    if (!email.includes('@')) {
                      setError('Please enter a valid email')
                      return
                    }
                    setSending(true)
                    setError('')
                    try {
                      const res = await fetch('/api/contact', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, message }),
                      })
                      if (res.ok) {
                        setSent(true)
                      } else {
                        const data = await res.json()
                        setError(data.error || 'Failed to send. Please try again.')
                      }
                    } catch {
                      setError('Failed to send. Please try again.')
                    }
                    setSending(false)
                  }}
                  disabled={sending}
                  className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-[#4285F4] text-white
                             active:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>

              <p className="text-center text-[11px] text-[#9ca3af] mt-4">
                We&apos;ll send you a copy of your message too.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
