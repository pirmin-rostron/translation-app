# Handoff: Helvara Translation Workspace

## Overview
A workspace for a translation platform with AI-assisted ("Autopilot") and Manual translation modes:
1. **Dashboard** — "what needs me right now" (attention queue, live Autopilot status, pinned projects, insights, activity feed)
2. **Autopilot** — agent-as-coworker cockpit: Rumi's feed (questions / decisions / completions), live queue, decisions log
3. **Documents** — flat, filterable cross-project view with a toggle between Documents (one row per file) and Jobs (one row per EN→XX translation)
4. **Projects** — grouped/containerized view of work, and a Project detail page with a block-by-block Review peek
5. **Translation Review** — full-screen block-by-block review surface for an individual job (reached from Dashboard attention rows, Autopilot feed, or Review Peek "Open full review"). Source/target panes, alternative picker for ambiguities, insights rail.

Includes two modals (New Project, New Translation/Upload) and a Tweaks panel (accent color + density).

## About the Design Files
The files in `prototype/` are **design references created in HTML** — a working React prototype using Tailwind via CDN and inline Babel. They show intended look and behavior; they are **not production code to ship directly**.

The task is to **recreate these HTML designs in your existing codebase's environment** (React, Vue, etc.) using the established component library, routing, state management, and styling patterns there. If no environment exists yet, use React + Tailwind to match the prototype 1:1.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions. Implement pixel-perfect.

## Information architecture

| Page | Primary lens | Unit of row | Distinct content |
|---|---|---|---|
| **Dashboard** | "What needs me right now" | Mixed (tasks, activity, pinned) | Attention queue, Autopilot live panel, pinned projects, insights summary, activity |
| **Documents** | "All my work, flat, filterable" | Toggle: Documents ↔ Jobs | Global search/filter; one row = one file OR one translation job |
| **Projects** | "Work grouped by container" | Project card / project detail | Project-scoped stats, docs grouped with jobs inside, project metadata |

Light overlap on stats is intentional; arrangement/lens differs per page.

## Design tokens

### Colors
```
--bg              #FAFAF7  app background
--surface         #FFFFFF  cards, panels
--sunken          #F4F3EE  filter tracks, chips, hover backgrounds
--border          #ECEAE3  panel borders
--border-soft     #F2F0EA  row dividers inside panels
--text            #121210  primary text
--muted           #5A5A55  secondary text
--subtle          #9A9A92  tertiary / labels
--hint            #BEBEB5  icon hints, arrows at rest
--accent          #0D7B6E  (default teal; themable via tweaks: #1D3557, #B04A2E, #5B2B5F)
--accent-hov      #0A6459
--accent-mid      #E6F4F2
--accent-soft     #F0F8F6  tint for pills/rails
```

Status colors:
```
success  #15803D on #F0FDF4
warning  #B45309 on #FFFBEB
error    #B91C1C on #FEF2F2
info     #1D4ED8 on #EFF6FF
```

App background uses a layered radial gradient:
```css
background:
  radial-gradient(1200px 600px at 85% -10%, rgba(13,123,110,0.05), transparent 60%),
  radial-gradient(900px 500px at -5% 110%, rgba(13,123,110,0.03), transparent 70%),
  #FAFAF7;
```

### Typography
- **Sans**: `Inter Tight` (400, 500, 600, 700) — UI, body. Letter-spacing `-0.005em` globally; headings `-0.02em`; display `-0.03em`.
- **Display**: `Fraunces` (500, 600) with `font-feature-settings: 'ss01'` — page titles, stat numbers, panel titles. Use italic variant for the accented word in greetings ("Good afternoon, *Maya*").
- **Mono**: `JetBrains Mono` (400, 500) — language codes, progress %, file sizes.

Type scale in use:
- H1 page title: 2.5rem / 2.75rem (Dashboard), semibold, display, tight tracking
- H2 panel title: 1.0625rem, semibold, display
- Stat number: 1.625rem – 2.25rem, semibold, display
- Body: 0.8125rem – 0.9375rem, Inter Tight
- Metadata: 0.6875rem, often uppercase tracking 0.14em–0.18em

### Radii
`sm 6 · DEFAULT 10 · lg 14 · xl 18 · 2xl 22 · 3xl 28 · full 9999`

### Shadows
```
card:   0 1px 0 rgba(17,17,14,0.04), 0 1px 2px rgba(17,17,14,0.03)
raised: 0 2px 6px -1px rgba(17,17,14,0.05), 0 8px 24px -8px rgba(17,17,14,0.08)
ring:   0 0 0 1px rgba(17,17,14,0.05), 0 1px 2px rgba(17,17,14,0.04)
```

