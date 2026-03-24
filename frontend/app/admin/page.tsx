"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, API_URL, type UsageEvent, type UsageResponse } from "../services/api";

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = "waitlist" | "users" | "usage" | "health";

type UserMe = {
  id: number;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
};

type WaitlistEntry = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

type OrgInfo = {
  id: number;
  name: string;
  created_at: string;
};

type OrgMember = {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}

function toTitle(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function exportCsv(rows: WaitlistEntry[]): void {
  const header = "Name,Email,Joined";
  const lines = rows.map(
    (e) => `"${e.name.replace(/"/g, '""')}","${e.email}","${fmt(e.created_at)}"`
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "waitlist.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

// ── Shared table class constants ───────────────────────────────────────────

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400";
const TD = "px-4 py-3 text-sm text-stone-600";

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-stone-200 bg-white px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#0D7B6E" }}>
        {label}
      </p>
      <p
        className="mt-1 text-3xl font-semibold"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

// ── Coming-soon placeholder ────────────────────────────────────────────────

function ComingSoon({ note }: { note: string }) {
  return (
    <div className="border border-stone-200 bg-stone-50 px-5 py-6">
      <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Coming Soon</p>
      <p className="mt-2 text-sm text-stone-500">{note}</p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("waitlist");

  // Waitlist
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");

  // Users & Orgs
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

  // Usage
  const [usageData, setUsageData] = useState<UsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState("");
  const [auditLog, setAuditLog] = useState<UsageEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");

  // ── Admin check on mount ─────────────────────────────────────────────────
  useEffect(() => {
    void apiFetch<UserMe>(`${API_URL}/auth/me`)
      .then((me) => {
        if (!me.is_admin) {
          router.replace("/dashboard");
          return;
        }
        setAuthChecked(true);
      })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  // ── Waitlist data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authChecked || activeTab !== "waitlist") return;
    setWaitlistLoading(true);
    setWaitlistError("");
    void apiFetch<WaitlistEntry[]>(`${API_URL}/api/waitlist`)
      .then(setWaitlist)
      .catch((err) =>
        setWaitlistError(err instanceof Error ? err.message : "Failed to load waitlist")
      )
      .finally(() => setWaitlistLoading(false));
  }, [authChecked, activeTab]);

  // ── Users & orgs data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!authChecked || activeTab !== "users") return;
    setUsersLoading(true);
    setUsersError("");
    void Promise.all([
      apiFetch<OrgInfo>(`${API_URL}/auth/org`),
      apiFetch<OrgMember[]>(`${API_URL}/auth/org/members`),
    ])
      .then(([orgData, membersData]) => {
        setOrg(orgData);
        setMembers(membersData);
      })
      .catch((err) =>
        setUsersError(err instanceof Error ? err.message : "Failed to load members")
      )
      .finally(() => setUsersLoading(false));
  }, [authChecked, activeTab]);

  // ── Usage + audit data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!authChecked || activeTab !== "usage") return;

    setUsageLoading(true);
    setUsageError("");
    void apiFetch<UsageResponse>(`${API_URL}/auth/usage`)
      .then(setUsageData)
      .catch((err) =>
        setUsageError(err instanceof Error ? err.message : "Failed to load usage data")
      )
      .finally(() => setUsageLoading(false));

    setAuditLoading(true);
    setAuditError("");
    void apiFetch<UsageEvent[]>(`${API_URL}/auth/org/audit`)
      .then(setAuditLog)
      .catch((err) =>
        setAuditError(err instanceof Error ? err.message : "Failed to load audit log")
      )
      .finally(() => setAuditLoading(false));
  }, [authChecked, activeTab]);

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: "#F5F2EC" }}>
        Checking access…
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "waitlist", label: "Waitlist" },
    { key: "users", label: "Users & Orgs" },
    { key: "usage", label: "Usage" },
    { key: "health", label: "System Health" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F2EC" }}>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1
          className="mb-1 text-2xl font-semibold"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
        >
          Admin Dashboard
        </h1>
        <p className="mb-8 text-sm text-stone-500">Internal tooling — admin access only.</p>

        {/* ── Tab pills ── */}
        <div className="mb-8 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-[#1A110A] text-white"
                  : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════
            TAB: Waitlist
        ════════════════════════════════════════════════════════════ */}
        {activeTab === "waitlist" && (
          <section>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2
                  className="text-lg font-semibold"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
                >
                  Waitlist
                </h2>
                {!waitlistLoading && (
                  <p className="mt-0.5 text-sm text-stone-500">
                    {waitlist.length} {waitlist.length === 1 ? "entry" : "entries"}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => exportCsv(waitlist)}
                disabled={waitlist.length === 0}
                className="rounded-full border border-stone-300 bg-white px-4 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
              >
                Export CSV
              </button>
            </div>

            {waitlistLoading && <p className="text-stone-500">Loading…</p>}
            {waitlistError && <p className="text-red-600">{waitlistError}</p>}

            {!waitlistLoading && !waitlistError && (
              <div className="overflow-x-auto border border-stone-200 bg-white">
                <table className="min-w-full divide-y divide-stone-100 text-sm">
                  <thead className="bg-stone-50">
                    <tr>
                      {["Name", "Email", "Joined"].map((col) => (
                        <th key={col} className={TH}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {waitlist.map((entry) => (
                      <tr key={entry.id} className="hover:bg-stone-50">
                        <td className={TD} style={{ color: "#1A110A" }}>
                          {entry.name}
                        </td>
                        <td className={TD}>{entry.email}</td>
                        <td className={TD}>{fmt(entry.created_at)}</td>
                      </tr>
                    ))}
                    {waitlist.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-stone-400">
                          No waitlist entries yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: Users & Orgs
        ════════════════════════════════════════════════════════════ */}
        {activeTab === "users" && (
          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
            >
              Users & Orgs
            </h2>

            {usersLoading && <p className="text-stone-500">Loading…</p>}
            {usersError && <p className="text-red-600">{usersError}</p>}

            {!usersLoading && !usersError && (
              <>
                {/* Org card */}
                {org && (
                  <div className="mb-6 border border-stone-200 bg-white px-5 py-4">
                    <p
                      className="text-xs font-medium uppercase tracking-widest"
                      style={{ color: "#0D7B6E" }}
                    >
                      Organisation
                    </p>
                    <p
                      className="mt-1 text-xl font-semibold"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
                    >
                      {org.name}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {members.length} member{members.length !== 1 ? "s" : ""} · Created{" "}
                      {fmt(org.created_at)}
                    </p>
                  </div>
                )}

                {/* Members table */}
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-400">
                  Members
                </p>
                <div className="mb-6 overflow-x-auto border border-stone-200 bg-white">
                  <table className="min-w-full divide-y divide-stone-100 text-sm">
                    <thead className="bg-stone-50">
                      <tr>
                        {["Name", "Email", "Role"].map((col) => (
                          <th key={col} className={TH}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {members.map((m) => (
                        <tr key={m.id} className="hover:bg-stone-50">
                          <td className={TD} style={{ color: "#1A110A" }}>
                            {m.full_name ?? <span className="text-stone-300">—</span>}
                          </td>
                          <td className={TD}>{m.email}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-stone-100 text-stone-600">
                              {toTitle(m.role)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {members.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-stone-400">
                            No members found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Cross-org admin — requires backend endpoints not yet implemented */}
                {/* GET /admin/users and GET /admin/organisations do not exist yet */}
                <ComingSoon note="Cross-org user and organisation management — requires /admin/users and /admin/organisations backend endpoints." />
              </>
            )}
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: Usage
        ════════════════════════════════════════════════════════════ */}
        {activeTab === "usage" && (
          <section>
            <h2
              className="mb-6 text-lg font-semibold"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
            >
              Usage
            </h2>

            {usageLoading && <p className="text-stone-500">Loading…</p>}
            {usageError && <p className="text-red-600">{usageError}</p>}

            {usageData && (
              <>
                {/* Stat grid */}
                <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <StatCard label="Users Registered" value={usageData.totals.users_registered} />
                  <StatCard label="Logins" value={usageData.totals.logins} />
                  <StatCard label="Documents Ingested" value={usageData.totals.documents_ingested} />
                  <StatCard label="Jobs Created" value={usageData.totals.jobs_created} />
                  <StatCard label="Words Translated" value={usageData.totals.words_translated} />
                  <StatCard label="Jobs Exported" value={usageData.totals.jobs_exported} />
                </div>

                {/* Org audit log — GET /auth/org/audit */}
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-400">
                  Org Audit Log
                </p>
                {auditLoading && <p className="text-stone-500">Loading audit log…</p>}
                {auditError && <p className="mb-2 text-red-600">{auditError}</p>}
                {!auditLoading && (
                  <div className="overflow-x-auto border border-stone-200 bg-white">
                    <table className="min-w-full divide-y divide-stone-100 text-sm">
                      <thead className="bg-stone-50">
                        <tr>
                          {["Time", "Event", "User ID", "Job ID", "Document ID"].map((col) => (
                            <th key={col} className={TH}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {auditLog.map((event) => (
                          <tr key={event.id} className="hover:bg-stone-50">
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-500">
                              {fmt(event.created_at)}
                            </td>
                            <td
                              className="whitespace-nowrap px-4 py-3 text-sm font-medium"
                              style={{ color: "#1A110A" }}
                            >
                              {toTitle(event.event_type)}
                            </td>
                            <td className={TD}>{event.user_id ?? "—"}</td>
                            <td className={TD}>{event.job_id ?? "—"}</td>
                            <td className={TD}>{event.document_id ?? "—"}</td>
                          </tr>
                        ))}
                        {auditLog.length === 0 && !auditError && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                              No audit events recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: System Health
            Note: GET /health/ready does not exist in backend yet.
        ════════════════════════════════════════════════════════════ */}
        {activeTab === "health" && (
          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
            >
              System Health
            </h2>
            <ComingSoon note="Requires a /health/ready backend endpoint exposing DB, Redis, and Celery worker status. Not yet implemented." />
          </section>
        )}
      </main>
    </div>
  );
}
