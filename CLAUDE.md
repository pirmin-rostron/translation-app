# CLAUDE.md — Translation App Project Rules

This file governs all Claude Code behaviour for this project. These rules are strict and always apply.

---

## Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript — strict mode, no `any`
- **UI:** React 18 + Tailwind CSS
- **State Management:** Zustand
- **Server State / Data Fetching:** TanStack Query (React Query v5)
- **Containerisation:** Docker

#### Install commands (if not already installed)
```bash
npm install zustand
npm install @tanstack/react-query
```

### Backend
- **Framework:** Python + FastAPI
- **ORM:** SQLAlchemy + Alembic (migrations)
- **Routers:** `documents`, `glossary_terms`, `translation_jobs`
- **Database:** initialised via `init_db()` on startup
- **CORS:** locked to `http://localhost:3000` — do not change without explicit instruction

#### Install commands (if not already installed)
```bash
pip install sqlalchemy alembic
```

### Stack Rules — Frontend
- Always use TypeScript. Never use `any` — use proper types or `unknown` with guards.
- Use Tailwind utility classes for all styling. Do not create custom CSS unless Tailwind cannot handle it.
- Use Next.js App Router conventions (`app/` directory, server vs client components, layouts).
- Default to server components; only use `"use client"` where interactivity requires it.
- Keep API calls in dedicated service/fetch files — not inline in components.

### Zustand Rules
- Use Zustand for all client-side UI state (active block, review decisions, panel state).
- One store per domain — do not create a single monolithic store.
- Job-scoped state (`translation_job_id`) must be explicitly set and cleared when switching jobs — never carry state between jobs.
- Do not store server data in Zustand — that belongs in React Query.

### React Query Rules
- Use TanStack Query for all server state — translation jobs, documents, glossary terms.
- Define query keys as constants, not inline strings, to avoid cache mismatches.
- Use `invalidateQueries` after mutations to keep UI in sync — do not manually patch cache.
- Set appropriate `staleTime` for glossary terms (infrequently changed) vs job status (frequently polled).
- Never duplicate server data into Zustand — React Query is the single source of truth for API data.

### Stack Rules — Backend
- Follow FastAPI conventions — use Pydantic models for all request/response schemas.
- Keep business logic out of routers — routers handle HTTP only, logic lives in service layers.
- Never modify CORS config without explicit instruction.
- All new endpoints must include a docstring explaining their purpose.
- Use Python type hints on all functions.

### SQLAlchemy + Alembic Rules
- Use SQLAlchemy ORM for all database interactions — no raw SQL unless performance requires it, and flag when doing so.
- All schema changes must go through Alembic migrations — never modify tables directly.
- Generate a new migration for every model change: `alembic revision --autogenerate -m "description"`.
- Never auto-apply migrations in application code — migrations are a manual deployment step.
- Keep models in a dedicated `models/` directory, not inline in routers.

---

## Architecture Separation (Review Page)

- `ReviewGuidancePanel` = direction/status/next-step only.
- `DocumentDiffPane` = document content only.
- `ReviewDetailsPane` = decision controls only.
- Never duplicate responsibilities across these three sections.

---

## State Ownership

- `TranslationJob.status` owns translation/review/export lifecycle.
- `Document.status` owns ingest/parse only.
- Do not merge or cross-drive these status domains.
- Glossary terms are job-agnostic reference data — never treat them as job state.

---

## API Structure

- `documents` router — handles document ingest and parse only.
- `glossary_terms` router — manages reference terminology, not job-specific decisions.
- `translation_jobs` router — owns the full translation/review/export lifecycle.
- Do not cross-call routers in ways that blur these boundaries.
- Frontend fetches must map to these router boundaries — do not create catch-all API wrappers.

### API Contract Rules

- All API calls must go through typed functions in `frontend/app/services/api.ts` — never use inline `apiFetch` calls inside components.
- Every backend endpoint used by a component must have a corresponding typed response interface in `api.ts` that matches the actual backend Pydantic model exactly. Check the backend schema before defining the frontend type.
- Components handle display logic only — no API parsing, shape assumptions, or raw fetch calls.
- When a new backend endpoint is added, the corresponding `api.ts` type and fetch function must be added in the same change.
- Never assume a response is a plain array if the backend returns a paginated wrapper — always check the actual `response_model`.

---

## Rendering Rules

- Translated diff must render full reconstructed block content from ordered segment translations.
- Never use ambiguity/semantic snippet text as the whole block value.
- Exception: if the original block truly contains only one sentence/snippet, single-segment output is valid.
- Review Details must not render full document content.

---

## Translation Quality Guardrails

