import type { Metadata } from 'next'
import LegalPageLayout from '@/components/legal/LegalPageLayout'

// TODO: Replace with a real contact email once configured (e.g. via NEXT_PUBLIC_CONTACT_EMAIL env var)
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'contact@wellofwishes.org'

export const metadata: Metadata = {
  title: 'Terms of Service — Well of Wishes',
  description: 'Terms governing your use of the Well of Wishes platform.',
}

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated="Last updated: April 2026"
      intro="Welcome to Well of Wishes. By using this platform, you agree to the following terms."
      sections={[
        {
          heading: '1. Use of the Service',
          body: (
            <>
              <p>
                Well of Wishes provides a space to share wishes, connect with others, and explore
                collaborations.
              </p>
              <p>You agree to use the platform in a respectful and lawful manner.</p>
            </>
          ),
        },
        {
          heading: '2. User Content',
          body: (
            <>
              <p>You retain ownership of the content you create (e.g., wishes and messages).</p>
              <p>
                By using the platform, you grant us permission to process, analyze, and display your
                content in order to operate the service, including sharing it with other users when
                relevant matches or resonance between wishes are identified.
              </p>
              <p>
                You are responsible for the content you share and should only include information
                you are comfortable sharing with relevant matches.
              </p>
            </>
          ),
        },
        {
          heading: '3. Accounts',
          body: (
            <>
              <p>You may sign in using Google or other supported methods.</p>
              <p>You are responsible for maintaining the security of your account.</p>
            </>
          ),
        },
        {
          heading: '4. Acceptable Use',
          body: (
            <>
              <p>You agree not to:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Violate any laws or regulations</li>
                <li>Share harmful, abusive, or misleading content</li>
                <li>Attempt to disrupt or misuse the platform</li>
              </ul>
              <p className="mt-2">
                We may suspend or remove accounts that violate these terms.
              </p>
            </>
          ),
        },
        {
          heading: '5. Service Availability',
          body: (
            <>
              <p>
                The service is provided &ldquo;as is&rdquo; without guarantees of uninterrupted
                availability.
              </p>
              <p>We may modify or discontinue features at any time.</p>
            </>
          ),
        },
        {
          heading: '6. Limitation of Liability',
          body: (
            <>
              <p>Well of Wishes is not responsible for:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>User interactions or outcomes from connections</li>
                <li>Loss of data or service interruptions</li>
              </ul>
            </>
          ),
        },
        {
          heading: '7. Termination',
          body: (
            <>
              <p>You may stop using the service at any time.</p>
              <p>You may request deletion of your account and data.</p>
            </>
          ),
        },
        {
          heading: '8. Changes to Terms',
          body: (
            <p>
              We may update these terms from time to time. Continued use of the platform means you
              accept the updated terms.
            </p>
          ),
        },
        {
          heading: '9. Contact',
          body: (
            <p>
              For questions:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          ),
        },
      ]}
    />
  )
}
