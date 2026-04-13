"use client";

import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/PageHeader";

export default function TermsPage() {
  return (
    <AppShell>
      <div className="px-8 py-8">
        <main className="mx-auto max-w-2xl">
          <PageHeader eyebrow="Legal" title="Terms of Service" subtitle="Last updated: 13 April 2026" />

          <div className="space-y-8 text-sm leading-relaxed text-brand-text">
            {/* 1 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">1. Acceptance of terms</h2>
              <p className="text-brand-muted">
                By creating an account or using Helvara (<a href="https://helvara.io" className="text-brand-accent hover:underline">helvara.io</a>),
                you agree to these Terms of Service. If you do not agree, do not use the service.
              </p>
            </section>

            {/* 2 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">2. The service</h2>
              <p className="text-brand-muted">
                Helvara is an AI-powered document translation platform. You upload documents, and the
                service translates them using large language models via the Anthropic API. You can review,
                edit, and export translations.
              </p>
            </section>

            {/* 3 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">3. Your content</h2>
              <p className="text-brand-muted">
                You retain full ownership of all documents you upload and all translations produced. Helvara
                does not claim any intellectual property rights over your content. We access your content
                solely to provide the translation service.
              </p>
            </section>

            {/* 4 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">4. Acceptable use</h2>
              <p className="mb-2 text-brand-muted">You agree not to:</p>
              <ul className="list-disc space-y-1.5 pl-5 text-brand-muted">
                <li>Upload content that is illegal, harmful, or violates the rights of others.</li>
                <li>Attempt to reverse-engineer, scrape, or interfere with the platform.</li>
                <li>Share your account credentials with third parties.</li>
                <li>Use the service to generate spam, misleading content, or for any fraudulent purpose.</li>
                <li>Exceed reasonable usage limits or deliberately overload the service.</li>
              </ul>
              <p className="mt-2 text-brand-muted">
                We reserve the right to suspend or terminate accounts that violate these terms.
              </p>
            </section>

            {/* 5 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">5. Service availability</h2>
              <p className="text-brand-muted">
                We aim to keep Helvara available at all times, but we do not guarantee uninterrupted
                service. Downtime may occur for maintenance, updates, or circumstances beyond our control.
                We will make reasonable efforts to notify users of planned downtime in advance.
              </p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">6. Translation accuracy</h2>
              <p className="text-brand-muted">
                Translations are produced by AI and may contain errors. Helvara provides tools for human
                review (ambiguity detection, glossary matching, manual editing) but does not guarantee
                translation accuracy. You are responsible for reviewing translations before use in any
                context where accuracy is critical (legal, medical, regulatory, etc.).
              </p>
            </section>

            {/* 7 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">7. Limitation of liability</h2>
              <p className="text-brand-muted">
                To the maximum extent permitted by law, Helvara is provided &ldquo;as is&rdquo; without
                warranties of any kind, whether express or implied. We are not liable for any indirect,
                incidental, or consequential damages arising from your use of the service, including but not
                limited to losses caused by translation errors, data loss, or service interruptions.
              </p>
            </section>

            {/* 8 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">8. Account termination</h2>
              <p className="text-brand-muted">
                You may close your account at any time. Upon account deletion, all your documents,
                translations, glossary terms, and personally identifiable information will be permanently
                removed. Self-service account deletion is coming soon; in the meantime,
                email <a href="mailto:support@helvara.io" className="text-brand-accent hover:underline">support@helvara.io</a>.
              </p>
            </section>

            {/* 9 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">9. Changes to these terms</h2>
              <p className="text-brand-muted">
                We may update these terms from time to time. If we make material changes, we will notify
                you via email or an in-app notice. Continued use of the service after changes constitutes
                acceptance of the updated terms.
              </p>
            </section>

            {/* 10 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">10. Governing law</h2>
              <p className="text-brand-muted">
                These terms are governed by the laws of Australia. Any disputes arising from these terms or
                your use of the service will be subject to the jurisdiction of the courts of Australia. For
                EU users, nothing in these terms limits your rights under the GDPR or other applicable EU
                consumer protection laws.
              </p>
            </section>

            {/* 11 */}
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-brand-text">11. Contact</h2>
              <p className="text-brand-muted">
                Questions about these terms? Email us
                at <a href="mailto:support@helvara.io" className="text-brand-accent hover:underline">support@helvara.io</a>.
              </p>
            </section>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