- Always preserve source block formatting and markup in translated output.
- Never silently drop untranslatable content — flag it explicitly in the UI.
- Glossary terms must be applied consistently across all blocks within a job — surface conflicts, never silently override.
- Maintain consistent terminology across all blocks within a job.
- On partial translation failure: preserve completed blocks, surface the failed block explicitly, do not fail the entire job.
- Translation option text always remains in the target language.
- Explanations and UI language are always English.

---

## Ambiguity Rules

- Ambiguity is valid only when there are 2+ distinct translation options.
- If fewer than 2 valid options exist, treat as non-ambiguity.
- Explanations/meanings must be in English (UI language).
- Translation option text remains in the target language.

---

## Product Naming Conventions

- All user-facing surfaces that expose translation intelligence (glossary matches, semantic memory matches, ambiguity detection, translation memory confidence) must be labelled "Linguistic Insights" — not "glossary match", "semantic match", "memory match", or other internal terms.
- Internal code and backend field names may use technical terms — only the user-facing UI label must use "Linguistic Insights".

---

## Visual Hierarchy Standards

### Layout Structure
- Use a clear page hierarchy: header → primary panel (guidance) → main content → secondary panel (details).
- Keep panel ownership strict: guidance for direction, main content for document context, details for decisions.

### Block/Card Pattern
- Render each review unit as one block/card row.
- Use consistent Tailwind spacing between rows (`gap-*`, `py-*`) and consistent internal padding (`p-*`).
- Show one block label per unit (`Block X`); avoid duplicate headings inside pane content.

### Highlight States
Use Tailwind classes consistently for these states:
- `active`: blue emphasis (highest attention) — e.g. `border-blue-500 bg-blue-50`
- `issue`: yellow emphasis (secondary attention) — e.g. `border-yellow-400 bg-yellow-50`
- `default`: neutral surface and border — e.g. `border-gray-200 bg-white`
- `completed`: muted treatment — e.g. `border-gray-100 bg-gray-50 opacity-60`
- Prefer row-level highlight over noisy inline emphasis unless required by interaction.

### Button Hierarchy
- Exactly one primary CTA per screen/state.
- Secondary actions must be visually de-emphasized (e.g. ghost or text-only buttons).
- Avoid duplicate actions that produce equivalent outcomes.

### Pane System
- Use a consistent left/right pane layout where applicable.
- Keep subtle but clear pane differentiation (e.g. neutral source vs tinted translated pane).
- Maintain vertical alignment between corresponding panes.

### Typography Roles
- Section titles: clear and high-signal (`text-sm font-semibold`).
- Block labels: compact meta markers (`text-xs font-medium text-gray-500`).
- Body text: readable, content-first (`text-sm text-gray-900`).
- Meta text: subdued supporting information (`text-xs text-gray-400`).

### Clarity Rules
- Do not duplicate the same information across guidance, diff, and details panels.
- Use `Block` as canonical review terminology in all user-facing review UI.
- Do not mix `content` or `segment` for the same review unit — `Block` only.
- Prioritise scanability and clarity over density.

---

## UX Rules

- One primary CTA per screen/state; secondary actions must be visually de-emphasized.
- No duplicate progress indicators.
- On review completion: hide block controls and guide user to export.

---

## Error Handling

### Frontend
- Never show raw error objects or stack traces in the UI.
- Surface user-friendly messages with a clear next action.
- On API failure: preserve existing state, do not reset progress.

### Backend
- Return structured error responses with meaningful HTTP status codes.
- Log errors with enough context to debug (job ID, block ID, operation).
- Never return 500 for predictable failure cases — use 400/404/422 appropriately.
- Fail safely on malformed or incomplete data — never silently swallow errors.

---

## Component + Change Discipline

- Modify existing components first; avoid creating parallel render paths.
- Reuse existing utilities/handlers before adding new ones.
- In every response, state which files were edited and why.
- Do not reorganise file structure unless explicitly asked.

---

## Data Integrity

- Review state is job-scoped (`translation_job_id`) only.
- Never reuse approvals/decisions across jobs (memory may suggest, never auto-approve).
- Export must use final reviewed data for the active job only.
- Glossary terms are shared reference data — changes affect all jobs, flag this when relevant.

---

## Delivery Discipline

- Explain what changed, why, and how to test.
- Call out assumptions and edge cases explicitly.
- Fail safely on malformed/incomplete data.
- Keep responses focused — do not refactor unrelated code in the same pass.
- After any backend parser change, always run the parser against all three test RTF files (`basic_test.rtf`, `legal_test.rtf`, `messy_test.rtf`) and verify block output before finishing.
- The frontend runs as a production Next.js build (`next build` + `next start`). `NEXT_PUBLIC_*` environment variables are baked into the bundle at build time — they are not available at runtime. Any new `NEXT_PUBLIC_*` var must be added to: (1) `/app/.env` on the server, (2) `docker-compose.yml` build args, (3) `frontend/Dockerfile` ARG and ENV declarations.

