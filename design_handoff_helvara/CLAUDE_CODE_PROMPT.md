# Claude Code prompt — implement the Helvara workspace redesign

Paste the block below into Claude Code from the root of your Helvara repo. The `design_handoff_helvara/` folder should be in the repo (or copied to a path you pass in — adjust the first paragraph accordingly).

---

## Prompt

You're going to implement a redesign of the Helvara translation workspace using the design reference in `design_handoff_helvara/`. That folder contains:

- `README.md` — the design spec (tokens, IA per page, component patterns, state shape, interactions)
- `prototype/Helvara Projects.html` — a self-contained runnable React prototype (open it in a browser with no build step to see the target behavior end-to-end)
- `prototype/*.jsx` — the source files behind the prototype, split by page (`dashboard_view.jsx`, `documents_view.jsx`, `projects_view.jsx`, `project_detail.jsx`, `autopilot_view.jsx`, `translation_review_view.jsx`, `review_peek.jsx`), plus `shell.jsx` (Icons, Sidebar, TopBar, AppShell, Modal, StatusBadge, PageHeader), `data.jsx` (fixtures), and `app.jsx` (state reducer + routing + Tweaks panel)

**Treat the prototype as a visual and behavioral spec, not code to ship.** The prototype uses Tailwind via CDN and inline Babel — that's fine for a reference, but the production implementation must go through our existing build pipeline, component library, routing, and data layer. Match the prototype 1:1 on look, layout, spacing, typography, color, motion, and interaction semantics.

### Step 1 — Orient yourself
1. Read `design_handoff_helvara/README.md` in full.
2. Open the prototype HTML file mentally by reading each `prototype/*.jsx` to understand how pages compose.
3. Then audit the current codebase:
   - `ls` the frontend root, identify the framework (React / Next / Vue), the component library location, the styling system (Tailwind config? CSS modules? styled-components?), the router, and the data-fetching layer.
   - Find the existing equivalents of: app shell, sidebar, top bar, dashboard, documents page, projects page, project detail page, translation/review UI. List what exists vs. what needs to be created.
4. Produce a short implementation plan (file-by-file) before writing any code. Wait for confirmation if anything in the plan is ambiguous or conflicts with existing patterns.

### Step 2 — Set up design tokens
Add the design tokens from the handoff README to the existing token system (Tailwind config, CSS variables, or theme object — whichever this codebase already uses). Tokens to land:

- **Colors**: `--bg #FAFAF7`, `--surface #FFFFFF`, `--sunken #F4F3EE`, `--border #ECEAE3`, `--border-soft #F2F0EA`, `--text #121210`, `--muted #5A5A55`, `--subtle #9A9A92`, `--hint #BEBEB5`, `--accent #0D7B6E`, `--accent-hov #0A6459`, `--accent-mid #E6F4F2`, `--accent-soft #F0F8F6`, plus status pairs for success/warning/error/info (see README).
- **App background**: the layered radial gradient from README.
- **Fonts**: Inter Tight (UI), Fraunces with `ss01` feature (display — italic for accented words), JetBrains Mono (language codes / progress %). Letter-spacing: `-0.005em` global, `-0.02em` headings, `-0.03em` display.
- **Radii**: sm 6 / DEFAULT 10 / lg 14 / xl 18 / 2xl 22 / 3xl 28.
- **Shadows**: `card`, `raised`, `ring` — exact values in README.
- **Animations**: `fadein`, `scalein` (cubic-bezier(0.22,1,0.36,1)), `slideup` (toast), `slidedown` (expanding peeks). Progress bars use `transition: width 700ms`.

If the repo already has tokens, map theirs to these values — don't duplicate or invent parallel names. Pull every hex, radius, and shadow from the prototype's `<style>` block and Tailwind config inside `Helvara Projects.html`; don't eyeball them.

### Step 3 — Implement pages in this order
Ship each page as an independent unit and verify against the prototype before moving on.

