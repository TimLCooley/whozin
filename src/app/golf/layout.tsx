import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Golf Foursome Organizer — Fill Your Tee Time Every Week',
  description: 'Stop scrambling for a fourth. Whozin fills your golf foursome automatically. Set priority order, auto-invite backups when someone bails. Your buddies respond via text — no app needed.',
  keywords: ['golf foursome organizer', 'fill golf tee time', 'find fourth for golf', 'golf group organizer', 'golf sub finder', 'tee time RSVP app', 'organize weekly golf game', 'golf captain app', 'golf group text invite', 'golf no show replacement'],
  openGraph: {
    title: 'Golf Foursome Organizer — Never Play as a Threesome Again',
    description: 'Fill your foursome every week. Priority invites for your regulars, auto-fill for backups. Buddies reply via text — no app needed.',
    url: 'https://whozin.io/golf',
  },
  alternates: { canonical: 'https://whozin.io/golf' },
}

export default function GolfLayout({ children }: { children: React.ReactNode }) {
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
                name: "How do I fill my golf foursome when someone cancels?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Whozin auto-invites the next person on your backup list via text. They reply IN or OUT. If they pass, the next backup gets texted automatically. Average fill time: under 60 seconds."
                }
              },
              {
                "@type": "Question",
                name: "Do my golf buddies need to download an app?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "No. Your golf group responds via text message. They get a text asking 'Are you in?' and reply IN or OUT. No app download, no account creation, no friction."
                }
              },
              {
                "@type": "Question",
                name: "How does the priority invite system work for golf?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "You rank your golf buddies by reliability. When you create a tee time, Whozin invites from the top down. Your most reliable players get first dibs. Backups only get invited when there's an open spot."
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
