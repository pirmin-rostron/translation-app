"use client";

import type { MutableRefObject, ReactNode, Ref } from "react";

type ReviewFilter = "all" | "ambiguities" | "glossary" | "memory";

type SegmentRef = { id: number };
type DiffBlock = { block_index: number; segments: SegmentRef[] };
type DocumentNode = {
  key: string;
  type: "block" | "bullet_list";
  block?: DiffBlock;
  blocks?: DiffBlock[];
};

type FilterChip = {
  key: ReviewFilter;
  label: string;
  count: number;
};

type BlockMemoryState = {
  hasExact: boolean;
  hasSemantic: boolean;
  similarityScore: number | null;
};

type DocumentDiffPaneProps = {
  activeFilter: ReviewFilter;
  onFilterChange: (filter: ReviewFilter) => void;
  filterChips: FilterChip[];
  displayedNodes: DocumentNode[];
  displayedBlocksCount: number;
  totalBlocksCount: number;
  selectedSegmentId: number | null;
  segmentColorStates: Map<number, string>;
  renderNode: (node: DocumentNode, side: "source" | "target") => ReactNode;
  segmentRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  blockMemoryStates: Map<string, BlockMemoryState>;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  canvasRef?: Ref<HTMLElement>;
};

export function DocumentDiffPane({
  displayedNodes,
  selectedSegmentId,
  renderNode,
  segmentRefs,
  sourceLanguageLabel,
  targetLanguageLabel,
  canvasRef,
}: DocumentDiffPaneProps) {
  const activeIndex = displayedNodes.findIndex((node) => {
    const segments = node.block?.segments ?? [];
    return selectedSegmentId != null && segments.some((s) => s.id === selectedSegmentId);
  });

  function getOpacityClass(nodeIndex: number): string {
    if (activeIndex === -1) return "opacity-100";
    const distance = Math.abs(nodeIndex - activeIndex);
    if (distance === 0) return "opacity-100";
    if (distance === 1) return "opacity-40";
    return "opacity-20";
  }

  if (!displayedNodes.length) {
    return (
      <main ref={canvasRef} tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
        <div className="flex h-full items-center justify-center text-brand-subtle">
          No blocks to display.
        </div>
      </main>
    );
  }

  return (
    <main ref={canvasRef} tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="space-y-6">
          {displayedNodes.map((node, nodeIndex) => {
            const segments = node.block?.segments ?? [];
            const isActive = activeIndex === nodeIndex;
            const opacityClass = getOpacityClass(nodeIndex);

            return (
              <div
                key={node.key}
                className={`transition-opacity duration-200 ${opacityClass}`}
                ref={(el) => {
                  segments.forEach((s) => {
                    segmentRefs.current[s.id] = el;
                  });
                }}
              >
                <div
                  className={`relative flex items-start gap-32 ${
                    isActive ? "rounded-lg bg-brand-bg/30" : ""
                  }`}
                >
                  {/* Source column */}
                  <div
                    className={`min-w-0 flex-1 py-4 pl-6 pr-2 ${
                      isActive
                        ? "border-l-4 border-brand-accent"
                        : "border-l-4 border-transparent"
                    }`}
                  >
                    {isActive && (
                      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-subtle">
                        {sourceLanguageLabel}
                      </p>
                    )}
                    {renderNode(node, "source")}
                  </div>

                  {/* Centre guideline — purely visual */}
                  <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-brand-border" />

                  {/* Target column */}
                  <div className="min-w-0 flex-1 py-4 pl-2 pr-6">
                    {isActive && (
                      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-subtle">
                        {targetLanguageLabel}
                      </p>
                    )}
                    {renderNode(node, "target")}
                    {isActive && (
                      <div className="mt-3">
                        <span className="inline-flex items-center rounded-full bg-brand-accentMid px-3 py-1 text-xs font-medium text-brand-accent">
                          Suggestion
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