1. **Shell** (TopBar + Sidebar + routing). Sidebar order: Dashboard · Autopilot · Documents · Projects under WORKSPACE; Glossary · Certified (badge "Soon") under TOOLS; Settings pinned bottom. Persist nav location in localStorage (`helvara_nav`). TopBar: logo mark + wordmark, search icon, primary "+ New translation" CTA, avatar dropdown.
2. **Dashboard** — header greeting ("Good afternoon, *Maya*" with the name in Fraunces italic accent), live Autopilot pill, stats strip (4 cells divided by `border-l`), two-column body (attention queue + Autopilot running panel on the left; pinned projects + linguistic insights grid + recent activity on the right).
3. **Projects index** — stats strip, pill filter (All / Active / Completed / Empty), project cards in a 2-col grid with hover `-translate-y-0.5` + left accent rail + status pill + language chips + stats tray + thin progress bar.
4. **Project detail** — project header, document list with jobs nested underneath, **Review Peek** that expands inline beneath an `in_review` job row (block-by-block source/target, alternative picker for ambiguities, insights panel, "Open full review" link).
5. **Documents** — pill toggle (Documents / Jobs), search with inline icon (rounded-full, shadow-card, accent/15 focus ring), project filter, status filter (jobs mode only), the two table variants with the exact columns from README. File-ext chips (DOCX blue / RTF violet / TXT slate) and job status chip palette per README.
6. **Autopilot page** — agent cockpit. Rumi header card (large gradient avatar, name, "Your in-house linguist, working around the clock", working-jobs / open-questions chips, "Pause Rumi"), 4-cell stats strip, feed with filter tabs (All / Questions / Decisions / Completed) rendering card rows with status chips (ASKING / DECIDED / SHIPPED) and contextual actions (Open review / Trust my picks / undo / audit). Right column: live queue (file · pair · status · progress bar · ETA) and decisions log.
7. **Translation Review (full-screen)** — reached from Dashboard attention rows, Autopilot feed "Open review" buttons, and Project detail Review Peek "Open full review". Top bar with back-to-origin, document name + language pair, completion meter, "Approve & export" (disabled until all ambiguities resolved), "Save draft". 3-column body: segment rail (status dots), source/target editor (source read-only, target editable, ambiguity segments show alternative picker with Rumi's rationale), insights rail (glossary / memory / conflicts) + collapsible decisions timeline. Keyboard: ↑/↓ between segments, Enter to accept, 1–9 to pick alternative.
8. **Modals** — New Project (name, description, languages multi-select, due date) and New Translation (project picker or pre-filled from context, drag-drop file area, languages, Autopilot/Manual toggle).

### Step 4 — Wire data
The prototype uses in-memory fixtures in `data.jsx`. Map each fixture shape to the real API models:

- `Project { id, name, description, due_date, target_languages[], pinned, document_count, stats { total_jobs, completed_count, in_review_count, total_words }, documents[] }`
- `Document { id, name, words, uploaded, jobs[] }`
- `Job { id, source, target, status: "pending"|"processing"|"in_review"|"completed"|"exported", ambiguities, insights, progress, autopilot }`
- Autopilot feed items, live queue items, decisions log entries, attention queue, insights summary, review blocks, translation review segments — see `data.jsx` for the exact shape of each.

If an API doesn't exist yet for a fixture (e.g. Autopilot decisions log), stub the endpoint returning the fixture shape and leave a `TODO` for the backend, but build the UI against the real data layer (React Query / RTK Query / whatever this repo uses), not against imported fixtures.

### Step 5 — Interactions, keyboard, motion
- Sidebar nav switches main view; persist to `helvara_nav` in localStorage so the user lands back where they left.
- Project card / attention row / pinned row → project detail.
- Review Peek: click an `in_review` job row to expand inline; ambiguity blocks show alternative picker with rationale.
- Translation Review keyboard: ↑/↓ between segments, Enter to accept current target, number keys 1–9 to pick an alternative.
- Toasts: `slideup`, auto-dismiss after 3000ms.
- Respect existing a11y patterns — all interactive elements reachable by keyboard, focus rings visible on `:focus-visible`, aria-labels on icon-only buttons.

### Step 6 — QA checklist
Before declaring done, verify each of these against the prototype side-by-side:

- [ ] Token values match exactly (pick 3 elements per page and compare computed color / bg / border / shadow).
- [ ] Fraunces ss01 feature is active on display text; italic appears on the greeting name.
- [ ] JetBrains Mono is used for language codes, progress %, file sizes — never Inter.
- [ ] All status chips use the exact palette from README (no ad-hoc green/red).
- [ ] File-ext chips are color-coded DOCX blue / RTF violet / TXT slate.
- [ ] Sidebar active state = `bg-text text-white` with shadow-card; inactive = `text-muted`, hover `bg-sunken text-text`.
- [ ] Project cards have hover lift + left accent rail + `shadow-raised`.
- [ ] Progress bars transition width over 700ms.
- [ ] Review Peek and Translation Review both render ambiguity alternative pickers.
- [ ] Keyboard shortcuts work in Translation Review.
- [ ] No Unicode-glyph icons — stroke-based SVG only (copy `Icon` definitions from `shell.jsx` if you don't have equivalents).
- [ ] No console warnings or TypeScript errors.
- [ ] Responsive down to 1280px without layout breakage (desktop-first — mobile is out of scope for this pass unless README says otherwise).

### Constraints
- **Don't ship the prototype HTML or JSX files to production.** They're reference.
- **Don't pull Tailwind CDN or inline Babel into production** — use the existing build pipeline.
- **Don't invent component APIs that conflict with existing ones.** If the codebase has a `<Button>`, reuse it and extend its variants rather than creating a parallel one.
- **Don't change backend contracts without a TODO explaining why** — if a fixture can't be mapped to the real API, flag it explicitly rather than silently reshaping data.
- **One page per PR if the branch model supports it**, otherwise one commit per page with a clear message so this can be reviewed incrementally.

Start with Step 1.