---

## Post-Ticket Self-Review Checklist

- After any change to `backend/main.py` — verify all routers are still registered by running: `curl -s http://localhost:8000/openapi.json | python3 -c "import sys,json; [print(p) for p in sorted(json.load(sys.stdin)['paths'])]"`

---

## MemPalace Memory Protocol

This project uses a MemPalace MCP server as its persistent knowledge graph. Follow this protocol every session.

### On Startup
- Query the MemPalace KG (`mempalace_kg_query`) for recent decisions, architecture changes, and open issues related to the current task context.
- Use retrieved facts to inform suggestions and avoid re-litigating settled decisions.

### During Session
- Record architectural decisions to the KG via `mempalace_kg_add` (e.g. "Pirmin decided_to use X over Y").
- Record significant file changes (created, deleted, renamed) as KG facts with `valid_from` set to today's date.
- When a KG fact becomes outdated, invalidate it via `mempalace_kg_invalidate` rather than leaving stale data.
- Keep triples clean: no special characters (dashes, colons, commas) in the object field — split complex facts into multiple triples if needed.

### On Session End
- Remind Pirmin to run `mempalace mine` so the palace indexes any new file changes from the session.

---

## Obsidian Documentation Protocol

The Obsidian vault at `/Users/pirmin/Documents/Projects/Helvara_obsidian_vault` is the source of truth for all structural platform documentation.

### Write to Obsidian when:
- A new router, service, or data model is created
- An architectural decision is made (why X over Y)
- A component's ownership or responsibility changes
- A new integration is added (external APIs, services, tools)
- A significant bug is found and fixed — document root cause and fix
- Any change that would affect how a new developer understands the system

### What to write:
- Create or update a `.md` file in the vault under the relevant folder
- Keep it current — if something changes, update the existing doc, don't create a duplicate
- Link related docs using Obsidian `[[wikilinks]]`

### What NOT to write:
- Implementation details that are obvious from the code
- Temporary decisions or WIP notes — those go in the KG
- Anything that changes every session

---

## Terminology

Always use these terms consistently in code, comments, UI copy, and conversation. See Obsidian vault/Helvara Terminology.md for the full glossary.

### Key terms
- **Block** — not segment, not content unit
- **Translation Job** — not translation (when referring to the job object)
- **Autopilot mode** — not auto, not quick mode
- **Manual review mode** — not expert mode, not full review
- **Overview** — the post-processing screen (PIR-69)
- **Human override** — when a user rewrites a translated block
- **Reference Document** — training material uploaded by user, not translated
- **Project** — named container for documents + settings

---

## Common Failure Patterns — Always Avoid

### Silent API failures
Never use `.catch(() => [])` or `.catch(() => null)` on API calls in polling loops or critical data fetches. These swallow wrong URLs silently and make bugs invisible — this pattern caused PIR-82 (processing page stuck) and the approve button 404. Always log at minimum:
`.catch((err) => { console.error('[fetch error]', err); return []; })`

### File type list drift
Never define ALLOWED_EXTENSIONS or ALLOWED_EXTS in more than one place. When adding a new upload entry point, import from a shared constant — do not copy-paste the list. This caused PIR-81 (RTF broken in dashboard modal while upload page was correct).

### Alembic migrations on existing data
Always add server_default when adding non-nullable columns to tables that may have existing rows. Autogenerated migrations never include this — always check and fix before applying:
`op.add_column('table', sa.Column('col', sa.String(), nullable=False, server_default='value'))`
This has caused migration failures twice. Check every new non-nullable column before running alembic upgrade head.

### API path mismatches
Always verify the full URL path including router prefix when writing frontend API calls. The translation jobs router has prefix /translation-jobs — endpoints under it are /translation-jobs/{endpoint}, not /{endpoint}. Check main.py for the registered prefix before writing any new API call.

### Auth state lost on page refresh
Zustand stores are in-memory — they reset on every page refresh. Auth tokens must be persisted to localStorage AND cookies:
- localStorage: for Zustand to rehydrate on load (use persist middleware from 'zustand/middleware')
- Cookie: for Next.js middleware to read before Zustand hydrates (middleware runs server-side and can't access localStorage)

On login: set token in Zustand store + document.cookie
On logout: clear both
Middleware reads the cookie, not Zustand

This has happened multiple times. Always check both persistence layers when implementing auth.

### init_db create_all vs Alembic migrations
init_db() calls Base.metadata.create_all() on startup, which creates tables that don't exist. If a new model is added and the server restarts before the migration runs, the table already exists. The migration will then fail with "table already exists".
Fix: ssh to production and run: `docker compose exec -T backend alembic stamp {revision_id}`
This marks the migration as applied without running it.

---

## Golden Rule

If uncertain, prioritise architecture + UX guardrails over shortcuts.
