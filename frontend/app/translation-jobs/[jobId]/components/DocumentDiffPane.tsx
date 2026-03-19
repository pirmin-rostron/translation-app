"use client";

import type { MutableRefObject, ReactNode } from "react";

type ReviewFilter = "all" | "issues" | "ambiguities" | "glossary" | "memory";
type ReviewMode = "document" | "issues";

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

type DocumentDiffPaneProps = {
  activeFilter: ReviewFilter;
  onFilterChange: (filter: ReviewFilter) => void;
  reviewMode: ReviewMode;
  filterChips: FilterChip[];
  visibleIssuesLength: number;
  displayedNodes: DocumentNode[];
  displayedBlocksCount: number;
  totalBlocksCount: number;
  selectedSegmentId: number | null;
  flaggedSegmentIds: Set<number>;
  renderNode: (node: DocumentNode, side: "source" | "target") => ReactNode;
  segmentRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
};

export function DocumentDiffPane({
  activeFilter,
  onFilterChange,
  reviewMode,
  filterChips,
  visibleIssuesLength,
  displayedNodes,
  displayedBlocksCount,
  totalBlocksCount,
  selectedSegmentId,
  flaggedSegmentIds,
  renderNode,
  segmentRefs,
}: DocumentDiffPaneProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="rounded-t-2xl border-b border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onFilterChange(chip.key)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                activeFilter === chip.key
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {chip.label} ({chip.count})
            </button>
          ))}
        </div>

        {reviewMode === "issues" ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">Issues-only view ({visibleIssuesLength}). Use Review Details to navigate.</p>
          </div>
        ) : null}
      </div>

      {!displayedNodes.length ? (
        <div className="p-8 text-slate-600">
          No issues found — you&apos;re all good here. Try switching back to All Blocks for full document context.
        </div>
      ) : (
        <div className="h-[74vh] overflow-y-auto bg-slate-50/30">
          <div className="sticky top-0 z-20 grid border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-600 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="bg-slate-100/90 px-6 py-3">SOURCE</div>
            <div className="border-l border-slate-200 bg-blue-50/90 px-6 py-3">TRANSLATED</div>
          </div>
          <div className="space-y-4 px-6 py-6">
          {displayedNodes.map((node) => {
            const nodeSegments = node.block?.segments ?? [];
            const isActive = selectedSegmentId != null && nodeSegments.some((segment) => segment.id === selectedSegmentId);
            const hasIssue = nodeSegments.some((segment) => flaggedSegmentIds.has(segment.id));
            const blockLabel = node.block ? `Block ${node.block.block_index + 1}` : "Block";
            const rowClass = isActive
              ? "border-blue-300 bg-blue-50/70 shadow-[0_0_0_1px_rgba(59,130,246,0.16)]"
              : hasIssue
                ? "border-amber-200 bg-amber-50/50"
                : "border-slate-200 bg-white";
            return (
              <div
                key={node.key}
                className={`overflow-hidden rounded-xl border ${rowClass}`}
                ref={(el) => {
                  nodeSegments.forEach((s) => {
                    segmentRefs.current[s.id] = el;
                  });
                }}
              >
                <div className="border-b border-slate-200/80 bg-white px-4 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{blockLabel}</p>
                </div>
                <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0 bg-slate-100/45 px-4 py-4">{renderNode(node, "source")}</div>
                  <div className="min-w-0 border-l border-slate-200 bg-blue-50/45 px-4 py-4">
                    {renderNode(node, "target")}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
      <div className="border-t border-slate-200 px-6 py-3 text-sm text-slate-500">
        Showing {displayedBlocksCount} of {totalBlocksCount} blocks
      </div>
    </section>
  );
}
