"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
    fetch(`${API_URL}/api/glossary-terms`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load glossary (${res.status})`);
        return res.json();
      })
      .then(setTerms)
      .catch((err) => setError(err.message))
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
      const res = await fetch(`${API_URL}/api/glossary-terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_term: form.source_term,
          target_term: form.target_term,
          source_language: form.source_language,
          target_language: form.target_language,
          industry: form.industry || null,
          domain: form.domain || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.detail || "Failed to create glossary term");
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
      const res = await fetch(`${API_URL}/api/glossary-terms/${termId}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail || "Failed to delete glossary term");
      setTerms((current) => current.filter((term) => term.id !== termId));
      setMessage("Glossary term deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete glossary term");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Glossary</h1>

        <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Bulk CSV import</h2>
          <p className="mt-1 text-sm text-slate-600">
            Use bulk import to seed terminology quickly, then manage terms here with create/delete actions.
          </p>
          <Link
            href="/imports"
            className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open glossary CSV import
          </Link>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Add term</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={form.source_term}
              onChange={(e) => setForm((current) => ({ ...current, source_term: e.target.value }))}
              placeholder="Source term"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={form.target_term}
              onChange={(e) => setForm((current) => ({ ...current, target_term: e.target.value }))}
              placeholder="Target term"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={form.source_language}
              onChange={(e) => setForm((current) => ({ ...current, source_language: e.target.value }))}
              placeholder="Source language"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={form.target_language}
              onChange={(e) => setForm((current) => ({ ...current, target_language: e.target.value }))}
              placeholder="Target language"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={form.industry}
              onChange={(e) => setForm((current) => ({ ...current, industry: e.target.value }))}
              placeholder="Industry (optional)"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={form.domain}
              onChange={(e) => setForm((current) => ({ ...current, domain: e.target.value }))}
              placeholder="Domain (optional)"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
              >
                {saving ? "Saving..." : "Save glossary term"}
              </button>
              {message && <span className="text-sm text-green-600">{message}</span>}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Glossary terms</h2>
          {loading ? (
            <p className="text-slate-600">Loading...</p>
          ) : terms.length === 0 ? (
            <p className="text-slate-600">No glossary terms yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 pr-4 font-medium">Target</th>
                    <th className="py-2 pr-4 font-medium">Languages</th>
                    <th className="py-2 pr-4 font-medium">Industry</th>
                    <th className="py-2 pr-4 font-medium">Domain</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((term) => (
                    <tr key={term.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 text-slate-900">{term.source_term}</td>
                      <td className="py-3 pr-4 text-slate-900">{term.target_term}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {term.source_language} -&gt; {term.target_language}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{term.industry ?? "—"}</td>
                      <td className="py-3 pr-4 text-slate-600">{term.domain ?? "—"}</td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => handleDelete(term.id)}
                          className="rounded border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
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
