// Inline block review peek + modals (New Project, New Translation)
// Restyled to match Dashboard / Documents / Projects system.

function ReviewPeek({ job, doc }) {
  const blocks = (window.HELVARA_DATA.reviewBlocks[job.id]) || null;
  const [decisions, setDecisions] = useState({});
  const [activeBlock, setActiveBlock] = useState(null);

  if (!blocks) {
    return (
      <div className="border-t border-brand-borderSoft bg-brand-sunken/40 px-5 py-5 pl-14">
        <p className="text-[0.8125rem] text-brand-muted m-0">Block-level review will appear here when Autopilot finishes this job.</p>
      </div>
    );
  }

  const approveAll = () => {
    const next = { ...decisions };
    blocks.forEach((b) => {
      if (b.status === "ambiguity") next[b.id] = next[b.id] || { status: "approved", pick: 0 };
      else next[b.id] = { status: "approved" };
    });
    setDecisions(next);
  };

  const decidedCount = blocks.filter((b) => decisions[b.id]?.status === "approved" || b.status === "approved").length;

  return (
    <div className="border-t border-brand-borderSoft bg-brand-sunken/40 px-5 py-5 pl-14 animate-slidedown">
      {/* Peek header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-accent m-0">Review peek</p>
          <p className="mt-1 font-display text-[1.0625rem] font-semibold tracking-display text-brand-text m-0">
            {doc.name} <span className="font-sans font-normal text-brand-subtle">·</span> <span className="font-mono text-[0.875rem] font-medium text-brand-muted">{lang(job.source).code} → {lang(job.target).code}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] text-brand-muted">
            <span className="font-mono font-medium text-brand-text">{decidedCount}</span>
            <span className="text-brand-subtle"> / </span>
            <span className="font-mono">{blocks.length}</span> approved
          </span>
          <button
            onClick={approveAll}
            className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-[0.75rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken shadow-card transition-colors"
          >
            Approve remaining
          </button>
          <button
            onClick={() => window.__helvaraDispatch && window.__helvaraDispatch({ type: "OPEN_REVIEW", jobId: job.id })}
            className="flex items-center gap-1 rounded-full bg-brand-text px-3.5 py-1.5 text-[0.75rem] font-medium text-white hover:bg-brand-accent transition-colors"
          >
            Open full review <Icon.Arrow className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Block list */}
      <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
        {blocks.map((b, i) => {
          const decision = decisions[b.id];
          const isActive = activeBlock === b.id;
          const effectiveStatus = decision?.status || b.status;
          return (
            <BlockRow
              key={b.id}
              block={b}
              index={i}
              active={isActive}
              effectiveStatus={effectiveStatus}
              decision={decision}
              onActivate={() => setActiveBlock(isActive ? null : b.id)}
              onDecide={(update) => setDecisions({ ...decisions, [b.id]: update })}
            />
          );
        })}
      </div>
    </div>
  );
}