## Shell

### TopBar (56px, sticky)
- Left: logo mark (28×28 rounded-lg bg-text + white icon) + "Helvara" in Fraunces 1.0625rem
- Right: search icon button, primary pill CTA "+ New translation" (bg-text → bg-accent on hover), vertical divider, avatar + name ("Pirmin") with chevron dropdown

### Sidebar (220px)
White/60% backdrop-blur. Sections:
- **WORKSPACE**: Dashboard · Autopilot · Documents · Projects
- **TOOLS**: Glossary · Certified (badge "Soon")
- Pinned to bottom: Settings

Active item: `bg-text text-white` with shadow-card. Rest: `text-muted` with hover `bg-sunken text-text`.
## Sidebar
White/60% backdrop-blur. Sections:
- **WORKSPACE**: Dashboard · Autopilot · Documents · Projects
- **TOOLS**: Glossary · Certified (badge "Soon")
- Pinned to bottom: Settings

Active item: `bg-text text-white` with shadow-card. Rest: `text-muted` with hover `bg-sunken text-text`.
Icons are stroke-based SVG at 18×18 (don't use Unicode glyphs — see `prototype/shell.jsx` for definitions).

## Autopilot page
Agent-as-coworker cockpit. Left column: "Rumi" agent header card (large gradient avatar, name, "Your in-house linguist, working around the clock", chips for working jobs + open questions + Pause Rumi button), 4-cell stats strip (blocks translated / decisions made / asking your call / time you saved), feed with tabbed filter (All / Questions / Decisions / Completed). Feed rows are card-style with avatar, status chip (ASKING / DECIDED / SHIPPED), project · file, language pair, headline, supporting body, and contextual actions (Open review / Trust my picks for questions; undo/audit for decisions). Right column: live queue panel (per-job: file · pair · status label · progress bar · ETA) and decisions log (icon + one-liner + timestamp, "View all" link).

## Translation Review (full-screen)
Reached from Dashboard attention rows, Autopilot feed "Open review" buttons, and the Project detail Review Peek "Open full review" link. Layout:
- **Top bar**: back button → origin view, document name + language pair (mono), completion meter, primary action "Approve & export" (disabled until all ambiguities resolved), secondary "Save draft".
- **Body**: 3-column — left rail of segments with status dots (approved / ambiguity / pending), center source/target pair editor (source read-only, target editable; ambiguity segments show alternative picker with rationale from Rumi), right rail with Insights panel (glossary matches, memory hits, conflicts) and a collapsible Decisions timeline.
- Keyboard: ↑/↓ between segments, Enter to accept, 1–9 to pick alternative.

## Dashboard

**Header**
- Live pill (top): `{N} Autopilot jobs running` with pulsing dot
- H1: "Good afternoon, *Maya*" — the name in Fraunces italic, color accent
- Subhead: "{N} blocks are waiting on you — mostly in **Nova Launch** and **Atlas Newsletter**"
- Right: "New project" (secondary) + "New translation" (primary pill)

**Stats strip** (one card, 4 cells divided by `border-l border-border-soft`)
Active projects · In progress · Needs review (accent) · Words this month

**Two-column body (1.5fr / 1fr)**

Left column:
1. **Needs your attention** — panel. Row: square counter tile (accent-soft bg + accent ring) + document / project + language pair (mono) + age + arrow (translate-x on hover). Accent-soft pill in header with sparkle icon + count.
2. **Autopilot running** — gradient panel (accent-soft → surface). Decorative blurred accent blob top-right. Rows: file name + lang pair (mono) · % · progress bar (gradient accent → accent-hov, white track with inset ring) · ETA.

Right column:
1. **Pinned** — per-project row with name, `N docs · N jobs · N review` meta, then progress bar (text-colored fill).
2. **Linguistic insights** — 2×2 grid (Glossary terms / Conflicts / Memory matches / Ambiguity rate), divided with `divide-x divide-y`.
3. **Recent activity** — icon (colored ring) + text + meta · time.

## Documents

**Header**: Eyebrow "Workspace" · H1 "Documents" · subtitle `{N} files · {N} translation jobs across {N} projects`.

**Filter bar**:
- Pill toggle (Documents / Jobs) with tabular count chips
- Search input with inline search icon (rounded-full, shadow-card, focus ring accent/15)
- Project filter select (custom chevron)
- Status filter select (jobs mode only)

**Documents table** — columns: Document (file-ext chip + name + translations count) · Project · Words (mono right) · Languages (target-code chips) + "N review" pill · Uploaded
**Jobs table** — columns: Document · Project · Language (mono `EN → ES`) · Status (dot + label, inline progress for processing) · Flags (amb / ins pills) · Mode

File extension chip: 32×32 rounded-lg with ring-1 ring-inset. Color-coded: DOCX blue, RTF violet, TXT slate.

Job status chip palette:
- in_review → accent-soft / accent
- completed/exported → emerald-50 / emerald-700
- processing → amber-50 / amber-700
- pending → sunken / subtle

## Projects

**Header**: Eyebrow "Workspace" · H1 "Projects" · subtitle about containers.

**Stats strip** (same pattern as Dashboard): Total projects · Documents · In review · Overall progress (with bar).

**Pill filter**: All N / Active / Completed / Empty.

**Project card** (2-column grid, gap-5):
- Hover: `-translate-y-0.5` + shadow-raised. Left accent rail appears on hover (`absolute inset-y-0 left-0 w-0.5 bg-accent`).
- Header: project name (Fraunces 1.25rem semibold, line-clamp-1) + derived status pill (In progress / Due soon / Overdue / Completed / No documents).
- If pinned: sparkle + "Pinned" label in accent.
- 2-line description.
- Language chips (border + bg-sunken/60, language code in mono + full name).
- Stats tray (rounded-xl bg-sunken/50, 4 micros): Docs / Words / Done / Review.
- Progress: thin 1px bar, gradient fill accent → accent-hov, with label + mono %.

## Project detail (existing, not restyled in last pass)
See `prototype/project_detail.jsx` and `prototype/review_peek.jsx`. The review peek expands inline under a job row with real block-by-block review — source/target pairs, status (approved / ambiguity / pending), alternative picker for ambiguity blocks, Linguistic Insights panel.

## Interactions
- Sidebar nav switches main view (persisted to localStorage `helvara_nav`).
- Project card / attention row / pinned row → navigate to project detail.
- New project modal: name + description + languages (multi-select) + due date.
- New translation modal: project picker (or pre-filled from context) · drag-drop file area · languages · Autopilot/Manual toggle.
- Review peek: click an `in_review` job row to expand. Ambiguity blocks show alternative picker, other blocks approved/pending.

Animations: `fadein 150ms`, `scalein 180ms cubic-bezier(0.22,1,0.36,1)`, `slideup` for toast, `slidedown` for expanding peeks. Progress bars `transition-[width] duration-700`. Arrow icons `translate-x-0.5` on group-hover.

## State shape
```ts
{
  view: "dashboard" | "documents" | "projects" | "project" | "autopilot" | "review",
  projectId: number | null,
  reviewJobId: number | null,
  projects: Project[],
  modal: null | "new-project" | "new-translation",
  modalContext: { projectId?: number } | null,
  toast: string | null,
  tweaksOpen: boolean,
}

Project = {
  id, name, description, due_date, target_languages: string[],
  pinned: boolean, document_count: number,
  stats: { total_jobs, completed_count, in_review_count, total_words },
  documents: Document[]
}
Document = { id, name, words, uploaded, jobs: Job[] }
Job = { id, source, target, status: "pending"|"processing"|"in_review"|"completed"|"exported",
        ambiguities, insights, progress, autopilot }
```

See `prototype/data.jsx` for complete fixtures including attention queue, activity feed, autopilot running jobs, insights summary, and review block data.

## Files
- `prototype/Helvara Projects.html` — self-contained runnable prototype (open in a browser; no build step)
- `prototype/data.jsx` — fixtures (projects, documents, jobs, attention queue, activity feed, autopilot running jobs, insights summary, review blocks, autopilot feed, translation review data)
- `prototype/shell.jsx` — Icons, Sidebar, TopBar, AppShell, Modal, StatusBadge, PageHeader
- `prototype/dashboard_view.jsx`
- `prototype/autopilot_view.jsx` — Rumi agent header, stats, feed with filter tabs, live queue, decisions log
- `prototype/documents_view.jsx`
- `prototype/projects_view.jsx`
- `prototype/project_detail.jsx`
- `prototype/review_peek.jsx` — inline block-by-block expansion under a job row
- `prototype/translation_review_view.jsx` — full-screen review page
- `prototype/app.jsx` — state reducer + routing + Tweaks panel
