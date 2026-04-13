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
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">Sub-processors</h2>
              <p className="mb-4 text-brand-muted">
                Helvara uses the following third-party services to deliver the platform. Each has access only to the data necessary for their specific function.
              </p>
              <div className="mb-4 overflow-hidden rounded-lg border border-brand-border">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border-b border-brand-border bg-brand-bg px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-brand-subtle">Sub-processor</th>
                      <th className="border-b border-brand-border bg-brand-bg px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-brand-subtle">Purpose</th>
                      <th className="border-b border-brand-border bg-brand-bg px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-brand-subtle">Location</th>
                      <th className="border-b border-brand-border bg-brand-bg px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-brand-subtle">Data accessed</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-b border-brand-border px-4 py-3 text-sm font-medium text-brand-text">Amazon Web Services (AWS)</td>
                      <td className="border-b border-brand-border px-4 py-3 text-sm text-brand-text">Cloud infrastructure — compute, storage, database</td>
                      <td className="border-b border-brand-border px-4 py-3 text-sm text-brand-muted">Sydney, Australia (ap-southeast-2)</td>
                      <td className="border-b border-brand-border px-4 py-3 text-sm text-brand-text">All platform data — documents, translations, account information</td>
                    </tr>
                    <tr>
                      <td className="border-b border-brand-border px-4 py-3 text-sm font-medium text-brand-text">Anthropic (Claude API)</td>
                      <td className="border-b border-brand-border px-4 py-3 text-sm text-brand-text">AI translation processing</td>
                      <td className="border-b border-brand-border px-4 py-3 text-sm text-brand-muted">United States</td>
                      <td className="border-b border-brand-border px-4 py-3 text-sm text-brand-text">Document content — source text is sent to Anthropic&rsquo;s API for translation, then deleted from Anthropic&rsquo;s systems within 7 days. Anthropic&rsquo;s commercial API terms prohibit training on customer content.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-brand-text">PostHog (EU Cloud)</td>
                      <td className="px-4 py-3 text-sm text-brand-text">Product analytics</td>
                      <td className="px-4 py-3 text-sm text-brand-muted">Germany (EU, eu-central-1)</td>
                      <td className="px-4 py-3 text-sm text-brand-text">Usage behaviour only — page views and feature events. Document content is never sent to PostHog.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <h3 className="mb-2 text-sm font-semibold text-brand-text">Data transfers</h3>
              <p className="text-brand-muted">
                Your documents are processed on AWS servers in Sydney, Australia. The only exception is translation processing — document text is temporarily sent to Anthropic&rsquo;s API (United States) and deleted within 7 days. Usage analytics are processed by PostHog on EU servers in Germany. No document content is ever sent to PostHog.
              </p>
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
