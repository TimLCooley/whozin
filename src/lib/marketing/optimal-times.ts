/**
 * Optimal posting windows per channel, in US Pacific Time.
 *
 * Based on published engagement research (Sprout Social, Later, Buffer averages):
 * - TikTok: evenings, especially Tue-Thu
 * - LinkedIn: morning commute, Tue-Thu
 * - Reddit: early US morning for east-coast peak traffic
 * - Instagram: midday + evening
 * - Newsletter: Tue/Thu morning (open-rate peak)
 *
 * These are v1 defaults. A smarter version could learn from your own click data
 * once you have enough historical posts.
 */

export interface PostingWindow {
  days: number[] // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  hour: number   // 0-23 in Pacific Time
  label: string
}

export const CHANNEL_WINDOWS: Record<string, PostingWindow[]> = {
  tiktok: [
    { days: [2, 3, 4], hour: 19, label: 'Tue–Thu 7pm PT (peak TikTok evening)' },
    { days: [2, 3, 4], hour: 12, label: 'Tue–Thu noon PT (lunch scroll)' },
    { days: [5], hour: 14, label: 'Fri 2pm PT' },
  ],
  linkedin: [
    { days: [2, 3, 4], hour: 8, label: 'Tue–Thu 8am PT (commute window)' },
    { days: [2, 3], hour: 12, label: 'Tue/Wed noon PT (lunch break)' },
  ],
  reddit: [
    { days: [1, 2, 3, 4], hour: 7, label: 'Weekday 7am PT (10am ET, US peak)' },
    { days: [0], hour: 8, label: 'Sunday 8am PT (weekend traffic)' },
  ],
  instagram: [
    { days: [2, 3, 4], hour: 11, label: 'Tue–Thu 11am PT' },
    { days: [2, 3, 4], hour: 19, label: 'Tue–Thu 7pm PT' },
  ],
  facebook: [
    { days: [3, 4], hour: 13, label: 'Wed/Thu 1pm PT' },
  ],
  newsletter: [
    { days: [2, 4], hour: 9, label: 'Tue/Thu 9am PT (newsletter open peak)' },
  ],
  other: [
    { days: [2, 3, 4], hour: 10, label: 'Tue–Thu 10am PT' },
  ],
}

export interface ScheduleSuggestion {
  iso: string
  reason: string
}

const PT_OFFSET_HOURS = -7 // PDT. Drifts 1h during PST (winter). v1 accepts this.
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const BUFFER_MS = 12 * HOUR_MS // minimum gap between scheduled items

/**
 * Suggest the next optimal posting time for a given channel.
 *
 * Logic:
 *  1. Collect all future-scheduled content items → find queue end
 *  2. minTime = max(queue_end + 12h buffer, now + 1h)
 *  3. Walk hour-by-hour from minTime forward, up to 21 days
 *  4. First hour that matches a preferred PT window wins
 *  5. Fallback: minTime + 24h
 */
export function suggestOptimalSchedule(
  channel: string,
  existingScheduleISOs: string[],
  now: Date = new Date(),
): ScheduleSuggestion {
  const windows = CHANNEL_WINDOWS[channel] ?? CHANNEL_WINDOWS.other
  const queueEnd = existingScheduleISOs.length
    ? Math.max(...existingScheduleISOs.map((s) => new Date(s).getTime()))
    : 0
  const minTime = Math.max(queueEnd + BUFFER_MS, now.getTime() + HOUR_MS)

  // Start at the top of the next hour after minTime
  const start = new Date(minTime)
  start.setUTCMinutes(0, 0, 0)
  if (start.getTime() < minTime) start.setUTCHours(start.getUTCHours() + 1)

  const maxHours = 21 * 24
  for (let hourOffset = 0; hourOffset < maxHours; hourOffset += 1) {
    const candidate = new Date(start.getTime() + hourOffset * HOUR_MS)
    // Convert candidate UTC → PT local time by shifting
    const ptShifted = new Date(candidate.getTime() + PT_OFFSET_HOURS * HOUR_MS)
    const ptHour = ptShifted.getUTCHours()
    const ptDayOfWeek = ptShifted.getUTCDay()

    for (const w of windows) {
      if (w.hour === ptHour && w.days.includes(ptDayOfWeek)) {
        return { iso: candidate.toISOString(), reason: w.label }
      }
    }
  }

  return {
    iso: new Date(minTime + DAY_MS).toISOString(),
    reason: 'Next available queue slot (no preferred window in range)',
  }
}
