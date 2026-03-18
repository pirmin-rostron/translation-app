"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const INDUSTRY_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "Government", label: "Government" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Legal", label: "Legal" },
  { value: "Financial Services", label: "Financial Services" },
  { value: "Technology", label: "Technology" },
];

const DOMAIN_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "Contract", label: "Contract" },
  { value: "Policy", label: "Policy" },
  { value: "Procedure", label: "Procedure" },
  { value: "Technical Manual", label: "Technical Manual" },
  { value: "Marketing Content", label: "Marketing Content" },
];

const ALLOWED_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/rtf",
  "text/rtf",
];

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [targetLanguage, setTargetLanguage] = useState("");
  const [industry, setIndustry] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidFile = (f: File) => {
    const ext = f.name.toLowerCase().split(".").pop();
    return ext === "docx" || ext === "txt" || ext === "rtf";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!isValidFile(selected)) {
      setError("Only DOCX, TXT, and RTF files are allowed");
      setFile(null);
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("File must be under 10 MB");
      setFile(null);
      return;
    }
    setError("");
    setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Please select a file");
      return;
    }
    const trimmed = targetLanguage.trim();
    if (!trimmed) {
      setError("Target language is required");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target_language", trimmed);
      if (industry.trim()) formData.append("industry", industry.trim());
      if (domain.trim()) formData.append("domain", domain.trim());

      const res = await fetch(`${API_URL}/api/documents/upload-and-translate`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Upload failed (${res.status})`);
      }
      const created = await res.json();
      router.push(`/processing/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-xl px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          Upload Document
        </h1>
        <p className="mb-4 text-sm text-slate-600">
          Upload once and start translation immediately. We will parse, translate, and open review automatically.
        </p>
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4"
        >
          <div>
            <label
              htmlFor="file"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              File (DOCX, TXT, or RTF)
            </label>
            <input
              id="file"
              type="file"
              accept=".docx,.txt,.rtf"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
              required
            />
          </div>
          <div>
            <label
              htmlFor="target_language"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Target language
            </label>
            <input
              id="target_language"
              type="text"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              placeholder="e.g. German"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
              maxLength={50}
              required
            />
          </div>
          <div>
            <label
              htmlFor="industry"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Industry <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required={false}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white"
            >
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="domain"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Domain <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required={false}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white"
            >
              {DOMAIN_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Starting translation…" : "Translate document"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/documents")}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
            >
              View Documents
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
