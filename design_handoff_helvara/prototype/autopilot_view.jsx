// Autopilot page — agent-as-coworker cockpit
// Left: agent feed (Rumi's decisions, questions, completions).
// Right: live queue with telemetry + decisions log.

function AutopilotView({ state, dispatch }) {
  const ap = window.HELVARA_DATA.autopilot;
  const [filter, setFilter] = useState("all"); // all | questions | decisions | completed
  const [running, setRunning] = useState(ap.queue);

  // Simulate live progress every 1.5s for the running queue
  useEffect(() => {
    const t = setInterval(() => {
      setRunning((prev) => prev.map((j) => {
        if (j.progress >= 100) return j;
        const bump = Math.random() * 2.4 + 0.2;
        return { ...j, progress: Math.min(100, +(j.progress + bump).toFixed(1)) };
      }));
    }, 1500);
    return () => clearInterval(t);
  }, []);

  const filteredMessages = filter === "all"
    ? ap.messages
    : ap.messages.filter((m) => (filter === "questions" ? m.kind === "question" : filter === "decisions" ? m.kind === "decision" : m.kind === "completed"));

  const questionCount = ap.messages.filter((m) => m.kind === "question").length;

  return (
    <div className="mx-auto max-w-[1280px] px-10 py-10">
      {/* Agent header */}
      <AgentHeader agent={ap.agent} runningCount={running.length} questionCount={questionCount} />

      {/* Stats row — agent's day at a glance */}
      <div className="mb-7 grid grid-cols-4 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
        <AgentStat label="Blocks translated" value={ap.agent.stats_today.blocks_translated.toLocaleString()} meta="last 24h" />
        <AgentStat label="Decisions made" value={ap.agent.stats_today.decisions_auto.toLocaleString()} meta="without asking" bordered />
        <AgentStat label="Asking your call" value={ap.agent.stats_today.decisions_asking} meta="waiting on you" valueClass="text-brand-accent" bordered />
        <AgentStat label="Time you saved" value={`${Math.floor(ap.agent.stats_today.saved_minutes / 60)}h ${ap.agent.stats_today.saved_minutes % 60}m`} meta="vs manual review" bordered />
      </div>

      {/* Body — 2 columns */}
      <div className="grid grid-cols-[1fr_380px] gap-5">
        {/* Left: agent feed */}
        <div>
          <FeedHeader filter={filter} setFilter={setFilter} counts={{
            all: ap.messages.length,
            questions: questionCount,
            decisions: ap.messages.filter((m) => m.kind === "decision").length,
            completed: ap.messages.filter((m) => m.kind === "completed").length,
          }} />
          <div className="space-y-3">
            {filteredMessages.map((m) => (
              <AgentMessage key={m.id} message={m} agent={ap.agent} dispatch={dispatch} />
            ))}
          </div>
        </div>

        {/* Right: live queue + decisions log */}
        <aside className="space-y-5">
          <LiveQueuePanel queue={running} />
          <DecisionsLogPanel log={ap.decisions_log} />
        </aside>
      </div>
    </div>
  );
}

// ── Agent header with avatar, status, and controls ─────────────────────────
function AgentHeader({ agent, runningCount, questionCount }) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-subtle">Workspace</p>
      <div className="flex items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <AgentAvatar agent={agent} size={72} pulse />
          <div>
            <h1 className="font-display text-[2.25rem] font-semibold leading-none tracking-display text-brand-text m-0">
              {agent.name}
              <span className="ml-3 align-middle font-sans text-[1rem] font-normal text-brand-muted tracking-normal">
                · {agent.role}
              </span>
            </h1>
            <p className="mt-2 max-w-xl text-[0.875rem] leading-relaxed text-brand-muted m-0">{agent.tagline}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-[0.75rem] font-medium text-brand-text shadow-card">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Working on {runningCount} job{runningCount === 1 ? "" : "s"}
          </span>
          {questionCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accentSoft px-3 py-1.5 text-[0.75rem] font-medium text-brand-accent">
              <Icon.Sparkle className="h-3 w-3" />
              {questionCount} question{questionCount === 1 ? "" : "s"} for you
            </span>
          )}
          <button className="rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-[0.8125rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken shadow-card transition-colors">
            Pause Rumi
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentAvatar({ agent, size = 36, pulse = false }) {
  const style = { width: size, height: size, background: agent.avatar_bg };
  return (
    <div className="relative shrink-0">
      <div
        className="flex items-center justify-center rounded-full font-display text-white shadow-card"
        style={{ ...style, fontSize: size * 0.42, fontWeight: 600, letterSpacing: "-0.02em" }}
      >
        {agent.initials}
      </div>
      {pulse && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-surface">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-brand-surface" />
          </span>
        </span>
      )}
    </div>
  );
}

