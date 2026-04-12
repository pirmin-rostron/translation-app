# Helvara Design System

Professional AI translation workspace. Warm editorial surfaces, deep teal accent, Playfair Display headlines, precise Inter UI text.

---

## 1. Visual Theme & Atmosphere

Helvara's interface is a study in warm editorial professionalism — a product handling sensitive business documents that must feel trustworthy, calm, and premium. The page opens with a warm parchment background (#F5F2EC), near-black warm text (#1A110A), and a deep teal accent (#0D7B6E) that signals intelligence and precision without feeling cold.

The typographic system pairs Playfair Display (for moments of meaning — page titles, completion states, value statements) with Inter (for all UI chrome — buttons, labels, navigation, tables). This editorial/UI split is strict and intentional: Playfair Display communicates "something important is happening here," while Inter communicates "here is how to act on it."

Cards and surfaces use rounded-xl (16px) corners with warm parchment backgrounds and subtle warm borders (#E5E0D8). Buttons are always full-pill (rounded-full, 9999px) — this is a Helvara signature. The surface colour is pure white (#FFFFFF) for cards against the warm parchment page, creating depth without shadows.

Key Characteristics:
- Warm parchment page background (#F5F2EC) — never cool grey, never pure white
- Deep teal (#0D7B6E) used sparingly — primary buttons, active states, accent text only
- Playfair Display for headlines and key moments; Inter for all UI text
- Full-pill buttons (9999px radius) — non-negotiable signature shape
- rounded-xl (16px) for all cards and containers
- Warm border colour (#E5E0D8) — never cool grey borders
- One primary action per screen — always. Everything else is secondary or ghost.

---

## 2. Colour Palette & Roles

### Backgrounds
- brand-bg (#F5F2EC): Page background — always, never override
- brand-surface (#FFFFFF): Cards, panels, inputs, modals
- brand-accentMid (#E6F4F2): Accent-tinted backgrounds, highlighted items

### Text
- brand-text (#1A110A): Primary text — headings, body, labels
- brand-muted (#6B6158): Secondary text — descriptions, meta, subheadings
- brand-subtle (#9E9189): Tertiary text — placeholders, captions, timestamps

### Accent
- brand-accent (#0D7B6E): Primary buttons, active nav, accent text links
- brand-accentHov (#0A6459): Hover state on accent elements

### Borders
- brand-border (#E5E0D8): All borders, dividers, table lines

### Status (always use as pairs — background + text together)
- Success: text-status-success (#15803D) + bg-status-successBg (#F0FDF4)
- Warning: text-status-warning (#B45309) + bg-status-warningBg (#FFFBEB)
- Error: text-status-error (#B91C1C) + bg-status-errorBg (#FEF2F2)
- Info: text-status-info (#1D4ED8) + bg-status-infoBg (#EFF6FF)

Rules:
- Never hardcode hex values — always use the token names above as Tailwind classes
- Never use cool greys — all neutrals must be warm
- Never use blue as an accent — teal only
- Never use bg-green-50, text-red-700 etc — always use status.* tokens

---

## 3. Typography Rules

Font Families:
- Display: Playfair Display — class font-display
- UI/Body: Inter — class font-sans (default)

Hierarchy:
- Page title: font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold text-brand-text
- Section headline: font-display text-2xl font-semibold text-brand-text
- Card title: font-display text-lg font-semibold text-brand-text
- Completion/moment headline: font-display text-[1.0625rem] font-semibold text-brand-text
- UI label: text-[0.8125rem] font-medium text-brand-muted
- Body text: text-sm text-brand-text
- Caption/meta: text-xs text-brand-subtle
- Micro label: text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-subtle

Principles:
- Use Playfair Display ONLY for: page titles, section headlines, card titles, completion moments, value statements
- Use Inter for: buttons, labels, nav, tables, form elements, badges, body copy
- Never Playfair Display in buttons, badges, table cells, or form labels
- Three weights only: 400 (read), 500 (interact/label), 600/700 (headline/announce)

---

## 4. Component Stylings

### Buttons

Primary — one per screen, always:
  rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov disabled:opacity-50 transition-colors

Secondary — supporting actions:
  rounded-full border border-brand-border bg-brand-surface px-5 py-2.5 text-sm font-medium text-brand-muted hover:bg-brand-bg transition-colors

Ghost — tertiary, low-emphasis:
  rounded-full px-4 py-2 text-sm font-medium text-brand-muted hover:text-brand-text underline

Destructive — dangerous/irreversible:
  rounded-full bg-status-error px-5 py-2.5 text-sm font-medium text-white hover:opacity-90

Small variant: use px-4 py-1.5 text-xs instead of px-5 py-2.5 text-sm
Large variant: use px-6 py-3 text-base instead of px-5 py-2.5 text-sm

Icon button:
  rounded-full p-2 text-brand-muted hover:bg-brand-bg hover:text-brand-text transition-colors

Rules:
- ALL buttons use rounded-full — never rounded, rounded-lg, or rounded-md
- Never more than one primary button per screen or state
- Disabled: always disabled:opacity-50
- Loading: replace text with "Saving…" or "Loading…", keep disabled

---

### Cards & Panels

Standard card:
  rounded-xl border border-brand-border bg-brand-surface p-6

Compact card:
  rounded-xl border border-brand-border bg-brand-surface p-4

Featured/hero card:
  rounded-xl border border-brand-border bg-brand-surface p-8

Accent-highlighted card (key insights, memory matches):
  rounded-xl border border-brand-accent/30 bg-brand-accentMid/30 p-4 border-l-4 border-l-brand-accent

Success card (completion, post-download):
  rounded-xl border border-status-success/30 bg-status-successBg p-6

Warning card (threshold, caution):
  rounded-xl border border-status-warning/30 bg-status-warningBg p-4

Rules:
- ALWAYS rounded-xl — never rounded-lg, rounded, or rounded-2xl
- ALWAYS border border-brand-border — never shadow-only cards
- Padding: p-6 standard, p-8 featured, p-4 compact

---

### Form Elements

Text input:
  w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 placeholder:text-brand-subtle transition-colors

Select:
  w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 transition-colors

Textarea:
  w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 resize-none transition-colors

Input label:
  block text-[0.8125rem] font-medium text-brand-muted mb-1.5

Error state — add to input:
  border-status-error focus:border-status-error focus:ring-status-error/20

Rules:
- Inputs use rounded-lg — NOT rounded-full (that is buttons only)
- Focus ring always brand-accent coloured
- Labels always above inputs, never floating/inside

---

### Badges & Pills

Language/accent badge:
  rounded-full bg-brand-accentMid px-3 py-1 text-xs font-medium text-brand-accent

Neutral status badge:
  rounded-full bg-brand-bg px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-muted

Success badge:
  rounded-full bg-status-successBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-success

Warning badge:
  rounded-full bg-status-warningBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-warning

Error badge:
  rounded-full bg-status-errorBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-error

Processing badge (animated):
  rounded-full bg-brand-bg px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-muted animate-pulse

Rules:
- All badges rounded-full — pill shape always
- Always pair background + text from the same colour family
- Never raw Tailwind colour names — always status.* tokens

---

### Navigation & Headers

Fixed page header:
  flex h-14 shrink-0 items-center gap-3 border-b border-brand-border bg-brand-surface px-6

Back link:
  text-sm text-brand-subtle no-underline hover:text-brand-text transition-colors
  Format: "← Dashboard" — always ← character, never icon

Header divider:
  text-brand-border mx-2 select-none
  Use | character

Page eyebrow label (above page title):
  text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-accent mb-2
  Examples: "PROJECT", "REVIEW", "SETTINGS"

---

### Tables

Container:
  overflow-hidden rounded-xl border border-brand-border bg-brand-surface

Header cell:
  px-5 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle border-b border-brand-border

Body row (clickable):
  border-b border-brand-border last:border-0 transition-colors hover:bg-brand-bg cursor-pointer

Body row (disabled):
  border-b border-brand-border last:border-0 opacity-60 cursor-not-allowed

Body cell:
  px-5 py-3.5 text-sm text-brand-text

---

## 5. Layout Principles

Spacing:
- Page padding: px-8 py-10
- Section gap: gap-6 or space-y-6
- Card padding: p-6 standard
- Component gap: gap-3 or gap-4
- Tight gap: gap-2

Border Radius Scale:
- rounded-lg (8px): Inputs, selects, textareas ONLY
- rounded-xl (16px): Cards, panels, modals, containers
- rounded-full (9999px): Buttons, badges, pills

Two-column page layout: flex gap-6 with sidebar w-80 shrink-0
Page root: min-h-screen bg-brand-bg

---

## 6. Common Patterns

Section header with accent rule:
  <div class="mb-4 flex items-center gap-3">
    <h2 class="font-display text-lg font-bold text-brand-text">Title</h2>
    <div class="h-0.5 w-8 rounded-sm bg-brand-accent" />
  </div>

Empty state:
  <div class="rounded-xl border border-brand-border bg-brand-surface px-8 py-20 text-center">
    [SVG icon ~48px text-brand-muted]
    <p class="font-display text-2xl font-bold text-brand-text mb-2">Headline</p>
    <p class="text-sm text-brand-muted max-w-sm mx-auto mb-6">Description.</p>
    <button class="rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov">Action</button>
  </div>

Modal:
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div class="w-full max-w-md rounded-xl bg-brand-surface p-6 shadow-xl">
      <h3 class="font-display text-lg font-bold text-brand-text mb-2">Title</h3>
      <p class="text-sm text-brand-muted mb-6">Description.</p>
      <div class="flex justify-end gap-3 mt-6">
        <button class="rounded-full border border-brand-border px-4 py-2 text-sm font-medium text-brand-muted">Cancel</button>
        <button class="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:bg-brand-accentHov">Confirm</button>
      </div>
    </div>
  </div>

Pulsing live indicator:
  <span class="relative flex h-2 w-2">
    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent opacity-75" />
    <span class="relative inline-flex h-2 w-2 rounded-full bg-brand-accent" />
  </span>

Language pair: EN → DE (arrow character, 2-letter uppercase, never "English to German")

---

## 7. Agent Prompt Guide

Quick colour reference:
- Page bg: bg-brand-bg (#F5F2EC)
- Card surface: bg-brand-surface (#FFFFFF)
- Primary text: text-brand-text (#1A110A)
- Secondary text: text-brand-muted (#6B6158)
- Border: border-brand-border (#E5E0D8)
- Accent: bg-brand-accent / text-brand-accent (#0D7B6E)
- Accent tint: bg-brand-accentMid (#E6F4F2)

Example prompts:

"Create a dashboard card: rounded-xl border border-brand-border bg-brand-surface p-6. Title font-display text-lg font-semibold text-brand-text. Body text-sm text-brand-muted. Primary button rounded-full bg-brand-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-accentHov."

"Build a data table: container overflow-hidden rounded-xl border border-brand-border bg-brand-surface. Header cells px-5 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-subtle border-b border-brand-border. Clickable rows hover:bg-brand-bg cursor-pointer transition-colors. Cells px-5 py-3.5 text-sm text-brand-text."

"Design a status badge set: success rounded-full bg-status-successBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-success, warning bg-status-warningBg text-status-warning, error bg-status-errorBg text-status-error, neutral bg-brand-bg text-brand-muted."

"Create a form field: label block text-[0.8125rem] font-medium text-brand-muted mb-1.5. Input w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20."

Iteration rules:
- rounded-full for buttons and badges always
- rounded-xl for cards always
- rounded-lg for inputs always
- Playfair Display for titles only, never buttons or labels
- One primary button per screen
- Warm parchment (#F5F2EC) page background always
- All borders warm (#E5E0D8)

---

## 8. What to Avoid

- rounded-lg on buttons — always rounded-full
- rounded-xl on inputs — always rounded-lg
- Hardcoded hex values — always use brand.* or status.* tokens
- Pure black text — always text-brand-text (#1A110A)
- Pure white page background — always bg-brand-bg (#F5F2EC)
- Cool grey borders — always border-brand-border (#E5E0D8)
- Multiple primary buttons per screen
- Playfair Display in buttons, badges, table cells, labels
- Blue accent — teal only
- bg-green-50, text-red-700 etc — always status.* tokens
- Shadow as primary depth — use borders and bg contrast instead
