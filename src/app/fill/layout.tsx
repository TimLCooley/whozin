import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Auto-Fill Empty Spots When Someone Bails | Whozin',
  description: 'Three ways to fill a spot when someone cancels: Emergency Fill, Auto Emergency Fill, and Open Fill. Average fill time: under 60 seconds. Never cancel a game again.',
  keywords: ['fill empty spot sports', 'find sub for game', 'someone cancelled game', 'auto fill sports roster', 'replace player last minute', 'emergency substitute finder', 'never cancel game again'],
  openGraph: {
    title: 'Auto-Fill Empty Spots When Someone Bails | Whozin',
    description: 'Someone bails? Whozin fills the spot in under 60 seconds. Three fill modes: Emergency, Auto, and Open Fill.',
    url: 'https://whozin.io/fill',
  },
  alternates: { canonical: 'https://whozin.io/fill' },
}

export default function FillLayout({ children }: { children: React.ReactNode }) {
  return children
}
