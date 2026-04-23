// Dashboard — "What needs me right now"

function DashboardView({ state, dispatch }) {
  const data = window.HELVARA_DATA;
  const projects = state.projects;
  const pinned = projects.filter((p) => p.pinned);

  const totals = projects.reduce(
    (acc, p) => ({
      jobs: acc.jobs + (p.stats?.total_jobs || 0),
      in_review: acc.in_review + (p.stats?.in_review_count || 0),
      completed: acc.completed + (p.stats?.completed_count || 0),
      words: acc.words + (p.stats?.total_words || 0),
    }),
    { jobs: 0, in_review: 0, completed: 0, words: 0 }
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-[1320px] px-10 py-10">
      {/* Header */}
      <header className="mb-8 flex items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-2.5 py-1 text-[0.6875rem] font-medium text-brand-muted shadow-card">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-accent" />
            </span>
            <span>{data.autopilotRunning.length} Autopilot jobs running</span>
          </div>
          <h1 className="font-display text-[2.75rem] font-semibold tracking-display leading-[1.05] text-brand-text m-0 whitespace-nowrap">
            {greeting}, <span className="italic text-brand-accent">Maya</span>
          </h1>
          <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-brand-muted m-0">
            {data.attention.length} blocks are waiting on you — mostly in <span className="font-medium text-brand-text">Nova Launch</span> and <span className="font-medium text-brand-text">Atlas Newsletter</span>.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => dispatch({ type: "OPEN_NEW_PROJECT" })}
            className="rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-[0.8125rem] font-medium text-brand-text shadow-card transition-all hover:border-brand-text hover:shadow-raised"
          >
            New project
          </button>
          <button
            onClick={() => dispatch({ type: "OPEN_NEW_TRANSLATION", projectId: null })}
            className="flex items-center gap-1.5 rounded-full bg-brand-text px-4 py-2 text-[0.8125rem] font-medium text-white shadow-card transition-all hover:bg-brand-accent"
          >
            <Icon.Plus className="h-3.5 w-3.5" /> New translation
          </button>
        </div>
      </header>

      {/* Stats row */}
      <section className="mb-8 grid grid-cols-4 gap-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
        <StatCell label="Active projects" value={projects.filter(p => p.stats?.total_jobs > 0).length} hint={`of ${projects.length} total`} />
        <StatCell label="In progress" value={totals.jobs - totals.completed} hint={`${totals.jobs} total jobs`} divider />
        <StatCell label="Needs review" value={totals.in_review} hint="across all projects" accent divider />
        <StatCell label="Words this month" value={(totals.words / 1000).toFixed(1) + "k"} hint="via Autopilot" divider />
      </section>

      {/* Two-column main */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-6">
        <div className="flex flex-col gap-6">
          <AttentionPanel data={data} dispatch={dispatch} />
          <AutopilotPanel data={data} dispatch={dispatch} />
        </div>
        <div className="flex flex-col gap-6">
          <PinnedPanel pinned={pinned} dispatch={dispatch} />
          <InsightsPanel summary={data.insightsSummary} />
          <ActivityPanel items={data.activity} />
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, hint, accent, divider }) {
  return (
    <div className={`relative px-6 py-5 ${divider ? "border-l border-brand-borderSoft" : ""}`}>
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle m-0">{label}</p>
      <p className={`mt-2.5 font-display text-[2.25rem] font-semibold leading-none tracking-display m-0 ${accent ? "text-brand-accent" : "text-brand-text"}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-brand-subtle m-0">{hint}</p>
    </div>
  );
}

function PanelHeader({ title, subtitle, meta, right }) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
      <div>
        <h2 className="font-display text-[1.0625rem] font-semibold tracking-display text-brand-text m-0">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-brand-subtle m-0">{subtitle}</p>}
      </div>
      {right || (meta && <span className="text-xs text-brand-subtle">{meta}</span>)}
    </header>
  );
}

function AttentionPanel({ data, dispatch }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <PanelHeader
        title="Needs your attention"
        subtitle="Blocks flagged by Autopilot across all projects"
        right={<span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accentSoft px-2.5 py-1 text-xs font-semibold text-brand-accent"><Icon.Sparkle className="h-3 w-3" />{data.attention.length}</span>}
      />
      <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
        {data.attention.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => item.job
                ? dispatch({ type: "OPEN_REVIEW", jobId: item.job })
                : dispatch({ type: "OPEN_PROJECT", id: item.projectId })}
              className="group grid w-full grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-brand-sunken/60"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[0.8125rem] font-semibold tabular-nums ${
                item.kind === "ambiguity" ? "bg-brand-accentSoft text-brand-accent ring-1 ring-inset ring-brand-accent/15" : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/60"
              }`}>
                {item.count}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-brand-text m-0">{item.document}</p>
                <p className="mt-0.5 truncate text-xs text-brand-subtle m-0">{item.projectName}</p>
              </div>
              <span className="font-mono text-[0.6875rem] text-brand-muted whitespace-nowrap">{item.pair}</span>
              <span className="text-[0.6875rem] text-brand-subtle w-20 text-right">{item.age}</span>
              <Icon.Arrow className="h-4 w-4 text-brand-hint transition-all group-hover:translate-x-0.5 group-hover:text-brand-text" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AutopilotPanel({ data, dispatch }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-accent/15 bg-gradient-to-br from-brand-accentSoft via-brand-surface to-brand-surface shadow-card">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-accent/8 blur-3xl" />
      <PanelHeader
        title={<><span className="relative mr-2 inline-flex h-2 w-2 align-middle"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-brand-accent" /></span>Autopilot running</>}
        subtitle={`${data.autopilotRunning.length} jobs · live`}
        right={dispatch && <button onClick={() => dispatch({ type: "NAVIGATE", view: "autopilot" })} className="flex items-center gap-1 text-xs font-medium text-brand-muted transition-colors hover:text-brand-text bg-transparent border-0 cursor-pointer">Open Autopilot<Icon.Arrow className="h-3 w-3" /></button>}
      />
      <ul className="relative m-0 list-none px-5 pb-4 pt-0">
        {data.autopilotRunning.map((j) => (
          <li key={j.id} className="grid grid-cols-[1fr_56px_120px_60px] items-center gap-4 border-t border-white/70 py-3 first:border-t-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-brand-text m-0">{j.file}</p>
              <p className="mt-0.5 font-mono text-[0.6875rem] text-brand-subtle m-0">{j.pair}</p>
            </div>
            <span className="font-mono text-xs font-medium tabular-nums text-brand-muted text-right">{j.progress}%</span>
            <div className="h-1.5 rounded-full bg-white/80 overflow-hidden ring-1 ring-inset ring-brand-border/50">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accentHov transition-[width] duration-700" style={{ width: `${j.progress}%` }} />
            </div>
            <span className="text-right text-[0.6875rem] text-brand-subtle">{j.eta}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PinnedPanel({ pinned, dispatch }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <PanelHeader
        title="Pinned"
        right={<button onClick={() => dispatch({ type: "NAVIGATE", view: "projects" })} className="flex items-center gap-1 text-xs font-medium text-brand-muted transition-colors hover:text-brand-text">All projects <Icon.Arrow className="h-3.5 w-3.5" /></button>}
      />
      <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
        {pinned.map((p) => {
          const pct = p.stats.total_jobs ? Math.round((p.stats.completed_count / p.stats.total_jobs) * 100) : 0;
          return (
            <li key={p.id}>
              <button
                onClick={() => dispatch({ type: "OPEN_PROJECT", id: p.id })}
                className="group flex w-full flex-col gap-2.5 px-5 py-4 text-left transition-colors hover:bg-brand-sunken/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-brand-text m-0 line-clamp-1">{p.name}</p>
                  <Icon.Arrow className="h-4 w-4 shrink-0 text-brand-hint transition-all group-hover:translate-x-0.5 group-hover:text-brand-text" />
                </div>
                <div className="flex items-center gap-2 text-[0.6875rem] text-brand-subtle">
                  <span>{p.document_count} {p.document_count === 1 ? "doc" : "docs"}</span>
                  <span className="text-brand-hint">·</span>
                  <span>{p.stats.total_jobs} jobs</span>
                  {p.stats.in_review_count > 0 && (
                    <>
                      <span className="text-brand-hint">·</span>
                      <span className="font-medium text-brand-accent">{p.stats.in_review_count} review</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 rounded-full bg-brand-sunken overflow-hidden">
                    <div className="h-full rounded-full bg-brand-text transition-[width]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[0.625rem] tabular-nums text-brand-subtle">{pct}%</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function InsightsPanel({ summary }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <PanelHeader title="Linguistic insights" subtitle="This week" />
      <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-brand-borderSoft border-t border-brand-borderSoft">
        <InsightCell label="Glossary terms" value={summary.glossary_terms} hint={`+${summary.new_this_week} new`} />
        <InsightCell label="Term conflicts" value={summary.conflicts} hint="needs review" warn={summary.conflicts > 0} />
        <InsightCell label="Memory matches" value={summary.memory_matches_week} hint="blocks reused" />
        <InsightCell label="Ambiguity rate" value={summary.ambiguity_rate + "%"} hint="of all blocks" />
      </div>
    </section>
  );
}

function InsightCell({ label, value, hint, warn }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle m-0">{label}</p>
      <p className={`mt-2 font-display text-[1.625rem] font-semibold leading-none tracking-display m-0 ${warn ? "text-amber-700" : "text-brand-text"}`}>{value}</p>
      <p className="mt-1.5 text-[0.6875rem] text-brand-subtle m-0">{hint}</p>
    </div>
  );
}

function ActivityPanel({ items }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <PanelHeader title="Recent activity" subtitle="Last 24 hours" />
      <ul className="m-0 list-none border-t border-brand-borderSoft p-0">
        {items.map((e) => (
          <li key={e.id} className="flex items-start gap-3 border-t border-brand-borderSoft px-5 py-3 first:border-t-0">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold ${
              e.tone === "success" ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/60"
              : e.tone === "accent" ? "bg-brand-accentSoft text-brand-accent ring-1 ring-inset ring-brand-accent/15"
              : "bg-brand-sunken text-brand-subtle ring-1 ring-inset ring-brand-border"
            }`}>{e.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] leading-snug text-brand-text m-0">{e.text}</p>
              <p className="mt-0.5 text-[0.6875rem] text-brand-subtle m-0">{e.meta} · {e.when}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
