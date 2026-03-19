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

---

## Golden Rule

If uncertain, prioritise architecture + UX guardrails over shortcuts.
