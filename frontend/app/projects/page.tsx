"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { useProjects } from "../hooks/queries";
import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/PageHeader";
import { NewProjectModal } from "../dashboard/NewProjectModal";

export default function ProjectsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const openProjectModal = useDashboardStore((s) => s.openProjectModal);
  const { data: projects, isLoading } = useProjects();

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  if (!hasHydrated || !token) return null;

  return (
    <AppShell>
      <div className="px-8 py-8">
        <PageHeader
          eyebrow="Workspace"
          title="Projects"
          action={
            projects && projects.length > 0 ? (
              <button
                type="button"
                onClick={openProjectModal}
                className="rounded-full bg-brand-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-accentHov"
              >
                + New Project
              </button>
            ) : undefined
          }
        />

        {isLoading && <p className="text-sm text-brand-muted">Loading…</p>}

        {!isLoading && (!projects || projects.length === 0) && (
          <div className="rounded-xl border border-brand-border bg-brand-surface px-8 py-20 text-center">
            <p className="font-display text-2xl font-bold text-brand-text">No projects yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-brand-muted">
              Create a project to organise your translations by client, campaign, or topic.
            </p>
            <button
              type="button"
              onClick={openProjectModal}
              className="mt-6 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov"
            >
              + New Project
            </button>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group rounded-xl border border-brand-border bg-brand-surface p-6 no-underline transition-colors hover:border-brand-accent"
              >
                <p className="font-display text-lg font-semibold text-brand-text group-hover:text-brand-accent">{p.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {p.target_languages.map((lang) => (
                    <span key={lang} className="rounded-full bg-brand-accentMid px-2 py-0.5 text-xs font-medium text-brand-accent">{lang}</span>
                  ))}
                  <span className="rounded-full bg-brand-bg px-2 py-0.5 text-xs font-medium text-brand-muted">
                    {p.default_tone}
                  </span>
                </div>
                <p className="mt-3 text-xs text-brand-subtle">
                  {p.document_count} {p.document_count === 1 ? "document" : "documents"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
      <NewProjectModal />
    </AppShell>
  );
}
