'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BrandedFullLogo } from '@/components/ui/branded-logo'
import { ContactModal } from '@/components/ui/contact-modal'

export default function PrivacyPolicyPage() {
  const [showContact, setShowContact] = useState(false)

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Nav */}
      <nav className="bg-[#0a0f1e] px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <BrandedFullLogo className="h-9" />
          </Link>
          <Link
            href="/"
            className="text-white/80 hover:text-white text-sm font-semibold px-5 py-2.5 rounded-xl border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted mb-8">Effective Date: March 8, 2026</p>

        <div className="prose-sm space-y-6 text-foreground/80 text-[14px] leading-relaxed">

          <p>
            Whozin is a product of Chumem, LLC and its affiliate companies (&quot;Chumem,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). Chumem is a software-as-a-service (SaaS) company that provides various services to its users. This Privacy Policy describes the types of personal information we collect from our users, how we use and share that information, and the measures we take to protect it.
          </p>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Personal Information Collected</h2>
            <p className="mb-3">As a SaaS company, we may collect various types of personal information from our users depending on the services provided. Examples include:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Contact information (e.g., name, email address, phone number)</li>
              <li>Payment information (e.g., credit card details, billing address)</li>
              <li>User-generated content (e.g., photos, comments)</li>
              <li>Usage data (e.g., browsing history, login times)</li>
              <li>Device information (e.g., IP address, operating system, browser type)</li>
              <li>Location information (e.g., IP address-based location)</li>
              <li>Communication data (e.g., chat messages within the app)</li>
              <li>User preferences and settings (e.g., notification settings)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">How We Collect Information</h2>
            <p className="mb-3">We may collect personal information in several ways, including:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>User-provided information:</strong> Information you provide directly, such as during account registration, creating activities, or updating your profile.</li>
              <li><strong>Automated collection:</strong> We may use cookies, web beacons, and other tracking technologies to collect information automatically, such as device information and usage data.</li>
              <li><strong>Third-party sources:</strong> We may receive information from third-party services you connect to your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Use of Personal Information</h2>
            <p className="mb-3">We may use personal information for purposes including:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Providing and improving services:</strong> Customizing content, processing payments, and resolving technical issues.</li>
              <li><strong>Communicating with users:</strong> Account-related communications, customer support, and marketing messages such as newsletters or promotional offers.</li>
              <li><strong>Conducting research and analytics:</strong> Improving our services and understanding user behavior and preferences.</li>
              <li><strong>Complying with legal obligations:</strong> Meeting applicable laws and regulations, and responding to legal requests or court orders.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Sharing Personal Information</h2>
            <p className="mb-3">We may share personal information with third parties in certain circumstances:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Service providers:</strong> Third-party providers who perform services on our behalf, such as payment processors (Stripe), communication providers (Twilio, SendGrid), and hosting services (Supabase, Vercel).</li>
              <li><strong>Legal and regulatory requirements:</strong> In response to legal requests, court orders, or to comply with applicable laws.</li>
              <li><strong>Mergers and acquisitions:</strong> In the event of a merger, acquisition, or sale of assets, personal information may be transferred to the acquiring company.</li>
            </ul>
            <p className="mt-3">We only share personal information to the extent necessary for legitimate business purposes and in compliance with applicable data protection and privacy laws.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Personal Information Protection</h2>
            <p className="mb-3">We take the protection of your personal information seriously and employ measures including:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Secure storage:</strong> Personal information is stored in secure data centers with encryption for data in transit and at rest.</li>
              <li><strong>Access controls:</strong> Access to personal information is limited to authorized personnel with strict authentication measures.</li>
              <li><strong>Regular audits:</strong> We conduct regular security assessments to identify and address potential risks.</li>
              <li><strong>Data minimization:</strong> We only collect and store personal information that is necessary and relevant for providing our services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Your Rights</h2>
            <p className="mb-3">You have the right to access, modify, or delete your personal information. You can exercise these rights through the Settings page within the Whozin app, or by contacting us directly.</p>
            <p>Upon receiving a request, we will verify your identity and respond in a timely manner, typically within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Marketing Communications</h2>
            <p>We may use your information to send marketing communications such as newsletters or promotional offers. You may opt out at any time by using the unsubscribe mechanism in such communications or by updating your notification settings in the app.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Children&apos;s Privacy</h2>
            <p>Whozin does not knowingly collect personal information from children under the age of 13. If we become aware that we have collected such information, we will take steps to delete it as soon as possible.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Legal Compliance</h2>
            <p className="mb-3">We comply with applicable data protection and privacy laws, including:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>General Data Protection Regulation (GDPR)</strong> for individuals in the European Union</li>
              <li><strong>California Consumer Privacy Act (CCPA)</strong> for California residents</li>
              <li><strong>Children&apos;s Online Privacy Protection Act (COPPA)</strong> for children under 13 in the United States</li>
              <li><strong>Federal Trade Commission Act (FTC Act)</strong> regulating unfair and deceptive trade practices</li>
              <li>Other applicable state, federal, and international data protection laws</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. When we make changes, we will notify you through direct communication, in-app notices, or other appropriate means. Continued use of Whozin after changes are posted constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Contact Us</h2>
            <p>If you have any questions or concerns about this Privacy Policy, please contact us at{' '}<a href="mailto:privacy@chumem.com" className="text-primary font-medium">privacy@chumem.com</a>.</p>
          </section>

          <div className="border-t border-border pt-6 mt-8">
            <p className="text-muted text-[13px]">By using Whozin, you agree to the collection, use, and sharing of your personal information as described in this Privacy Policy.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#0a0f1e] text-white/50 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <BrandedFullLogo className="h-8" />
            <div className="flex gap-6 text-xs">
              <span className="text-white/70">Privacy</span>
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
              <button onClick={() => setShowContact(true)} className="hover:text-white transition-colors">Contact</button>
            </div>
            <p className="text-xs">&copy; {new Date().getFullYear()} Chumem, LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </div>
  )
}
