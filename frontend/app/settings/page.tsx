"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, API_URL } from "../services/api";
import { useAuthStore } from "../stores/authStore";

// ── Types ──────────────────────────────────────────────────────────────────

type UserMe = {
  id: number;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
};

// ── Toggle component ───────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex-1">
        <p className="text-sm font-medium" >
          {label}
        </p>
        {description && <p className="mt-0.5 text-xs text-brand-subtle">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
          checked ? "bg-[#0D7B6E]" : "bg-brand-border"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-brand-border bg-white px-6 py-6 ${className ?? ""}`}>
      <h2
        className="mb-5 text-base font-semibold"
        
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setAuth = useAuthStore((s) => s.setAuth);
  const storeToken = useAuthStore((s) => s.token);
  const storeUser = useAuthStore((s) => s.user);

  // Profile state
  const [profile, setProfile] = useState<UserMe | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  // Email preferences state
  // TODO: no API endpoint for email preferences yet — toggles are non-functional
  const [notifyCompletion, setNotifyCompletion] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(false);
  const [notifyProduct, setNotifyProduct] = useState(true);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Fetch profile on mount
  useEffect(() => {
    void apiFetch<UserMe>(`${API_URL}/auth/me`)
      .then((me) => {
        setProfile(me);
        setFullName(me.full_name ?? "");
      })
      .catch(() => {
        // Redirect if unauthenticated
        router.replace("/login");
      })
      .finally(() => setProfileLoading(false));
  }, [router]);

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
      // Update the nav immediately — reuse existing token, replace user object
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
    setDeleteError("");
    try {
      // DELETE /auth/me — soft-anonymises the account (GDPR right-to-erasure)
      await apiFetch<unknown>(`${API_URL}/auth/me`, { method: "DELETE" });
      clearAuth();
      router.replace("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleteLoading(false);
    }
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-brand-bg p-6">
        Loading…
      </div>
    );
  }

  const deleteConfirmValid = deleteConfirmText === "DELETE";

  return (
    <div className="min-h-screen bg-brand-bg">
      <main className="mx-auto max-w-2xl px-8 py-12 pt-24">
        <h1
          className="mb-1 text-2xl font-semibold"
          
        >
          Settings
        </h1>
        <p className="mb-8 text-sm text-brand-subtle">Manage your account and preferences.</p>

        <div className="space-y-6">
          {/* ════════════════════════════════════════════════════════════
              Section 1 — Personal information
          ════════════════════════════════════════════════════════════ */}
          <Section title="Personal information">
            <div className="space-y-4">
              {/* Full name — editable */}
              <div>
                <label
                  htmlFor="full-name"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-brand-subtle"
                >
                  Full name
                </label>
                <input
                  id="full-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="w-full border border-brand-border bg-white px-3 py-2 text-sm text-brand-text placeholder:text-brand-subtle focus:border-brand-accent focus:outline-none"
                />
              </div>

              {/* Email — read-only */}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-brand-subtle">
                  Email
                </label>
                <div className="flex items-center gap-2 border border-brand-border bg-brand-bg px-3 py-2">
                  <span className="flex-1 text-sm text-brand-subtle">{profile?.email}</span>
                  <span className="text-xs text-brand-subtle">read-only</span>
                </div>
              </div>

              {/* Member since */}
              {profile?.created_at && (
                <p className="text-xs text-brand-subtle">
                  Member since {new Date(profile.created_at).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={profileSaving}
                className="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov disabled:opacity-50"
              >
                {profileSaving ? "Saving…" : "Save changes"}
              </button>
              {profileMessage && (
                <p className="mt-2 text-sm text-[#0D7B6E]">{profileMessage}</p>
              )}
              {profileError && (
                <p className="mt-2 text-sm text-status-error">{profileError}</p>
              )}
            </div>
          </Section>

          {/* ════════════════════════════════════════════════════════════
              Section 2 — Email preferences
          ════════════════════════════════════════════════════════════ */}
          <Section title="Email preferences">
            <div className="divide-y divide-stone-100">
              <Toggle
                label="Translation completion notifications"
                description="Get notified when a translation job finishes."
                checked={notifyCompletion}
                onChange={setNotifyCompletion}
                disabled
              />
              <Toggle
                label="Weekly usage digest"
                description="A summary of your translation activity each week."
                checked={notifyDigest}
                onChange={setNotifyDigest}
                disabled
              />
              <Toggle
                label="Product updates"
                description="News about new features and improvements."
                checked={notifyProduct}
                onChange={setNotifyProduct}
                disabled
              />
            </div>

            {/* TODO: no API endpoint for email preferences yet — save disabled */}
            <div className="mt-5">
              <button
                type="button"
                disabled
                title="Email preference saving is not yet available"
                className="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white opacity-40 cursor-not-allowed"
              >
                Save preferences
              </button>
              <p className="mt-1.5 text-xs text-brand-subtle">
                Email preferences coming soon.
              </p>
            </div>
          </Section>

          {/* ════════════════════════════════════════════════════════════
              Section 3 — Danger zone
          ════════════════════════════════════════════════════════════ */}
          <section className="border border-red-200 bg-white px-6 py-6">
            <h2 className="mb-1 text-base font-semibold text-status-error">Delete account</h2>
            <p className="mb-5 text-sm text-brand-subtle">
              Permanently anonymises your account and removes you from your organisation. This
              action cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmText("");
                setDeleteError("");
                setShowDeleteModal(true);
              }}
              className="border border-status-error/30 px-4 py-2 text-sm font-medium text-status-error hover:bg-status-errorBg"
            >
              Delete account
            </button>
          </section>
        </div>
      </main>

      {/* ── Delete confirmation modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md border border-brand-border bg-white px-6 py-6">
            <h3
              className="mb-1 text-lg font-semibold"
              
            >
              Delete your account?
            </h3>
            <p className="mb-5 text-sm text-brand-subtle">
              This will anonymise your account and remove you from your organisation. All your
              data remains on record for compliance purposes but will no longer be linked to
              your identity.
            </p>

            <label
              htmlFor="delete-confirm"
              className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-brand-subtle"
            >
              Type <span className="font-semibold text-brand-text">DELETE</span> to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mb-5 w-full border border-brand-border bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
            />

            {deleteError && (
              <p className="mb-3 text-sm text-status-error">{deleteError}</p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="rounded-full border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-bg disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={!deleteConfirmValid || deleteLoading}
                className="rounded-full bg-status-error px-4 py-2 text-sm font-medium text-white hover:bg-status-errorBg0 disabled:opacity-40"
              >
                {deleteLoading ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
