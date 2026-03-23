# DESIGN_SYSTEM.md — Translation App UI Rules

This file is the single source of truth for all UI decisions.
**Always read this file before generating or modifying any page or component.**
Do not invent new patterns — extend only if explicitly instructed.

---

## Color Palette

Use these Tailwind classes consistently. Do not use arbitrary color values.

| Role | Tailwind class(es) |
|---|---|
| Page background | `bg-gray-50` |
| Panel / card surface | `bg-white` |
| Primary brand | `bg-blue-600` / `text-blue-600` |
| Destructive / error | `bg-red-600` / `text-red-600` |
| Warning / issue | `bg-yellow-400` / `text-yellow-700` |
| Success | `bg-green-600` / `text-green-600` |
| Border default | `border-gray-200` |
| Border active | `border-blue-500` |
| Border issue | `border-yellow-400` |

---

## Typography

Never use arbitrary font sizes. Always use these roles:

| Role | Tailwind classes |
|---|---|
| Page title | `text-lg font-semibold text-gray-900` |
| Section heading | `text-sm font-semibold text-gray-900` |
| Block label / meta marker | `text-xs font-medium text-gray-500` |
| Body text | `text-sm text-gray-900` |
| Supporting / meta text | `text-xs text-gray-400` |
| Link | `text-sm text-blue-600 hover:underline` |

---

## Spacing

Use these consistently. Do not mix ad-hoc padding.

| Context | Classes |
|---|---|
| Page outer padding | `px-6 py-6` |
| Panel inner padding | `p-4` |
| Card inner padding | `p-4` |
| Gap between cards/rows | `gap-3` |
| Gap between panes | `gap-6` |
| Section vertical spacing | `space-y-4` |

---

## Buttons

Exactly **one primary CTA per screen/state**. All others must be secondary or ghost.

### Primary Button
```tsx
<button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
  Label
</button>
```

### Secondary Button
```tsx
<button className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
  Label
</button>
```

### Ghost / Text Button
```tsx
<button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
  Label
</button>
```

### Destructive Button
```tsx
<button className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
  Label
</button>
```

---

## Block / Card States

Every review unit is a **Block card**. Use exactly these state classes — do not invent new ones.

| State | Tailwind classes |
|---|---|
| Default | `border border-gray-200 bg-white rounded-lg` |
| Active | `border border-blue-500 bg-blue-50 rounded-lg` |
| Issue | `border border-yellow-400 bg-yellow-50 rounded-lg` |
| Completed | `border border-gray-100 bg-gray-50 opacity-60 rounded-lg` |

Apply state at the **row / card level**, not inline on text.

---

## Layout — Three-Pane Review Page

```
┌─────────────────────────────────────────────────────────┐
│ Header (page title + job meta)                          │
├──────────────────┬──────────────────────────────────────┤
│ ReviewGuidance   │ DocumentDiffPane  │ ReviewDetailsPane │
│ Panel (left)     │ (centre)          │ (right)           │
│ direction/status │ source vs target  │ decision controls │
└──────────────────┴───────────────────┴───────────────────┘
```

- Left guidance panel: `w-64 shrink-0`
- Centre diff pane: `flex-1 min-w-0`
- Right details pane: `w-72 shrink-0`
- Outer wrapper: `flex gap-6 px-6 py-6 min-h-screen bg-gray-50`

**Panel ownership is strict — never duplicate content across panes.**

---

## Pane Pair (Source / Target)

Used inside `DocumentDiffPane` to show original vs translated content side by side.

```
┌─────────────────────┬──────────────────────────┐
│ Source (neutral)    │ Translated (tinted blue)  │
│ bg-white            │ bg-blue-50/40             │
└─────────────────────┴──────────────────────────┘
```

- Source pane: `bg-white border border-gray-200 rounded-lg p-4`
- Target pane: `bg-blue-50/40 border border-blue-100 rounded-lg p-4`
- Wrapper: `grid grid-cols-2 gap-4`

---

## Status Badge

```tsx
// Variants: 'pending' | 'in_progress' | 'completed' | 'error'
const badge = {
  pending:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  error:       'bg-red-100 text-red-700',
}

<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge[status]}`}>
  {label}
</span>
```

---

## Form Inputs

```tsx
<input
  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
/>

<select
  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
/>
```

---

## Dividers

```tsx
<hr className="border-t border-gray-200" />
```

---

## Empty States

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  {/* Optional icon here */}
  <p className="text-sm font-medium text-gray-900">Nothing here yet</p>
  <p className="mt-1 text-xs text-gray-400">Supporting description.</p>
</div>
```

---

## Error Messages (inline)

```tsx
<p className="text-xs text-red-600 mt-1">Something went wrong. Please try again.</p>
```

Never show raw error objects, stack traces, or API error strings.

---

## Terminology

Use these terms consistently in all user-facing UI strings:

| Use | Never use |
|---|---|
| Block | segment, content, unit |
| Review | approve/reject flow |
| Job | task, project |
| Target language | destination, output language |

---

## What NOT to do

- Do not create custom CSS unless Tailwind cannot handle it
- Do not use arbitrary values like `text-[13px]` or `p-[18px]`
- Do not invent new button variants
- Do not place two primary CTAs on the same screen
- Do not duplicate the same info across guidance, diff, and details panes
- Do not use `any` in TypeScript
- Do not store server data in Zustand
