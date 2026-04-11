"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { projectsApi } from "../../services/api";
import type { ProjectDetailResponse } from "../../services/api";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const projectId = Number(params.id);

  const [project, setProject] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!token || Number.isNaN(projectId)) return;
    projectsApi
      .get(projectId)
      .then(setProject)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load project"))
      .finally(() => setLoading(false));
  }, [projectId, token]);

  if (!hasHydrated || !token) return null;
  if (loading) return <div className="min-h-screen bg-brand-bg pt-20 px-6">Loading…</div>;
  if (error) return <div className="min-h-screen bg-brand-bg pt-20 px-6 text-status-error">{error}</div>;
  if (!project) return <div className="min-h-screen bg-brand-bg pt-20 px-6 text-status-error">Project not found</div>;

  return (
    <div className="min-h-screen bg-brand-bg pt-20">
      <div className="mx-auto max-w-[1100px] px-10 py-12">
        <Link href="/dashboard" className="mb-6 inline-block text-sm text-brand-subtle hover:text-brand-text no-underline">
          ← Back to dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <p className="mb-2 font-sans text-[0.6875rem] font-medium uppercase tracking-widest text-brand-accent">
            PROJECT
          </p>
          <h1 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.1] tracking-tight text-brand-text">
            {project.name}
          </h1>
          <div className="mt-3 flex items-center gap-4 text-sm text-brand-muted">
            {project.target_languages.length > 0 && (
              <span>Languages: {project.target_languages.join(", ")}</span>
            )}
            <span>Tone: {project.default_tone.charAt(0).toUpperCase() + project.default_tone.slice(1)}</span>
            <span>{project.document_count} {project.document_count === 1 ? "document" : "documents"}</span>
          </div>
        </div>

        {/* Documents */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-brand-text">Documents</h2>
            <Link
              href="/upload"
              className="font-sans text-[0.8125rem] font-medium text-brand-accent no-underline hover:underline"
            >
              + Upload document
            </Link>
          </div>

          {project.documents.length === 0 ? (
            <div className="rounded-lg border border-brand-border bg-brand-surface px-8 py-16 text-center">
              <p className="font-display text-lg font-bold text-brand-text">No documents yet</p>
              <p className="mt-1 font-sans text-sm text-brand-muted">
                Upload your first document to this project.
              </p>
              <Link
                href="/upload"
                className="mt-4 inline-block rounded-full bg-brand-accent px-5 py-2 font-sans text-sm font-medium text-white no-underline hover:bg-brand-accentHov"
              >
                Upload document
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-surface">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-brand-border">
                    {["Document", "Status", "Language", "Created"].map((col) => (
                      <th
                        key={col}
                        className="px-5 py-3 text-left font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {project.documents.map((doc) => (
                    <tr key={doc.id} className="transition-colors hover:bg-brand-bg">
                      <td className="px-5 py-3.5 font-sans text-sm font-medium text-brand-text">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="text-brand-text no-underline hover:underline"
                        >
                          {doc.filename}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-brand-bg px-2.5 py-0.5 font-sans text-[0.6875rem] font-medium text-brand-muted">
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-sans text-sm text-brand-muted">
                        {doc.target_language}
                      </td>
                      <td className="px-5 py-3.5 font-sans text-xs text-brand-subtle">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
