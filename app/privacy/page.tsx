import type { Metadata } from 'next'
import LegalPageLayout from '@/components/legal/LegalPageLayout'

// TODO: Replace with a real contact email once configured (e.g. via NEXT_PUBLIC_CONTACT_EMAIL env var)
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'contact@wellofwishes.org'

export const metadata: Metadata = {
  title: 'Privacy Policy — Well of Wishes',
  description: 'How Well of Wishes collects, uses, and protects your personal data.',
}

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated="Last updated: April 2026"
      intro='Well of Wishes ("we", "the platform") respects your privacy and is committed to protecting your data.'
      sections={[
        {
          heading: '1. Information We Collect',
          body: (
            <>
              <p>When you use Well of Wishes, we may collect:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>
                  <strong>Account information:</strong> Name, email address, and Google account ID
                  (if you sign in with Google)
                </li>
                <li>
                  <strong>User content:</strong> Wishes, messages, and interactions you create
                </li>
                <li>
                  <strong>Technical data:</strong> IP address, device/browser information, and
                  basic usage logs
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: '2. Google Sign-In',
          body: (
            <>
              <p>
                If you sign in with Google, we access only basic profile information (such as name,
                email, and user ID) in accordance with Google&apos;s OAuth policies.
              </p>
              <p>We use this data only for authentication and account management.</p>
              <p>
                We do not access, read, or store your Google data beyond what is required for login.
              </p>
            </>
          ),
        },
        {
          heading: '3. How We Use Information',
          body: (
            <>
              <p>We use your data to:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Provide and operate the platform</li>
                <li>Match wishes and enable connections</li>
                <li>Improve functionality and user experience</li>
                <li>Maintain security and prevent abuse</li>
              </ul>
            </>
          ),
        },
        {
          heading: '4. Sharing Within the Platform',
          body: (
            <>
              <p>
                Well of Wishes is designed to connect users based on resonance between wishes. As
                part of this functionality:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>
                  Content you submit, including any personal information you choose to include in a
                  wish, may be shared with other users when relevant matches are identified
                </li>
                <li>
                  This sharing occurs only within the platform and only for the purpose of enabling
                  meaningful connections
                </li>
              </ul>
              <p className="mt-2">
                You are responsible for the information you choose to include, and you should avoid
                sharing sensitive personal data unless you are comfortable doing so.
              </p>
            </>
          ),
        },
        {
          heading: '5. Data Sharing',
          body: (
            <>
              <p>We do not sell your personal data.</p>
              <p>
                We may process data through trusted service providers (for example hosting,
                authentication, database, analytics, or AI service providers) strictly to operate
                the platform.
              </p>
            </>
          ),
        },
        {
          heading: '6. Data Retention',
          body: (
            <>
              <p>
                We retain your data only as long as your account is active or as needed to provide
                the service.
              </p>
              <p>You may request deletion at any time.</p>
            </>
          ),
        },
        {
          heading: '7. Your Rights',
          body: (
            <>
              <p>You can:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Request access to your data</li>
                <li>Request deletion of your account and associated data</li>
                <li>Revoke access by disconnecting your Google account</li>
              </ul>
            </>
          ),
        },
        {
          heading: '8. Security',
          body: (
            <p>
              We implement reasonable safeguards to protect your data, but no system is completely
              secure.
            </p>
          ),
        },
        {
          heading: '9. Contact',
          body: (
            <p>
              For privacy-related requests:{' '}
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
