'use client'

import { useState } from 'react'
import { type CalendarEvent, openGoogleCalendar, downloadIcs } from '@/lib/calendar'

// Popup shown after a user taps "I'm In" (mode 'confirm') or when someone wants
// to add an activity to their calendar (mode 'calendar'). Confirms the spot and
// offers Google Calendar / Apple (.ics) shortcuts.
export function InConfirmModal({
  activityName,
  event,
  mode = 'confirm',
  onClose,
}: {
  activityName: string
  event: CalendarEvent
  mode?: 'confirm' | 'calendar'
  onClose: () => void
}) {
  const [added, setAdded] = useState(false)

  const heading = mode === 'confirm' ? 'You’re in! 🎉' : 'Add to calendar'
  const message =
    mode === 'confirm' ? (
      <>
        You’re confirmed for <span className="font-semibold">{activityName}</span>. Add it to your
        calendar so it’s not a surprise later.
      </>
    ) : (
      <>
        Add <span className="font-semibold">{activityName}</span> to your calendar.
      </>
    )

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-xl animate-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#00C853]/10 flex items-center justify-center">
            {mode === 'confirm' ? (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#00C853" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00C853" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M3 10h18M8 2v4M16 2v4" />
              </svg>
            )}
          </div>
          <h3 className="text-[17px] font-bold text-foreground">{heading}</h3>
          <p className="text-[14px] text-foreground/70 mt-2 leading-relaxed">{message}</p>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={() => { openGoogleCalendar(event); setAdded(true) }}
            className="w-full py-3 rounded-xl text-[14px] font-bold bg-primary text-white active:opacity-80 transition-opacity flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 10h18M8 2v4M16 2v4" />
            </svg>
            Google Calendar
          </button>
          <button
            onClick={() => { downloadIcs(event, activityName); setAdded(true) }}
            className="w-full py-3 rounded-xl text-[14px] font-bold bg-surface text-foreground border border-border/50 active:opacity-80 transition-opacity flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M8 11l4 4 4-4M4 19h16" />
            </svg>
            Apple Calendar / Other
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-muted active:opacity-70 transition-opacity"
          >
            {added ? 'Done' : mode === 'confirm' ? 'Maybe later' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
