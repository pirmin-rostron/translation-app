// Shared UI bits for the Helvara prototype

const { useState, useEffect, useRef, useMemo, createContext, useContext } = React;

// ── Icons (proper SVG, not glyphs) ─────────────────────────────────────────
const Icon = {
  Dashboard: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2.5" y="2.5" width="6.5" height="8" rx="1.5" />
      <rect x="11" y="2.5" width="6.5" height="5" rx="1.5" />
      <rect x="11" y="9.5" width="6.5" height="8" rx="1.5" />
      <rect x="2.5" y="12.5" width="6.5" height="5" rx="1.5" />
    </svg>
  ),
  Documents: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 2.5h6l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" />
      <path d="M11 2.5V6.5h4" />
      <path d="M7 10h6M7 13h6M7 16h4" />
    </svg>
  ),
  Projects: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2.5 6a2 2 0 0 1 2-2h3.5l2 2h5.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V6Z" />
    </svg>
  ),
  Autopilot: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10 2.5v2M10 15.5v2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M2.5 10h2M15.5 10h2M4.4 15.6l1.4-1.4M14.2 5.8l1.4-1.4" />
      <circle cx="10" cy="10" r="3" />
    </svg>
  ),
  Glossary: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 3.5h9a3 3 0 0 1 3 3v10.5" />
      <path d="M4 3.5v12a1.5 1.5 0 0 0 1.5 1.5h10.5" />
      <path d="M7 7h6M7 10h4" />
    </svg>
  ),
  Certified: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10 2.5l1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6L10 2.5Z" />
    </svg>
  ),
  Settings: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M16.5 10a6.5 6.5 0 0 0-.1-1.1l1.7-1.3-1.6-2.8-2 .7a6.5 6.5 0 0 0-1.9-1.1l-.3-2.1h-3.2l-.3 2.1a6.5 6.5 0 0 0-1.9 1.1l-2-.7-1.6 2.8 1.7 1.3a6.5 6.5 0 0 0 0 2.2l-1.7 1.3 1.6 2.8 2-.7a6.5 6.5 0 0 0 1.9 1.1l.3 2.1h3.2l.3-2.1a6.5 6.5 0 0 0 1.9-1.1l2 .7 1.6-2.8-1.7-1.3c.07-.36.1-.73.1-1.1Z" />
    </svg>
  ),
  Plus: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  ),
  Search: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.5 13.5 3 3" />
    </svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 10h10M11 6l4 4-4 4" />
    </svg>
  ),
  Sparkle: (p) => (
    <svg viewBox="0 0 20 20" fill="currentColor" {...p}>
      <path d="M10 1.5l1.6 4.8a3 3 0 0 0 1.9 1.9l4.8 1.6-4.8 1.6a3 3 0 0 0-1.9 1.9L10 16.4l-1.6-4.7a3 3 0 0 0-1.9-1.9L1.7 8.2l4.8-1.6a3 3 0 0 0 1.9-1.9L10 1.5Z" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  ),
};

// ── Language helpers ────────────────────────────────────────────────────────
const LANGS = {
  "en":     { flag: "🇺🇸", name: "English",            code: "EN" },
  "en-US":  { flag: "🇺🇸", name: "English",            code: "EN" },
  "es-ES":  { flag: "🇪🇸", name: "Spanish (Spain)",    code: "ES" },
  "es-MX":  { flag: "🇲🇽", name: "Spanish (Mexico)",   code: "MX" },
  "fr-FR":  { flag: "🇫🇷", name: "French",             code: "FR" },
  "de-DE":  { flag: "🇩🇪", name: "German",             code: "DE" },
  "pt-BR":  { flag: "🇧🇷", name: "Portuguese (Brazil)", code: "BR" },
  "it-IT":  { flag: "🇮🇹", name: "Italian",            code: "IT" },
  "ja-JP":  { flag: "🇯🇵", name: "Japanese",           code: "JP" },
};
const lang = (c) => LANGS[c] || { flag: "🏳", name: c, code: c.toUpperCase() };

