// Translation Review — full-page review of a single job.
// Side-by-side columns, insight-first, with Rumi's reasoning inline.
// Keyboard: ↑/↓ to move between blocks, Enter to approve, 1-9 to pick alternative.

function TranslationReviewView({ state, dispatch }) {
  const data = window.HELVARA_DATA.reviewData[state.reviewJobId] || window.HELVARA_DATA.reviewData[1004];
  const agent = window.HELVARA_DATA.autopilot.agent;
  const [decisions, setDecisions] = useState({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [density, setDensity] = useState("balanced"); // cozy | balanced | compact
  const [granularity, setGranularity] = useState("sentence"); // sentence | paragraph
  const [showDiff, setShowDiff] = useState(false);
  const blockRefs = useRef([]);

  // Keyboard nav
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      const b = data.blocks[activeIdx];
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const next = Math.min(data.blocks.length - 1, activeIdx + 1);
        setActiveIdx(next);
        blockRefs.current[next]?.scrollIntoView({ block: "center", behavior: "smooth" });
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const prev = Math.max(0, activeIdx - 1);
        setActiveIdx(prev);
        blockRefs.current[prev]?.scrollIntoView({ block: "center", behavior: "smooth" });
      } else if (e.key === "Enter" && b) {
        e.preventDefault();
        approveBlock(b.id, decisions[b.id]?.pick ?? 0);
      } else if (/^[1-9]$/.test(e.key) && b?.alternatives) {
        const pick = parseInt(e.key, 10) - 1;
        if (pick < b.alternatives.length) {
          setDecisions({ ...decisions, [b.id]: { status: "approved", pick } });
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [activeIdx, decisions, data.blocks]);

  const approveBlock = (id, pick) => {
    setDecisions({ ...decisions, [id]: { status: "approved", pick: pick ?? 0 } });
  };
  const approveAll = () => {
    const next = { ...decisions };
    data.blocks.forEach((b) => {
      if (b.status === "ambiguity" && b.alternatives) next[b.id] = next[b.id] || { status: "approved", pick: 0 };
      else next[b.id] = { status: "approved" };
    });
    setDecisions(next);
  };

  const getEffective = (b) => decisions[b.id]?.status || b.status;
  const approved = data.blocks.filter((b) => getEffective(b) === "approved").length;
  const progressPct = Math.round((approved / data.blocks.length) * 100);

  return (
    <div className="flex h-full flex-col">
      {/* Sticky review header */}
      <ReviewHeader
        data={data}
        approved={approved}
        progressPct={progressPct}
        density={density} setDensity={setDensity}
        granularity={granularity} setGranularity={setGranularity}
        showDiff={showDiff} setShowDiff={setShowDiff}
        onApproveAll={approveAll}
        onBack={() => dispatch({ type: "OPEN_PROJECT", id: data.projectId })}
      />

      {/* Agent summary strip */}
      <AgentSummaryStrip data={data} agent={agent} />

      {/* Main body — block navigator + scrollable review area */}
      <div className="flex flex-1 overflow-hidden">
        <BlockNavigator
          blocks={data.blocks}
          decisions={decisions}
          activeIdx={activeIdx}
          onSelect={(i) => { setActiveIdx(i); blockRefs.current[i]?.scrollIntoView({ block: "center", behavior: "smooth" }); }}
          getEffective={getEffective}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1180px] px-10 py-8">
            <div className={density === "cozy" ? "space-y-6" : density === "compact" ? "space-y-2" : "space-y-4"}>
              {data.blocks.map((b, i) => (
                <div key={b.id} ref={(el) => (blockRefs.current[i] = el)}>
                  <ReviewBlock
                    block={b}
                    index={i}
                    active={activeIdx === i}
                    density={density}
                    showDiff={showDiff}
                    decision={decisions[b.id]}
                    effective={getEffective(b)}
                    onActivate={() => setActiveIdx(i)}
                    onApprove={(pick) => approveBlock(b.id, pick)}
                    onPickAlt={(pick) => setDecisions({ ...decisions, [b.id]: { status: "approved", pick } })}
                    target={data.target}
                  />
                </div>
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="mt-10 flex items-center justify-between rounded-2xl border border-brand-border bg-brand-surface p-5 shadow-card">
              <div>
                <p className="font-display text-[1.0625rem] font-semibold tracking-display text-brand-text m-0">
                  {approved === data.blocks.length ? "All blocks approved." : `${data.blocks.length - approved} block${data.blocks.length - approved === 1 ? "" : "s"} remaining`}
                </p>
                <p className="mt-1 text-[0.8125rem] text-brand-muted m-0">Exporting locks edits. Rumi keeps the memory updated either way.</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-[0.8125rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken shadow-card transition-colors">
                  Save draft
                </button>
                <button
                  disabled={approved !== data.blocks.length}
                  className="flex items-center gap-1 rounded-full bg-brand-text px-5 py-2 text-[0.8125rem] font-medium text-white hover:bg-brand-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Approve & export <Icon.Arrow className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Keyboard hint footer */}
      <KeyboardHint />
    </div>
  );
}

// ── Review header (sticky) ─────────────────────────────────────────────────
function ReviewHeader({ data, approved, progressPct, density, setDensity, granularity, setGranularity, showDiff, setShowDiff, onApproveAll, onBack }) {
  return (
    <header className="shrink-0 border-b border-brand-border bg-brand-surface/90 backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-10 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text hover:bg-brand-sunken shadow-card transition-colors"
              aria-label="Back to project"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3 5 8l5 5"/></svg>
            </button>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-brand-muted m-0">
                <span className="font-semibold uppercase tracking-[0.18em] text-brand-accent">Review</span>
                <span className="text-brand-hint">·</span>
                <span className="truncate">{data.project}</span>
              </p>
              <h1 className="mt-1 flex items-center gap-2 font-display text-[1.25rem] font-semibold leading-none tracking-display text-brand-text m-0">
                <span className="truncate">{data.document}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-sunken px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-brand-text tracking-normal">
                  {lang(data.source).code}
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-brand-subtle" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 6h8M7 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {lang(data.target).code}
                </span>
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Progress */}
            <div className="hidden items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 shadow-card md:flex">
              <span className="font-mono text-[0.75rem] font-medium text-brand-text">{approved}/{data.blocks.length}</span>
              <div className="h-1 w-20 overflow-hidden rounded-full bg-brand-sunken">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accentHov transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            {/* Diff toggle */}
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.75rem] font-medium shadow-card transition-all ${
                showDiff
                  ? "border-brand-accent bg-brand-accentSoft text-brand-accent"
                  : "border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text hover:bg-brand-sunken"
              }`}
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v10M13 3v10M3 5h3M3 8h4M3 11h2M13 5h-3M13 8h-4M13 11h-2"/>
              </svg>
              Alignment
            </button>

            {/* Density segmented */}
            <div className="flex items-center gap-0.5 rounded-full border border-brand-border bg-brand-surface p-0.5 shadow-card">
              {[["cozy", "Cozy"], ["balanced", "Balanced"], ["compact", "Compact"]].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setDensity(k)}
                  className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-medium transition-all ${
                    density === k ? "bg-brand-text text-white" : "text-brand-muted hover:text-brand-text"
                  }`}
                >{l}</button>
              ))}
            </div>

            <button
              onClick={onApproveAll}
              className="rounded-full border border-brand-border bg-brand-surface px-3.5 py-1.5 text-[0.75rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken shadow-card transition-colors"
            >
              Approve remaining
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Agent summary strip ─────────────────────────────────────────────────────
function AgentSummaryStrip({ data, agent }) {
  return (
    <div className="shrink-0 border-b border-brand-borderSoft bg-brand-sunken/40">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-10 py-4">
        <AgentAvatar agent={agent} size={36} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-brand-muted m-0">
            <span className="font-semibold text-brand-text">{agent.name}</span>
            <span className="text-brand-hint">·</span>
            <span>{agent.role} summary</span>
          </p>
          <p className="mt-0.5 text-[0.875rem] leading-relaxed text-brand-text m-0">{data.agent_summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-[0.75rem]">
          <SummaryStat label="Blocks" value={data.stats.blocks} />
          <SummaryStat label="Insights" value={data.stats.insights} accent />
          <SummaryStat label="Ambiguous" value={data.stats.ambiguities} warning={data.stats.ambiguities > 0} />
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, accent, warning }) {
  const cls = warning ? "text-amber-700" : accent ? "text-brand-accent" : "text-brand-text";
  return (
    <div className="text-right">
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-brand-subtle m-0">{label}</p>
      <p className={`font-display text-[1.125rem] font-semibold leading-none tracking-display m-0 ${cls}`}>{value}</p>
    </div>
  );
}

// ── Block navigator (left rail) ─────────────────────────────────────────────
function BlockNavigator({ blocks, activeIdx, onSelect, getEffective }) {
  return (
    <aside className="w-[56px] shrink-0 border-r border-brand-borderSoft bg-brand-sunken/30 py-4 overflow-y-auto">
      <div className="flex flex-col items-center gap-1.5">
        {blocks.map((b, i) => {
          const eff = getEffective(b);
          const dotCls =
            eff === "approved" ? "bg-emerald-500" :
            eff === "ambiguity" ? "bg-amber-500" :
            "bg-brand-hint";
          const active = activeIdx === i;
          return (
            <button
              key={b.id}
              onClick={() => onSelect(i)}
              className={`group flex h-8 w-9 items-center justify-center rounded-lg transition-all ${
                active ? "bg-brand-surface shadow-card ring-1 ring-brand-border" : "hover:bg-brand-surface/60"
              }`}
              title={`Block ${i + 1} · ${eff}`}
            >
              <span className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
                <span className={`font-mono text-[0.625rem] font-medium ${active ? "text-brand-text" : "text-brand-muted"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// ── A single review block ───────────────────────────────────────────────────
function ReviewBlock({ block, index, active, density, showDiff, decision, effective, onActivate, onApprove, onPickAlt, target }) {
  const isAmb = block.status === "ambiguity";
  const pick = decision?.pick ?? 0;
  const targetText = block.alternatives ? block.alternatives[pick].text : block.target;

  const borderCls =
    active ? "border-brand-accent/50 shadow-[0_0_0_3px_rgba(13,123,110,0.06)]" :
    effective === "approved" ? "border-emerald-200/60" :
    effective === "ambiguity" ? "border-amber-200/60" :
    "border-brand-border";

  const compact = density === "compact";
  const pad = compact ? "p-3" : density === "cozy" ? "p-6" : "p-5";

  return (
    <article
      onClick={onActivate}
      className={`rounded-2xl border bg-brand-surface transition-all cursor-pointer ${borderCls} ${pad}`}
    >
      {/* Header row */}
      <header className="mb-3 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">
          <span className={`h-1.5 w-1.5 rounded-full ${
            effective === "approved" ? "bg-emerald-500" :
            effective === "ambiguity" ? "bg-amber-500" :
            "bg-brand-hint"
          }`} />
          B{String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex-1" />
        <BlockStatusPill effective={effective} />
        {block.insights?.filter((i) => i.kind === "memory").slice(0, 1).map((ins, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[0.625rem] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
            <span className="font-mono">{Math.round((ins.confidence || 0.9) * 100)}%</span> memory
          </span>
        ))}
      </header>

      {/* Body — two columns */}
      <div className="grid grid-cols-2 gap-5">
        <div>
          <p className="mb-1 flex items-center gap-1.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-brand-subtle m-0">
            Source · {lang("en").code}
          </p>
          {showDiff && block.alignment ? (
            <AlignmentText segments={block.alignment} side="source" />
          ) : (
            <p className={`leading-relaxed text-brand-text m-0 ${compact ? "text-[0.8125rem]" : "text-[0.9375rem]"}`}>{block.source}</p>
          )}
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-brand-accent m-0">
            Target · {lang(target).code}
          </p>
          {showDiff && block.alignment ? (
            <AlignmentText segments={block.alignment} side="target" />
          ) : (
            <p className={`leading-relaxed text-brand-text m-0 ${compact ? "text-[0.8125rem]" : "text-[0.9375rem]"}`}>{targetText}</p>
          )}
        </div>
      </div>

      {/* Insights — only show in balanced/cozy */}
      {!compact && block.insights && block.insights.length > 0 && (
        <div className="mt-4 space-y-2">
          {block.insights.map((ins, i) => (
            <InsightCard key={i} insight={ins} />
          ))}
        </div>
      )}

      {/* Ambiguity picker */}
      {isAmb && block.alternatives && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <div className="mb-3 flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor"><circle cx="6" cy="6" r="5" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-display text-[0.875rem] font-semibold tracking-display text-brand-text m-0">
                Rumi flagged this one
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.12em] text-amber-800">Ambiguity</span>
              </p>
              {block.agent_reasoning && (
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-brand-muted m-0">{block.agent_reasoning}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {block.alternatives.map((alt, i) => {
              const selected = pick === i;
              return (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); onPickAlt(i); }}
                  className={`block w-full rounded-xl border text-left transition-all ${
                    selected
                      ? "border-brand-accent bg-brand-surface shadow-card"
                      : "border-brand-border bg-brand-surface hover:border-brand-accent/40 hover:bg-brand-sunken/40"
                  }`}
                >
                  <div className="flex items-start gap-3 p-3">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${selected ? "bg-brand-accent text-white" : "bg-brand-sunken text-brand-muted"}`}>
                      {selected ? <Icon.Check className="h-3 w-3" /> : <span className="font-mono text-[0.625rem]">{i + 1}</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.875rem] leading-relaxed text-brand-text m-0">{alt.text}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-brand-muted m-0">
                        {alt.recommended && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-accentSoft px-1.5 py-0 font-mono text-[0.5625rem] font-medium uppercase tracking-[0.1em] text-brand-accent">
                            Rumi's pick
                          </span>
                        )}
                        <span className="italic">{alt.tone}</span>
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer actions */}
      {effective !== "approved" && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[0.75rem] text-brand-subtle m-0">
            <span className="font-mono rounded bg-brand-sunken px-1.5 py-0.5 text-brand-muted">↵</span> approve
            {block.alternatives && <> · <span className="font-mono rounded bg-brand-sunken px-1.5 py-0.5 text-brand-muted">1–{block.alternatives.length}</span> pick alt</>}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => e.stopPropagation()}
              className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-[0.75rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken transition-colors"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(pick); }}
              className="flex items-center gap-1 rounded-full bg-brand-text px-3.5 py-1 text-[0.75rem] font-medium text-white hover:bg-brand-accent transition-colors"
            >
              <Icon.Check className="h-3 w-3" /> Approve
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ── Block status pill ───────────────────────────────────────────────────────
function BlockStatusPill({ effective }) {
  if (effective === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[0.6875rem] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <Icon.Check className="h-2.5 w-2.5" /> Approved
      </span>
    );
  }
  if (effective === "ambiguity") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[0.6875rem] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
        Needs your call
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-brand-sunken px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-muted">
      Pending
    </span>
  );
}

// ── Insight card ────────────────────────────────────────────────────────────
function InsightCard({ insight }) {
  const cfg = {
    glossary: {
      icon: (
        <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 2h7a2 2 0 0 1 2 2v8.5"/><path d="M3 2v9a1 1 0 0 0 1 1h8"/><path d="M5 5h4M5 7h3"/></svg>
      ),
      label: "Glossary",
      chipCls: "bg-violet-50 text-violet-700 ring-violet-200",
    },
    memory: {
      icon: (
        <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="2" width="10" height="10" rx="1.5"/><path d="M4 6h6M4 8h5"/></svg>
      ),
      label: "Memory",
      chipCls: "bg-blue-50 text-blue-700 ring-blue-200",
    },
    ambiguity: {
      icon: <Icon.Sparkle className="h-3 w-3" />,
      label: "Ambiguity",
      chipCls: "bg-amber-50 text-amber-700 ring-amber-200",
    },
  }[insight.kind] || { icon: null, label: insight.kind, chipCls: "bg-brand-sunken text-brand-muted ring-brand-border" };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-borderSoft bg-brand-sunken/30 p-3">
      <span className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[0.625rem] font-medium ring-1 ring-inset ${cfg.chipCls}`}>
        <span className="mr-1">{cfg.icon}</span>
        {cfg.label}
      </span>
      <div className="min-w-0 flex-1">
        {insight.term && (
          <p className="font-mono text-[0.75rem] font-medium text-brand-text m-0">{insight.term}</p>
        )}
        <p className="text-[0.75rem] leading-relaxed text-brand-muted m-0">{insight.note}</p>
      </div>
      {insight.confidence != null && insight.confidence > 0 && (
        <span className="shrink-0 font-mono text-[0.6875rem] font-medium text-brand-muted">
          {Math.round(insight.confidence * 100)}%
        </span>
      )}
    </div>
  );
}

// ── Alignment text — tokens rendered as linked chips for EN↔XX diff ─────────
function AlignmentText({ segments, side }) {
  const [hovered, setHovered] = useState(null);
  return (
    <p className="m-0 text-[0.9375rem] leading-[1.9] text-brand-text">
      {segments.map((seg, i) => {
        const word = side === "source" ? seg.s : seg.t;
        const isGlossary = seg.glossary;
        const isHovered = hovered === i;
        return (
          <React.Fragment key={i}>
            <span
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className={`inline-block rounded px-0.5 transition-all cursor-default ${
                isHovered ? "bg-brand-accentSoft text-brand-accent" : ""
              } ${isGlossary ? "underline decoration-violet-400 decoration-2 underline-offset-[3px]" : ""}`}
            >
              {word}
            </span>
            {i < segments.length - 1 && " "}
          </React.Fragment>
        );
      })}
    </p>
  );
}

// ── Keyboard hint footer ────────────────────────────────────────────────────
function KeyboardHint() {
  return (
    <footer className="shrink-0 border-t border-brand-borderSoft bg-brand-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-10 py-2 text-[0.6875rem] text-brand-muted">
        <div className="flex items-center gap-4">
          <Kbd>↑↓</Kbd> Move
          <Kbd>↵</Kbd> Approve
          <Kbd>1-9</Kbd> Pick alternative
        </div>
        <p className="m-0">Changes are saved as you go · Rumi learns from your picks</p>
      </div>
    </footer>
  );
}

function Kbd({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 mr-1">
      <span className="font-mono rounded border border-brand-border bg-brand-surface px-1.5 py-0.5 text-[0.625rem] font-medium text-brand-text shadow-card">{children}</span>
    </span>
  );
}

Object.assign(window, { TranslationReviewView });
