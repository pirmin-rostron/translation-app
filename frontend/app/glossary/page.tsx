"use client";

import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/PageHeader";

import { useEffect, useMemo, useState } from "react";

import { glossaryTermsApi, glossarySuggestionsApi, type GlossaryTerm, type GlossaryTermCreate, type GlossarySuggestion } from "../services/api";

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

const LANG_CODE_MAP: Record<string, string> = {
  english: "EN", german: "DE", french: "FR", dutch: "NL", spanish: "ES",
  japanese: "JA", korean: "KO", thai: "TH", chinese: "ZH", italian: "IT",
  portuguese: "PT", arabic: "AR", en: "EN", de: "DE", fr: "FR", nl: "NL",
  es: "ES", ja: "JA", ko: "KO", th: "TH", zh: "ZH", it: "IT", pt: "PT", ar: "AR",
};

function toLangCode(lang: string): string {
  const code = LANG_CODE_MAP[lang.toLowerCase()];
  if (code) return code;
  return lang.length <= 3 ? lang.toUpperCase() : lang.substring(0, 2).toUpperCase();
}

export default function GlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [form, setForm] = useState<GlossaryForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Panel visibility
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);

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

  // Glossary suggestions
  const [pendingSuggestions, setPendingSuggestions] = useState<GlossarySuggestion[]>([]);

  function loadTerms() {
    glossaryTermsApi.list<GlossaryTerm[]>()
      .then(setTerms)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load glossary"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTerms();
    glossarySuggestionsApi.getPending()
      .then(setPendingSuggestions)
      .catch(() => { /* non-critical */ });
  }, []);

  // Unique language pairs for filter pills (using 2-letter codes)
  const langPairs = useMemo(() => {
    const seen = new Set<string>();
    terms.forEach((t) => seen.add(`${toLangCode(t.source_language)} → ${toLangCode(t.target_language)}`));
    return Array.from(seen).sort();
  }, [terms]);

  // Map from display pair back to raw values for filtering
  const langPairRawMap = useMemo(() => {
    const map = new Map<string, { src: string; tgt: string }>();
    terms.forEach((t) => {
      const key = `${toLangCode(t.source_language)} → ${toLangCode(t.target_language)}`;
      if (!map.has(key)) map.set(key, { src: t.source_language, tgt: t.target_language });
    });
    return map;
  }, [terms]);

  // Stats
  const totalTerms = terms.length;
  const totalUsage = useMemo(() => terms.reduce((sum, t) => sum + (t.usage_count ?? 0), 0), [terms]);
  const timeSavedHrs = totalUsage > 0 ? ((totalUsage * 2) / 60).toFixed(1) : null;

  // Filtered terms
  const displayedTerms = useMemo(() => {
    return terms.filter((t) => {
      const matchesSearch =
        !search ||
        t.source_term.toLowerCase().includes(search.toLowerCase()) ||
        t.target_term.toLowerCase().includes(search.toLowerCase());
      const matchesLang =
        langFilter === "All" ||
        `${toLangCode(t.source_language)} → ${toLangCode(t.target_language)}` === langFilter;
      return matchesSearch && matchesLang;
    });
  }, [terms, search, langFilter]);

  // Whether a single-language filter is active (to hide Languages column)
  const singleLangActive = langFilter !== "All";

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
      setShowAddPanel(false);
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

  const TH = "px-5 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle";

  return (
    <AppShell>
      <div className="px-8 py-8">
      <main className="mx-auto max-w-5xl px-8 pb-12">
        <PageHeader
          eyebrow="Tools"
          title="Glossary"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowAddPanel(!showAddPanel); setShowImportPanel(false); }}
                className="rounded-full border border-brand-border bg-brand-surface px-4 py-1.5 text-sm font-medium text-brand-muted hover:bg-brand-bg transition-colors"
              >
                + Add term
              </button>
              <button
                type="button"
                onClick={() => { setShowImportPanel(!showImportPanel); setShowAddPanel(false); }}
                className="rounded-full border border-brand-border bg-brand-surface px-4 py-1.5 text-sm font-medium text-brand-muted hover:bg-brand-bg transition-colors"
              >
                ↓ Import CSV
              </button>
            </div>
          }
        />

        {/* Explainer */}
        <p className="mb-6 max-w-xl text-sm text-brand-muted">
          Your glossary ensures key terms are translated consistently across every document.
          When Helvara translates a document, it checks each block against your glossary and
          applies your preferred translations automatically.
        </p>

        {/* Stat tiles — only shown when terms exist */}
        {totalTerms > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <p className="text-xs font-medium text-brand-muted">Terms in your glossary</p>
              <p className="mt-1 font-display text-2xl font-bold text-brand-text">{totalTerms}</p>
              <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">
                {langPairs.length} {langPairs.length === 1 ? "language pair" : "language pairs"}
              </p>
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <p className="text-xs font-medium text-brand-muted">Times applied</p>
              <p className={`mt-1 font-display text-2xl font-bold ${totalUsage > 0 ? "text-brand-accent" : "text-brand-subtle"}`}>
                {totalUsage}
              </p>
              <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">Across all translations</p>
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <p className="text-xs font-medium text-brand-muted">Time saved</p>
              <p className={`mt-1 font-display text-2xl font-bold ${timeSavedHrs ? "text-brand-text" : "text-brand-subtle"}`}>
                {timeSavedHrs ? `~${timeSavedHrs} hrs` : "—"}
              </p>
              <p className="mt-0.5 text-[0.6875rem] text-brand-subtle">vs manual terminology checking</p>
            </div>
          </div>
        )}

        {/* ── Suggested terms from recent translations ── */}
        {pendingSuggestions.length > 0 && (
          <div className="mb-6 rounded-xl border border-brand-accent/30 bg-brand-accentMid/30 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-brand-text">
                From your recent translations, we suggest adding these terms:
              </p>
              <button
                type="button"
                onClick={() => {
                  const ids = pendingSuggestions.map((s) => s.id);
                  void glossarySuggestionsApi.bulkAccept(ids).then(() => {
                    setPendingSuggestions([]);
                    loadTerms();
                  });
                }}
                className="rounded-full border border-brand-accent bg-brand-accentMid px-3 py-1 text-xs font-medium text-brand-accent hover:bg-brand-accent hover:text-white transition-colors"
              >
                Add all {pendingSuggestions.length} terms
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-surface">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-brand-subtle">Source</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-brand-subtle">Translation</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-brand-subtle">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSuggestions.map((s) => (
                    <tr key={s.id} className="border-b border-brand-border last:border-0">
                      <td className="px-4 py-2 font-medium text-brand-text">{s.source_term}</td>
                      <td className="px-4 py-2 text-brand-muted">{s.target_term}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            void glossarySuggestionsApi.accept(s.id).then(() => {
                              setPendingSuggestions((prev) => prev.filter((p) => p.id !== s.id));
                              loadTerms();
                            });
                          }}
                          className="mr-2 text-status-success hover:underline"
                        >
                          ✓ Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void glossarySuggestionsApi.reject(s.id).then(() => {
                              setPendingSuggestions((prev) => prev.filter((p) => p.id !== s.id));
                            });
                          }}
                          className="text-brand-subtle hover:text-brand-text"
                        >
                          ✗ Skip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {message && <p className="mb-4 text-sm text-brand-accent">{message}</p>}
        {error && <p className="mb-4 text-sm text-status-error">{error}</p>}

        {/* ── Add term panel (collapsible) ── */}
        {showAddPanel && (
          <div className="mb-6 rounded-xl border border-brand-border bg-brand-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-brand-text">Add term</h2>
              <button
                type="button"
                onClick={() => setShowAddPanel(false)}
                className="text-brand-subtle hover:text-brand-text"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                value={form.source_term}
                onChange={(e) => setForm((current) => ({ ...current, source_term: e.target.value }))}
                placeholder="Source term"
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                required
              />
              <input
                value={form.target_term}
                onChange={(e) => setForm((current) => ({ ...current, target_term: e.target.value }))}
                placeholder="Target term"
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                required
              />
              <input
                value={form.source_language}
                onChange={(e) => setForm((current) => ({ ...current, source_language: e.target.value }))}
                placeholder="Source language"
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                required
              />
              <input
                value={form.target_language}
                onChange={(e) => setForm((current) => ({ ...current, target_language: e.target.value }))}
                placeholder="Target language"
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                required
              />
              <input
                value={form.industry}
                onChange={(e) => setForm((current) => ({ ...current, industry: e.target.value }))}
                placeholder="Industry (optional)"
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
              />
              <input
                value={form.domain}
                onChange={(e) => setForm((current) => ({ ...current, domain: e.target.value }))}
                placeholder="Domain (optional)"
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
              />
              <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : "Save glossary term"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Import CSV panel (collapsible) ── */}
        {showImportPanel && (
          <div className="mb-6 rounded-xl border border-brand-border bg-brand-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-brand-text">Import CSV</h2>
              <button
                type="button"
                onClick={() => setShowImportPanel(false)}
                className="text-brand-subtle hover:text-brand-text"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-brand-subtle">
              CSV must include headers: source_term, target_term. Terms will be merged with your existing glossary.
            </p>
            <form
              onSubmit={(e) => { void handleCsvImport(e); }}
              className="flex flex-wrap items-end gap-3"
            >
              <div>
                <label className="mb-1.5 block text-xs font-medium text-brand-subtle">CSV file</label>
                <input
                  type="file"
                  accept=".csv"
                  required
                  disabled={csvImporting}
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-brand-text file:mr-3 file:border-0 file:bg-brand-bg file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-muted hover:file:bg-brand-bg"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-brand-subtle">Source language</label>
                <input
                  value={csvSourceLang}
                  onChange={(e) => setCsvSourceLang(e.target.value)}
                  placeholder="en"
                  required
                  disabled={csvImporting}
                  className="w-24 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm focus:border-brand-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-brand-subtle">Target language</label>
                <input
                  value={csvTargetLang}
                  onChange={(e) => setCsvTargetLang(e.target.value)}
                  placeholder="de"
                  required
                  disabled={csvImporting}
                  className="w-24 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm focus:border-brand-accent focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={csvImporting || !csvFile}
                className="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov disabled:opacity-50 transition-colors"
              >
                {csvImporting ? "Importing…" : "Import"}
              </button>
            </form>
            {csvResult && (
              <div className="mt-3 text-sm text-brand-accent">
                Imported {csvResult.imported} terms, skipped {csvResult.skipped}.
                {csvResult.errors.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-status-error">
                    {csvResult.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {csvError && <p className="mt-2 text-sm text-status-error">{csvError}</p>}
          </div>
        )}

        {/* ── Term table ── */}
        <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
          {/* Search + language filter bar */}
          <div className="border-b border-brand-border px-5 py-4">
            <div className="flex items-center gap-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search terms…"
                className="w-full max-w-xs rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 placeholder:text-brand-subtle"
              />
              {langPairs.length >= 2 && (
                <div className="flex flex-wrap gap-1.5">
                  {["All", ...langPairs].map((pair) => (
                    <button
                      key={pair}
                      type="button"
                      onClick={() => setLangFilter(pair)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        langFilter === pair
                          ? "bg-brand-accent text-white"
                          : "border border-brand-border bg-brand-surface text-brand-muted hover:bg-brand-bg"
                      }`}
                    >
                      {pair === "All" ? "All languages" : pair}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-border">
                <th className={TH}>Source term</th>
                <th className={TH}>Translation</th>
                {!singleLangActive && <th className={TH}>Languages</th>}
                <th className={TH}>Type</th>
                <th className={TH}>Usage</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={singleLangActive ? 5 : 6} className="px-5 py-8 text-center text-sm text-brand-subtle">
                    Loading…
                  </td>
                </tr>
              ) : displayedTerms.length === 0 && terms.length === 0 ? (
                /* Empty state */
                <tr>
                  <td colSpan={singleLangActive ? 5 : 6} className="px-5 py-16 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mb-3 text-4xl">📖</div>
                      <p className="font-display text-lg font-bold text-brand-text">No terms yet</p>
                      <p className="mt-1 text-sm text-brand-muted">
                        Add terms to ensure Helvara translates your key vocabulary consistently across every document.
                      </p>
                      <div className="mt-5 flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => { setShowAddPanel(true); setShowImportPanel(false); }}
                          className="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov transition-colors"
                        >
                          + Add first term
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowImportPanel(true); setShowAddPanel(false); }}
                          className="rounded-full border border-brand-border bg-brand-surface px-5 py-2.5 text-sm font-medium text-brand-muted hover:bg-brand-bg transition-colors"
                        >
                          Import CSV
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : displayedTerms.length === 0 ? (
                <tr>
                  <td colSpan={singleLangActive ? 5 : 6} className="px-5 py-8 text-center text-sm text-brand-subtle">
                    No terms match your search or filter.
                  </td>
                </tr>
              ) : (
                displayedTerms.map((term) => {
                  const isEditing = editingId === term.id;
                  const isPhrase = term.source_term.includes(" ");
                  return (
                    <tr key={term.id} className="group/row border-b border-brand-border last:border-0 transition-colors hover:bg-brand-bg">
                      {/* Source term */}
                      <td className="px-5 py-3.5 font-medium text-brand-text">
                        {isEditing ? (
                          <input
                            value={editSource}
                            onChange={(e) => setEditSource(e.target.value)}
                            className="w-full rounded-lg border border-brand-border px-2 py-1 text-sm focus:border-brand-accent focus:outline-none"
                          />
                        ) : (
                          term.source_term
                        )}
                      </td>
                      {/* Translation */}
                      <td className="px-5 py-3.5 text-brand-text">
                        {isEditing ? (
                          <input
                            value={editTarget}
                            onChange={(e) => setEditTarget(e.target.value)}
                            className="w-full rounded-lg border border-brand-border px-2 py-1 text-sm focus:border-brand-accent focus:outline-none"
                          />
                        ) : (
                          term.target_term
                        )}
                      </td>
                      {/* Languages */}
                      {!singleLangActive && (
                        <td className="px-5 py-3.5 text-brand-muted">
                          {toLangCode(term.source_language)} → {toLangCode(term.target_language)}
                        </td>
                      )}
                      {/* Type */}
                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-brand-bg px-2 py-0.5 text-xs font-medium text-brand-subtle">
                          {isPhrase ? "Phrase" : "Term"}
                        </span>
                      </td>
                      {/* Usage */}
                      <td className="px-5 py-3.5">
                        {term.usage_count > 0 ? (
                          <span className="text-xs text-brand-muted">
                            Used {term.usage_count} {term.usage_count === 1 ? "time" : "times"}
                          </span>
                        ) : (
                          <span className="text-xs text-brand-subtle">Not used yet</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => { void handleSaveEdit(term.id); }}
                              disabled={editSaving}
                              className="text-sm font-medium text-brand-accent disabled:opacity-50"
                            >
                              {editSaving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={editSaving}
                              className="text-sm text-brand-subtle hover:text-brand-muted disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            {editError && <span className="text-xs text-status-error">{editError}</span>}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover/row:opacity-100">
                            <button
                              type="button"
                              onClick={() => startEdit(term)}
                              className="text-sm text-brand-subtle hover:text-brand-text"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => { void handleDelete(term.id); }}
                              className="text-sm text-status-error hover:opacity-80"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
    </AppShell>
  );
}
