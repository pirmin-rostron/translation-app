"use client";

import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/PageHeader";

export default function PrivacyPolicyPage() {
  return (
    <AppShell>
      <div className="px-8 py-8">
        <main className="mx-auto max-w-2xl">
          <PageHeader eyebrow="Legal" title="Privacy Policy" subtitle="Last updated: 13 April 2026" />

          <div className="space-y-8 text-sm leading-relaxed text-brand-text">
            {/* 1 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">Who we are</h2>
              <p className="text-brand-muted">
                Helvara (<a href="https://helvara.io" className="text-brand-accent hover:underline">helvara.io</a>) is
                an AI-powered document translation platform. When we say &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
                &ldquo;Helvara&rdquo; in this policy we mean the team behind the product.
              </p>
            </section>

            {/* 2 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">What data we collect</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-brand-muted">
                <li><strong className="text-brand-text">Account information</strong> &mdash; email address, full name (optional), hashed password.</li>
                <li><strong className="text-brand-text">Documents</strong> &mdash; files you upload for translation (DOCX, RTF, TXT).</li>
                <li><strong className="text-brand-text">Translation output</strong> &mdash; translated text, review decisions, glossary terms.</li>
                <li><strong className="text-brand-text">Usage data</strong> &mdash; page views, feature usage, and performance metrics collected via PostHog.</li>
              </ul>
            </section>

            {/* 3 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">Where your data is stored</h2>
              <p className="text-brand-muted">
                All data is stored on Amazon Web Services (AWS) in the <strong className="text-brand-text">ap-southeast-2 (Sydney, Australia)</strong> region.
                Your documents, translations, and account data do not leave Australia except when sent to the
                Anthropic API (United States) for translation processing.
              </p>
            </section>

            {/* 4 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">Third parties</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-brand-muted">
                <li>
                  <strong className="text-brand-text">Anthropic API</strong> &mdash; provides the AI translation engine.
                  Under Anthropic&rsquo;s commercial API terms, customer inputs and outputs are <strong className="text-brand-text">not used for model training</strong> and
                  are deleted from Anthropic&rsquo;s systems within 7 days.
                </li>
                <li>
                  <strong className="text-brand-text">PostHog</strong> &mdash; collects anonymised product analytics (page views, feature usage).
                  No document content is sent to PostHog.
                </li>
              </ul>
            </section>

            {/* 5 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">How we use your data</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-brand-muted">
                <li>To translate your documents and provide the core service.</li>
                <li>To maintain your glossary and translation memory across jobs.</li>
                <li>To improve the product using aggregated, anonymised usage metrics &mdash; never your document content.</li>
                <li>To communicate with you about your account (e.g. password reset).</li>
              </ul>
            </section>

            {/* 6 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">Data retention</h2>
              <p className="text-brand-muted">
                We retain your data for as long as your account is active. When you delete your account, all
                documents, translations, glossary terms, and personally identifiable information are permanently
                removed.
              </p>
            </section>

            {/* 7 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">Your rights</h2>
              <p className="mb-2 text-brand-muted">
                Under the Australian Privacy Act 1988 and (where applicable) the EU General Data Protection
                Regulation (GDPR), you have the right to:
              </p>
              <ul className="list-disc space-y-1.5 pl-5 text-brand-muted">
                <li>Access the personal data we hold about you.</li>
                <li>Request correction of inaccurate data.</li>
                <li>Request deletion of your account and associated data.</li>
                <li>Object to processing of your data for analytics purposes.</li>
              </ul>
              <p className="mt-2 text-brand-muted">
                Account deletion is coming soon as a self-service feature. In the meantime,
                email <a href="mailto:support@helvara.io" className="text-brand-accent hover:underline">support@helvara.io</a> and
                we will process your request manually.
              </p>
            </section>

            {/* 8 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">Contact</h2>
              <p className="text-brand-muted">
                For any privacy-related questions or requests, email us
                at <a href="mailto:support@helvara.io" className="text-brand-accent hover:underline">support@helvara.io</a>.
              </p>
            </section>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
