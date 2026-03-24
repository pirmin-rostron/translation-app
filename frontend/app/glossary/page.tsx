"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { glossaryTermsApi, type GlossaryTermCreate } from "../services/api";

type GlossaryTerm = {
  id: number;
  source_term: string;
  target_term: string;
  source_language: string;
  target_language: string;
  industry: string | null;
  domain: string | null;
  created_at: string;
};

type GlossaryForm = {
  source_term: string;
  target_term: string;
  source_language: string;
  target_language: string;
  industry: string;
  domain: string;
};

const INITIAL_FORM: GlossaryForm = {
  source_term: "",
  target_term: "",
  source_language: "en",
  target_language: "german",
  industry: "",
  domain: "",
};

export default function GlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [form, setForm] = useState<GlossaryForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function loadTerms() {
    glossaryTermsApi.list<GlossaryTerm[]>()
      .then(setTerms)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load glossary"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTerms();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const termData: GlossaryTermCreate = {
        source_term: form.source_term,
        target_term: form.target_term,
        source_language: form.source_language,
        target_language: form.target_language,
        industry: form.industry || null,
        domain: form.domain || null,
      };
      const payload = await glossaryTermsApi.create<GlossaryTerm>(termData);
      setTerms((current) => [payload, ...current]);
      setForm(INITIAL_FORM);
      setMessage("Glossary term saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save glossary term");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(termId: number) {
    setMessage("");
    setError("");
    try {
      await glossaryTermsApi.delete<unknown>(termId);
      setTerms((current) => current.filter((term) => term.id !== termId));
      setMessage("Glossary term deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete glossary term");
    }
  }

  const INPUT = "w-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#0D7B6E] focus:outline-none";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F2EC" }}>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1
          className="mb-6 text-2xl font-semibold"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
        >
          Glossary
        </h1>

        {/* Bulk CSV import */}
        <div className="mb-6 border border-stone-200 bg-white p-6">
          <h2 className="text-base font-semibold" style={{ color: "#1A110A" }}>
            Bulk CSV import
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Use bulk import to seed terminology quickly, then manage terms here with create/delete actions.
          </p>
          <Link
            href="/imports"
            className="mt-4 inline-flex border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Open glossary CSV import
          </Link>
        </div>

        {/* Add term */}
        <div className="mb-6 border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold" style={{ color: "#1A110A" }}>
            Add term
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              value={form.source_term}
              onChange={(e) => setForm((current) => ({ ...current, source_term: e.target.value }))}
              placeholder="Source term"
              className={INPUT}
              required
            />
            <input
              value={form.target_term}
              onChange={(e) => setForm((current) => ({ ...current, target_term: e.target.value }))}
              placeholder="Target term"
              className={INPUT}
              required
            />
            <input
              value={form.source_language}
              onChange={(e) => setForm((current) => ({ ...current, source_language: e.target.value }))}
              placeholder="Source language"
              className={INPUT}
              required
            />
            <input
              value={form.target_language}
              onChange={(e) => setForm((current) => ({ ...current, target_language: e.target.value }))}
              placeholder="Target language"
              className={INPUT}
              required
            />
            <input
              value={form.industry}
              onChange={(e) => setForm((current) => ({ ...current, industry: e.target.value }))}
              placeholder="Industry (optional)"
              className={INPUT}
            />
            <input
              value={form.domain}
              onChange={(e) => setForm((current) => ({ ...current, domain: e.target.value }))}
              placeholder="Domain (optional)"
              className={INPUT}
            />
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#0D7B6E" }}
              >
                {saving ? "Saving…" : "Save glossary term"}
              </button>
              {message && <span className="text-sm" style={{ color: "#0D7B6E" }}>{message}</span>}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </form>
        </div>

        {/* Terms list */}
        <div className="border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-6 py-4">
            <h2 className="text-base font-semibold" style={{ color: "#1A110A" }}>
              Glossary terms
            </h2>
          </div>
          {loading ? (
            <p className="px-6 py-8 text-sm text-stone-400">Loading…</p>
          ) : terms.length === 0 ? (
            <p className="px-6 py-8 text-sm text-stone-400">No glossary terms yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100 text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {["Source", "Target", "Languages", "Industry", "Domain", "Action"].map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {terms.map((term) => (
                    <tr key={term.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium" style={{ color: "#1A110A" }}>
                        {term.source_term}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: "#1A110A" }}>
                        {term.target_term}
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        {term.source_language} → {term.target_language}
                      </td>
                      <td className="px-4 py-3 text-stone-500">{term.industry ?? <span className="text-stone-300">—</span>}</td>
                      <td className="px-4 py-3 text-stone-500">{term.domain ?? <span className="text-stone-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleDelete(term.id)}
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
