"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { apiFetch, API_URL } from "../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type TranslationJob = {
  id: number;
  status: "pending" | "processing" | "review" | "completed" | "failed";
  source_language: string;
  target_language: string;
  created_at: string;
  document_name: string | null;
};

// ─── Query keys ───────────────────────────────────────────────────────────────

const QUERY_KEYS = {
  recentJobs: ["translation-jobs", "recent"] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TranslationJob["status"], string> = {
  pending: "Pending",
  processing: "Processing",
  review: "In Review",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_BADGE: Record<TranslationJob["status"], React.CSSProperties> = {
  pending:    { background: "#f1eee5", color: "#424843" },
  processing: { background: "#fef3cd", color: "#92610a" },
  review:     { background: "#e6f0ea", color: "#082012" },
  completed:  { background: "#e6f4f2", color: "#0D7B6E" },
  failed:     { background: "#fde8e8", color: "#ba1a1a" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getFirstName(fullName: string | null | undefined, email: string): string {
  if (fullName) return fullName.split(" ")[0];
  return email.split("@")[0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function JobRow({ job }: { job: TranslationJob }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/translation-jobs/${job.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 2rem",
        borderBottom: "1px solid #f6f3eb",
        backgroundColor: hovered ? "#f6f3eb" : "transparent",
        transition: "background-color 0.15s",
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: hovered ? "#082012" : "#1c1c17",
          transition: "color 0.15s",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          margin: 0,
        }}>
          {job.document_name ?? `Job #${job.id}`}
        </p>
        <p style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "0.75rem",
          color: "#424843",
          opacity: 0.7,
          marginTop: "2px",
          margin: "2px 0 0",
        }}>
          {job.source_language} → {job.target_language} · {formatDate(job.created_at)}
        </p>
      </div>
      <span style={{
        ...STATUS_BADGE[job.status],
        borderRadius: "9999px",
        padding: "0.2rem 0.75rem",
        fontSize: "0.6875rem",
        fontWeight: 600,
        fontFamily: "Inter, sans-serif",
        flexShrink: 0,
        marginLeft: "1rem",
      }}>
        {STATUS_LABELS[job.status]}
      </span>
    </Link>
  );
}

function QuickActionCard({ label, desc, href }: { label: string; desc: string; href: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        backgroundColor: hovered ? "#f6f3eb" : "#ffffff",
        borderRadius: "4px",
        padding: "1.25rem 1.5rem",
        cursor: "pointer",
        transition: "background-color 0.15s",
        textDecoration: "none",
      }}
    >
      <p style={{
        fontFamily: "Inter, sans-serif",
        fontSize: "0.875rem",
        fontWeight: 600,
        color: "#082012",
        margin: 0,
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: "Inter, sans-serif",
        fontSize: "0.75rem",
        color: "#424843",
        opacity: 0.65,
        marginTop: "2px",
        margin: "2px 0 0",
      }}>
        {desc}
      </p>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  // Redirect to login if unauthenticated — wait for hydration to avoid false redirects
  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  const { data: jobs, isLoading: jobsLoading } = useQuery<TranslationJob[]>({
    queryKey: QUERY_KEYS.recentJobs,
    queryFn: () =>
      apiFetch(`${API_URL}/translation-jobs?limit=10&order=desc`) as Promise<TranslationJob[]>,
    enabled: !!token,
    staleTime: 30_000,
  });

  if (!hasHydrated) return null;
  if (!token) return null;

  const firstName = getFirstName(user?.full_name, user?.email ?? "");

  return (
    <div style={{ backgroundColor: "#fcf9f0", minHeight: "100vh", padding: "5rem 2rem 4rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: "2.5rem", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <p style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.6875rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#0D7B6E",
              opacity: 0.8,
              marginBottom: "0.375rem",
              margin: "0 0 0.375rem",
            }}>
              Welcome back
            </p>
            <h1 style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#082012",
              lineHeight: 1.05,
              margin: 0,
            }}>
              {firstName}
            </h1>
          </div>

          <Link
            href="/upload"
            style={{
              backgroundColor: "#082012",
              color: "#ffffff",
              fontFamily: "Inter, sans-serif",
              fontSize: "0.875rem",
              fontWeight: 600,
              padding: "0.625rem 1.5rem",
              borderRadius: "9999px",
              textDecoration: "none",
              transition: "opacity 0.15s",
              display: "inline-block",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
          >
            New translation
          </Link>
        </div>

        {/* ── Recent jobs ── */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: "4px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 2rem",
            borderBottom: "1px solid #f1eee5",
          }}>
            <h2 style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#082012",
              opacity: 0.5,
              margin: 0,
            }}>
              Recent translations
            </h2>
            <Link
              href="/documents"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "0.75rem",
                color: "#0D7B6E",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
            >
              View all
            </Link>
          </div>

          {jobsLoading && (
            <div>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem 2rem",
                    borderBottom: i < 2 ? "1px solid #f6f3eb" : "none",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div className="animate-pulse" style={{ height: "0.875rem", width: "12rem", borderRadius: "2px", backgroundColor: "#f6f3eb" }} />
                    <div className="animate-pulse" style={{ height: "0.625rem", width: "8rem", borderRadius: "2px", backgroundColor: "#f6f3eb" }} />
                  </div>
                  <div className="animate-pulse" style={{ height: "1.25rem", width: "4rem", borderRadius: "9999px", backgroundColor: "#f6f3eb" }} />
                </div>
              ))}
            </div>
          )}

          {!jobsLoading && (!jobs || jobs.length === 0) && (
            <div style={{ padding: "3rem 2rem", textAlign: "center" }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "#424843", opacity: 0.6, margin: "0 0 0.75rem" }}>
                No translations yet.
              </p>
              <Link
                href="/upload"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#0D7B6E",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
              >
                Upload your first document →
              </Link>
            </div>
          )}

          {!jobsLoading && jobs && jobs.length > 0 && (
            <div>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>

        <Link
          href="/documents"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "#0D7B6E",
            textDecoration: "none",
            display: "inline-block",
            marginTop: "0.75rem",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
        >
          View all translations →
        </Link>

        {/* ── Quick actions ── */}
        <div style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
          {[
            { label: "Upload document", href: "/upload",   desc: "Start a new translation job" },
            { label: "Glossary",        href: "/glossary", desc: "Manage terminology" },
            { label: "Settings",        href: "/settings", desc: "Account & preferences" },
          ].map((action) => (
            <QuickActionCard key={action.href} {...action} />
          ))}
        </div>

      </div>
    </div>
  );
}
