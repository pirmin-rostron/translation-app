// Main app — state + routing + Tweaks panel

function App() {
  const initialState = {
    view: "dashboard", // "dashboard" | "documents" | "projects" | "project" | "autopilot" | "review"
    projectId: null,
    reviewJobId: null,
    projects: window.HELVARA_DATA.projects,
    modal: null, // "new-project" | "new-translation"
    modalContext: null,
    toast: null,
    tweaksOpen: false,
  };
  const [state, setState] = useState(initialState);
  // persist location
  useEffect(() => {
    const saved = localStorage.getItem("helvara_nav");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setState((s) => ({ ...s, view: p.view || "dashboard", projectId: p.projectId ?? null }));
      } catch (e) {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("helvara_nav", JSON.stringify({ view: state.view, projectId: state.projectId }));
  }, [state.view, state.projectId]);

  const dispatch = (a) => {
    setState((s) => {
      switch (a.type) {
        case "NAVIGATE":         return { ...s, view: a.view, projectId: null, reviewJobId: null };
        case "GO_PROJECTS":      return { ...s, view: "projects", projectId: null };
        case "OPEN_PROJECT":     return { ...s, view: "project", projectId: a.id };
        case "OPEN_REVIEW":      return { ...s, view: "review", reviewJobId: a.jobId };
        case "OPEN_NEW_PROJECT": return { ...s, modal: "new-project" };
        case "OPEN_NEW_TRANSLATION": return { ...s, modal: "new-translation", modalContext: { projectId: a.projectId } };
        case "CLOSE_MODAL":      return { ...s, modal: null, modalContext: null };
        case "TOAST":            return { ...s, toast: a.msg };
        case "CREATE_PROJECT": {
          const newP = {
            id: Date.now(),
            name: a.payload.name,
            description: a.payload.description,
            target_languages: a.payload.target_languages,
            due_date: a.payload.due_date,
            document_count: 0,
            stats: { total_jobs: 0, completed_count: 0, in_review_count: 0, total_words: 0 },
            documents: [],
          };
          return { ...s, projects: [newP, ...s.projects], modal: null, toast: `Project "${a.payload.name}" created` };
        }
        case "UPLOAD_TRANSLATION": {
          const { projectId, file, languages } = a.payload;
          const projects = s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const newDocId = Date.now();
            const newJobs = languages.map((target, i) => ({
              id: newDocId + i, source: "en", target, status: "processing", ambiguities: 0, insights: 0, progress: 5, autopilot: true,
            }));
            const newDoc = { id: newDocId, name: file.name, words: 400, uploaded: "2026-04-22", jobs: newJobs };
            return {
              ...p,
              document_count: p.document_count + 1,
              documents: [newDoc, ...p.documents],
              stats: { ...p.stats, total_jobs: p.stats.total_jobs + languages.length, total_words: p.stats.total_words + 400 },
            };
          });
          return { ...s, projects, modal: null, toast: `Uploading "${file.name}" — ${languages.length} languages queued` };
        }
        case "TOGGLE_TWEAKS":    return { ...s, tweaksOpen: !s.tweaksOpen };
        default: return s;
      }
    });
  };

  // Expose dispatch globally so leaf components (ReviewPeek) can route without prop-drilling
  useEffect(() => { window.__helvaraDispatch = dispatch; }, []);

  // Auto-clear toast
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => setState((s) => ({ ...s, toast: null })), 3000);
    return () => clearTimeout(t);
  }, [state.toast]);

  // Edit-mode protocol
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === "__activate_edit_mode") setState((s) => ({ ...s, tweaksOpen: true }));
      if (e.data?.type === "__deactivate_edit_mode") setState((s) => ({ ...s, tweaksOpen: false }));
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <>
      <AppShell
        active={state.view === "project" ? "projects" : state.view === "review" ? "autopilot" : state.view}
        onGoHome={() => dispatch({ type: "NAVIGATE", view: "dashboard" })}
        onNavigate={(key) => dispatch({ type: "NAVIGATE", view: key })}
        onNewTranslation={() => dispatch({ type: "OPEN_NEW_TRANSLATION", projectId: null })}
      >
        <div data-screen-label={
          state.view === "dashboard" ? "01 Dashboard"
          : state.view === "documents" ? "02 Documents"
          : state.view === "projects" ? "03 Projects"
          : state.view === "project" ? "04 Project detail"
          : state.view === "autopilot" ? "05 Autopilot"
          : "06 Translation review"
        } className={state.view === "review" ? "h-full" : ""}>
          {state.view === "dashboard" && <DashboardView state={state} dispatch={dispatch} />}
          {state.view === "documents" && <DocumentsView state={state} dispatch={dispatch} />}
          {state.view === "projects" && <ProjectsView state={state} dispatch={dispatch} />}
          {state.view === "project" && <ProjectDetailView state={state} dispatch={dispatch} />}
          {state.view === "autopilot" && <AutopilotView state={state} dispatch={dispatch} />}
          {state.view === "review" && <TranslationReviewView state={state} dispatch={dispatch} />}
        </div>
      </AppShell>

      <NewProjectModal
        open={state.modal === "new-project"}
        onClose={() => dispatch({ type: "CLOSE_MODAL" })}
        onCreate={(payload) => dispatch({ type: "CREATE_PROJECT", payload })}
      />
      <NewTranslationModal
        open={state.modal === "new-translation"}
        onClose={() => dispatch({ type: "CLOSE_MODAL" })}
        projects={state.projects}
        projectId={state.modalContext?.projectId}
        onUpload={(payload) => dispatch({ type: "UPLOAD_TRANSLATION", payload })}
      />

      <Toast message={state.toast} />
      {state.tweaksOpen && <TweaksPanel />}
    </>
  );
}

