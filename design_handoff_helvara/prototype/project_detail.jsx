// Project detail view — documents + jobs + inline block review peek
// Restyled to match Dashboard / Documents / Projects system.

function ProjectDetailView({ state, dispatch }) {
  const project = state.projects.find((p) => p.id === state.projectId);
  const [collapsed, setCollapsed] = useState(new Set());
  const [openReviewJobId, setOpenReviewJobId] = useState(null);

  if (!project) return null;

  const toggle = (name) => {
    const next = new Set(collapsed);
    next.has(name) ? next.delete(name) : next.add(name);
    setCollapsed(next);
  };

  const totalDocs = project.documents.length;
  const totalJobs = project.stats.total_jobs;
  const completedCount = project.stats.completed_count;
  const inReviewCount = project.stats.in_review_count;
  const progressPct = totalJobs > 0 ? Math.round((completedCount / totalJobs) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1240px] px-10 py-10">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 text-[0.75rem]">
        <button
          onClick={() => dispatch({ type: "GO_PROJECTS" })}
          className="text-brand-muted hover:text-brand-text bg-transparent border-0 p-0 cursor-pointer transition-colors"
        >
          Projects
        </button>
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-brand-hint" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4.5 3 3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span className="text-brand-text">{project.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-7 flex items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-subtle">Project</p>
          <h1 className="font-display text-[2.25rem] font-semibold leading-[1.05] tracking-display text-brand-text m-0">
            {project.name}
            {project.pinned && (
              <span className="ml-3 inline-flex items-center gap-1.5 align-middle rounded-full bg-brand-accentSoft px-2.5 py-1 text-[0.6875rem] font-medium text-brand-accent tracking-normal">
                <Icon.Sparkle className="h-3 w-3" /> Pinned
              </span>
            )}
          </h1>
          {project.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-muted m-0">{project.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button className="rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-[0.8125rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken shadow-card transition-colors">
            Edit project
          </button>
          <button
            onClick={() => dispatch({ type: "OPEN_NEW_TRANSLATION", projectId: project.id })}
            className="flex items-center gap-1.5 rounded-full bg-brand-text px-4 py-2 text-[0.8125rem] font-medium text-white hover:bg-brand-accent transition-colors"
          >
            <Icon.Plus className="h-3.5 w-3.5" /> Upload document
          </button>
        </div>
      </div>

      {/* Autopilot banner — cleaner, no left-border-accent */}
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-brand-border bg-gradient-to-br from-brand-accentSoft to-brand-surface p-5 shadow-card">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-accent/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-surface text-brand-accent ring-1 ring-brand-accent/20 shadow-card">
            <Icon.Sparkle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-display text-[1.0625rem] font-semibold tracking-display text-brand-text m-0">Autopilot is handling this project</p>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-accent" />
              </span>
            </div>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-brand-muted m-0">
              Files translate and check automatically. You're pulled in only when Linguistic Insights flag a material ambiguity
              {inReviewCount > 0 ? (
                <> — <span className="font-medium text-brand-text">{inReviewCount} block{inReviewCount === 1 ? "" : "s"}</span> waiting now.</>
              ) : <>.</>}
            </p>
          </div>
        </div>
      </div>

      {/* Meta row — language chips + due date */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {project.target_languages.map((l) => (
          <span
            key={l}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-sunken/60 px-3 py-1 text-[0.75rem] text-brand-text"
          >
            <span className="font-mono text-[0.6875rem] font-medium text-brand-muted">{lang(l).code}</span>
            <span className="text-brand-subtle">·</span>
            <span>{lang(l).name}</span>
          </span>
        ))}
        {project.due_date && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-[0.75rem] text-brand-muted">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/>
            </svg>
            Due {new Date(project.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      {/* Stats strip — single card, 4 cells (matches Dashboard/Projects pattern) */}
      <div className="mb-7 grid grid-cols-4 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
        <ProjectStatCell label="Total jobs" value={totalJobs} meta={`${totalDocs} doc${totalDocs === 1 ? "" : "s"} · ${project.target_languages.length} lang${project.target_languages.length === 1 ? "" : "s"}`} />
        <ProjectStatCell label="Completed" value={completedCount} meta="Ready to export" valueClass="text-status-success" bordered />
        <ProjectStatCell label="Needs review" value={inReviewCount} meta={inReviewCount > 0 ? "Awaiting you" : "All clear"} valueClass={inReviewCount > 0 ? "text-brand-accent" : "text-brand-text"} bordered />
        <ProjectStatCell label="Progress" value={`${progressPct}%`} progress={progressPct} bordered />
      </div>

      {/* Documents panel */}
      <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
        <header className="flex items-center justify-between border-b border-brand-borderSoft px-5 py-3.5">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-[1.0625rem] font-semibold tracking-display text-brand-text m-0">Documents</h2>
            <span className="text-[0.75rem] text-brand-subtle">{totalDocs} file{totalDocs === 1 ? "" : "s"} · {totalJobs} translation job{totalJobs === 1 ? "" : "s"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCollapsed(collapsed.size === project.documents.length ? new Set() : new Set(project.documents.map((d) => d.name)))}
              className="rounded-full px-3 py-1 text-[0.75rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken bg-transparent border-0 cursor-pointer transition-colors"
            >
              {collapsed.size === project.documents.length ? "Expand all" : "Collapse all"}
            </button>
            <button
              onClick={() => dispatch({ type: "OPEN_NEW_TRANSLATION", projectId: project.id })}
              className="flex items-center gap-1 rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-[0.75rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken transition-colors"
            >
              <Icon.Plus className="h-3 w-3" /> Upload
            </button>
          </div>
        </header>

        {project.documents.map((doc, docIdx) => {
          const isCol = collapsed.has(doc.name);
          const ambTotal = doc.jobs.reduce((a, j) => a + (j.ambiguities || 0), 0);
          const isLast = docIdx === project.documents.length - 1;
          return (
            <React.Fragment key={doc.id}>
              <div className={`flex items-center gap-3 border-t border-brand-borderSoft bg-brand-sunken/40 px-5 py-3`}>
                <button
                  onClick={() => toggle(doc.name)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-brand-subtle hover:text-brand-text hover:bg-brand-sunken border-0 bg-transparent cursor-pointer transition-all"
                  style={{ transform: isCol ? "rotate(-90deg)" : "rotate(0deg)" }}
                  aria-label={isCol ? "Expand" : "Collapse"}
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <FileExtChip name={doc.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.875rem] font-medium text-brand-text m-0">{doc.name}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-brand-subtle m-0">
                    <span className="font-mono">{doc.words.toLocaleString()}</span> words · {doc.jobs.length} translation{doc.jobs.length === 1 ? "" : "s"}
                  </p>
                </div>
                {ambTotal > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-accentSoft px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-accent">
                    <Icon.Sparkle className="h-2.5 w-2.5" />
                    {ambTotal} insight{ambTotal === 1 ? "" : "s"}
                  </span>
                )}
                <button className="rounded-full border border-brand-border bg-brand-surface px-2.5 py-1 text-[0.6875rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken transition-colors">
                  + Add language
                </button>
              </div>

              {!isCol && doc.jobs.map((job, jobIdx) => (
                <JobRow
                  key={job.id}
                  job={job}
                  doc={doc}
                  isLastOfLastDoc={isLast && jobIdx === doc.jobs.length - 1}
                  expanded={openReviewJobId === job.id}
                  onToggle={() => setOpenReviewJobId(openReviewJobId === job.id ? null : job.id)}
                />
              ))}
            </React.Fragment>
          );
        })}
      </section>
    </div>
  );
}

// File extension chip (matches Documents page)
function FileExtChip({ name }) {
  const ext = (name.split(".").pop() || "").toUpperCase();
  const palette = {
    DOCX: "bg-blue-50 text-blue-700 ring-blue-200",
    RTF:  "bg-violet-50 text-violet-700 ring-violet-200",
    TXT:  "bg-slate-100 text-slate-700 ring-slate-200",
    PDF:  "bg-red-50 text-red-700 ring-red-200",
  }[ext] || "bg-brand-sunken text-brand-muted ring-brand-border";
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[0.5625rem] font-semibold ring-1 ring-inset ${palette}`}>
      {ext}
    </span>
  );
}

// Stat cell used inside the stats-strip card (project-scoped to avoid collision with dashboard's StatCell)
function ProjectStatCell({ label, value, meta, valueClass, progress, bordered }) {
  return (
    <div className={`px-5 py-4 ${bordered ? "border-l border-brand-borderSoft" : ""}`}>
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle m-0">{label}</p>
      <p className={`mt-2 font-display text-[1.75rem] font-semibold leading-none tracking-display m-0 ${valueClass || "text-brand-text"}`}>{value}</p>
      {progress != null ? (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-brand-sunken">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accentHov transition-[width] duration-700" style={{ width: `${progress}%` }} />
        </div>
      ) : meta ? (
        <p className="mt-1.5 text-[0.75rem] text-brand-muted m-0">{meta}</p>
      ) : null}
    </div>
  );
}

function JobRow({ job, doc, expanded, onToggle, isLastOfLastDoc }) {
  const isProc = job.status === "processing";
  const isReview = job.status === "in_review";
  const canExpand = isReview || job.status === "completed";

  return (
    <>
      <div
        className={`flex items-center gap-2.5 border-t border-brand-borderSoft bg-brand-surface px-5 py-2.5 pl-14 transition-colors ${
          isProc ? "opacity-70" : canExpand ? "cursor-pointer hover:bg-brand-sunken/40" : ""
        } ${expanded ? "bg-brand-accentSoft/40" : ""}`}
        onClick={() => canExpand && onToggle()}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-sunken px-2.5 py-0.5 font-mono text-[0.6875rem] font-medium text-brand-text">
          {lang(job.source).code}
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-brand-subtle" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 6h8M7 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {lang(job.target).code}
        </span>
        <span className="text-[0.75rem] text-brand-muted">{lang(job.target).name}</span>
        <StatusBadge status={job.status} />
        {job.ambiguities > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[0.6875rem] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            {job.ambiguities} amb
          </span>
        )}
        {job.insights > 0 && (
          <span className="rounded-full bg-brand-sunken px-2 py-0.5 text-[0.6875rem] font-medium text-brand-muted">
            {job.insights} ins
          </span>
        )}
        {isProc && (
          <div className="ml-1 flex items-center gap-2">
            <div className="h-[3px] w-32 overflow-hidden rounded-full bg-brand-sunken ring-1 ring-inset ring-black/[0.02]">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accentHov transition-[width] duration-700" style={{ width: `${job.progress}%` }} />
            </div>
            <span className="font-mono text-[0.6875rem] text-brand-muted">{job.progress}%</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canExpand && (
            <span className="text-[0.6875rem] text-brand-subtle">
              {expanded ? "Hide peek" : "Peek"}
            </span>
          )}
          <button
            onClick={(e) => e.stopPropagation()}
            className={
              isReview
                ? "flex items-center gap-1 rounded-full bg-brand-text px-3 py-1 text-[0.6875rem] font-medium text-white hover:bg-brand-accent transition-colors"
                : "rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-[0.6875rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken transition-colors"
            }
          >
            {isReview ? <>Open review <Icon.Arrow className="h-3 w-3" /></> : job.status === "exported" ? "Download" : job.status === "processing" ? "Monitor" : "View"}
          </button>
        </div>
      </div>

      {expanded && canExpand && <ReviewPeek job={job} doc={doc} />}
    </>
  );
}

Object.assign(window, { ProjectDetailView, FileExtChip });
