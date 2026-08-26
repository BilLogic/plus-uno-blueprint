---
audience: designers
summary: The accessibility bar — forced-colors restatements, reduced motion everywhere, the global focus catch-all, aria state on toggles, 44px targets, and plain screen-reader names.
sources: src/styles/base.css, src/styles/blueprint.css, src/styles/animations.css, src/components/editor/CanvasPhaseSection.tsx, src/components/blueprint/BlueprintLabelRail.tsx, src/lib/canvasAnnotations.ts
last-reviewed: 2026-08-25
---

# Accessibility

This is a bar, not a checklist appendix: each item below has an **owner in
code**, and new work is expected to ride that owner rather than re-earn it.

Owners are not all checkers, and the difference matters. Forced colors, reduced
motion and screen-reader naming ride mechanisms that fail loudly when bypassed
(`src/lib/motion.test.ts` pins every animation's reduced path). **Focus and the
44px floor are convention only** — no lint rule, no test — and both have
violations in the tree: `SidebarNav.tsx:217,232` write
`focus-visible:outline-none` with no equal replacement, and nothing asserts
`size-11` on a touch target. Treat those two as rules a reviewer enforces, not
rules the build enforces.

## Forced colors

Windows High Contrast replaces every color; meaning carried by fill or ring
alone disappears. The stance is **restate, don't fight** — the
`@media (forced-colors: active)` block in `src/styles/base.css` restates:

- focus as a `Highlight` outline;
- pressed/selected state as `Highlight`/`HighlightText` fills — keyed off
  `aria-pressed`, `aria-selected`, `data-state` (which is why those
  attributes are mandatory, below);
- blueprint cell boundaries as `CanvasText` borders, since lanes identify
  themselves by fill alone.

The semantic-zoom blocks tier has its own restatement in
`src/styles/blueprint.css`: blocks redraw in `CanvasText` so the density map
survives when the `--border` fill flattens to Canvas. Any new
meaning-through-color needs its restatement in the same PR.

## Reduced motion

Everywhere, no exceptions: every animation ships a reduced path, and an
instant swap is acceptable. CSS goes through the `prefers-reduced-motion`
block in `animations.css` (or `motion-reduce:` utilities); JS reads
`prefersReducedMotion()` live, never cached at mount. Policy details in
[motion](motion.md#reduced-motion).

## Focus

A global `:focus-visible` catch-all in `base.css` gives every interactive
element the same ring recipe `ui/button.tsx` uses — wrapped in `:where()` so
it has zero specificity and any component's own `focus-visible:` rules win.
It exists because raw `<button>`s kept shipping with no indicator (or with
`outline-none` and nothing in its place); the catch-all makes the *next* raw
button covered by default. Never write `focus-visible:outline-none` without
an equal-or-better replacement in the same class list.

## State attributes on toggles

Anything that toggles carries **`aria-pressed`** (or `aria-selected` /
`aria-current` for selection and wayfinding). This is not only for screen
readers — the forced-colors restatement above *keys off these attributes*, so
a toggle without them loses its pressed state in High Contrast. Blueprint
cells set `aria-pressed` for their selected state; segmented controls and nav
rows follow the same rule.

## Touch targets

44px minimum on touch surfaces — the `size-11` pattern
([iconography](iconography.md#glyph-vs-hit-area)). Glyphs stay
small; targets do not.

## Screen-reader naming: plain names

Visual registers are visual; accessible names stay plain:

- The phase badge renders `01 · ARRIVAL` but its section's `aria-label` is
  "Open Arrival phase" — the ordinal register is presentation, the name is
  the content.
- Annotation swatches announce human color names ("Red") via
  `annotationSwatchName`, never their token strings.
- The canvas divider rows (line of visibility and the interaction lines,
  `BlueprintLabelRail.tsx`) are each a single `role="separator"` carrying the
  divider's name; their rules and sticky visible labels are `aria-hidden` —
  AT hears each separator **once**.

The general rule: decorative repetition and typographic dressing are
`aria-hidden`; every meaningful element has exactly one plain name.
