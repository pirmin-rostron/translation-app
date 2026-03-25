"use client";

import { useEffect, useMemo, useState } from "react";

import { glossaryTermsApi, type GlossaryTerm, type GlossaryTermCreate } from "../services/api";

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

  // Search + language pair filter
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("All");

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSource, setEditSource] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // CSV import
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvSourceLang, setCsvSourceLang] = useState("en");
  const [csvTargetLang, setCsvTargetLang] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [csvError, setCsvError] = useState("");

  function loadTerms() {
    glossaryTermsApi.list<GlossaryTerm[]>()
      .then(setTerms)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load glossary"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTerms();
  }, []);

  // Unique language pairs for filter pills
  const langPairs = useMemo(() => {
    const seen = new Set<string>();
    terms.forEach((t) => seen.add(`${t.source_language} → ${t.target_language}`));
    return Array.from(seen).sort();
  }, [terms]);

  // Filtered terms
  const displayedTerms = useMemo(() => {
    return terms.filter((t) => {
      const matchesSearch =
        !search ||
        t.source_term.toLowerCase().includes(search.toLowerCase()) ||
        t.target_term.toLowerCase().includes(search.toLowerCase());
      const matchesLang =
        langFilter === "All" || `${t.source_language} → ${t.target_language}` === langFilter;
      return matchesSearch && matchesLang;
    });
  }, [terms, search, langFilter]);

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

  function startEdit(term: GlossaryTerm) {
    setEditingId(term.id);
    setEditSource(term.source_term);
    setEditTarget(term.target_term);
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditSource("");
    setEditTarget("");
    setEditError("");
  }

  async function handleSaveEdit(termId: number) {
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await glossaryTermsApi.update(termId, {
        source_term: editSource.trim(),
        target_term: editTarget.trim(),
      });
      setTerms((current) => current.map((t) => (t.id === termId ? updated : t)));
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleCsvImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!csvFile) return;
    setCsvImporting(true);
    setCsvResult(null);
    setCsvError("");
    try {
      const result = await glossaryTermsApi.importCsv(csvFile, csvSourceLang, csvTargetLang);
      setCsvResult(result);
      setCsvFile(null);
      loadTerms();
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setCsvImporting(false);
    }
  }

  const INPUT: React.CSSProperties = {
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: "1px solid rgba(194,200,193,0.5)",
    borderRadius: 0,
    background: "transparent",
    padding: "0.5rem 0",
    fontSize: "0.9375rem",
    color: "#1c1c17",
    outline: "none",
    width: "100%",
    fontFamily: "Inter, sans-serif",
  };
  const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F2EC", paddingTop: "5.5rem" }}>
      <main className="mx-auto max-w-5xl px-6 pb-12">
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A", marginBottom: "2.5rem" }}
        >
          Glossary
        </h1>

        {/* ── CSV Import ── */}
        <div className="mb-6 border border-stone-200 bg-white p-6">
          <h2 className="mb-1 text-base font-semibold" style={{ color: "#1A110A" }}>
            Bulk CSV import
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Use bulk import to seed terminology quickly, then manage terms here with create/edit/delete actions.
          </p>
          <form
            onSubmit={(e) => { void handleCsvImport(e); }}
            className="flex flex-wrap items-end gap-3"
          >
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">CSV file</label>
              <input
                type="file"
                accept=".csv"
                required
                disabled={csvImporting}
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                className="text-sm text-stone-700 file:mr-3 file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-stone-600 hover:file:bg-stone-200"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Source language</label>
              <input
                value={csvSourceLang}
                onChange={(e) => setCsvSourceLang(e.target.value)}
                placeholder="en"
                required
                disabled={csvImporting}
                className="w-24 border border-stone-300 bg-white px-3 py-2 text-sm focus:border-[#0D7B6E] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-500">Target language</label>
              <input
                value={csvTargetLang}
                onChange={(e) => setCsvTargetLang(e.target.value)}
                placeholder="de"
                required
                disabled={csvImporting}
                className="w-24 border border-stone-300 bg-white px-3 py-2 text-sm focus:border-[#0D7B6E] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={csvImporting || !csvFile}
              className="rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#082012" }}
            >
              {csvImporting ? "Importing…" : "Import"}
            </button>
          </form>
          {csvResult && (
            <div className="mt-3 text-sm" style={{ color: "#0D7B6E" }}>
              Imported {csvResult.imported} terms, skipped {csvResult.skipped}.
              {csvResult.errors.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-red-600">
                  {csvResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {csvError && <p className="mt-2 text-sm text-red-600">{csvError}</p>}
        </div>

        {/* ── Add term ── */}
        <div className="mb-6 border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold" style={{ color: "#1A110A" }}>
            Add term
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              value={form.source_term}
              onChange={(e) => setForm((current) => ({ ...current, source_term: e.target.value }))}
              placeholder="Source term"
              style={INPUT}
              required
            />
            <input
              value={form.target_term}
              onChange={(e) => setForm((current) => ({ ...current, target_term: e.target.value }))}
              placeholder="Target term"
              style={INPUT}
              required
            />
            <input
              value={form.source_language}
              onChange={(e) => setForm((current) => ({ ...current, source_language: e.target.value }))}
              placeholder="Source language"
              style={INPUT}
              required
            />
            <input
              value={form.target_language}
              onChange={(e) => setForm((current) => ({ ...current, target_language: e.target.value }))}
              placeholder="Target language"
              style={INPUT}
              required
            />
            <input
              value={form.industry}
              onChange={(e) => setForm((current) => ({ ...current, industry: e.target.value }))}
              placeholder="Industry (optional)"
              style={INPUT}
            />
            <input
              value={form.domain}
              onChange={(e) => setForm((current) => ({ ...current, domain: e.target.value }))}
              placeholder="Domain (optional)"
              style={INPUT}
            />
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#082012" }}
              >
                {saving ? "Saving…" : "Save glossary term"}
              </button>
              {message && <span className="text-sm" style={{ color: "#0D7B6E" }}>{message}</span>}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </form>
        </div>

        {/* ── Terms list ── */}
        <div className="border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-6 py-4">
            <h2 className="mb-3 text-base font-semibold" style={{ color: "#1A110A" }}>
              Glossary terms
            </h2>
            {/* Search */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search source or target term…"
              style={{
                borderTop: "none", borderLeft: "none", borderRight: "none",
                borderBottom: "1px solid rgba(194,200,193,0.5)",
                borderRadius: 0, background: "transparent",
                padding: "0.5rem 0", fontSize: "0.9375rem",
                color: "#1c1c17", outline: "none", width: "100%",
                maxWidth: "24rem", fontFamily: "Inter, sans-serif",
                marginBottom: "0.75rem",
              }}
            />
            {/* Language pair pills */}
            {langPairs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {["All", ...langPairs].map((pair) => (
                  <button
                    key={pair}
                    type="button"
                    onClick={() => setLangFilter(pair)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      langFilter === pair
                        ? "text-white"
                        : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                    }`}
                    style={langFilter === pair ? { backgroundColor: "#0D7B6E" } : undefined}
                  >
                    {pair}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <p className="px-6 py-8 text-sm text-stone-400">Loading…</p>
          ) : displayedTerms.length === 0 ? (
            <p className="px-6 py-8 text-sm text-stone-400">
              {terms.length === 0
                ? "No glossary terms yet. Add your first term above or import from a CSV file."
                : "No terms match your search or filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100 text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {["Source", "Target", "Languages", "Industry", "Domain", "Action"].map((col) => (
                      <th key={col} className={TH}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {displayedTerms.map((term) => {
                    const isEditing = editingId === term.id;
                    const isPhrase = term.source_term.includes(" ");
                    return (
                      <tr key={term.id} className="hover:bg-stone-50">
                        {/* Source */}
                        <td className="px-4 py-3 font-medium" style={{ color: "#1A110A" }}>
                          {isEditing ? (
                            <input
                              value={editSource}
                              onChange={(e) => setEditSource(e.target.value)}
                              className="w-full border border-stone-300 px-2 py-1 text-sm focus:border-[#0D7B6E] focus:outline-none"
                            />
                          ) : (
                            <span className="flex items-center gap-2">
                              {term.source_term}
                              <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-400">
                                {isPhrase ? "Phrase" : "Term"}
                              </span>
                            </span>
                          )}
                        </td>
                        {/* Target */}
                        <td className="px-4 py-3 font-medium" style={{ color: "#1A110A" }}>
                          {isEditing ? (
                            <input
                              value={editTarget}
                              onChange={(e) => setEditTarget(e.target.value)}
                              className="w-full border border-stone-300 px-2 py-1 text-sm focus:border-[#0D7B6E] focus:outline-none"
                            />
                          ) : (
                            term.target_term
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-500">
                          {term.source_language} → {term.target_language}
                        </td>
                        <td className="px-4 py-3 text-stone-500">
                          {term.industry ?? <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-stone-500">
                          {term.domain ?? <span className="text-stone-300">—</span>}
                        </td>
                        {/* Action */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => { void handleSaveEdit(term.id); }}
                                  disabled={editSaving}
                                  className="text-sm font-medium disabled:opacity-50"
                                  style={{ color: "#0D7B6E" }}
                                >
                                  {editSaving ? "Saving…" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={editSaving}
                                  className="text-sm text-stone-400 hover:text-stone-600 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                              {editError && (
                                <span className="text-xs text-red-600">{editError}</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => startEdit(term)}
                                className="text-sm text-stone-500 hover:text-stone-700"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => { void handleDelete(term.id); }}
                                className="text-sm text-red-500 hover:text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
