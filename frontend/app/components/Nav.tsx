"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "../stores/authStore";

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  {
    label: "All Translations",
    href: "/",
    match: (pathname) =>
      pathname === "/" ||
      pathname.startsWith("/documents") ||
      pathname.startsWith("/processing") ||
      pathname.startsWith("/translation-jobs"),
  },
  {
    label: "Upload",
    href: "/upload",
    match: (pathname) => pathname.startsWith("/upload"),
  },
  {
    label: "Glossary",
    href: "/glossary",
    match: (pathname) => pathname.startsWith("/glossary") || pathname.startsWith("/imports"),
  },
  {
    label: "Certified Translation",
    href: "/certified-translation",
    match: (pathname) => pathname.startsWith("/certified-translation"),
  },
  {
    label: "Settings",
    href: "/settings",
    match: (pathname) => pathname.startsWith("/settings"),
  },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
          Translation Workspace
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const isActive = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <span className="text-sm text-slate-500">
              {user.full_name ?? user.email}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