// ── Status badge ────────────────────────────────────────────────────────────
const STATUS = {
  pending:    { bg: "bg-brand-bg",         text: "text-brand-muted",    label: "Pending" },
  processing: { bg: "bg-status-infoBg",    text: "text-status-info",    label: "Translating" },
  in_review:  { bg: "bg-brand-accentMid",  text: "text-brand-accent",   label: "In Review" },
  completed:  { bg: "bg-status-successBg", text: "text-status-success", label: "Completed" },
  exported:   { bg: "bg-status-successBg", text: "text-status-success", label: "Exported" },
  failed:     { bg: "bg-status-errorBg",   text: "text-status-error",   label: "Failed" },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  const isProc = status === "processing";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium ${s.bg} ${s.text}`}>
      {isProc && (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {s.label}
    </span>
  );
}

// ── Derived project badge ───────────────────────────────────────────────────
function deriveProjectBadge(p) {
  const s = p.stats;
  if (p.document_count === 0) return { label: "No documents", classes: "bg-brand-bg text-brand-subtle" };
  if (s.total_jobs > 0 && s.completed_count >= s.total_jobs) return { label: "✓ Completed", classes: "bg-status-successBg text-status-success" };
  if (p.due_date) {
    const due = new Date(p.due_date);
    const now = new Date("2026-04-22");
    const diff = Math.ceil((due - now) / 86400000);
    if (diff < 0) return { label: "Overdue", classes: "bg-status-errorBg text-status-error" };
    if (diff <= 7) return { label: "⚠ Due soon", classes: "bg-status-warningBg text-status-warning" };
  }
  return { label: "In progress", classes: "bg-status-infoBg text-status-info" };
}

// ── App shell (sidebar + topbar) ────────────────────────────────────────────
const NAV_WORKSPACE = [
  { key: "dashboard", label: "Dashboard", icon: "Dashboard" },
  { key: "autopilot", label: "Autopilot", icon: "Autopilot" },
  { key: "documents", label: "Documents", icon: "Documents" },
  { key: "projects",  label: "Projects",  icon: "Projects" },
];
const NAV_TOOLS = [
  { key: "glossary",  label: "Glossary",  icon: "Glossary" },
  { key: "certified", label: "Certified", icon: "Certified", badge: "Soon" },
];

function Sidebar({ active, onNavigate }) {
  const link = (item, isActive) => {
    const IconCmp = Icon[item.icon] || (() => null);
    return (
      <a
        key={item.key}
        href="#"
        onClick={(e) => { e.preventDefault(); onNavigate && onNavigate(item.key); }}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.8125rem] no-underline transition-all ${
          isActive
            ? "bg-brand-text font-medium text-white shadow-card"
            : "text-brand-muted hover:bg-brand-sunken hover:text-brand-text"
        }`}
      >
        <IconCmp className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 tracking-tight">{item.label}</span>
        {item.badge && (
          <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium ${isActive ? "bg-white/15 text-white/80" : "bg-brand-sunken text-brand-subtle"}`}>
            {item.badge}
          </span>
        )}
      </a>
    );
  };
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-brand-border bg-brand-surface/60 backdrop-blur-sm">
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2.5 px-3 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-brand-hint">Workspace</p>
        <nav className="space-y-0.5">{NAV_WORKSPACE.map((i) => link(i, active === i.key))}</nav>
        <p className="mb-2.5 mt-7 px-3 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-brand-hint">Tools</p>
        <nav className="space-y-0.5">{NAV_TOOLS.map((i) => link(i, active === i.key))}</nav>
      </div>
      <div className="border-t border-brand-border px-3 py-3">
        {link({ key: "settings", label: "Settings", icon: "Settings" }, active === "settings")}
      </div>
    </aside>
  );
}

function TopBar({ onNewTranslation, onGoHome }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-brand-border bg-brand-surface/80 px-6 backdrop-blur">
      <button onClick={onGoHome} className="group flex items-center gap-2 bg-transparent border-0 p-0 cursor-pointer">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-text text-white">
          <svg viewBox="0 0 20 20" className="h-4 w-4"><path d="M4 3h3v14H4zM13 3h3v14h-3zM7 9h6v2H7z" fill="currentColor"/></svg>
        </span>
        <span className="font-display text-[1.0625rem] font-semibold tracking-display text-brand-text">Helvara</span>
      </button>
      <div className="flex items-center gap-2">
        <button type="button" className="rounded-full p-2 text-brand-muted hover:bg-brand-sunken hover:text-brand-text transition-colors" title="Search">
          <Icon.Search className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={onNewTranslation}
          className="flex items-center gap-1.5 rounded-full bg-brand-text px-3.5 py-1.5 text-[0.8125rem] font-medium text-white hover:bg-brand-accent transition-colors"
        >
          <Icon.Plus className="h-3.5 w-3.5" /> New translation
        </button>
        <div className="mx-1 h-6 w-px bg-brand-border" />
        <div ref={ref} className="relative">
          <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-full px-2 py-1 text-sm text-brand-text hover:bg-brand-sunken transition-colors">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-accent to-brand-accentHov text-xs font-semibold text-white">P</span>
            <span className="font-medium">Pirmin</span>
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-brand-subtle" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {open && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-raised">
              <div className="block w-full px-4 py-2.5 text-left text-sm text-brand-text hover:bg-brand-sunken cursor-pointer">Profile & account</div>
              <div className="block w-full px-4 py-2.5 text-left text-sm text-brand-text hover:bg-brand-sunken cursor-pointer">Preferences</div>
              <div className="border-t border-brand-border" />
              <div className="block w-full px-4 py-2.5 text-left text-sm text-status-error hover:bg-brand-sunken cursor-pointer">Log out</div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function AppShell({ active, onNewTranslation, onGoHome, onNavigate, children }) {
  return (
    <div className="flex min-h-screen flex-col app-bg">
      <TopBar onNewTranslation={onNewTranslation} onGoHome={onGoHome} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar active={active} onNavigate={onNavigate} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

// ── Page header ─────────────────────────────────────────────────────────────
function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6">
      <div>
        {eyebrow && <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-accent">{eyebrow}</p>}
        <h1 className="font-display text-[2rem] font-bold leading-tight text-brand-text m-0">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-brand-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Modal overlay ───────────────────────────────────────────────────────────
function Modal({ open, onClose, children, maxWidth = "max-w-md" }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/30 backdrop-blur-sm p-6 animate-fadein" onClick={onClose}>
      <div
        className={`w-full ${maxWidth} rounded-[22px] border border-brand-border bg-brand-surface p-7 shadow-raised animate-scalein`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Toast ───────────────────────────────────────────────────────────────────
function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface/95 backdrop-blur-md px-4 py-2.5 text-[0.8125rem] font-medium text-brand-text shadow-raised animate-slideup">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-accentSoft text-brand-accent">
        <Icon.Check className="h-3 w-3" />
      </span>
      {message}
    </div>
  );
}

Object.assign(window, {
  Icon, lang, LANGS, STATUS, StatusBadge, deriveProjectBadge,
  Sidebar, TopBar, AppShell, PageHeader, Modal, Toast,
});
