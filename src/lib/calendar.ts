// Add-to-calendar helpers. Times are emitted as "floating" local time (no
// timezone/Z suffix) so the event lands at the same wall-clock time in the
// attendee's calendar — correct for the common case where everyone is in the
// activity's local area.

export interface CalendarEvent {
  title: string
  date: string | null // YYYY-MM-DD
  time: string | null // HH:MM[:SS]
  durationHours?: number | null
  location?: string | null
  description?: string | null
  uid?: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function ymd(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function ymdhm(d: Date): string {
  return `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`
}

interface Stamps {
  start: string
  end: string
  allDay: boolean
}

function computeStamps(ev: CalendarEvent): Stamps | null {
  if (!ev.date) return null
  const [y, mo, d] = ev.date.split('-').map(Number)
  if (!y || !mo || !d) return null

  if (!ev.time) {
    // All-day: DTEND is exclusive, so use the next day.
    const start = new Date(y, mo - 1, d)
    const end = new Date(y, mo - 1, d + 1)
    return { start: ymd(start), end: ymd(end), allDay: true }
  }

  const [h, mi] = ev.time.split(':').map(Number)
  const start = new Date(y, mo - 1, d, h || 0, mi || 0)
  const dur = ev.durationHours && ev.durationHours > 0 ? ev.durationHours : 2
  const end = new Date(start.getTime() + dur * 3600 * 1000)
  return { start: ymdhm(start), end: ymdhm(end), allDay: false }
}

export function googleCalendarUrl(ev: CalendarEvent): string | null {
  const s = computeStamps(ev)
  if (!s) return null
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title || 'Activity',
    dates: `${s.start}/${s.end}`,
  })
  if (ev.location) params.set('location', ev.location)
  if (ev.description) params.set('details', ev.description)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

export function icsContent(ev: CalendarEvent): string | null {
  const s = computeStamps(ev)
  if (!s) return null
  const now = new Date()
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  const uid = `${ev.uid ?? Math.random().toString(36).slice(2)}@whozin.io`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Whozin//Activities//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    s.allDay ? `DTSTART;VALUE=DATE:${s.start}` : `DTSTART:${s.start}`,
    s.allDay ? `DTEND;VALUE=DATE:${s.end}` : `DTEND:${s.end}`,
    `SUMMARY:${escapeIcs(ev.title || 'Activity')}`,
    ...(ev.location ? [`LOCATION:${escapeIcs(ev.location)}`] : []),
    ...(ev.description ? [`DESCRIPTION:${escapeIcs(ev.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

/** Open the Google Calendar "add event" template in a new tab. */
export function openGoogleCalendar(ev: CalendarEvent): void {
  const url = googleCalendarUrl(ev)
  if (url) window.open(url, '_blank')
}

/** Download an .ics file (Apple Calendar / Outlook / etc.). */
export function downloadIcs(ev: CalendarEvent, filename = 'event'): void {
  const content = icsContent(ev)
  if (!content) return
  const safe = filename.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'event'
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safe}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
