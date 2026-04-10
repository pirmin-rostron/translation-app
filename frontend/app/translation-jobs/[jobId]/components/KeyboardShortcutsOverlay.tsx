"use client";

import { useEffect, useRef } from "react";

type KeyboardShortcutsOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const NAV_SHORTCUTS = [
  { key: "↑ / K", action: "Previous block" },
  { key: "↓ / J", action: "Next block" },
  { key: "?", action: "Toggle this overlay" },
];

const ACTION_SHORTCUTS = [
  { key: "Enter", action: "Approve block" },
  { key: "S", action: "Skip block" },
  { key: "E", action: "Toggle edit mode" },
  { key: "Esc", action: "Cancel / close" },
];

function ShortcutRow({ shortcut }: { shortcut: { key: string; action: string } }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-brand-text">{shortcut.action}</span>
      <kbd className="rounded bg-brand-bg px-2 py-0.5 font-mono text-xs font-medium text-brand-muted">
        {shortcut.key}
      </kbd>
    </div>
  );
}

export function KeyboardShortcutsOverlay({ open, onClose }: KeyboardShortcutsOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-md rounded-xl border border-brand-border bg-brand-surface p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-text">Keyboard Shortcuts</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="flex h-8 w-8 items-center justify-center rounded-full text-brand-muted hover:bg-brand-bg"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-8">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-subtle">Navigation</p>
            {NAV_SHORTCUTS.map((s) => (
              <ShortcutRow key={s.key} shortcut={s} />
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-subtle">Actions</p>
            {ACTION_SHORTCUTS.map((s) => (
              <ShortcutRow key={s.key} shortcut={s} />
            ))}
          </div>
        </div>

        <p className="mt-5 text-xs text-brand-subtle">
          Shortcuts are disabled while editing text.
        </p>
      </div>
    </div>
  );
}