// ── Tweaks panel ────────────────────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#0D7B6E",
  "density": "comfortable",
  "insightStyle": "inline",
  "autopilotBanner": true
}/*EDITMODE-END*/;

const ACCENTS = [
  { label: "Helvara Teal", value: "#0D7B6E", hov: "#0A6459", mid: "#E6F4F2" },
  { label: "Editorial Ink", value: "#1D3557", hov: "#152b47", mid: "#E7ECF2" },
  { label: "Terracotta",   value: "#B04A2E", hov: "#913B23", mid: "#F6E6DF" },
  { label: "Aubergine",    value: "#5B2B5F", hov: "#48224b", mid: "#EDE3EE" },
];

function TweaksPanel() {
  const [accent, setAccent] = useState(TWEAK_DEFAULTS.accent);
  const [density, setDensity] = useState(TWEAK_DEFAULTS.density);

  useEffect(() => {
    const a = ACCENTS.find((x) => x.value === accent) || ACCENTS[0];
    const root = document.documentElement;
    root.style.setProperty("--brand-accent", a.value);
    root.style.setProperty("--brand-accent-hov", a.hov);
    root.style.setProperty("--brand-accent-mid", a.mid);
    root.style.setProperty("--brand-accent-soft", a.mid + "80"); // rough soft tint
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  const set = (key, val) => window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [key]: val } }, "*");

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[280px] rounded-[22px] border border-brand-border bg-brand-surface/95 backdrop-blur-md p-5 shadow-raised animate-scalein">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-subtle m-0">Design</p>
          <p className="mt-0.5 font-display text-[1rem] font-semibold tracking-display text-brand-text m-0">Tweaks</p>
        </div>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accentSoft text-brand-accent">
          <Icon.Sparkle className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-muted m-0">Accent</p>
        <div className="grid grid-cols-4 gap-1.5">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              onClick={() => { setAccent(a.value); set("accent", a.value); }}
              className={`relative h-11 rounded-xl transition-all ${
                accent === a.value
                  ? "ring-2 ring-brand-text ring-offset-2 ring-offset-brand-surface"
                  : "ring-1 ring-brand-border hover:ring-brand-hint"
              }`}
              style={{ background: a.value }}
              title={a.label}
              aria-label={a.label}
            >
              {accent === a.value && (
                <span className="absolute inset-0 flex items-center justify-center text-white">
                  <Icon.Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-muted m-0">Density</p>
        <div className="flex gap-1 rounded-full bg-brand-sunken p-1">
          {["comfortable", "compact"].map((d) => (
            <button
              key={d}
              onClick={() => { setDensity(d); set("density", d); }}
              className={`flex-1 rounded-full px-3 py-1.5 text-[0.75rem] font-medium transition-all ${
                density === d
                  ? "bg-brand-surface text-brand-text shadow-card"
                  : "text-brand-muted hover:text-brand-text"
              }`}
            >
              {d[0].toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
