"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  icon: string;
  match: (p: string) => boolean;
  badge?: string;
};

const WORKSPACE: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "⊞", match: (p) => p === "/dashboard" },
  { label: "Documents", href: "/documents", icon: "☰", match: (p) => p === "/documents" || p.startsWith("/translation-jobs") },
  { label: "Projects", href: "/projects", icon: "▦", match: (p) => p.startsWith("/projects") },
];

const TOOLS: NavItem[] = [
  { label: "Glossary", href: "/glossary", icon: "≡", match: (p) => p.startsWith("/glossary") },
  { label: "Certified", href: "/certified-translation", icon: "★", match: (p) => p.startsWith("/certified-translation"), badge: "Soon" },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm no-underline transition-colors ${
        active
          ? "bg-brand-accentMid font-semibold text-brand-accent"
          : "text-brand-muted hover:bg-brand-bg hover:text-brand-text"
      }`}
    >
      <span className="w-5 text-center text-base">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="rounded-full bg-brand-bg px-1.5 py-0.5 text-[0.6rem] font-medium text-brand-subtle">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[196px] shrink-0 flex-col border-r border-brand-border bg-brand-surface">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[0.6rem] font-bold uppercase tracking-widest text-brand-subtle">
          Workspace
        </p>
        <nav className="space-y-0.5">
          {WORKSPACE.map((item) => (
            <NavLink key={item.href} item={item} active={item.match(pathname)} />
          ))}
        </nav>

        <p className="mb-2 mt-6 px-3 text-[0.6rem] font-bold uppercase tracking-widest text-brand-subtle">
          Tools
        </p>
        <nav className="space-y-0.5">
          {TOOLS.map((item) => (
            <NavLink key={item.href} item={item} active={item.match(pathname)} />
          ))}
        </nav>
      </div>

      <div className="border-t border-brand-border px-3 py-3">
        <NavLink
          item={{ label: "Settings", href: "/settings", icon: "⚙", match: (p) => p.startsWith("/settings") }}
          active={pathname.startsWith("/settings")}
        />
      </div>
    </aside>
  );
}
