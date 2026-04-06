import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Volleyball Team Organizer — Fill Positions, Not Just Headcount',
  description: 'Volleyball is position-dependent. Whozin fills the right position when someone bails — setter, hitter, libero. Build your roster, set priority by position, auto-fill smart. Players respond via text.',
  keywords: ['volleyball team organizer', 'volleyball sub finder', 'find setter for volleyball', 'volleyball roster manager', 'organize volleyball game', 'volleyball position fill', 'recreational volleyball organizer', 'volleyball league manager', 'need a setter volleyball'],
  openGraph: {
    title: "Volleyball Team Organizer — Can't Play Without a Setter",
    description: 'Position-aware roster filling. When your setter bails, Whozin contacts backup setters first.',
    url: 'https://whozin.io/volleyball',
  },
  alternates: { canonical: 'https://whozin.io/volleyball' },
}

export default function VolleyballLayout({ children }: { children: React.ReactNode }) {
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
                name: "How do I find a setter when mine cancels on volleyball night?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Whozin knows player positions. When your setter bails, it auto-texts your backup setters first — not just the next warm body. The right player fills the right position."
                }
              },
              {
                "@type": "Question",
                name: "Do volleyball players need an app to respond to invites?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "No. Players respond via text message. They get 'Are you in for Tuesday volleyball?' and reply IN or OUT. No download, no account, no friction."
                }
              },
              {
                "@type": "Question",
                name: "Can Whozin handle position-based roster filling for volleyball?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. You can tag players by position (setter, hitter, libero, etc.) and set priority order. When a position-specific spot opens, Whozin invites players who play that position first."
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
