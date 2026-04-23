"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../stores/authStore";
import { useDashboardStore } from "../stores/dashboardStore";
import { Icons } from "./Icons";

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
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-brand-border bg-brand-surface/80 px-6 backdrop-blur">
      {/* Logo */}
      <Link href="/dashboard" className="group flex items-center gap-2 no-underline">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-text text-white">
          <Icons.HLogo className="h-4 w-4" />
        </span>
        <span className="font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">
          Helvara
        </span>
      </Link>

      {/* Right cluster */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          type="button"
          className="rounded-full p-2 text-brand-muted transition-colors hover:bg-brand-sunken hover:text-brand-text"
          title="Search"
        >
          <Icons.Search className="h-[18px] w-[18px]" />
        </button>

        {/* New translation CTA */}
        <button
          type="button"
          onClick={() => openTranslationModal()}
          className="flex items-center gap-1.5 rounded-full bg-brand-text px-3.5 py-1.5 text-[0.8125rem] font-medium text-white transition-colors hover:bg-brand-accent"
        >
          <Icons.Plus className="h-3.5 w-3.5" />
          New translation
        </button>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-brand-border" />

        {/* Avatar dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full px-2 py-1 text-sm text-brand-text transition-colors hover:bg-brand-sunken"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-accent to-brand-accentHov text-xs font-semibold text-white">
              {initial}
            </span>
            <span className="font-medium">{displayName}</span>
            <Icons.ChevronDown className="h-3 w-3 text-brand-subtle" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-raised animate-fadein">
              <button
                type="button"
                onClick={() => { setDropdownOpen(false); router.push("/settings"); }}
                className="block w-full px-4 py-2.5 text-left text-sm text-brand-text hover:bg-brand-sunken"
              >
                Profile &amp; account
              </button>
              <button
                type="button"
                onClick={() => { setDropdownOpen(false); router.push("/settings"); }}
                className="block w-full px-4 py-2.5 text-left text-sm text-brand-text hover:bg-brand-sunken"
              >
                Preferences
              </button>
              <div className="border-t border-brand-border" />
              <button
                type="button"
                onClick={() => { clearAuth(); router.push("/login"); }}
                className="block w-full px-4 py-2.5 text-left text-sm text-status-error hover:bg-brand-sunken"
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
