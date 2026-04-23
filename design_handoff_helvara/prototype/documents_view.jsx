// Documents view — cross-project view with toggle (Documents | Jobs) + filters

function DocumentsView({ state, dispatch }) {
  const projects = state.projects;

  const allDocs = [];
  const allJobs = [];
  projects.forEach((p) => {
    (p.documents || []).forEach((d) => {
      allDocs.push({ ...d, projectId: p.id, projectName: p.name });
      (d.jobs || []).forEach((j) => {
        allJobs.push({ ...j, projectId: p.id, projectName: p.name, docId: d.id, docName: d.name });
      });
    });
  });

  const [mode, setMode] = useState("documents");
  const [q, setQ] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const qlc = q.trim().toLowerCase();
  const docs = allDocs.filter((d) => {
    if (projectFilter !== "all" && d.projectId !== +projectFilter) return false;
    if (qlc && !(d.name.toLowerCase().includes(qlc) || d.projectName.toLowerCase().includes(qlc))) return false;
    return true;
  });
  const jobs = allJobs.filter((j) => {
    if (projectFilter !== "all" && j.projectId !== +projectFilter) return false;
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    if (qlc && !(j.docName.toLowerCase().includes(qlc) || j.projectName.toLowerCase().includes(qlc) || j.target.toLowerCase().includes(qlc))) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1320px] px-10 py-10">
      <header className="mb-8 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-brand-subtle m-0">Workspace</p>
          <h1 className="font-display text-[2.5rem] font-semibold tracking-display leading-[1.05] text-brand-text m-0">
            Documents
          </h1>
          <p className="mt-2.5 text-[0.9375rem] text-brand-muted m-0">
            <span className="font-medium text-brand-text">{allDocs.length}</span> files · <span className="font-medium text-brand-text">{allJobs.length}</span> translation jobs across {projects.length} projects
          </p>
        </div>
        <button
          onClick={() => dispatch({ type: "OPEN_NEW_TRANSLATION", projectId: null })}
          className="flex items-center gap-1.5 rounded-full bg-brand-text px-4 py-2 text-[0.8125rem] font-medium text-white shadow-card transition-all hover:bg-brand-accent"
        >
          <Icon.Plus className="h-3.5 w-3.5" /> New translation
        </button>
      </header>

      {/* Filter bar */}
      <div className="mb-5 flex items-center gap-3">
        <div className="inline-flex rounded-full border border-brand-border bg-brand-surface p-0.5 shadow-card">
          {[
            { k: "documents", label: "Documents", count: allDocs.length },
            { k: "jobs", label: "Jobs", count: allJobs.length },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setMode(t.k)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                mode === t.k ? "bg-brand-text text-white" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[0.625rem] tabular-nums ${mode === t.k ? "bg-white/20" : "bg-brand-sunken"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Icon.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-hint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search files, projects, languages…"
              className="w-full rounded-full border border-brand-border bg-brand-surface py-2 pl-9 pr-3.5 text-[0.8125rem] text-brand-text placeholder:text-brand-subtle shadow-card focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/15"
            />
          </div>
          <FilterSelect value={projectFilter} onChange={setProjectFilter}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </FilterSelect>
          {mode === "jobs" && (
            <FilterSelect value={statusFilter} onChange={setStatusFilter}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="in_review">In review</option>
              <option value="completed">Completed</option>
              <option value="exported">Exported</option>
            </FilterSelect>
          )}
        </div>
      </div>

      {mode === "documents" ? (
        <DocumentsTable rows={docs} dispatch={dispatch} />
      ) : (
        <JobsTable rows={jobs} dispatch={dispatch} />
      )}

      {((mode === "documents" && docs.length === 0) || (mode === "jobs" && jobs.length === 0)) && (
        <div className="mt-6 rounded-2xl border border-dashed border-brand-border bg-brand-surface p-10 text-center shadow-card">
          <p className="font-display text-lg font-semibold text-brand-text m-0">No matches</p>
          <p className="mt-1.5 text-sm text-brand-muted m-0">Try clearing a filter or changing your search.</p>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-brand-border bg-brand-surface py-2 pl-3.5 pr-8 text-[0.8125rem] text-brand-text shadow-card focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/15"
      >
        {children}
      </select>
      <svg viewBox="0 0 12 12" className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-brand-subtle" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function DocumentsTable({ rows, dispatch }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <header className="grid grid-cols-[2.2fr_1.6fr_0.8fr_1.6fr_0.7fr] gap-4 border-b border-brand-borderSoft bg-brand-sunken/50 px-5 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">
        <span>Document</span>
        <span>Project</span>
        <span className="text-right">Words</span>
        <span>Languages · status</span>
        <span className="text-right">Uploaded</span>
      </header>
      <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
        {rows.map((d) => {
          const review = d.jobs.filter((j) => j.status === "in_review").length;
          return (
            <li key={d.projectId + "-" + d.id}>
              <button
                onClick={() => dispatch({ type: "OPEN_PROJECT", id: d.projectId })}
                className="group grid w-full grid-cols-[2.2fr_1.6fr_0.8fr_1.6fr_0.7fr] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-brand-sunken/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileIcon name={d.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-text m-0">{d.name}</p>
                    <p className="mt-0.5 text-[0.6875rem] text-brand-subtle m-0">{d.jobs.length} {d.jobs.length === 1 ? "translation" : "translations"}</p>
                  </div>
                </div>
                <p className="truncate text-[0.8125rem] text-brand-muted m-0">{d.projectName}</p>
                <p className="text-right font-mono text-xs tabular-nums text-brand-muted m-0">{d.words.toLocaleString()}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {d.jobs.map((j) => <JobChip key={j.id} j={j} />)}
                  {review > 0 && (
                    <span className="ml-1 rounded-full bg-brand-accentSoft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-accent ring-1 ring-inset ring-brand-accent/15">
                      {review} review
                    </span>
                  )}
                </div>
                <p className="text-right text-[0.6875rem] text-brand-subtle m-0">{d.uploaded}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function JobsTable({ rows, dispatch }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <header className="grid grid-cols-[2fr_1.5fr_0.8fr_1fr_0.7fr_0.6fr] gap-4 border-b border-brand-borderSoft bg-brand-sunken/50 px-5 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">
        <span>Document</span>
        <span>Project</span>
        <span>Language</span>
        <span>Status</span>
        <span className="text-right">Flags</span>
        <span className="text-right">Mode</span>
      </header>
      <ul className="m-0 list-none divide-y divide-brand-borderSoft p-0">
        {rows.map((j) => (
          <li key={j.projectId + "-" + j.id}>
            <button
              onClick={() => dispatch({ type: "OPEN_PROJECT", id: j.projectId })}
              className="group grid w-full grid-cols-[2fr_1.5fr_0.8fr_1fr_0.7fr_0.6fr] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-brand-sunken/60"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon name={j.docName} />
                <p className="truncate text-sm font-medium text-brand-text m-0">{j.docName}</p>
              </div>
              <p className="truncate text-[0.8125rem] text-brand-muted m-0">{j.projectName}</p>
              <p className="font-mono text-[0.75rem] tabular-nums text-brand-text m-0">{j.source.toUpperCase()} → {j.target.toUpperCase()}</p>
              <div className="flex items-center gap-2 min-w-0">
                <StatusDot status={j.status} />
                <span className="text-xs text-brand-muted">{statusLabel(j.status)}</span>
                {j.status === "processing" && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="h-1 w-12 rounded-full bg-brand-sunken overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accentHov" style={{ width: j.progress + "%" }} />
                    </div>
                    <span className="font-mono text-[0.625rem] text-brand-subtle">{j.progress}%</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-1.5">
                {j.ambiguities > 0 && (
                  <span className="rounded-full bg-brand-accentSoft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-accent ring-1 ring-inset ring-brand-accent/15">
                    {j.ambiguities} amb
                  </span>
                )}
                {j.insights > 0 && (
                  <span className="rounded-full bg-brand-sunken px-2 py-0.5 text-[0.6875rem] text-brand-muted">
                    {j.insights} ins
                  </span>
                )}
              </div>
              <p className="text-right text-[0.6875rem] text-brand-subtle m-0">{j.autopilot ? "Autopilot" : "Manual"}</p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FileIcon({ name }) {
  const ext = (name.split(".").pop() || "").toUpperCase();
  const tone =
    ext === "DOCX" || ext === "DOC" ? "bg-blue-50 text-blue-700 ring-blue-200/60"
    : ext === "RTF" ? "bg-violet-50 text-violet-700 ring-violet-200/60"
    : ext === "TXT" ? "bg-slate-50 text-slate-600 ring-slate-200/60"
    : "bg-brand-sunken text-brand-muted ring-brand-border";
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[0.625rem] font-semibold ring-1 ring-inset ${tone}`}>
      {ext.slice(0, 4)}
    </span>
  );
}

function JobChip({ j }) {
  const tone =
    j.status === "in_review" ? "bg-brand-accentSoft text-brand-accent ring-brand-accent/15"
    : j.status === "completed" || j.status === "exported" ? "bg-emerald-50 text-emerald-700 ring-emerald-200/50"
    : j.status === "processing" ? "bg-amber-50 text-amber-700 ring-amber-200/50"
    : "bg-brand-sunken text-brand-subtle ring-brand-border";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[0.6875rem] font-medium ring-1 ring-inset ${tone}`}>
      {j.target.toUpperCase()}
    </span>
  );
}

function StatusDot({ status }) {
  const color =
    status === "in_review" ? "bg-brand-accent"
    : status === "completed" || status === "exported" ? "bg-emerald-500"
    : status === "processing" ? "bg-amber-500"
    : "bg-brand-subtle";
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

function statusLabel(s) {
  return { pending: "Pending", processing: "Processing", in_review: "In review", completed: "Completed", exported: "Exported" }[s] || s;
}
