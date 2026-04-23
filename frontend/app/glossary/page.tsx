"use client";

/**
 * Glossary page — manage glossary terms with three-tab switcher (Terms,
 * Do Not Translate, Forbidden), search, language filters, inline editing,
 * CSV import, AI-suggested terms, and a right-side detail panel.
 * Redesigned to match the Helvara design system (PIR-131).
 */

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/PageHeader";
import { Icons } from "../components/Icons";
import {
  glossaryTermsApi,
  glossarySuggestionsApi,
  type GlossaryTerm,
  type GlossaryTermCreate,
  type GlossarySuggestion,
} from "../services/api";

// ── Helpers ─────────────────────────────────────────────────────────────────

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

type GlossaryTab = "terms" | "do_not_translate" | "forbidden";

const LANG_CODE_MAP: Record<string, string> = {
  english: "EN", german: "DE", french: "FR", dutch: "NL", spanish: "ES",
  japanese: "JA", korean: "KO", thai: "TH", chinese: "ZH", italian: "IT",
  portuguese: "PT", arabic: "AR", en: "EN", de: "DE", fr: "FR", nl: "NL",
  es: "ES", ja: "JA", ko: "KO", th: "TH", zh: "ZH", it: "IT", pt: "PT", ar: "AR",
};

function toLangCode(lang: string): string {
  return LANG_CODE_MAP[lang.toLowerCase()] ?? (lang.length <= 3 ? lang.toUpperCase() : lang.substring(0, 2).toUpperCase());
}

