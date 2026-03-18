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
  showMarkup: boolean;
  onToggleMarkup: () => void;
  reviewMode: ReviewMode;
  filterChips: FilterChip[];
  visibleIssuesLength: number;
  displayedNodes: DocumentNode[];
  allNodesCount: number;
  getNodeSpacing: (node: DocumentNode) => string;
  renderNode: (node: DocumentNode, side: "source" | "target") => ReactNode;
  segmentRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
};

export function DocumentDiffPane({
  activeFilter,
  onFilterChange,
  showMarkup,
  onToggleMarkup,
  reviewMode,
  filterChips,
  visibleIssuesLength,
  displayedNodes,
  allNodesCount,
  getNodeSpacing,
  renderNode,
  segmentRefs,
}: DocumentDiffPaneProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="rounded-t-2xl border-b border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleMarkup}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                showMarkup
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Markup: {showMarkup ? "Visible" : "Hidden"}
            </button>
          </div>
        </div>

        {reviewMode === "issues" ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">
              Issues-only content view ({visibleIssuesLength} items). Use Review Details for issue navigation.
            </p>
            {!visibleIssuesLength && (
              <p className="mt-2 text-xs text-slate-500">
                Try <span className="font-medium">All Content</span> to continue full document review.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="grid border-b border-slate-200 bg-slate-50 px-8 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="pr-6">Source</div>
        <div className="pl-6">Translated</div>
      </div>
      {!displayedNodes.length ? (
        <div className="p-8 text-slate-600">
          No issues found — you&apos;re all good here. Try switching back to All Content for full document context.
        </div>
      ) : (
        <div className="h-[74vh] overflow-y-auto bg-slate-50/40 px-8 py-9">
          {displayedNodes.map((node) => {
            const nodeSegments =
              node.type === "bullet_list" ? node.blocks?.flatMap((b) => b.segments) ?? [] : node.block?.segments ?? [];
            const blockLabel =
              node.type === "bullet_list"
                ? node.blocks?.length
                  ? `Blocks ${node.blocks[0].block_index + 1}-${node.blocks[node.blocks.length - 1].block_index + 1}`
                  : "Blocks"
                : node.block
                  ? `Block ${node.block.block_index + 1}`
                  : "Block";
            return (
              <div
                key={node.key}
                className={getNodeSpacing(node)}
                ref={(el) => {
                  nodeSegments.forEach((s) => {
                    segmentRefs.current[s.id] = el;
                  });
                }}
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{blockLabel}</p>
                <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0 rounded-lg bg-white/80 p-2 pr-3">{renderNode(node, "source")}</div>
                  <div className="min-w-0 rounded-lg bg-white p-2 pl-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
                    {renderNode(node, "target")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="border-t border-slate-200 px-6 py-3 text-sm text-slate-500">
        Showing {displayedNodes.length} of {allNodesCount} document sections
      </div>
    </section>
  );
}