function AgentStat({ label, value, meta, bordered, valueClass }) {
  return (
    <div className={`px-5 py-4 ${bordered ? "border-l border-brand-borderSoft" : ""}`}>
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle m-0">{label}</p>
      <p className={`mt-2 font-display text-[1.75rem] font-semibold leading-none tracking-display m-0 ${valueClass || "text-brand-text"}`}>{value}</p>
      <p className="mt-1.5 text-[0.75rem] text-brand-muted m-0">{meta}</p>
    </div>
  );
}

// ── Feed filter tabs ────────────────────────────────────────────────────────
function FeedHeader({ filter, setFilter, counts }) {
  const tabs = [
    { key: "all", label: "All" },
    { key: "questions", label: "Questions", accent: true },
    { key: "decisions", label: "Decisions" },
    { key: "completed", label: "Completed" },
  ];
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-display text-[1.125rem] font-semibold tracking-display text-brand-text m-0">Feed</h2>
      <div className="flex items-center gap-1 rounded-full border border-brand-border bg-brand-surface p-1 shadow-card">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-medium transition-all ${
                active
                  ? (t.accent ? "bg-brand-accent text-white shadow-card" : "bg-brand-text text-white shadow-card")
                  : "text-brand-muted hover:text-brand-text"
              }`}
            >
              {t.label}
              <span className={`font-mono text-[0.625rem] ${active ? "text-white/70" : "text-brand-subtle"}`}>{counts[t.key]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── A single message from the agent ─────────────────────────────────────────
function AgentMessage({ message, agent, dispatch }) {
  const kindStyle = {
    question:  { pill: "bg-brand-accentSoft text-brand-accent", label: "Asking" },
    decision:  { pill: "bg-brand-sunken text-brand-muted", label: "Decided" },
    completed: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200", label: "Shipped" },
  }[message.kind] || { pill: "bg-brand-sunken text-brand-muted", label: "Note" };

  const isQuestion = message.kind === "question";

  return (
    <article className={`group rounded-2xl border bg-brand-surface p-5 transition-all hover:shadow-card ${
      isQuestion ? "border-brand-accent/30 shadow-[0_0_0_3px_rgba(13,123,110,0.05)]" : "border-brand-border"
    }`}>
      <header className="mb-3 flex items-start gap-3">
        <AgentAvatar agent={agent} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-[0.9375rem] font-semibold tracking-display text-brand-text">{agent.name}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.1em] ${kindStyle.pill}`}>
              {kindStyle.label}
            </span>
            <span className="text-[0.75rem] text-brand-subtle">· {message.when}</span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.75rem] text-brand-muted m-0">
            <span className="font-medium text-brand-text">{message.project}</span>
            <span className="text-brand-hint">/</span>
            <span>{message.document}</span>
            <span className="font-mono text-[0.6875rem] rounded bg-brand-sunken px-1.5 py-0 text-brand-muted">{message.pair}</span>
          </p>
        </div>
      </header>

      <h3 className="mb-2 font-display text-[1.0625rem] font-semibold leading-snug tracking-display text-brand-text m-0">
        {message.title}
      </h3>
      <p className="mb-0 text-[0.875rem] leading-relaxed text-brand-muted m-0">{message.body}</p>

      {message.meta && !message.actions && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[0.75rem] text-brand-subtle m-0">
          <span className="h-1 w-1 rounded-full bg-brand-hint" />
          {message.meta}
        </p>
      )}

      {message.actions && (
        <div className="mt-4 flex items-center gap-2">
          {message.actions.map((a, i) => (
            <button
              key={i}
              onClick={() => a.primary && a.jobId && dispatch({ type: "OPEN_REVIEW", jobId: a.jobId })}
              className={
                a.primary
                  ? "flex items-center gap-1 rounded-full bg-brand-text px-3.5 py-1.5 text-[0.75rem] font-medium text-white hover:bg-brand-accent transition-colors"
                  : "rounded-full border border-brand-border bg-brand-surface px-3.5 py-1.5 text-[0.75rem] font-medium text-brand-muted hover:text-brand-text hover:bg-brand-sunken shadow-card transition-colors"
              }
            >
              {a.label}
              {a.primary && <Icon.Arrow className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

// ── Live queue panel ────────────────────────────────────────────────────────
function LiveQueuePanel({ queue }) {
  const stageLabel = {
    analyze: "Analyzing",
    translate: "Translating",
    insight_check: "Checking insights",
    finalize: "Finalizing",
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <header className="flex items-center justify-between border-b border-brand-borderSoft px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-accent" />
          </span>
          <h3 className="font-display text-[0.9375rem] font-semibold tracking-display text-brand-text m-0">Live queue</h3>
          <span className="text-[0.75rem] text-brand-subtle">· {queue.length}</span>
        </div>
      </header>
      <div className="divide-y divide-brand-borderSoft">
        {queue.map((j) => (
          <div key={j.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-medium text-brand-text m-0">{j.file}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-brand-muted m-0">
                  <span className="font-mono rounded bg-brand-sunken px-1 py-0 text-brand-muted">{j.pair}</span>
                  <span className="text-brand-hint">·</span>
                  <span>{stageLabel[j.stage] || j.stage}</span>
                </p>
              </div>
              <span className="font-mono text-[0.6875rem] text-brand-subtle whitespace-nowrap">{j.eta}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-brand-sunken ring-1 ring-inset ring-black/[0.02]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accentHov transition-[width] duration-[1200ms]"
                  style={{ width: `${j.progress}%` }}
                />
              </div>
              <span className="font-mono text-[0.625rem] font-medium text-brand-muted w-9 text-right">{Math.round(j.progress)}%</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Decisions log panel (recent trail of Autopilot's work) ──────────────────
function DecisionsLogPanel({ log }) {
  const iconFor = {
    question:  <Icon.Sparkle className="h-3 w-3" />,
    glossary:  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2.5 2h6a1.5 1.5 0 0 1 1.5 1.5v7"/><path d="M2.5 2v7.5A1 1 0 0 0 3.5 10.5h6.5"/><path d="M4.5 4.5h3M4.5 6.5h2"/></svg>,
    memory:    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="2" width="8" height="8" rx="1.5"/><path d="M4 5h4M4 7h3"/></svg>,
    edit:      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 10l3-.8 5-5.2-2-2-5 5.2L2 10Z"/></svg>,
    completed: <Icon.Check className="h-3 w-3" />,
  };
  const toneFor = {
    question:  "bg-brand-accentSoft text-brand-accent",
    glossary:  "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
    memory:    "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    edit:      "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    completed: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-card">
      <header className="flex items-center justify-between border-b border-brand-borderSoft px-4 py-3">
        <h3 className="font-display text-[0.9375rem] font-semibold tracking-display text-brand-text m-0">Decisions log</h3>
        <button className="text-[0.6875rem] font-medium text-brand-muted hover:text-brand-text bg-transparent border-0 cursor-pointer">View all</button>
      </header>
      <ul className="divide-y divide-brand-borderSoft">
        {log.map((d) => (
          <li key={d.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${toneFor[d.type] || "bg-brand-sunken text-brand-muted"}`}>
              {iconFor[d.type] || <span className="h-1 w-1 rounded-full bg-current" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.75rem] leading-snug text-brand-text m-0">{d.text}</p>
              <p className="mt-0.5 font-mono text-[0.625rem] text-brand-subtle m-0">{d.when}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

Object.assign(window, { AutopilotView, AgentAvatar });