function BlockRow({ block, index, active, effectiveStatus, decision, onActivate, onDecide }) {
  const isAmb = block.status === "ambiguity";
  const rowBg = active ? "bg-brand-accentSoft/60" : "bg-brand-surface hover:bg-brand-sunken/40";

  const statusDot =
    effectiveStatus === "approved" ? "bg-status-success" :
    effectiveStatus === "ambiguity" && !decision ? "bg-amber-500" :
    "bg-brand-hint";

  return (
    <div className={`border-b border-brand-borderSoft last:border-0 ${rowBg} transition-colors`}>
      <button onClick={onActivate} className="w-full text-left px-5 py-3.5 bg-transparent border-0 cursor-pointer">
        <div className="flex items-start gap-4">
          <div className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5">
            <span className="font-mono text-[0.625rem] font-medium uppercase tracking-wider text-brand-subtle">B{String(index + 1).padStart(2, "0")}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-5">
            <div className="min-w-0">
              <p className="mb-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-brand-subtle m-0">Source · EN</p>
              <p className="text-[0.8125rem] leading-relaxed text-brand-text m-0">{block.source}</p>
            </div>
            <div className="min-w-0">
              <p className="mb-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-brand-accent m-0">Target · {lang("es-ES").code}</p>
              <p className="text-[0.8125rem] leading-relaxed text-brand-text m-0">
                {decision?.pick !== undefined ? block.alternatives[decision.pick] : block.target}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
            {effectiveStatus === "approved" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[0.6875rem] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <Icon.Check className="h-2.5 w-2.5" /> Approved
              </span>
            )}
            {effectiveStatus === "ambiguity" && !decision && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[0.6875rem] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                Ambiguous
              </span>
            )}
            {effectiveStatus === "pending" && (
              <span className="rounded-full bg-brand-sunken px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-muted">Pending</span>
            )}
            {block.insights?.map((ins, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-brand-accentSoft px-2 py-0.5 text-[0.625rem] font-medium text-brand-accent">
                {ins.kind === "glossary" ? "Glossary" : ins.kind === "memory" ? "Memory" : "Ambiguity"}
              </span>
            ))}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {active && (
        <div className="border-t border-brand-borderSoft bg-brand-sunken/30 px-5 pb-4 pt-4 pl-[4.25rem] animate-slidedown">
          {isAmb && (
            <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-amber-800 m-0">
                <Icon.Sparkle className="h-3 w-3" /> Linguistic insight — ambiguity
              </p>
              <p className="mb-3 text-[0.8125rem] leading-relaxed text-brand-text m-0">{block.ambiguityReason}</p>
              <div className="space-y-2">
                {block.alternatives.map((alt, idx) => {
                  const selected = (decision?.pick ?? 0) === idx;
                  return (
                    <button
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); onDecide({ status: "approved", pick: idx }); }}
                      className={`block w-full rounded-xl border px-3.5 py-2.5 text-left text-[0.8125rem] transition-all ${
                        selected
                          ? "border-brand-accent bg-brand-surface text-brand-text shadow-card"
                          : "border-brand-border bg-brand-surface text-brand-text hover:border-brand-accent/40 hover:bg-brand-sunken/40"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`mt-[0.1875rem] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-brand-accent bg-brand-accent text-white" : "border-brand-border bg-brand-surface"}`}>
                          {selected && <Icon.Check className="h-2.5 w-2.5" />}
                        </span>
                        <span className="flex-1">
                          <span className="mr-2 font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">Option {idx + 1}</span>
                          {alt}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {block.insights?.filter((i) => i.kind !== "ambiguity").map((ins, idx) => (
            <div key={idx} className="mb-2 rounded-xl border border-brand-border bg-brand-surface p-3.5">
              <p className="mb-1 flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-accent m-0">
                {ins.kind === "glossary" ? "Glossary match" : "Memory match"}
                {ins.term && <span className="font-sans font-normal normal-case tracking-normal text-brand-text">· {ins.term}</span>}
              </p>
              <p className="text-[0.8125rem] leading-relaxed text-brand-muted m-0">{ins.note}</p>
            </div>
          ))}

          {!isAmb && effectiveStatus !== "approved" && (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onDecide({ status: "approved" }); }}
                className="flex items-center gap-1 rounded-full bg-brand-text px-3.5 py-1.5 text-[0.75rem] font-medium text-white hover:bg-brand-accent transition-colors"
              >
                <Icon.Check className="h-3 w-3" /> Approve
              </button>
              <button
                onClick={(e) => e.stopPropagation()}
                className="rounded-full border border-brand-border bg-brand-surface px-3.5 py-1.5 text-[0.75rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken shadow-card transition-colors"
              >
                Edit translation
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── New Project Modal ──────────────────────────────────────────────────────

const ALL_LANG_CODES = ["es-ES", "es-MX", "fr-FR", "de-DE", "pt-BR", "it-IT", "ja-JP"];

function NewProjectModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [langs, setLangs] = useState(new Set(["es-ES"]));
  const [due, setDue] = useState("");

  useEffect(() => { if (open) { setName(""); setDesc(""); setLangs(new Set(["es-ES"])); setDue(""); } }, [open]);

  const toggle = (c) => {
    const n = new Set(langs);
    n.has(c) ? n.delete(c) : n.add(c);
    setLangs(n);
  };
  const canSubmit = name.trim().length > 0 && langs.size > 0;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-subtle">New</p>
          <h2 className="font-display text-[1.5rem] font-semibold leading-none tracking-display text-brand-text m-0">Project</h2>
          <p className="mt-2 text-[0.8125rem] text-brand-muted m-0">A container for documents and their translations.</p>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <div className="space-y-5">
        <Field label="Project name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova Launch — Summer" />
        </Field>

        <Field label="Description" hint="Optional">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            placeholder="What this project is for"
            className="w-full resize-none rounded-xl border border-brand-border bg-brand-surface px-3.5 py-2.5 text-[0.875rem] text-brand-text outline-none placeholder:text-brand-hint focus:border-brand-accent focus:shadow-[0_0_0_3px_rgba(13,123,110,0.12)] transition-all"
          />
        </Field>

        <Field label="Translate into" required>
          <LangPicker codes={ALL_LANG_CODES} selected={langs} onToggle={toggle} />
        </Field>

        <Field label="Due date" hint="Optional">
          <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>

      <div className="mt-7 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-full px-4 py-2 text-[0.8125rem] font-medium text-brand-muted hover:text-brand-text bg-transparent border-0 cursor-pointer transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onCreate({ name: name.trim(), description: desc.trim(), target_languages: Array.from(langs), due_date: due || null })}
          disabled={!canSubmit}
          className="rounded-full bg-brand-text px-5 py-2 text-[0.8125rem] font-medium text-white hover:bg-brand-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Create project
        </button>
      </div>
    </Modal>
  );
}

// ── New Translation Modal ──────────────────────────────────────────────────

function NewTranslationModal({ open, onClose, projects, onUpload, projectId }) {
  const [selectedProject, setSelectedProject] = useState(projectId ?? (projects[0]?.id));
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [languages, setLanguages] = useState(new Set(["es-ES"]));
  const [mode, setMode] = useState("autopilot");

  useEffect(() => {
    if (open) {
      setSelectedProject(projectId ?? projects[0]?.id);
      setFile(null);
      setDragging(false);
      const proj = projects.find((p) => p.id === (projectId ?? projects[0]?.id));
      setLanguages(new Set(proj?.target_languages || ["es-ES"]));
      setMode("autopilot");
    }
  }, [open, projectId, projects]);

  const toggleLang = (c) => {
    const n = new Set(languages);
    n.has(c) ? n.delete(c) : n.add(c);
    setLanguages(n);
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-lg">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-subtle">New</p>
          <h2 className="font-display text-[1.5rem] font-semibold leading-none tracking-display text-brand-text m-0">Translation</h2>
          <p className="mt-2 text-[0.8125rem] text-brand-muted m-0">Upload a document — Autopilot handles the rest.</p>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <div className="space-y-5">
        <Field label="Project">
          <div className="relative">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(Number(e.target.value))}
              className="w-full appearance-none rounded-xl border border-brand-border bg-brand-surface px-3.5 py-2.5 pr-10 text-[0.875rem] text-brand-text outline-none focus:border-brand-accent focus:shadow-[0_0_0_3px_rgba(13,123,110,0.12)] transition-all"
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <svg viewBox="0 0 12 12" className="pointer-events-none absolute right-3.5 top-1/2 h-3 w-3 -translate-y-1/2 text-brand-subtle" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </Field>

        <Field label="Document">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile({ name: f.name, size: f.size }); }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              dragging ? "border-brand-accent bg-brand-accentSoft" : "border-brand-border bg-brand-sunken/50 hover:border-brand-accent/40 hover:bg-brand-sunken"
            }`}
          >
            {file ? (
              <div>
                <FileExtChip name={file.name} />
                <p className="mt-3 text-[0.875rem] font-medium text-brand-text m-0">{file.name}</p>
                <button
                  onClick={() => setFile(null)}
                  className="mt-2 text-[0.75rem] text-brand-muted hover:text-brand-text underline bg-transparent border-0 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface text-brand-muted ring-1 ring-brand-border shadow-card">
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13V4M6.5 7.5 10 4l3.5 3.5"/><path d="M4 13v2.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V13"/>
                  </svg>
                </div>
                <p className="mt-3 text-[0.875rem] text-brand-text m-0">
                  Drop a file here or{" "}
                  <button
                    onClick={() => setFile({ name: "nova-blog-post.docx", size: 14820 })}
                    className="font-medium text-brand-accent bg-transparent border-0 cursor-pointer underline-offset-2 hover:underline"
                  >
                    browse
                  </button>
                </p>
                <p className="mt-1 text-[0.75rem] text-brand-subtle m-0">DOCX, RTF, TXT · up to 10 MB</p>
              </div>
            )}
          </div>
        </Field>

        <Field label="Target languages">
          <LangPicker codes={ALL_LANG_CODES} selected={languages} onToggle={toggleLang} />
        </Field>

        <Field label="Mode">
          <div className="grid grid-cols-2 gap-2">
            <ModeCard
              selected={mode === "autopilot"}
              onClick={() => setMode("autopilot")}
              title="Autopilot"
              desc="Surface only material ambiguities"
              icon={<Icon.Sparkle className="h-4 w-4" />}
            />
            <ModeCard
              selected={mode === "manual"}
              onClick={() => setMode("manual")}
              title="Manual review"
              desc="Review every block"
              icon={
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 17l4-1 9-9-3-3-9 9-1 4Z"/><path d="m12 5 3 3"/>
                </svg>
              }
            />
          </div>
        </Field>
      </div>

      <div className="mt-7 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-full px-4 py-2 text-[0.8125rem] font-medium text-brand-muted hover:text-brand-text bg-transparent border-0 cursor-pointer transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onUpload({ projectId: selectedProject, file, languages: Array.from(languages), mode })}
          disabled={!file || languages.size === 0}
          className="rounded-full bg-brand-text px-5 py-2 text-[0.8125rem] font-medium text-white hover:bg-brand-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Start translation
        </button>
      </div>
    </Modal>
  );
}

// ── Small shared bits for modals ────────────────────────────────────────────

function CloseButton({ onClose }) {
  return (
    <button
      onClick={onClose}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-subtle hover:bg-brand-sunken hover:text-brand-text bg-transparent border-0 cursor-pointer transition-colors"
      aria-label="Close"
    >
      <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m3 3 8 8M11 3l-8 8"/></svg>
    </button>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-medium text-brand-muted">
        {label}
        {required && <span className="text-brand-accent">*</span>}
        {hint && <span className="ml-auto text-[0.6875rem] font-normal text-brand-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ ...props }) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-brand-border bg-brand-surface px-3.5 py-2.5 text-[0.875rem] text-brand-text outline-none placeholder:text-brand-hint focus:border-brand-accent focus:shadow-[0_0_0_3px_rgba(13,123,110,0.12)] transition-all"
    />
  );
}

function LangPicker({ codes, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map((c) => {
        const s = selected.has(c);
        return (
          <button
            key={c}
            onClick={() => onToggle(c)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.75rem] font-medium transition-all ${
              s
                ? "border-brand-accent bg-brand-accentSoft text-brand-accent shadow-card"
                : "border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text hover:border-brand-accent/30 hover:bg-brand-sunken/60"
            }`}
          >
            {s && <Icon.Check className="h-2.5 w-2.5" />}
            <span className="font-mono text-[0.6875rem]">{lang(c).code}</span>
            <span>{lang(c).name.replace(/\s*\(.*\)$/, "")}</span>
          </button>
        );
      })}
    </div>
  );
}

function ModeCard({ selected, onClick, title, desc, icon }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border p-3.5 transition-all ${
        selected
          ? "border-brand-accent bg-brand-accentSoft shadow-card"
          : "border-brand-border bg-brand-surface hover:border-brand-accent/30 hover:bg-brand-sunken/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${selected ? "bg-brand-surface text-brand-accent ring-1 ring-brand-accent/20" : "bg-brand-sunken text-brand-muted"}`}>
          {icon}
        </span>
        <p className="font-display text-[0.9375rem] font-semibold tracking-display text-brand-text m-0">{title}</p>
      </div>
      <p className="mt-2 text-[0.75rem] leading-relaxed text-brand-muted m-0">{desc}</p>
    </button>
  );
}

Object.assign(window, { ReviewPeek, BlockRow, NewProjectModal, NewTranslationModal });
