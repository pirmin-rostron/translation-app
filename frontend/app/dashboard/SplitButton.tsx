"use client";

import { useEffect, useRef } from "react";
import { useDashboardStore } from "../stores/dashboardStore";

export function SplitButton() {
  const ref = useRef<HTMLDivElement>(null);
  const dropdownOpen = useDashboardStore((s) => s.splitButtonOpen);
  const toggleSplitButton = useDashboardStore((s) => s.toggleSplitButton);
  const closeSplitButton = useDashboardStore((s) => s.closeSplitButton);
  const openTranslationModal = useDashboardStore((s) => s.openTranslationModal);
  const openProjectModal = useDashboardStore((s) => s.openProjectModal);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeSplitButton();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [closeSplitButton]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => {
          closeSplitButton();
          openTranslationModal();
        }}
        className="cursor-pointer rounded-l-full border-none bg-brand-accent px-5 py-2.5 pr-5 pl-6 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        + New Translation
      </button>
      <button
        onClick={toggleSplitButton}
        className="cursor-pointer rounded-r-full border-none border-l border-l-white/20 bg-brand-accent px-3.5 py-2.5 font-sans text-xs text-white transition-opacity hover:opacity-90"
        aria-label="More actions"
      >
        ▾
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-10 min-w-[220px] overflow-hidden rounded bg-brand-surface border border-brand-border shadow-md">
          <button
            onClick={() => {
              closeSplitButton();
              openTranslationModal();
            }}
            className="block w-full cursor-pointer border-none border-b border-brand-border-light bg-transparent px-4 py-3 text-left font-sans text-[0.8125rem] font-medium text-brand-text hover:bg-brand-bg"
          >
            <span className="font-semibold">New Translation</span>
            <br />
            <span className="text-[0.6875rem] text-brand-subtle">
              Upload a document to translate
            </span>
          </button>
          <button
            onClick={() => {
              closeSplitButton();
              openProjectModal();
            }}
            className="block w-full cursor-pointer border-none bg-transparent px-4 py-3 text-left font-sans text-[0.8125rem] font-medium text-brand-text hover:bg-brand-bg"
          >
            <span className="font-semibold">New Project</span>
            <br />
            <span className="text-[0.6875rem] text-brand-subtle">
              Group translations together
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
