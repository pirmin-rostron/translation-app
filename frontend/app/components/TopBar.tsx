"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";

export function TopBar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const openTranslationModal = useDashboardStore((s) => s.openTranslationModal);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayName = user?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "User";

  return (
    <header className="flex h-[50px] shrink-0 items-center justify-between border-b border-brand-border bg-brand-surface px-5">
      <span className="font-display text-lg font-bold text-brand-text">Helvara</span>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => openTranslationModal()}
          className="rounded-full bg-brand-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-accentHov"
        >
          + New Translation
        </button>

        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-brand-muted hover:bg-brand-bg"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accentMid text-xs font-bold text-brand-accent">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <span>{displayName}</span>
            <span className="text-[0.6rem]">▾</span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-lg">
              <button
                type="button"
                onClick={() => { setDropdownOpen(false); router.push("/settings"); }}
                className="block w-full px-4 py-2.5 text-left text-sm text-brand-text hover:bg-brand-bg"
              >
                Profile &amp; account
              </button>
              <button
                type="button"
                onClick={() => { setDropdownOpen(false); router.push("/settings"); }}
                className="block w-full px-4 py-2.5 text-left text-sm text-brand-text hover:bg-brand-bg"
              >
                Preferences
              </button>
              <div className="border-t border-brand-border" />
              <button
                type="button"
                onClick={() => { clearAuth(); router.push("/login"); }}
                className="block w-full px-4 py-2.5 text-left text-sm text-status-error hover:bg-brand-bg"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
