"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "./Icons";
import type { SVGProps } from "react";

type NavItem = {
  label: string;
  href: string;
  iconKey: keyof typeof Icons;
  match: (p: string) => boolean;
  badge?: string;
};

const WORKSPACE: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", iconKey: "Dashboard", match: (p) => p === "/dashboard" },
  { label: "Autopilot", href: "/autopilot", iconKey: "Sparkle", match: (p) => p === "/autopilot" },
  { label: "Documents", href: "/documents", iconKey: "Documents", match: (p) => p === "/documents" || p.startsWith("/documents/") },
  { label: "Projects",  href: "/projects",  iconKey: "Projects",  match: (p) => p.startsWith("/projects") },
];

const TOOLS: NavItem[] = [
  { label: "Glossary",  href: "/glossary",              iconKey: "Glossary",  match: (p) => p.startsWith("/glossary") },
  { label: "Certified", href: "/certified-translation", iconKey: "Certified", match: (p) => p.startsWith("/certified-translation"), badge: "Soon" },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const IconCmp = Icons[item.iconKey] as (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
  return (
    <Link
      href={item.href}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.8125rem] no-underline transition-all ${
        active
          ? "bg-brand-text font-medium text-white shadow-card"
          : "text-brand-muted hover:bg-brand-sunken hover:text-brand-text"
      }`}
    >
      <IconCmp className="h-[18px] w-[18px] shrink-0" />
      <span className="flex-1 tracking-tight">{item.label}</span>
      {item.badge && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium ${
            active ? "bg-white/15 text-white/80" : "bg-brand-sunken text-brand-subtle"
          }`}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-brand-border bg-brand-surface/60 backdrop-blur-sm">
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2.5 px-3 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-brand-hint">
          Workspace
        </p>
        <nav className="space-y-0.5">
          {WORKSPACE.map((item) => (
            <NavLink key={item.href} item={item} active={item.match(pathname)} />
          ))}
        </nav>

        <p className="mb-2.5 mt-7 px-3 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-brand-hint">
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
          item={{ label: "Settings", href: "/settings", iconKey: "Settings", match: (p) => p.startsWith("/settings") }}
          active={pathname.startsWith("/settings")}
        />
      </div>
    </aside>
  );
}
