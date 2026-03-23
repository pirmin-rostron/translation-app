# Helvara Design System

This document defines the visual language, tokens, and component rules for Helvara.
It is the source of truth for all UI work — reference it when building or reviewing any page.

---

## Visual Reference

Inspired by Heidi Health (heidihealth.com): warm off-white backgrounds, dark brown/near-black text,
serif display headlines, Helvetica UI text, generous whitespace, confident minimal layout.
Adapted for legal/translation context: teal accent instead of yellow, slightly more formal tone.

---

## Colour Tokens

Define these in `tailwind.config.js` under `theme.extend.colors`:

```js
colors: {
  brand: {
    bg:        '#F5F2EC',  // warm off-white — primary page background
    surface:   '#FFFFFF',  // card/panel surfaces
    border:    '#E5E0D8',  // subtle borders
    text:      '#1A110A',  // near-black (warm) — primary text
    muted:     '#6B6158',  // secondary/muted text
    subtle:    '#9E9189',  // placeholder, disabled text
    accent:    '#0D7B6E',  // deep teal — primary CTA, links, highlights
    accentHov: '#0A6459',  // teal hover state
    accentMid: '#E6F4F2',  // teal tint — badge backgrounds, hover surfaces
  },
  status: {
    success:   '#15803D',
    successBg: '#F0FDF4',
    warning:   '#B45309',
    warningBg: '#FFFBEB',
    error:     '#B91C1C',
    errorBg:   '#FEF2F2',
    info:      '#1D4ED8',
    infoBg:    '#EFF6FF',
  },
}
```

---

## Typography

### Font Stack

```css
/* UI font — system Helvetica, no web font load required */
--font-ui: 'Helvetica Neue', Helvetica, Arial, sans-serif;

/* Display font — serif for hero headlines only */
/* Option 1 (free): Playfair Display via Google Fonts */
/* Option 2 (premium): Canela or Editorial New */
--font-display: 'Playfair Display', Georgia, serif;
```

In `tailwind.config.js`:
```js
fontFamily: {
  sans: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
  display: ['Playfair Display', 'Georgia', 'serif'],
}
```

### Type Scale

| Role | Class | Size | Weight | Usage |
|------|-------|------|--------|-------|
| Hero | `font-display text-6xl font-bold` | 60px+ | 700 | Landing page headlines only |
| H1 | `text-3xl font-semibold` | 30px | 600 | Page titles |
| H2 | `text-2xl font-semibold` | 24px | 600 | Section headings |
| H3 | `text-lg font-semibold` | 18px | 600 | Card headings |
| Body | `text-sm` | 14px | 400 | Default body text |
| Small | `text-xs` | 12px | 400 | Labels, meta, captions |
| Label | `text-xs font-medium uppercase tracking-wide` | 12px | 500 | Form labels, filter chips |

---

## Spacing

Use Tailwind's default spacing scale. Key conventions:
- Page horizontal padding: `px-6` (mobile) → `px-12` (desktop)
- Section vertical padding: `py-16` → `py-24`
- Card internal padding: `p-5` or `p-6`
- Between related elements: `gap-3` or `gap-4`
- Between sections: `gap-8` or `gap-12`

---

## Border Radius

```js
borderRadius: {
  DEFAULT: '8px',   // cards, inputs, modals
  sm:      '4px',   // badges, chips
  lg:      '12px',  // large cards
  xl:      '16px',  // modals, drawers
  full:    '9999px', // pills, avatars
}
```

---

## Shadows

```js
boxShadow: {
  sm:  '0 1px 2px 0 rgba(26, 17, 10, 0.05)',
  md:  '0 4px 6px -1px rgba(26, 17, 10, 0.08)',
  lg:  '0 10px 15px -3px rgba(26, 17, 10, 0.10)',
  xl:  '0 20px 25px -5px rgba(26, 17, 10, 0.12)',
}
```

---

## Components

### Button