// Derive a status for display purposes — real status field can come from backend later
function deriveTermStatus(term: GlossaryTerm): "locked" | "enforced" | "suggested" {
  if (term.usage_count > 5) return "locked";
  if (term.usage_count > 0) return "enforced";
  return "suggested";
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function GlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [form, setForm] = useState<GlossaryForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<GlossaryTab>("terms");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSource, setEditSource] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvSourceLang, setCsvSourceLang] = useState("en");
  const [csvTargetLang, setCsvTargetLang] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [csvError, setCsvError] = useState("");
  const [pendingSuggestions, setPendingSuggestions] = useState<GlossarySuggestion[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);

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

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const langPairs = useMemo(() => {
    const seen = new Set<string>();
    terms.forEach((t) => seen.add(`${toLangCode(t.source_language)} → ${toLangCode(t.target_language)}`));
    return Array.from(seen).sort();
  }, [terms]);

  const totalTerms = terms.length;
  const totalUsage = useMemo(() => terms.reduce((sum, t) => sum + (t.usage_count ?? 0), 0), [terms]);

  const displayedTerms = useMemo(() => {
    return terms.filter((t) => {
      const matchesSearch = !search
        || t.source_term.toLowerCase().includes(search.toLowerCase())
        || t.target_term.toLowerCase().includes(search.toLowerCase());
      const matchesLang = langFilter === "All"
        || `${toLangCode(t.source_language)} → ${toLangCode(t.target_language)}` === langFilter;
      return matchesSearch && matchesLang;
    });
  }, [terms, search, langFilter]);

  const singleLangActive = langFilter !== "All";
  const selectedTerm = selectedTermId != null ? terms.find((t) => t.id === selectedTermId) ?? null : null;

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
      if (selectedTermId === termId) setSelectedTermId(null);
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

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-10 py-10">
        <PageHeader
          eyebrow="Tools"
          title="Glossary"
          subtitle={totalTerms > 0 ? `${totalTerms} terms · ${totalUsage} times applied across all translations` : "Ensure key terms are translated consistently across every document."}
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowImportPanel(!showImportPanel); setShowAddPanel(false); }}
                className="rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-[0.8125rem] font-medium text-brand-muted shadow-card transition-all hover:border-brand-text hover:shadow-raised"
              >
                Import CSV
              </button>
              <button
                type="button"
                onClick={() => { setShowAddPanel(!showAddPanel); setShowImportPanel(false); }}
                className="flex items-center gap-1.5 rounded-full bg-brand-text px-4 py-2 text-[0.8125rem] font-medium text-white shadow-card transition-all hover:bg-brand-accent"
              >
                <Icons.Plus className="h-3.5 w-3.5" /> Add term
              </button>
            </div>
          }
        />

        {/* Three-tab switcher */}
        <div className="mb-6 inline-flex rounded-full border border-brand-border bg-brand-surface p-0.5 shadow-card">
          {([
            { key: "terms" as const, label: "Terms" },
            { key: "do_not_translate" as const, label: "Do Not Translate" },
            { key: "forbidden" as const, label: "Forbidden" },
          ]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                activeTab === tab.key ? "bg-brand-accent text-white" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats strip */}
        {totalTerms > 0 && (
          <section className="mb-7 grid grid-cols-3 gap-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
            <div className="px-6 py-5">
              <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">Terms</p>
              <p className="m-0 mt-2.5 font-display text-[2.25rem] font-semibold leading-none tracking-display text-brand-text">{totalTerms}</p>
              <p className="m-0 mt-2 text-xs text-brand-subtle">{langPairs.length} language {langPairs.length === 1 ? "pair" : "pairs"}</p>
            </div>
            <div className="border-l border-brand-borderSoft px-6 py-5">
              <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">Times applied</p>
              <p className={`m-0 mt-2.5 font-display text-[2.25rem] font-semibold leading-none tracking-display ${totalUsage > 0 ? "text-brand-accent" : "text-brand-subtle"}`}>{totalUsage}</p>
              <p className="m-0 mt-2 text-xs text-brand-subtle">across all translations</p>
            </div>
            <div className="border-l border-brand-borderSoft px-6 py-5">
              <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">Suggestions</p>
              <p className={`m-0 mt-2.5 font-display text-[2.25rem] font-semibold leading-none tracking-display ${pendingSuggestions.length > 0 ? "text-brand-accent" : "text-brand-subtle"}`}>{pendingSuggestions.length}</p>
              <p className="m-0 mt-2 text-xs text-brand-subtle">pending review</p>
            </div>
          </section>
        )}

        {/* AI suggestions */}
        {pendingSuggestions.length > 0 && (
          <section className="mb-6 overflow-hidden rounded-2xl border border-brand-accent/30 bg-brand-surface shadow-card">
            <header className="flex items-center justify-between border-b border-brand-borderSoft px-5 pb-3 pt-4">
              <div className="flex items-center gap-2">
                <Icons.Sparkle className="h-4 w-4 text-brand-accent" />
                <h2 className="m-0 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Suggested terms</h2>
                <span className="rounded-full bg-brand-accentSoft px-2 py-0.5 text-[0.625rem] font-semibold text-brand-accent">{pendingSuggestions.length}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const ids = pendingSuggestions.map((s) => s.id);
                  void glossarySuggestionsApi.bulkAccept(ids).then(() => { setPendingSuggestions([]); loadTerms(); });
                }}
                className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-[0.75rem] font-medium text-brand-muted shadow-card transition-colors hover:bg-brand-sunken hover:text-brand-text"
              >
                Add all
              </button>
            </header>
            <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
              {pendingSuggestions.map((s) => (
                <li key={s.id} className="flex items-center gap-4 bg-brand-accentSoft/20 px-5 py-3 transition-colors hover:bg-brand-accentSoft/40">
                  <span className="inline-flex items-center rounded-full border border-brand-accent/30 bg-brand-surface px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.1em] text-brand-accent">AI</span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-brand-text">{s.source_term}</span>
                  <Icons.Arrow className="h-3 w-3 text-brand-hint" />
                  <span className="min-w-0 flex-1 text-sm text-brand-muted">{s.target_term}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { void glossarySuggestionsApi.accept(s.id).then(() => { setPendingSuggestions((p) => p.filter((x) => x.id !== s.id)); loadTerms(); }); }}
                      className="rounded-full bg-brand-accent px-3 py-1 text-[0.75rem] font-medium text-white transition-colors hover:bg-brand-accentHov"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => { void glossarySuggestionsApi.reject(s.id).then(() => { setPendingSuggestions((p) => p.filter((x) => x.id !== s.id)); }); }}
                      className="rounded-full border border-brand-border px-3 py-1 text-[0.75rem] font-medium text-brand-muted transition-colors hover:bg-brand-sunken hover:text-brand-text"
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {message && (
          <div className="animate-slideup fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-brand-border bg-brand-surface px-5 py-2.5 text-sm font-medium text-brand-text shadow-lg">
            {message}
          </div>
        )}
        {error && <p className="mb-4 text-sm text-status-error">{error}</p>}

        {/* Add term panel */}
        {showAddPanel && (
          <section className="mb-6 rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card animate-fadein">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="m-0 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Add term</h2>
              <button type="button" onClick={() => setShowAddPanel(false)} className="text-brand-subtle hover:text-brand-text">
                <span className="text-lg">x</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Source term <span className="text-status-error">*</span></label>
                <input value={form.source_term} onChange={(e) => setForm((c) => ({ ...c, source_term: e.target.value }))} placeholder="e.g. adaptive noise cancellation" className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-subtle focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20" required />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Target term <span className="text-status-error">*</span></label>
                <input value={form.target_term} onChange={(e) => setForm((c) => ({ ...c, target_term: e.target.value }))} placeholder="e.g. cancelacion de ruido adaptativa" className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-subtle focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20" required />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Source language <span className="text-status-error">*</span></label>
                <input value={form.source_language} onChange={(e) => setForm((c) => ({ ...c, source_language: e.target.value }))} className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20" required />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Target language <span className="text-status-error">*</span></label>
                <input value={form.target_language} onChange={(e) => setForm((c) => ({ ...c, target_language: e.target.value }))} className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20" required />
              </div>
              <div className="col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddPanel(false)} className="text-sm font-medium text-brand-muted underline hover:text-brand-text">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-full bg-brand-text px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save term"}</button>
              </div>
            </form>
          </section>
        )}

        {/* Import CSV panel */}
        {showImportPanel && (
          <section className="mb-6 rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card animate-fadein">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="m-0 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Import CSV</h2>
              <button type="button" onClick={() => setShowImportPanel(false)} className="text-brand-subtle hover:text-brand-text"><span className="text-lg">x</span></button>
            </div>
            <p className="mb-4 text-sm text-brand-subtle">CSV must include headers: source_term, target_term. Terms will be merged with your existing glossary.</p>
            <form onSubmit={(e) => { void handleCsvImport(e); }} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">CSV file</label>
                <input type="file" accept=".csv" required disabled={csvImporting} onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} className="text-sm text-brand-text file:mr-3 file:rounded-full file:border-0 file:bg-brand-sunken file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-muted hover:file:bg-brand-bg" />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Source lang</label>
                <input value={csvSourceLang} onChange={(e) => setCsvSourceLang(e.target.value)} placeholder="en" required disabled={csvImporting} className="w-24 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm focus:border-brand-accent focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Target lang</label>
                <input value={csvTargetLang} onChange={(e) => setCsvTargetLang(e.target.value)} placeholder="de" required disabled={csvImporting} className="w-24 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm focus:border-brand-accent focus:outline-none" />
              </div>
              <button type="submit" disabled={csvImporting || !csvFile} className="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-accentHov disabled:cursor-not-allowed disabled:opacity-50">{csvImporting ? "Importing..." : "Import"}</button>
            </form>
            {csvResult && (
              <p className="mt-3 text-sm text-brand-accent">Imported {csvResult.imported} terms, skipped {csvResult.skipped}.</p>
            )}
            {csvError && <p className="mt-2 text-sm text-status-error">{csvError}</p>}
          </section>
        )}

        {/* Search + language filter bar */}
        <div className="mb-5 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Icons.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-hint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search terms..."
              className="w-full rounded-full border border-brand-border bg-brand-surface py-2 pl-9 pr-3.5 text-[0.8125rem] text-brand-text shadow-card placeholder:text-brand-subtle focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/15"
            />
          </div>
          {langPairs.length >= 2 && (
            <div className="inline-flex rounded-full border border-brand-border bg-brand-surface p-0.5 shadow-card">
              {["All", ...langPairs].map((pair) => (
                <button
                  key={pair}
                  type="button"
                  onClick={() => setLangFilter(pair)}
                  className={`rounded-full px-3 py-1.5 text-[0.75rem] font-medium transition-colors ${
                    langFilter === pair ? "bg-brand-text text-white" : "text-brand-muted hover:text-brand-text"
                  }`}
                >
                  {pair === "All" ? "All" : pair}
                </button>
              ))}
            </div>
          )}
          <span className="text-xs text-brand-subtle">{displayedTerms.length} shown</span>
        </div>

        {/* Main content: table + detail panel */}
        <div className="flex gap-6">
          {/* Terms table */}
          <section className={`overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card ${selectedTerm ? "flex-1" : "w-full"}`}>
            <header className="grid grid-cols-[2fr_2fr_0.8fr_0.7fr_0.7fr_0.5fr] gap-4 border-b border-brand-borderSoft bg-brand-sunken/50 px-5 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">
              <span>Source term</span>
              <span>Translation</span>
              {!singleLangActive && <span>Languages</span>}
              {singleLangActive && <span />}
              <span>Status</span>
              <span>Scope</span>
              <span />
            </header>

            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-brand-subtle">Loading...</div>
            ) : activeTab !== "terms" ? (
              <div className="px-5 py-16 text-center">
                <p className="m-0 font-display text-lg font-semibold text-brand-text">
                  {activeTab === "do_not_translate" ? "Do Not Translate" : "Forbidden"} terms
                </p>
                <p className="m-0 mt-1.5 text-sm text-brand-muted">
                  {activeTab === "do_not_translate"
                    ? "Terms that should remain in the source language. Coming soon."
                    : "Terms that must never appear in translations. Coming soon."}
                </p>
              </div>
            ) : displayedTerms.length === 0 && terms.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <p className="m-0 font-display text-lg font-semibold text-brand-text">No terms yet</p>
                <p className="m-0 mt-1.5 text-sm text-brand-muted">Add terms to ensure consistent translations across every document.</p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button type="button" onClick={() => { setShowAddPanel(true); setShowImportPanel(false); }} className="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-accentHov">Add first term</button>
                  <button type="button" onClick={() => { setShowImportPanel(true); setShowAddPanel(false); }} className="rounded-full border border-brand-border bg-brand-surface px-5 py-2.5 text-sm font-medium text-brand-muted shadow-card transition-colors hover:bg-brand-sunken hover:text-brand-text">Import CSV</button>
                </div>
              </div>
            ) : displayedTerms.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-brand-subtle">No terms match your search or filter.</div>
            ) : (
              <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
                {displayedTerms.map((term) => {
                  const isEditing = editingId === term.id;
                  const isSelected = selectedTermId === term.id;
                  const status = deriveTermStatus(term);
                  return (
                    <li
                      key={term.id}
                      onClick={() => !isEditing && setSelectedTermId(isSelected ? null : term.id)}
                      className={`group/row grid cursor-pointer grid-cols-[2fr_2fr_0.8fr_0.7fr_0.7fr_0.5fr] items-center gap-4 px-5 py-3.5 shadow-card transition-all hover:shadow-raised ${
                        isSelected ? "bg-brand-accentMid/20" : "hover:bg-brand-sunken/60"
                      }`}
                    >
                      {/* Source */}
                      <div className="min-w-0">
                        {isEditing ? (
                          <input value={editSource} onChange={(e) => setEditSource(e.target.value)} className="w-full rounded-lg border border-brand-border px-2 py-1 text-sm text-brand-text focus:border-brand-accent focus:outline-none" />
                        ) : (
                          <span className="text-sm font-medium text-brand-text">{term.source_term}</span>
                        )}
                      </div>
                      {/* Target */}
                      <div className="min-w-0">
                        {isEditing ? (
                          <input value={editTarget} onChange={(e) => setEditTarget(e.target.value)} className="w-full rounded-lg border border-brand-border px-2 py-1 text-sm text-brand-text focus:border-brand-accent focus:outline-none" />
                        ) : (
                          <span className="text-sm text-brand-muted">{term.target_term}</span>
                        )}
                      </div>
                      {/* Languages */}
                      <span className="font-mono text-[0.6875rem] text-brand-muted">
                        {toLangCode(term.source_language)} → {toLangCode(term.target_language)}
                      </span>
                      {/* Status */}
                      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${
                        status === "locked" ? "bg-brand-sunken text-brand-text"
                        : status === "enforced" ? "bg-status-successBg text-status-success"
                        : "bg-brand-accentSoft text-brand-accent"
                      }`}>
                        {status === "locked" && (
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2.5" y="5" width="7" height="5" rx="1" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" /></svg>
                        )}
                        {status === "enforced" && <span className="h-1.5 w-1.5 rounded-full bg-status-success" />}
                        {status === "locked" ? "Locked" : status === "enforced" ? "Enforced" : "Suggested"}
                      </span>
                      {/* Scope */}
                      <span className="rounded-full bg-brand-sunken px-2 py-0.5 text-[0.6875rem] font-medium text-brand-subtle">
                        Master
                      </span>
                      {/* Actions */}
                      <div>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={(e) => { e.stopPropagation(); void handleSaveEdit(term.id); }} disabled={editSaving} className="text-[0.75rem] font-medium text-brand-accent disabled:opacity-50">{editSaving ? "..." : "Save"}</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} disabled={editSaving} className="text-[0.75rem] text-brand-subtle hover:text-brand-muted disabled:opacity-50">Cancel</button>
                            {editError && <span className="text-[0.6875rem] text-status-error">{editError}</span>}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover/row:opacity-100">
                            <button type="button" onClick={(e) => { e.stopPropagation(); startEdit(term); }} className="text-[0.75rem] text-brand-subtle hover:text-brand-text">Edit</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); void handleDelete(term.id); }} className="text-[0.75rem] text-status-error hover:opacity-80">Delete</button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Right-side detail panel */}
          {selectedTerm && (
            <aside className="w-[340px] shrink-0 animate-fadein rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card self-start">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">Term detail</p>
                  <p className="m-0 mt-1 text-base font-semibold text-brand-text">{selectedTerm.source_term}</p>
                </div>
                <button type="button" onClick={() => setSelectedTermId(null)} className="text-brand-subtle hover:text-brand-text">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="m-0 mb-1 text-[0.6875rem] font-medium text-brand-subtle">Translation</p>
                  <p className="m-0 text-sm text-brand-text">{selectedTerm.target_term}</p>
                </div>
                <div>
                  <p className="m-0 mb-1 text-[0.6875rem] font-medium text-brand-subtle">Language pair</p>
                  <p className="m-0 font-mono text-sm text-brand-muted">{toLangCode(selectedTerm.source_language)} → {toLangCode(selectedTerm.target_language)}</p>
                </div>
                <div>
                  <p className="m-0 mb-1 text-[0.6875rem] font-medium text-brand-subtle">Usage count</p>
                  <p className="m-0 text-sm text-brand-text">{selectedTerm.usage_count ?? 0} times applied</p>
                </div>
                <div>
                  <p className="m-0 mb-1 text-[0.6875rem] font-medium text-brand-subtle">Status</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    deriveTermStatus(selectedTerm) === "locked" ? "bg-brand-sunken text-brand-text"
                    : deriveTermStatus(selectedTerm) === "enforced" ? "bg-status-successBg text-status-success"
                    : "bg-brand-accentSoft text-brand-accent"
                  }`}>
                    {deriveTermStatus(selectedTerm) === "locked" ? "Locked" : deriveTermStatus(selectedTerm) === "enforced" ? "Enforced" : "Suggested"}
                  </span>
                </div>
                <div>
                  <p className="m-0 mb-1 text-[0.6875rem] font-medium text-brand-subtle">Scope</p>
                  <span className="rounded-full bg-brand-sunken px-2.5 py-0.5 text-xs font-medium text-brand-subtle">Master</span>
                </div>
                {selectedTerm.created_at && (
                  <div>
                    <p className="m-0 mb-1 text-[0.6875rem] font-medium text-brand-subtle">Created</p>
                    <p className="m-0 text-sm text-brand-muted">
                      {new Date(selectedTerm.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center gap-3 border-t border-brand-borderSoft pt-5">
                <button
                  type="button"
                  onClick={() => startEdit(selectedTerm)}
                  className="rounded-full bg-brand-text px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-accent"
                >
                  Edit term
                </button>
                <button
                  type="button"
                  onClick={() => { void handleDelete(selectedTerm.id); }}
                  className="text-sm font-medium text-status-error hover:opacity-80"
                >
                  Delete
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </AppShell>
  );
}
