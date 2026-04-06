import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How Whozin Works — Organize Group Activities Without the Group Chat',
  description: 'Build a group, create an activity, set spots, send invites via text. Responses come in automatically. Someone bails? Auto-filled. The complete Whozin walkthrough in 5 steps.',
  keywords: ['how whozin works', 'group activity organizer', 'organize pickup games', 'text based RSVP', 'no app group invite', 'sports activity coordinator', 'replace group chat for sports'],
  openGraph: {
    title: 'How Whozin Works — 5 Steps to Organize Any Group Activity',
    description: 'Build a group, create an activity, send invites via text. Responses come in live. Someone bails? Auto-filled. No app required for invitees.',
    url: 'https://whozin.io/how-it-works',
  },
  alternates: { canonical: 'https://whozin.io/how-it-works' },
}

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children
}