**Primary**
```
bg-brand-accent text-white rounded-full px-5 py-2.5 text-sm font-medium
hover:bg-brand-accentHov transition-colors
disabled:opacity-50 disabled:cursor-not-allowed
```

**Secondary**
```
border border-brand-border text-brand-text bg-white rounded-full px-5 py-2.5 text-sm font-medium
hover:bg-brand-bg transition-colors
```

**Ghost**
```
text-brand-accent text-sm font-medium hover:underline
```

**Destructive**
```
bg-status-error text-white rounded-full px-5 py-2.5 text-sm font-medium
hover:bg-red-700 transition-colors
```

### Input / Textarea

```
w-full border border-brand-border rounded-lg px-3 py-2.5 text-sm
bg-white text-brand-text placeholder:text-brand-subtle
focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent
```

**Underline style (landing page only)**
```
border-0 border-b border-brand-border rounded-none bg-transparent px-0 py-2 text-sm
focus:outline-none focus:border-brand-accent transition-colors
```

### Card

```
bg-white border border-brand-border rounded-xl p-5 shadow-sm
```

### Badge

```
inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium
```

Variants:
- Default: `bg-brand-bg text-brand-muted`
- Accent: `bg-brand-accentMid text-brand-accent`
- Success: `bg-status-successBg text-status-success`
- Warning: `bg-status-warningBg text-status-warning`
- Error: `bg-status-errorBg text-status-error`

### Navigation

```
fixed top-0 w-full bg-brand-bg/90 backdrop-blur-sm border-b border-brand-border z-50
```

Brand name: `font-sans text-lg font-semibold text-brand-text tracking-tight`

---

## Layout Patterns

### Page wrapper
```
min-h-screen bg-brand-bg text-brand-text font-sans
```

### Section container
```
max-w-5xl mx-auto px-6 py-16
```

### Two-column split (review page)
```
grid grid-cols-2 gap-6
```

### Three-column feature row
```
grid grid-cols-3 gap-8
```

---

## Landing Page Content Structure

Based on Heidi Health reference — adapt for Helvara:

1. **Nav** — Logo left, links centre, Login + CTA right
2. **Hero** — Large serif headline, one-line descriptor, waitlist form
3. **Social proof** — "Trusted by [org logos]" or compliance badges
4. **Feature row** — 3 cards: AI translation / Human review / Team glossaries
5. **How it works** — 3-step visual: Upload → Review → Export
6. **Compliance/Security** — SOC2, ISO27001, GDPR badges (when certified)
7. **CTA section** — "Ready to translate with confidence?" + waitlist form repeat
8. **Footer** — © Helvara · Privacy · Terms · Contact

---

## Compliance Badges to display (when certified)

- SOC 2 Type II
- ISO 27001
- GDPR Compliant
- IRAP (AU gov)

Display as: small monochrome icon + label, in a grid, matching Heidi Health's certification section style.

---

## Voice & Tone

- **Confident, not boastful** — "Built for precision" not "The world's best translation tool"
- **Professional, not stiff** — Speak like a senior colleague, not a legal document
- **Specific, not vague** — "Review block by block" not "Advanced review features"
- **Enterprise-ready** — Reference compliance, security, and accuracy without over-explaining

### Key messages
- "Intelligent document translation"
- "AI-powered. Human-reviewed."
- "Built for teams that care about precision"
- "Translation you can trust"

---

## Usage with Claude Code

When asking Claude Code to build a page, include:

> "Use the Helvara design system defined in DESIGN_SYSTEM.md.
> Use shadcn/ui components where available.
> All colours should use brand.* tokens from tailwind config.
> Font: Helvetica Neue system stack for UI, Playfair Display for display headlines.
> Buttons must use the pill shape (rounded-full).
> Background: brand-bg (#F5F2EC), not white."

---

## Files to update

- `frontend/tailwind.config.js` — add brand colour tokens and font families
- `frontend/app/globals.css` — import Playfair Display from Google Fonts
- `frontend/app/layout.tsx` — apply font-sans to body
- Components live in `frontend/app/components/ui/` (shadcn/ui base)
