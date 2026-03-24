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
    href: "/documents",
    match: (pathname) =>
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

// Routes that manage their own header — suppress the app nav here
const NAV_SUPPRESSED_ROUTES = ["/", "/login", "/register"];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  // All hooks must be called unconditionally above this point
  if (NAV_SUPPRESSED_ROUTES.includes(pathname)) return null;

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link
          href="/dashboard"
          className="text-lg font-semibold"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            color: "#1A110A",
          }}
        >
          Helvara
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
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <Link
              href="/dashboard"
              className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              {user.full_name ?? user.email}
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-stone-400 hover:text-stone-900 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
