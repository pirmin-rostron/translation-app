// Projects list view

function ProjectsView({ state, dispatch }) {
  const projects = state.projects;
  const totalProjects = projects.length;
  const totalDocs = projects.reduce((a, p) => a + p.document_count, 0);
  const totalInReview = projects.reduce((a, p) => a + p.stats.in_review_count, 0);
  const totalJobs = projects.reduce((a, p) => a + p.stats.total_jobs, 0);
  const totalCompleted = projects.reduce((a, p) => a + p.stats.completed_count, 0);
  const overall = totalJobs > 0 ? Math.round((totalCompleted / totalJobs) * 100) : 0;

  const [filter, setFilter] = useState("all"); // all | active | completed | empty

  const filtered = projects.filter((p) => {
    if (filter === "active") return p.stats.total_jobs > 0 && p.stats.completed_count < p.stats.total_jobs;
    if (filter === "completed") return p.stats.total_jobs > 0 && p.stats.completed_count >= p.stats.total_jobs;
    if (filter === "empty") return p.document_count === 0;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1320px] px-10 py-10">
      <header className="mb-8 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-brand-subtle m-0">Workspace</p>
          <h1 className="font-display text-[2.5rem] font-semibold tracking-display leading-[1.05] text-brand-text m-0">
            Projects
          </h1>
          <p className="mt-2.5 max-w-xl text-[0.9375rem] text-brand-muted m-0">
            Containers for documents, target languages, and translation jobs.
          </p>
        </div>
        <button
          onClick={() => dispatch({ type: "OPEN_NEW_PROJECT" })}
          className="flex items-center gap-1.5 rounded-full bg-brand-text px-4 py-2 text-[0.8125rem] font-medium text-white shadow-card transition-all hover:bg-brand-accent"
        >
          <Icon.Plus className="h-3.5 w-3.5" /> New project
        </button>
      </header>

      {/* Stat strip */}
      <section className="mb-8 grid grid-cols-4 gap-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
        <StatTile label="Total projects" value={totalProjects} meta={`${totalProjects} active`} />
        <StatTile label="Documents" value={totalDocs} meta={`across ${totalProjects} projects`} divider />
        <StatTile label="In review" value={totalInReview} valueClass="text-brand-accent" meta="awaiting approval" divider />
        <StatTile label="Overall progress" value={`${overall}%`} meta={null} progress={overall} divider />
      </section>

      {/* Filter bar */}
      <div className="mb-5 flex items-center justify-between">
        <div className="inline-flex rounded-full border border-brand-border bg-brand-surface p-0.5 shadow-card">
          {[
            { k: "all", label: `All ${projects.length}` },
            { k: "active", label: "Active" },
            { k: "completed", label: "Completed" },
            { k: "empty", label: "Empty" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className={`rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                filter === t.k ? "bg-brand-text text-white" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-brand-subtle">{filtered.length} shown</span>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-5">
        {filtered.map((p) => (
          <ProjectCard key={p.id} project={p} onOpen={() => dispatch({ type: "OPEN_PROJECT", id: p.id })} />
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, valueClass = "text-brand-text", meta, progress, divider }) {
  const isZero = value === 0 || value === "0%" || value === "—";
  return (
    <div className={`px-6 py-5 ${divider ? "border-l border-brand-borderSoft" : ""}`}>
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle m-0">{label}</p>
      <p className={`mt-2.5 font-display text-[2rem] font-semibold leading-none tracking-display m-0 ${isZero ? "text-brand-subtle" : valueClass}`}>{value}</p>
      {meta && <p className="mt-2 text-xs text-brand-subtle m-0">{meta}</p>}
      {typeof progress === "number" && (
        <div className="mt-2.5 h-1 w-full rounded-full bg-brand-sunken overflow-hidden">
          <div className="h-full rounded-full bg-brand-text transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onOpen }) {
  const badge = deriveProjectBadge(project);
  const pct = project.stats.total_jobs > 0 ? Math.round((project.stats.completed_count / project.stats.total_jobs) * 100) : 0;
  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface p-6 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised"
    >
      {/* accent rail on hover */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-brand-accent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[1.25rem] font-semibold leading-tight tracking-display text-brand-text m-0 line-clamp-1">{project.name}</p>
          {project.pinned && <span className="mt-1.5 inline-flex items-center gap-1 text-[0.6875rem] font-medium text-brand-accent"><Icon.Sparkle className="h-2.5 w-2.5" /> Pinned</span>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium ${badge.classes}`}>{badge.label}</span>
      </div>

      <div className="mt-2 h-10">
        {project.description ? (
          <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-brand-muted m-0">{project.description}</p>
        ) : (
          <p className="text-[0.8125rem] italic text-brand-subtle m-0">No description added</p>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        {project.target_languages.map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-sunken/60 px-2 py-0.5 text-[0.6875rem] font-medium text-brand-muted">
            <span className="font-mono text-brand-text">{lang(l).code}</span>
            <span>{lang(l).name.replace(/\s*\(.+\)$/, '')}</span>
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 rounded-xl bg-brand-sunken/50 p-3">
        <StatMicro value={project.document_count} label="Docs" />
        <StatMicro value={project.stats.total_words.toLocaleString()} label="Words" />
        <StatMicro value={project.stats.completed_count} label="Done" tone="success" />
        <StatMicro value={project.stats.in_review_count} label="Review" tone="accent" />
      </div>

      <div className="mt-4">
        {project.document_count === 0 ? (
          <p className="text-[0.6875rem] text-brand-subtle m-0">No documents yet — upload to get started</p>
        ) : (
          <>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[0.6875rem] text-brand-subtle">Progress</span>
              <span className="font-mono text-[0.6875rem] font-medium text-brand-text tabular-nums">{pct}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-brand-sunken overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accentHov transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>
    </button>
  );
}

function StatMicro({ value, label, tone = "default" }) {
  const zero = value === 0 || value === "0";
  const cls =
    zero ? "text-brand-subtle" :
    tone === "success" ? "text-emerald-700" :
    tone === "accent" ? "text-brand-accent" :
    "text-brand-text";
  return (
    <div className="text-center">
      <p className={`font-display text-[1.125rem] font-semibold leading-none m-0 ${cls}`}>{value}</p>
      <p className="mt-1 text-[0.625rem] uppercase tracking-wider text-brand-subtle m-0">{label}</p>
    </div>
  );
}

Object.assign(window, { ProjectsView });
