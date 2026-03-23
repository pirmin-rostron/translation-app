# Prompt Template — Page Generation

Use this template every time you ask the AI to build or update a page.
Replace the [BRACKETED] sections with your specifics.

---

## The Prompt

```
Before writing any code, read DESIGN_SYSTEM.md in full.
Every UI decision — buttons, spacing, typography, card states, pane layout — must come from that file.
Do not invent new patterns. If something is not covered, ask before proceeding.

---

Build [PAGE NAME] for the translation app.

Tech stack:
- Next.js 14 App Router, TypeScript (strict, no `any`)
- Tailwind CSS only — no custom CSS unless Tailwind cannot handle it
- Zustand for client UI state, TanStack Query for all server state
- Follow all rules in CLAUDE.md and DESIGN_SYSTEM.md

Page purpose:
[One sentence: what does this page do and who uses it?]

Layout:
[Describe the layout. For review page: three-pane as defined in DESIGN_SYSTEM.md.
For other pages: describe the structure simply.]

Data / props:
[List what data this page needs, e.g.:
- TranslationJob: { id, status, source_language, target_language }
- Blocks: { id, source_text, translated_text, status }[]
- onApprove(blockId): void
- onReject(blockId, reason): void
]

Behaviour:
[List specific interactions, e.g.:
- Active block is highlighted with the `active` state from DESIGN_SYSTEM.md
- Clicking a block sets it as active in Zustand
- Approving a block calls onApprove and moves to next
- Exactly one primary CTA on screen at a time
]

Components to produce:
[List each component file and its responsibility, e.g.:
- app/review/[jobId]/page.tsx — page shell, data fetching via React Query
- components/review/ReviewGuidancePanel.tsx — direction + status only
- components/review/DocumentDiffPane.tsx — source vs target content only
- components/review/ReviewDetailsPane.tsx — decision controls only
]

Constraints:
- Use the three-pane layout exactly as defined in DESIGN_SYSTEM.md
- Block state classes (active/issue/completed/default) must match DESIGN_SYSTEM.md exactly
- One primary button per screen — all other actions are secondary or ghost
- No raw error strings in the UI
- All query keys defined as constants, not inline strings
- Keep API calls in service files, not inline in components
```

---

## Tips for Follow-up Prompts

When asking for changes or additions, always start with:

```
Read DESIGN_SYSTEM.md before making any changes.
Only modify [FILE NAME]. Do not touch other files.
[Your change request here.]
```

When asking the AI to add a new component:

```
Read DESIGN_SYSTEM.md. Add [COMPONENT NAME] to [FILE PATH].
It is responsible for [ONE THING ONLY — no mixed responsibilities].
Use the [button/badge/card] pattern from DESIGN_SYSTEM.md exactly.
Do not add new Tailwind classes that aren't already in the design system.
```
