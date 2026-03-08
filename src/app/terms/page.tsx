'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BrandedFullLogo } from '@/components/ui/branded-logo'
import { ContactModal } from '@/components/ui/contact-modal'

export default function TermsOfServicePage() {
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
        <h1 className="text-2xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted mb-8">Effective Date: March 8, 2026</p>

        <div className="prose-sm space-y-6 text-foreground/80 text-[14px] leading-relaxed">

          <p>
            Welcome to Whozin. These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Whozin application, website, and related services (collectively, the &quot;Service&quot;) provided by Chumem, LLC (&quot;Chumem,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). Whozin is a DBA of Chumem, LLC.
          </p>
          <p>
            By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
          </p>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">1. Eligibility</h2>
            <p>
              You must be at least 13 years old to use the Service. By using Whozin, you represent and warrant that you meet this age requirement. If you are under 18, you must have parental or guardian consent to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">2. Account Registration</h2>
            <p>
              To use certain features of the Service, you must create an account. You agree to provide accurate, current, and complete information during registration and to keep your account information up to date. You are responsible for safeguarding your account credentials and for all activity under your account. You must notify us immediately of any unauthorized access or use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">3. Acceptable Use</h2>
            <p className="mb-3">You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Violate any applicable laws, regulations, or third-party rights</li>
              <li>Harass, abuse, threaten, or intimidate other users</li>
              <li>Post or transmit content that is unlawful, defamatory, obscene, or otherwise objectionable</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity</li>
              <li>Interfere with or disrupt the Service or its servers and networks</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Use the Service for any commercial purpose not expressly permitted by us</li>
              <li>Collect or harvest user data without consent</li>
              <li>Send unsolicited messages, spam, or bulk communications through the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">4. User Content</h2>
            <p>
              You retain ownership of content you create and share through the Service (&quot;User Content&quot;). By posting User Content, you grant Chumem a non-exclusive, worldwide, royalty-free license to use, display, reproduce, and distribute your User Content solely in connection with operating and providing the Service. You represent that you have the right to share any content you post and that it does not infringe any third-party rights.
            </p>
            <p className="mt-3">
              We reserve the right to remove any User Content that violates these Terms or that we find objectionable, without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">5. Payments and Subscriptions</h2>
            <p>
              Certain features of the Service may require payment. By purchasing a subscription or making a payment, you agree to pay all applicable fees. Payments are processed through third-party payment providers (e.g., Stripe) and are subject to their terms. Subscription fees are billed in advance on a recurring basis. You may cancel your subscription at any time through your account settings or by contacting us. Refunds are handled in accordance with applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">6. Intellectual Property</h2>
            <p>
              The Service, including its design, features, code, content, trademarks, and logos, is owned by Chumem, LLC and is protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the Service without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">7. Third-Party Services</h2>
            <p>
              The Service may integrate with or contain links to third-party services (e.g., Google Maps, payment processors, communication services). We are not responsible for the content, policies, or practices of any third-party services. Your use of third-party services is subject to their respective terms and privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">8. Privacy</h2>
            <p>
              Your use of the Service is also governed by our <Link href="/privacy" className="text-primary font-medium">Privacy Policy</Link>, which describes how we collect, use, and protect your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">9. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, CHUMEM, LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATING TO YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Chumem, LLC and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses arising out of your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">12. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time, with or without cause, and with or without notice. You may delete your account at any time through the Settings page. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature should survive termination will survive, including intellectual property, disclaimers, limitations of liability, and indemnification.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of California, without regard to conflict of law principles. Any disputes arising under these Terms shall be resolved exclusively in the state or federal courts located in San Diego County, California.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">14. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. When we make changes, we will update the effective date and notify you through appropriate means. Your continued use of the Service after changes are posted constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">15. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at{' '}
              <a href="mailto:legal@chumem.com" className="text-primary font-medium">legal@chumem.com</a>.
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#0a0f1e] text-white/50 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <BrandedFullLogo className="h-8" />
            <div className="flex gap-6 text-xs">
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <span className="text-white/70">Terms</span>
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
