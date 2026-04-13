"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-brand-bg">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1">{children}</div>
          <footer className="border-t border-brand-border px-8 py-4">
            <div className="flex items-center gap-3 text-xs text-brand-subtle">
              <Link href="/privacy" className="no-underline hover:text-brand-muted">Privacy</Link>
              <span>·</span>
              <Link href="/terms" className="no-underline hover:text-brand-muted">Terms</Link>
              <span>·</span>
              <Link href="/data-faq" className="no-underline hover:text-brand-muted">Data &amp; Security</Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
