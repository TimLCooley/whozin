'use client'

import { useState } from 'react'

interface Template {
  id: string
  name: string
  channel: 'email' | 'sms'
  category: string
  subject?: string
  body: string
  description: string
}

const DEFAULT_TEMPLATES: Template[] = [
  // Email templates
  {
    id: 'welcome_email',
    name: 'Welcome Email',
    channel: 'email',
    category: 'Onboarding',
    subject: 'Welcome to Whozin! 🎉',
    body: 'Hi {{first_name}},\n\nWelcome to Whozin! We\'re excited to have you.\n\nStart by creating a group and inviting your friends to find out who\'s in.\n\nBest,\nThe Whozin Team',
    description: 'Sent when a new user completes registration.',
  },
  {
    id: 'activity_invite_email',
    name: 'Activity Invitation',
    channel: 'email',
    category: 'Activities',
    subject: '{{creator_name}} invited you to {{activity_name}}',
    body: 'Hi {{first_name}},\n\n{{creator_name}} has invited you to {{activity_name}} on {{activity_date}}.\n\nTap below to respond:\n{{response_link}}\n\nBest,\nThe Whozin Team',
    description: 'Sent when a user is invited to an activity.',
  },
  {
    id: 'activity_reminder_email',
    name: 'Activity Reminder',
    channel: 'email',
    category: 'Activities',
    subject: 'Reminder: {{activity_name}} is coming up!',
    body: 'Hi {{first_name}},\n\n{{activity_name}} is happening on {{activity_date}} at {{activity_time}}.\n\nLocation: {{location}}\n\nSee you there!\nThe Whozin Team',
    description: 'Sent 24 hours before an activity.',
  },
  {
    id: 'group_invite_email',
    name: 'Group Invitation',
    channel: 'email',
    category: 'Groups',
    subject: '{{inviter_name}} added you to {{group_name}}',
    body: 'Hi {{first_name}},\n\n{{inviter_name}} has added you to the group "{{group_name}}" on Whozin.\n\nOpen the app to see the group.\n\nBest,\nThe Whozin Team',
    description: 'Sent when a user is added to a group.',
  },
  {
    id: 'password_reset_email',
    name: 'Password Reset',
    channel: 'email',
    category: 'Auth',
    subject: 'Your Whozin verification code',
    body: 'Hi {{first_name}},\n\nYour verification code is: {{code}}\n\nThis code expires in 10 minutes.\n\nIf you didn\'t request this, please ignore this email.\n\nBest,\nThe Whozin Team',
    description: 'Sent when a user requests a password reset.',
  },
  {
    id: 'account_deleted_email',
    name: 'Account Deleted',
    channel: 'email',
    category: 'Account',
    subject: 'Your Whozin account has been deleted',
    body: 'Hi {{first_name}},\n\nYour Whozin account has been successfully deleted. All your data has been removed.\n\nWe\'re sorry to see you go. If you change your mind, you can always create a new account.\n\nBest,\nThe Whozin Team',
    description: 'Sent after account deletion is completed.',
  },
  // SMS templates
  {
    id: 'otp_sms',
    name: 'OTP Code',
    channel: 'sms',
    category: 'Auth',
    body: 'Your Whozin code is {{code}}. Expires in 10 min. Don\'t share this code.',
    description: 'SMS OTP for phone authentication.',
  },
  {
    id: 'activity_invite_sms',
    name: 'Activity Invite SMS',
    channel: 'sms',
    category: 'Activities',
    body: '{{creator_name}} invited you to "{{activity_name}}" on {{activity_date}}. Reply YES or NO, or tap: {{link}}',
    description: 'SMS sent when inviting a user to an activity.',
  },
  {
    id: 'activity_reminder_sms',
    name: 'Activity Reminder SMS',
    channel: 'sms',
    category: 'Activities',
    body: 'Reminder: {{activity_name}} is tomorrow at {{activity_time}}. {{location}}',
    description: 'SMS reminder before an activity.',
  },
  {
    id: 'group_invite_sms',
    name: 'Group Invite SMS',
    channel: 'sms',
    category: 'Groups',
    body: '{{inviter_name}} added you to "{{group_name}}" on Whozin. Download the app: {{link}}',
    description: 'SMS sent when adding a non-user to a group.',
  },
]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES)
  const [editing, setEditing] = useState<Template | null>(null)
  const [filterChannel, setFilterChannel] = useState<'all' | 'email' | 'sms'>('all')

  const filtered = filterChannel === 'all'
    ? templates
    : templates.filter((t) => t.channel === filterChannel)

  const categories = [...new Set(filtered.map((t) => t.category))]

  function handleSave() {
    if (!editing) return
    setTemplates((prev) => prev.map((t) => (t.id === editing.id ? editing : t)))
    // TODO: persist to whozin_settings or a templates table
    setEditing(null)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">System Templates</h2>
      <p className="text-[13px] text-muted mb-6">Manage email and SMS templates for automated system messages.</p>

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {(['all', 'email', 'sms'] as const).map((ch) => (
          <button
            key={ch}
            onClick={() => setFilterChannel(ch)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
              filterChannel === ch ? 'bg-primary text-white' : 'bg-background border border-border text-foreground'
            }`}
          >
            {ch === 'all' ? 'All' : ch.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Templates by category */}
      {categories.map((cat) => (
        <div key={cat} className="mb-6">
          <h3 className="text-[12px] font-bold text-muted uppercase tracking-wide mb-2">{cat}</h3>
          <div className="space-y-2">
            {filtered
              .filter((t) => t.category === cat)
              .map((template) => (
                <button
                  key={template.id}
                  onClick={() => setEditing({ ...template })}
                  className="w-full text-left bg-background border border-border/50 rounded-xl p-4 hover:bg-surface active:bg-surface transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-semibold text-foreground">{template.name}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      template.channel === 'email' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                    }`}>
                      {template.channel}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">{template.description}</p>
                </button>
              ))}
          </div>
        </div>
      ))}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop bg-black/40 px-4 pb-4" onClick={() => setEditing(null)}>
          <div className="modal-panel bg-background rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[85dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">{editing.name}</h3>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                editing.channel === 'email' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
              }`}>
                {editing.channel}
              </span>
            </div>
            <p className="text-[12px] text-muted mb-4">{editing.description}</p>

            {editing.channel === 'email' && (
              <div className="mb-4">
                <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">Subject</label>
                <input
                  type="text"
                  value={editing.subject || ''}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  className="input-field"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-[13px] font-medium text-foreground/70 mb-1.5">Body</label>
              <textarea
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                rows={8}
                className="input-field resize-none font-mono text-[12px]"
              />
            </div>

            <div className="bg-surface rounded-lg p-3 mb-5">
              <p className="text-[11px] font-medium text-muted mb-1">Available variables:</p>
              <p className="text-[11px] text-muted">
                {'{{first_name}}, {{last_name}}, {{creator_name}}, {{activity_name}}, {{activity_date}}, {{activity_time}}, {{location}}, {{group_name}}, {{inviter_name}}, {{code}}, {{link}}, {{response_link}}'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 border border-border text-foreground font-semibold text-[13px] py-2.5 rounded-xl"
              >
                Cancel
              </button>
              <button onClick={handleSave} className="btn-primary flex-1 py-2.5">
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
