import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Build an Activity in 30 Seconds | Whozin',
  description: 'Create a group activity, set the number of spots, choose priority invite or blast all, and watch your group build itself. No group chat needed. Invitees respond via text.',
  keywords: ['create group activity', 'organize sports game', 'invite friends to play', 'activity organizer app', 'group event planner', 'RSVP by text', 'no app required invite'],
  openGraph: {
    title: 'Build an Activity in 30 Seconds | Whozin',
    description: 'Create a group activity, set spots, choose priority or blast all. The group builds itself via text. No app required for invitees.',
    url: 'https://whozin.io/build',
  },
  alternates: { canonical: 'https://whozin.io/build' },
}

export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return children
}
