"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "../stores/authStore";

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    match: (pathname) => pathname === "/dashboard",
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
];

// Routes that manage their own header — suppress the app nav here
const NAV_SUPPRESSED_ROUTES = ["/", "/login", "/register", "/features"];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [logoutHovered, setLogoutHovered] = useState(false);
  const [userHovered, setUserHovered] = useState(false);

  // All hooks must be called unconditionally above this point
  if (NAV_SUPPRESSED_ROUTES.includes(pathname)) return null;

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <nav style={{
      position: "fixed",
      inset: "0 0 auto 0",
      zIndex: 50,
      background: "rgba(252,249,240,0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    }}>
      <div style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "1.25rem 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1.5rem",
      }}>
        <Link
          href="/dashboard"
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: "1.375rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#082012",
            textDecoration: "none",
          }}
        >
          Helvara
        </Link>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem" }}>
          {navItems.map((item) => {
            const isActive = item.match(pathname);
            const isHovered = hoveredHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onMouseEnter={() => setHoveredHref(item.href)}
                onMouseLeave={() => setHoveredHref(null)}
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  padding: "0.375rem 1rem",
                  borderRadius: "9999px",
                  textDecoration: "none",
                  transition: "background 0.15s, color 0.15s",
                  backgroundColor: isActive
                    ? "#082012"
                    : isHovered
                    ? "rgba(8,32,18,0.06)"
                    : "transparent",
                  color: isActive ? "#ffffff" : isHovered ? "#082012" : "#424843",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {user && (
            <Link
              href="/settings"
              onMouseEnter={() => setUserHovered(true)}
              onMouseLeave={() => setUserHovered(false)}
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "0.8125rem",
                color: userHovered ? "#082012" : "#424843",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
            >
              {user.full_name ?? user.email}
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            onMouseEnter={() => setLogoutHovered(true)}
            onMouseLeave={() => setLogoutHovered(false)}
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.8125rem",
              color: logoutHovered ? "#082012" : "#424843",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "color 0.15s",
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
