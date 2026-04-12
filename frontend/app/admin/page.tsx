"use client";

import { AppShell } from "../components/AppShell";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiFetch,
  API_URL,
  adminApi,
  type WaitlistEntry,
  type OrgInfo,
  type OrgMember,
  type AuditEvent,
  type AdminUsageResponse,
  type InviteResult,
} from "../services/api";

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = "waitlist" | "users" | "usage" | "health";

type UserMe = {
  id: number;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
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

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-brand-subtle";
const TD = "px-4 py-3 text-sm text-brand-muted";

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-brand-border bg-white px-5 py-4">
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
    <div className="border border-brand-border bg-brand-bg px-5 py-6">
      <p className="text-xs font-medium uppercase tracking-widest text-brand-subtle">Coming Soon</p>
      <p className="mt-2 text-sm text-brand-subtle">{note}</p>
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

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteResult, setInviteResult] = useState<{
    isNewUser: boolean;
    email: string;
    temporaryPassword?: string;
  } | null>(null);

  // Usage
  const [usageData, setUsageData] = useState<AdminUsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState("");
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
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
    void adminApi.getWaitlist()
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
      adminApi.getOrg(),
      adminApi.getOrgMembers(),
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
    void adminApi.getUsage()
      .then(setUsageData)
      .catch((err) =>
        setUsageError(err instanceof Error ? err.message : "Failed to load usage data")
      )
      .finally(() => setUsageLoading(false));

    setAuditLoading(true);
    setAuditError("");
    void adminApi.getAuditLog()
      .then((res) => setAuditLog(res.events))
      .catch((err) =>
        setAuditError(err instanceof Error ? err.message : "Failed to load audit log")
      )
      .finally(() => setAuditLoading(false));
  }, [authChecked, activeTab]);

  // ── Invite handler ───────────────────────────────────────────────────────
  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError("");
    setInviteResult(null);
    try {
      const res: InviteResult = await adminApi.inviteUser({
        email: inviteEmail.trim(),
        full_name: inviteFullName.trim(),
        role: inviteRole,
      });
      setInviteResult({
        isNewUser: res.is_new_user,
        email: res.user.email,
        temporaryPassword: res.temporary_password,
      });
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("member");
      // Refresh members list
      void adminApi.getOrgMembers().then(setMembers);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite user.");
    } finally {
      setInviteLoading(false);
    }
  }

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
    <AppShell>
      <div className="px-8 py-8">
      <main className="mx-auto max-w-6xl">
        <h1
          className="mb-1 text-2xl font-semibold"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
        >
          Admin Dashboard
        </h1>
        <p className="mb-8 text-sm text-brand-subtle">Internal tooling — admin access only.</p>

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
                  : "border border-brand-border bg-white text-brand-muted hover:bg-brand-bg"
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
                  <p className="mt-0.5 text-sm text-brand-subtle">
                    {waitlist.length} {waitlist.length === 1 ? "entry" : "entries"}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => exportCsv(waitlist)}
                disabled={waitlist.length === 0}
                className="rounded-full border border-brand-border bg-white px-4 py-1.5 text-sm font-medium text-brand-text hover:bg-brand-bg disabled:opacity-40"
              >
                Export CSV
              </button>
            </div>

            {waitlistLoading && <p className="text-brand-subtle">Loading…</p>}
            {waitlistError && <p className="text-status-error">{waitlistError}</p>}

            {!waitlistLoading && !waitlistError && (
              <div className="overflow-x-auto border border-brand-border bg-white">
                <table className="min-w-full divide-y divide-stone-100 text-sm">
                  <thead className="bg-brand-bg">
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
                      <tr key={entry.email} className="hover:bg-brand-bg">
                        <td className={TD} style={{ color: "#1A110A" }}>
                          {entry.name}
                        </td>
                        <td className={TD}>{entry.email}</td>
                        <td className={TD}>{fmt(entry.created_at)}</td>
                      </tr>
                    ))}
                    {waitlist.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-brand-subtle">
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

            {usersLoading && <p className="text-brand-subtle">Loading…</p>}
            {usersError && <p className="text-status-error">{usersError}</p>}

            {!usersLoading && !usersError && (
              <>
                {/* Org card */}
                {org && (
                  <div className="mb-6 border border-brand-border bg-white px-5 py-4">
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
                      {org.org.name}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-subtle">
                      {members.length} member{members.length !== 1 ? "s" : ""} · Created{" "}
                      {fmt(org.org.created_at)}
                    </p>
                  </div>
                )}

                {/* Members table */}
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-brand-subtle">
                  Members
                </p>
                <div className="mb-6 overflow-x-auto border border-brand-border bg-white">
                  <table className="min-w-full divide-y divide-stone-100 text-sm">
                    <thead className="bg-brand-bg">
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
                        <tr key={m.user_id} className="hover:bg-brand-bg">
                          <td className={TD} style={{ color: "#1A110A" }}>
                            {m.full_name ?? <span className="text-brand-subtle">—</span>}
                          </td>
                          <td className={TD}>{m.email}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-brand-bg text-brand-muted">
                              {toTitle(m.role)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {members.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-brand-subtle">
                            No members found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── Invite User ── */}
                <div className="border border-brand-border bg-white px-5 py-5">
                  <p className="mb-4 text-xs font-medium uppercase tracking-widest" style={{ color: "#0D7B6E" }}>
                    Invite User
                  </p>

                  {inviteResult && (
                    <div className="mb-4 border border-[#0D7B6E]/30 bg-[#E6F4F2] px-5 py-4">
                      {inviteResult.isNewUser && inviteResult.temporaryPassword ? (
                        <>
                          <p className="mb-3 text-sm font-semibold" style={{ color: "#0D7B6E" }}>
                            Account created. Share these credentials with the user:
                          </p>
                          <div className="space-y-1 rounded border border-[#0D7B6E]/20 bg-white px-4 py-3 font-mono text-sm" style={{ color: "#1A110A" }}>
                            <p><span className="text-brand-subtle">Email:</span> {inviteResult.email}</p>
                            <p><span className="text-brand-subtle">Temporary password:</span> <span className="font-bold select-all">{inviteResult.temporaryPassword}</span></p>
                          </div>
                          <p className="mt-2 text-xs text-brand-subtle">They should change this on first login.</p>
                        </>
                      ) : (
                        <p className="text-sm font-medium" style={{ color: "#0D7B6E" }}>
                          User added to your organisation.
                        </p>
                      )}
                    </div>
                  )}

                  {inviteError && (
                    <p className="mb-4 text-sm text-status-error">{inviteError}</p>
                  )}

                  <form onSubmit={(e) => { void handleInvite(e); }} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-medium text-brand-subtle">Email</label>
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="user@company.com"
                        disabled={inviteLoading}
                        className="w-full border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder-stone-300 focus:border-[#0D7B6E] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-medium text-brand-subtle">Full name</label>
                      <input
                        type="text"
                        required
                        value={inviteFullName}
                        onChange={(e) => setInviteFullName(e.target.value)}
                        placeholder="Ada Lovelace"
                        disabled={inviteLoading}
                        className="w-full border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder-stone-300 focus:border-[#0D7B6E] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-brand-subtle">Role</label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                        disabled={inviteLoading}
                        className="border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text focus:border-[#0D7B6E] focus:outline-none disabled:opacity-50"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={inviteLoading || !inviteEmail.trim() || !inviteFullName.trim()}
                      className="shrink-0 rounded-full px-5 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: "#0D7B6E" }}
                    >
                      {inviteLoading ? "Sending…" : "Send Invite"}
                    </button>
                  </form>
                </div>

                {/* Cross-org admin — requires backend endpoints not yet implemented */}
                {/* GET /admin/users and GET /admin/organisations do not exist yet */}
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

            {usageLoading && <p className="text-brand-subtle">Loading…</p>}
            {usageError && <p className="text-status-error">{usageError}</p>}

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
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-brand-subtle">
                  Org Audit Log
                </p>
                {auditLoading && <p className="text-brand-subtle">Loading audit log…</p>}
                {auditError && <p className="mb-2 text-status-error">{auditError}</p>}
                {!auditLoading && !auditError && (
                  <div className="overflow-x-auto border border-brand-border bg-white">
                    <table className="min-w-full divide-y divide-stone-100 text-sm">
                      <thead className="bg-brand-bg">
                        <tr>
                          {["Time", "Event", "Meta"].map((col) => (
                            <th key={col} className={TH}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {auditLog.map((event) => (
                          <tr key={event.id} className="hover:bg-brand-bg">
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-brand-subtle">
                              {fmt(event.created_at)}
                            </td>
                            <td
                              className="whitespace-nowrap px-4 py-3 text-sm font-medium"
                              style={{ color: "#1A110A" }}
                            >
                              {toTitle(event.event_type)}
                            </td>
                            <td className={`${TD} max-w-xs truncate font-mono text-xs`}>
                              {event.meta ? JSON.stringify(event.meta) : "—"}
                            </td>
                          </tr>
                        ))}
                        {auditLog.length === 0 && !auditError && (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-brand-subtle">
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
    </AppShell>
  );
}
