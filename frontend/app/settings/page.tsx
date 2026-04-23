"use client";

/**
 * Settings page — account management with left-rail tab nav.
 * Tabs: Account, Preferences, Danger Zone.
 * Team + Billing tabs are planned but not yet implemented (show placeholder).
 * Redesigned to match the Helvara design system (PIR-132).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, API_URL } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { useOrgStats } from "../hooks/queries";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";

// ── Types ───────────────────────────────────────────────────────────────────

type UserMe = {
  id: number;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
};

type SettingsTab = "account" | "preferences" | "team" | "billing";

// ── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, description, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex-1">
        <p className="m-0 text-sm font-medium text-brand-text">{label}</p>
        {description && <p className="m-0 mt-0.5 text-xs text-brand-subtle">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
          checked ? "bg-brand-accent" : "bg-brand-border"
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

// ── Nav item ────────────────────────────────────────────────────────────────

const TABS: Array<{ key: SettingsTab; label: string; description: string }> = [
  { key: "account", label: "Account", description: "Name, email, password" },
  { key: "preferences", label: "Preferences", description: "Languages, notifications" },
  { key: "team", label: "Team", description: "Members & roles" },
  { key: "billing", label: "Billing", description: "Plan & usage" },
];

function TabNav({ active, onChange }: { active: SettingsTab; onChange: (t: SettingsTab) => void }) {
  return (
    <nav className="w-[220px] shrink-0 space-y-1">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`group w-full rounded-xl px-4 py-3 text-left transition-all ${
            active === tab.key
              ? "bg-brand-surface shadow-card ring-1 ring-brand-border"
              : "hover:bg-brand-sunken/60"
          }`}
        >
          <p className={`m-0 text-sm font-medium ${active === tab.key ? "text-brand-text" : "text-brand-muted"}`}>
            {tab.label}
          </p>
          <p className="m-0 mt-0.5 text-[0.6875rem] text-brand-subtle">{tab.description}</p>
        </button>
      ))}
    </nav>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setAuth = useAuthStore((s) => s.setAuth);
  const storeToken = useAuthStore((s) => s.token);
  const storeUser = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<SettingsTab>("account");
  const [profile, setProfile] = useState<UserMe | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const { data: orgStats } = useOrgStats();

  // Preferences
  const [defaultSourceLang, setDefaultSourceLang] = useState("English");
  const [defaultTargetLang, setDefaultTargetLang] = useState("German");
  const [memoryThreshold, setMemoryThreshold] = useState(95);
  const [notifyCompletion, setNotifyCompletion] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(false);
  const [notifyProduct, setNotifyProduct] = useState(true);

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    void apiFetch<UserMe>(`${API_URL}/auth/me`)
      .then((me) => { setProfile(me); setFullName(me.full_name ?? ""); })
      .catch(() => router.replace("/login"))
      .finally(() => setProfileLoading(false));
  }, [router]);

  useEffect(() => {
    if (!profileMessage) return;
    const t = setTimeout(() => setProfileMessage(""), 3000);
    return () => clearTimeout(t);
  }, [profileMessage]);

  async function handleSaveProfile() {
    setProfileSaving(true);
    setProfileMessage("");
    setProfileError("");
    try {
      const updated = await apiFetch<UserMe>(`${API_URL}/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      setProfile(updated);
      if (storeToken && storeUser) {
        setAuth(storeToken, { id: storeUser.id, email: storeUser.email, full_name: updated.full_name });
      }
      setProfileMessage("Saved");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      await apiFetch<unknown>(`${API_URL}/auth/me`, { method: "DELETE" });
      clearAuth();
      router.replace("/");
    } catch {
      setDeleteLoading(false);
    }
  }

  if (profileLoading) {
    return <AppShell><div className="px-10 py-10 text-brand-muted">Loading…</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-10 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="m-0 mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-accent">Account</p>
          <h1 className="m-0 font-display text-[2rem] font-bold leading-tight tracking-heading text-brand-text">Settings</h1>
          <p className="m-0 mt-2 text-sm text-brand-muted">Manage your account, preferences, and team.</p>
        </div>

        {/* Left rail + content */}
        <div className="flex gap-8">
          <TabNav active={tab} onChange={setTab} />

          <div className="min-w-0 flex-1">
            {/* ── Account tab ── */}
            {tab === "account" && (
              <div className="space-y-6">
                {/* Personal info */}
                <section className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card">
                  <h2 className="m-0 mb-5 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Personal information</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="full-name" className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Full name</label>
                      <input
                        id="full-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your name"
                        className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-subtle focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Email</label>
                      <div className="flex items-center rounded-lg border border-brand-border bg-brand-sunken px-3 py-2">
                        <span className="flex-1 text-sm text-brand-subtle">{profile?.email}</span>
                        <span className="text-[0.6875rem] text-brand-hint">read-only</span>
                      </div>
                    </div>
                  </div>
                  {profile?.created_at && (
                    <p className="m-0 mt-4 text-xs text-brand-subtle">
                      Member since {new Date(profile.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSaveProfile()}
                      disabled={profileSaving}
                      className="rounded-full bg-brand-text px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {profileSaving ? "Saving…" : "Save changes"}
                    </button>
                    {profileMessage && <span className="text-sm text-brand-accent">{profileMessage}</span>}
                    {profileError && <span className="text-sm text-status-error">{profileError}</span>}
                  </div>
                </section>

                {/* Danger zone */}
                <section className="rounded-2xl border border-status-error/20 bg-brand-surface p-6 shadow-card">
                  <h2 className="m-0 mb-1 font-display text-[1.0625rem] font-semibold tracking-display text-status-error">Danger zone</h2>
                  <p className="m-0 mb-5 text-sm text-brand-subtle">
                    Permanently anonymises your account and removes you from your organisation. This cannot be undone.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="rounded-full border border-status-error/30 px-4 py-2 text-sm font-medium text-status-error transition-colors hover:bg-status-errorBg"
                  >
                    Delete account
                  </button>
                </section>
              </div>
            )}

            {/* ── Preferences tab ── */}
            {tab === "preferences" && (
              <div className="space-y-6">
                {/* Language defaults */}
                <section className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card">
                  <h2 className="m-0 mb-5 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Language defaults</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="default-source" className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Default source language</label>
                      <input
                        id="default-source"
                        type="text"
                        value={defaultSourceLang}
                        onChange={(e) => setDefaultSourceLang(e.target.value)}
                        className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="default-target" className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Default target language</label>
                      <input
                        id="default-target"
                        type="text"
                        value={defaultTargetLang}
                        onChange={(e) => setDefaultTargetLang(e.target.value)}
                        className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                      />
                    </div>
                  </div>
                </section>

                {/* Memory threshold */}
                <section className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card">
                  <h2 className="m-0 mb-5 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Translation memory</h2>
                  <div>
                    <label htmlFor="memory-threshold" className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">
                      Auto-apply threshold
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="memory-threshold"
                        type="range"
                        min={50}
                        max={100}
                        step={1}
                        value={memoryThreshold}
                        onChange={(e) => setMemoryThreshold(Number(e.target.value))}
                        className="flex-1 accent-brand-accent"
                      />
                      <span className="w-12 text-right font-mono text-sm font-medium text-brand-text">{memoryThreshold}%</span>
                    </div>
                    <p className="m-0 mt-2 text-xs text-brand-subtle">
                      Memory matches above this threshold will be auto-applied during translation.
                    </p>
                  </div>
                </section>

                {/* Notifications */}
                <section className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card">
                  <h2 className="m-0 mb-5 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Email notifications</h2>
                  <div className="divide-y divide-brand-borderSoft">
                    <Toggle label="Translation completion" description="Get notified when a translation job finishes." checked={notifyCompletion} onChange={setNotifyCompletion} disabled />
                    <Toggle label="Weekly usage digest" description="A summary of your translation activity each week." checked={notifyDigest} onChange={setNotifyDigest} disabled />
                    <Toggle label="Product updates" description="News about new features and improvements." checked={notifyProduct} onChange={setNotifyProduct} disabled />
                  </div>
                  <p className="m-0 mt-4 text-xs text-brand-subtle">Email preferences coming soon.</p>
                </section>
              </div>
            )}

            {/* ── Team tab ── */}
            {tab === "team" && (
              <div className="space-y-6">
                {/* Members list */}
                <section className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card">
                  <h2 className="m-0 mb-5 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Members</h2>
                  <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
                    <li className="flex items-center gap-4 py-3.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent text-xs font-semibold text-white">
                        {profile?.full_name?.charAt(0).toUpperCase() ?? "U"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm font-medium text-brand-text">{profile?.full_name ?? "You"}</p>
                        <p className="m-0 text-xs text-brand-subtle">{profile?.email}</p>
                      </div>
                      <span className="rounded-full bg-brand-accentMid px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-accent">Admin</span>
                    </li>
                  </ul>
                </section>

                {/* Invite */}
                <section className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card">
                  <h2 className="m-0 mb-5 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Invite a team member</h2>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label htmlFor="invite-email" className="mb-1.5 block text-[0.8125rem] font-medium text-brand-muted">Email address</label>
                      <input
                        id="invite-email"
                        type="email"
                        placeholder="colleague@company.com"
                        disabled
                        className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-subtle focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 disabled:opacity-50"
                      />
                    </div>
                    <button
                      type="button"
                      disabled
                      className="rounded-full bg-brand-text px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Send invite
                    </button>
                  </div>
                  <p className="m-0 mt-3 text-xs text-brand-subtle">Team invitations coming soon.</p>
                </section>
              </div>
            )}

            {/* ── Billing tab ── */}
            {tab === "billing" && (
              <div className="space-y-6">
                {/* Current plan */}
                <section className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card">
                  <h2 className="m-0 mb-5 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Current plan</h2>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="m-0 text-lg font-semibold text-brand-text">Free</p>
                      <p className="m-0 mt-0.5 text-sm text-brand-muted">10,000 words per month</p>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-accentHov disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Upgrade
                    </button>
                  </div>
                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-brand-muted">
                      <span>Word usage this month</span>
                      <span className="font-mono">{orgStats?.total_words_translated ?? 0} / 10,000</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-brand-sunken">
                      <div
                        className="h-full rounded-full bg-brand-accent transition-all duration-700"
                        style={{ width: `${Math.min(100, ((orgStats?.total_words_translated ?? 0) / 10_000) * 100)}%` }}
                      />
                    </div>
                  </div>
                </section>

                {/* Invoice history */}
                <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
                  <header className="px-6 pb-3 pt-5">
                    <h2 className="m-0 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Invoice history</h2>
                  </header>
                  <div className="border-t border-brand-borderSoft px-6 py-8 text-center">
                    <p className="m-0 text-sm text-brand-subtle">No invoices yet. Upgrade to a paid plan to see billing history.</p>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteModal}
        title="Delete your account?"
        description="This will anonymise your account and remove you from your organisation. All data remains on record for compliance but will no longer be linked to your identity."
        confirmLabel="Delete account"
        onConfirm={() => { void handleDeleteAccount(); }}
        onCancel={() => setShowDeleteModal(false)}
        loading={deleteLoading}
        variant="destructive"
      />
    </AppShell>
  );
}
