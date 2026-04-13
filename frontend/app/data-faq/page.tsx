"use client";

import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/PageHeader";

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
      <h3 className="mb-2 font-display text-base font-semibold text-brand-text">{question}</h3>
      <div className="text-sm leading-relaxed text-brand-muted">{children}</div>
    </div>
  );
}

export default function DataFaqPage() {
  return (
    <AppShell>
      <div className="px-8 py-8">
        <main className="mx-auto max-w-2xl">
          <PageHeader
            eyebrow="Legal"
            title="Data & Security FAQ"
            subtitle="Plain-English answers about how Helvara handles your data."
          />

          <div className="space-y-4">
            <FaqItem question="Where is my data stored?">
              <p>
                All data is stored in <strong className="text-brand-text">Sydney, Australia</strong> on
                Amazon Web Services (AWS ap-southeast-2). Your documents, translations, and account data
                remain in Australia.
              </p>
              <p className="mt-2">
                The only exception: when a document is translated, the text is sent to the Anthropic API
                (United States) for processing. Anthropic deletes all inputs and outputs within 7 days.
              </p>
              <p className="mt-2">
                For a full list of sub-processors and where your data is processed, see our{" "}
                <a href="/privacy" className="text-brand-accent hover:underline">Privacy Policy</a>.
              </p>
            </FaqItem>

            <FaqItem question="Does Helvara read my documents?">
              <p>
                Your documents are processed automatically by AI for translation. No human at Helvara
                reviews, reads, or accesses your document content. Access to production infrastructure is
                limited to essential maintenance.
              </p>
            </FaqItem>

            <FaqItem question="Does Anthropic train on my documents?">
              <p>
                <strong className="text-brand-text">No.</strong> Helvara uses Anthropic&rsquo;s commercial
                API, which explicitly prohibits using customer inputs and outputs for model training.
                Your content is processed for translation only and is deleted from Anthropic&rsquo;s
                systems within 7 days. Document text sent for translation is deleted from Anthropic&rsquo;s systems within 7 days.
              </p>
            </FaqItem>

            <FaqItem question="Can I delete my data?">
              <p>
                Self-service account deletion is coming soon. When available, deleting your account will
                permanently remove all documents, translations, glossary terms, and personally identifiable
                information.
              </p>
              <p className="mt-2">
                In the meantime, email{" "}
                <a href="mailto:support@helvara.io" className="text-brand-accent hover:underline">
                  support@helvara.io
                </a>{" "}
                and we will process your deletion request manually.
              </p>
            </FaqItem>

            <FaqItem question="How long do you keep my data?">
              <p>
                We retain your data for as long as your account is active. Once you delete your account,
                all associated data is permanently removed. There is no time-based auto-deletion while
                your account exists.
              </p>
            </FaqItem>

            <FaqItem question="Is my data used to improve Helvara?">
              <p>
                We collect aggregated, anonymised usage metrics (e.g. which features are used, page load
                times) via PostHog to improve the product. <strong className="text-brand-text">We never
                use your document content, translations, or glossary terms</strong> for product
                improvement, analytics, or any purpose beyond providing the service to you.
              </p>
            </FaqItem>

            <FaqItem question="Is Helvara GDPR compliant?">
              <p>
                Helvara follows GDPR principles: we minimise data collection, store data securely, provide
                transparency about processing, and support your right to access and delete your data. Full
                formal GDPR compliance documentation is in progress.
              </p>
              <p className="mt-2">
                For Australian users, we comply with the Australian Privacy Act 1988.
              </p>
            </FaqItem>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
