import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Whozin — Who's In? | Organize Group Activities Effortlessly",
  description:
    "Stop blowing up the group chat. Whozin helps you organize activities, send priority invites, and instantly find out who's in — no app download required for invitees.",
  keywords: [
    "group activities",
    "event planning",
    "who's in",
    "RSVP app",
    "group organizer",
    "activity planner",
    "invite management",
  ],
  authors: [{ name: "Whozin" }],
  creator: "Whozin",
  metadataBase: new URL("https://whozin.io"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://whozin.io",
    siteName: "Whozin",
    title: "Whozin — Who's In?",
    description:
      "Organize group activities and find out who's coming — without the group chat chaos.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Whozin — Who's In?",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Whozin — Who's In?",
    description:
      "Organize group activities and find out who's coming — without the group chat chaos.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/api/favicon",
    apple: "/api/favicon",
  },
  manifest: "/manifest.json",
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
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
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
                "Organize group activities and find out who's coming without the group chat chaos.",
              url: "https://whozin.io",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />
      </head>
      <body className={`${jakarta.variable} antialiased`}>
        {children}
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
