import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Smart Groups & Priority Invite System | Whozin',
  description: 'Build smart groups for your regulars and set a priority order. Your most reliable players get first dibs. Backups auto-fill when someone drops. Never scramble for a fourth again.',
  keywords: ['smart groups app', 'priority invite system', 'golf foursome organizer', 'group priority order', 'sports group manager', 'find a sub for sports', 'replace player who bails'],
  openGraph: {
    title: 'Smart Groups & Priority Invite System | Whozin',
    description: 'Your regulars get first dibs. Backups auto-fill when someone drops. Build smart groups with priority order.',
    url: 'https://whozin.io/groups',
  },
  alternates: { canonical: 'https://whozin.io/groups' },
}

export default function GroupsLayout({ children }: { children: React.ReactNode }) {
  return children
}
