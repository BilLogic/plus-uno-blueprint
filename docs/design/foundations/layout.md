---
audience: designers
summary: Spacing, radius and width tokens, and the one-home split between theme.css (class-only widths) and layoutTokens.ts (widths the runtime does math on).
sources: src/styles/theme.css, src/lib/layoutTokens.ts
last-reviewed: 2026-08-08
---

# Layout

## Spacing and radius

Tailwind's default spacing scale, plus the handful of named measures Supabase
also registers — recurring app measures, not a parallel scale. All live in
`src/styles/theme.css`:

- `--radius` is the dial; `--radius-sm/md/lg/xl` (and `2xl/3xl/4xl`) derive
  from it, so rounding retunes from one place. `--radius-panel` is the flat
  panel radius.
- `--spacing-content` (the content column unit) and `--spacing-card`
  (indirecting to the card's own padding token).

Use the scale; a `p-[13px]`-style arbitrary value is a review-blocker unless
the PR argues why no step fits.

## Width tokens, and the one-home rule

Widths have **exactly one home each**, chosen by who consumes them:

- **`src/styles/theme.css`** owns widths that *only feed class names*:
  `--width-cell-panel` / `--width-cell-panel-expanded` (the detail panel's two
  desktop postures), `--width-listbox`. CSS is their single home because no
  JavaScript ever computes with them.
- **`src/lib/layoutTokens.ts`** owns widths the *runtime does math on* — drag
  clamps, persistence, viewport clamping, things a CSS custom property cannot
  serve (`Math.min` has no `var()`): `RAIL_WIDTH`, the sidebar default/min/max
  widths, and the agent float's birth geometry and minimums. The file's
  header comment is the contract.

The rule: **never declare the same measure in both**. If a CSS-only width
grows a runtime consumer, it *moves* to `layoutTokens.ts` (and the class
reads it via inline style); it does not get copied. The sidebar width is the
worked example — one value for all three sidebar surfaces, drag-resizable,
persisted as a single number, because a width that jumps per surface reads as
layout instability.

## Shell structure

The desktop shell is three columns: icon rail + resizable sidebar, the
canvas, and the right-pinned detail panel; the mobile shell replaces all of
it below the breakpoint. Z-ordering of shell parts is owned by
[elevation](elevation.md#z-index-conventions).

## Breakpoints live elsewhere

This doc deliberately does **not** define breakpoints. The breakpoint
contract — the single 768px gate, what changes below it, tablet behavior —
is owned by [responsive.md](../responsive.md). (`--breakpoint-xs` in
`theme.css` is a Tailwind utility step, not a shell fork; the shell forks
only at the responsive contract's gate.)
