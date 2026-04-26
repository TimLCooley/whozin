import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import CodeGrab from "@/components/dev/code-grab";
import RunAsBanner from "@/components/admin/run-as-banner";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Whozin — Group Activity Organizer | Replace Your Group Chat",
    template: "%s | Whozin",
  },
  description:
    "Stop blowing up the group chat. Whozin sends a text — they reply IN or OUT. Priority invites, auto-waitlist, instant fill when someone bails. No app required for invitees. Free.",
  keywords: [
    "group activity organizer",
    "organize pickup games",
    "sports group coordinator",
    "RSVP by text message",
    "no app required invite",
    "replace group chat",
    "find sub for game",
    "auto fill sports roster",
    "priority invite system",
    "golf foursome organizer",
    "pickleball court organizer",
    "volleyball team organizer",
    "group event planner",
    "text based RSVP",
    "who's in who's out",
    "last minute cancellation sports",
  ],
  authors: [{ name: "Whozin" }],
  creator: "Whozin",
  metadataBase: new URL("https://whozin.io"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://whozin.io",
    siteName: "Whozin",
    title: "Whozin — Group Activity Organizer | IN or OUT via Text",
    description:
      "Organize any group activity in 30 seconds. Invitees reply IN or OUT by text — no app needed. Auto-fill when someone bails. Free forever.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Whozin — Group Activity Organizer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Whozin — Group Activity Organizer",
    description:
      "Send a text. They reply IN or OUT. Auto-fill when someone bails. No app required. Free.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/api/favicon",
    apple: "/api/favicon",
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: "https://whozin.io",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4285F4",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Whozin",
              applicationCategory: "SocialNetworkingApplication",
              operatingSystem: "Web, iOS, Android",
              description:
                "Group activity organizer that replaces messy group chats with a binary IN or OUT text system. Priority invites, auto-waitlist, instant fill when someone bails. No app required for invitees.",
              url: "https://whozin.io",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "5",
                ratingCount: "1",
              },
              featureList: [
                "Text-based RSVP — invitees reply IN or OUT via text message",
                "No app download required for invitees",
                "Smart Groups with priority invite order",
                "Auto-waitlist fills spots when someone cancels",
                "Emergency Fill blasts the group when someone bails last-minute",
                "Works for golf, pickleball, volleyball, basketball, and any group activity",
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Whozin",
              url: "https://whozin.io",
              logo: "https://whozin.io/api/favicon",
              sameAs: [],
              description: "Group activity organizer. Text-based IN or OUT RSVP system.",
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Whozin",
              url: "https://whozin.io",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://whozin.io/?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body className={`${jakarta.variable} antialiased`} suppressHydrationWarning>
        <RunAsBanner />
        {children}
        {process.env.NODE_ENV === "development" && <CodeGrab />}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-N82VPQFJHG"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-N82VPQFJHG');
          `}
        </Script>
      </body>
    </html>
  );
}
