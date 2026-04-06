import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pickleball Court Organizer — Manage Players & Rotations',
  description: 'Organize pickleball sessions without the chaos. Set player caps per court, manage waitlists, auto-fill when someone drops. 20 people, 2 courts, zero drama. Players respond via text.',
  keywords: ['pickleball organizer app', 'pickleball court rotation', 'organize pickleball group', 'pickleball player manager', 'pickleball waitlist', 'court booking organizer', 'pickleball group text invite', 'pickleball session planner', 'manage pickleball players'],
  openGraph: {
    title: 'Pickleball Court Organizer — 20 Players, 2 Courts, Zero Chaos',
    description: 'Set player caps, manage waitlists, auto-fill dropouts. Organize pickleball without the group chat chaos.',
    url: 'https://whozin.io/pickleball',
  },
  alternates: { canonical: 'https://whozin.io/pickleball' },
}

export default function PickleballLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "How do I organize pickleball with more players than courts?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Set your court count and player cap in Whozin (e.g., 2 courts = 8 spots). Whozin enforces the cap. Extra players go on the waitlist and auto-fill when someone drops. No more showing up to 14 people for 8 spots."
                }
              },
              {
                "@type": "Question",
                name: "Do pickleball players need to download an app to respond?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "No. Players get a text message and reply IN or OUT. No app download, no account needed. Zero friction for your group."
                }
              },
              {
                "@type": "Question",
                name: "What happens when someone cancels on pickleball night?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "The next person on the waitlist gets auto-texted. They reply IN and the spot is filled. If they pass, Whozin moves to the next person. Average fill time: under 60 seconds."
                }
              },
            ],
          }),
        }}
      />
      {children}
    </>
  )
}
