---
title: 'Fix focus contrast, mirror Supabase's CSS architecture, rebrand to teal, ship light/dark'
type: refactor
status: completed
date: 2026-08-04
---

# ♻️ Fix focus contrast, mirror Supabase's CSS architecture, rebrand to teal, ship light/dark

> **Executed** on `claude/blueprint-design-system-57db6a`, commits `49e6c5a..40f5255`
> (35 commits, 2026-08-04/05). All phases A–G shipped: A in `3bf1db2`/`f59f230`,
> B across `65a94b6..5b13701`/`4b3cf7e`, C–D in `a169838..a33fa79`/`6aee01e`,
> E in `bb98719`/`7bbc42a`, F across the canvas refactors, G in `9899f1b`/`218cf0b`.
> Checkboxes below are left as written; this note is the execution record.
> Merged to `main` via docs/plans/2026-08-05-002-refactor-design-system-frontend-migration-plan.md.

## Enhancement Summary

**Deepened:** 2026-08-04 · 12 parallel agents (6 research, 6 review) · every concrete claim
re-verified against the code before adoption.

### What changed, and why

| # | Original plan said | Verified reality | Now |
| --- | --- | --- | --- |
| 1 | Port Supabase's `oklch(from …)` relative-color syntax | Tailwind v4 hardcodes Lightning CSS targets — verified in our own `node_modules`: `chrome: 7274496` (= 111), `safari: 16.4`, `firefox: 128` — and ignores `vite.config.ts`. RCS needs Chrome 119+, so over a `var()` base it ships raw with no fallback. **But Supabase Studio uses `@tailwindcss/vite` 4.2.4 — the same plugin — with no `browserslist` anywhere, and ships RCS regardless (10 uses in `semantic.css`).** The exposed population is Chrome 111–118: a seven-month window in 2023, long since auto-updated. | **Adopt RCS.** Note the exposure in the file header. Separately: `abs()` (used by Supabase's `--surface-overlay-unit`) is *newer* than RCS — author the unit per theme with a known sign instead. |
| 2 | `--ring: var(--primary)` fixes the focus ring | `index.css:414` sets the app-wide default outline to `outline-ring/50` — **1.76:1**. The `/50` is at the utility site, so the token fix does not reach it. 27 raw buttons depend on it. | Fix `--ring` **and** `outline-ring/50` in the same commit. |
| 3 | Contrast validated on 2 surfaces | The app has **10**. `--primary` measures 3.13 on the light canvas but **2.59** on the blueprint canvas `#E8E8ED` and **2.31–2.83** on the 8 pastel cell fills. | Acceptance criterion now names all 10 surfaces. |
| 4 | `blueprintCellStyle.ts` frozen byte-identical | `--blueprint-cell-ring-soft` (`:118`) is the focus ring on the app's **most-used control**, and measures **1.86:1** on chartreuse. The freeze protects the defect. | Unfreeze `ringSoft`; freeze the *palette values*, not the file. |
| 5 | TanStack: "no dedup, no stale-while-revalidate" | **Both exist** — `useSupabaseQuery.ts:153` (in-flight dedup) and `:185-188` (SWR, with a comment saying so). | Rationale corrected. **Adopted in Phase H** (parity decision, 2026-08-04) on the corrected grounds — leaked requests, an order-sensitive cache key, a 3-deep waterfall, an unbounded cache. |
| 6 | Toast because `deleteSlice` "fails silently" | It doesn't. `TabStrip.tsx:76` catches into `setError` → `<Alert variant="warning">` at `:105`. | Rationale corrected: the **success** path has no feedback. |
| 7 | View Transitions for the presentation choreography | Document-global singleton (rapid switches reject with unhandled `AbortError`); `::view-transition-*` pseudos resolve custom properties at `:root`, **not** the `.dark` subtree → white flash on the presentation stage; snapshot paint is proportional to display list; input dead for the duration; fights the 420 ms rAF camera. | **Cut.** |
| 8 | `motion` via `LazyMotion` ≈ 6 KB | `AnimatePresence` requires the `domAnimation` feature bundle: 4.6 KB + **15 KB**. React 19.2 stable does **not** ship `<ViewTransition>` (experimental channel only). | Size corrected: ~4.6 KB initial + ~15 KB deferred. **Adopted in Phase I** (parity decision) scoped to shell + presentation choreography, never the grid. |
| 9 | `@use-gesture/react` for wheel normalization | `useZoomPanViewport` deliberately writes `el.style.transform` with `commitTransform(syncReact=false)` — **zero React commits during a pan**. use-gesture's idiom is handler→setState; naive migration = ~120 renders/sec of an unmemoized grid. | **Cut.** Hand-roll ~30 lines. |
| 10 | ⌘K via Base UI `combobox` | Base UI's own docs put the command-palette example under **Autocomplete**. `ComboboxContent` hard-wraps `Portal > Positioner > Popup` — unusable inline in a Dialog. Installing it also drags in `input-group` + `textarea`. | **Autocomplete**, or `cmdk` — decided in its own plan. |
| 11 | `--secondary` is the terminal fallback for blueprint cells (risk row + Phase 2 constraint) | `fill` is a **required** prop (`BlueprintCellButton.tsx:19`) always fed to `getBlueprintCellInteractionStyle`, which always sets `--blueprint-cell-bg`. The `var(--secondary)` tail is **unreachable**. | Risk row and constraint deleted; collapse the fallback ladder instead. |
| 12 | 16 slash-opacity sites to re-tune | **23**, mechanically counted. Mechanism confirmed in Tailwind v4 source: `withAlpha` emits `color-mix(in oklab, <value> <alpha>, transparent)`, so alpha is **multiplicative** — `bg-muted/50` over a 10 %-alpha token renders at **5 %**. | Count corrected. These 23 are now the migration cost of a necessary fix (see #14), not a reason to skip it. |
| 13 | Entry imports `themes/*` before `semantic.css` | `:root, .dark` and `.dark` are both specificity (0,1,0); **source order breaks the tie**. That order silently kills all six dark overrides *and* the `@media print` dials. Phase 1 was gated on "no visual diff" and would have shipped a regression. Also `@custom-variant` between two `@import`s is invalid CSS. | Order fixed and made a CI check. |
| 14 | 9-file split; overlay conversion framed as optional polish; full contrast-machinery port | `--border-opacity` is *already* a squared ramp. Custom-property chains substitute **once at the declaring element** — depth is free. `--chart-1..5`, `--sidebar-primary*` have **zero** consumers. But the overlay conversion is **not** optional: Supabase's light `card`/`popover`/`secondary` clip to white exactly as ours do, and all visible light-mode state comes from the subtractive alpha overlays. Ours are opaque, so `--accent` over `--card` is `#FFFFFF` on `#FFFFFF` — contrast **1.00**. | **Full 14-file mirror of their tree, including the Radix scales** (decision taken 2026-08-04, reservation recorded in Phase B); contrast port reduced to two floors; dead tokens deleted; **overlay conversion promoted to core** — it is the fix for the dead ladder. |

### New findings not in the original plan

1. **Light-mode state colours are invisible, because we kept half of Supabase's system.** `--surface: 0.985` + `--elevation-step: 0.024` puts sidebar (L 1.019), secondary/muted (1.023), accent (1.028), card (1.038) and popover (1.052) **all past L = 1** → all five clamp to `#FFFFFF`. Supabase's light theme clips identically **by design** — raised surfaces are white and separated by borders. What we're missing is the second mechanism: their `muted`/`accent`/`tertiary` are *subtractive* alpha overlays of `--foreground`, which darken whatever they sit on and therefore work at any gamut position. Ours stayed opaque, so `--accent` over `--card` is `#FFFFFF` on `#FFFFFF` — **contrast 1.00**. Every hover, muted and accent state in light mode is currently invisible; `NavbarSlideTitleNav.tsx:150` is just where someone noticed.
2. **Every blueprint cell re-renders on every hover.** Zero `React.memo` in `BlueprintCellButton` or either grid, and `BlueprintCellButton.tsx:89` consumes `useBlueprintCellPreviewHover()` from context. This fan-out dominates every other performance question here.
3. **Focus is literally invisible in one place.** `NavbarSlideTitleNav.tsx:150` is `focus-visible:bg-muted focus-visible:outline-none` — a background-only indicator, and `--muted` clamps to `#FFFFFF` (finding 1), identical to its surround.
4. **The path legend never renders in either shipping view.** `pathsLegend` is gated to the non-`embedded` branch (`IntegratedBlueprintGrid.tsx:363`), and both consumers — `ScenarioBlueprintPanel.tsx:228`, `CanvasBlueprintArtboard.tsx:116` — pass `embedded`. There is no persistent colour→name mapping in the product.
5. **Exception red and alternative blue are 1.02:1 apart.** `#EF4444` vs `#3B82F6` — functionally one colour in greyscale, under protanopia, or on a projector.
6. **Three CSS classes are referenced in JSX and defined nowhere** — `blueprint-panel-surface`, `blueprint-panel-label-surface`, `blueprint-panel-section-frame`, across 5 files, 0 definitions.
7. **`raceSupabaseQuery` leaks twice** — `Promise.race` never aborts the request, and the `setTimeout` is never cleared.
8. **A third motion vocabulary already exists** — 46 `duration-*` utilities in the class layer, including `duration-300` and `duration-450` which map to nothing in `lib/motion.ts` (320 / 420).
9. **`useSliceScenarioId` keys on `cellIds.join('|')`** — order-sensitive, over an order-independent `.in()` query.
10. **`@theme inline` tokens are not emitted as custom properties** — `var(--color-canvas)` in hand-written CSS is undefined. Current exposure: zero. Must stay that way.
11. **Desktop Safari pinch-to-zoom does not work.** No `gesturestart` / `gesturechange` / `gestureend` handling exists anywhere in the repo, and macOS Safari's trackpad pinch emits those rather than `ctrl+wheel` — so the browser page-zooms instead of the canvas.
12. **Firefox wheel speed is ~40× off.** `useZoomPanViewport.ts:418` reads `e.deltaY` raw with no `deltaMode` check; Firefox reports lines, not pixels. No `touch-action` is declared anywhere either.

---

## Overview

Three things, in strict order of urgency:

1. **Fix live WCAG failures.** The focus indicator fails SC 1.4.11 on every surface in the
   product, in three independent ways, today.
2. **Restructure `src/index.css`** — 670 lines, six concerns — into Supabase's
   dials / derivation / Tailwind-map split, adapted to Vite and to the fact that `.dark` here
   is a subtree.
3. **Rebrand** to a teal OKLCH anchor at hue 177.6, authored in OKLCH, with a two-token split
   so the identity colour and the contrast-obligated colour can differ.

Settled by discussion: Base UI stays (no Radix migration); no literal `#85ECD5` requirement;
OKLCH is the authoring unit; `lib/blueprintTheme.ts` / `pathColorTheme.ts` / `techPillColors.ts`
keep their **values** frozen.

Descoped into their own plans: TanStack Query, the ⌘K palette, `perfect-freehand`, and the
`--muted`/`--accent` overlay conversion. Each is independent of the colour work, each carries
its own risk, and bundling them under one bundle budget was the wrong unit of work.

## Problem Statement

### 1. The focus indicator fails, three ways, on every surface

| Path | Measured | Required |
| --- | --- | --- |
| `--ring` at `primary / 55%` → `focus-visible:border-ring` | 1.85 | 3:1 |
| `index.css:414` `* { @apply … outline-ring/50 }` — the default outline for 27 raw buttons | **1.76** | 3:1 |
| `--blueprint-cell-ring-soft` (`blueprintCellStyle.ts:118`) — the ring on blueprint cells, the app's most-used control | **1.86** on chartreuse (5 of 8 lanes fail) | 3:1 |
| `NavbarSlideTitleNav.tsx:150` — background-only, on a `--muted` that clamps to white | **1.04** | 3:1 |

Twelve files render raw `<button>`s with **no** `focus-visible` rule at all, relying entirely on
the 1.76:1 global outline. The 14 that do define one use **six** competing recipes
(`ring-2`, `ring-3`, `ring-[3px]`, `ring-1`, `ring-ring`, `ring-ring/50`, `ring-white/40`,
`ring-sidebar-ring`). Four use `ring-1`, which also fails SC 2.4.11 on focus area.

### 2. The light-mode surface ladder does not exist

```
canvas    L 0.985  ok
sidebar   L 1.019  → clamps to #FFFFFF
secondary L 1.023  → #FFFFFF
accent    L 1.028  → #FFFFFF
card      L 1.038  → #FFFFFF
popover   L 1.052  → #FFFFFF
```

Six named rungs resolve to two distinct colours. The `index.css:73-83` comment describes a
ladder the code does not produce. Any hover or selected state that works by swapping surfaces is
invisible in light mode — which is how `NavbarSlideTitleNav.tsx:150` came to have an invisible
focus state without anyone noticing.

### 3. One file, six concerns

`src/index.css` holds the Tailwind token map, the dials, the derived engine, the frozen
blueprint palette, the motion keyframes and the print stylesheet.

### 4. `--success` is byte-identical to `--primary`

`src/index.css:191`. Success and brand are indistinguishable.

### 5. Path identity is encoded by colour alone, with no legend

Trigger arrows differ only in stroke colour — no `strokeDasharray`, identical arrowhead
geometry, shared `ARROW_STROKE_WIDTH = 3`, `aria-hidden` SVG. Nested path frames
(`IntegratedPathSectionFrame.tsx:57-83`) are N concentric 3px rings differing only in
`borderColor`. And the legend never renders (new finding 4). Exception and alternative are
1.02:1 apart.

## Proposed Solution

### Phase A — Ship the accessibility fixes. Standalone, today.

Four one-line edits and one small function change. No dependency on anything else in this plan,
and one of them is a live SC 2.4.7 failure.

- [ ] `index.css:414` — `outline-ring/50` → `outline-ring`. Fixes the default outline for 27
      buttons at once.
- [ ] `--ring: var(--primary)` — full alpha. Add a separate `--ring-glow` for the decorative
      `ring-3 ring-ring/50` layer, so a future alpha tune moves one thing, not four.
- [ ] `NavbarSlideTitleNav.tsx:150` — replace the background-only indicator with the canonical ring.
- [ ] `--success` → its own hue at 159 (the retired Supabase green), no longer aliasing `--primary`.
- [ ] `blueprintCellStyle.ts` — raise the `ringSoft` lightness floor from `max(l * 0.54, 36)` to a
      contrast-solved value, with a unit test asserting ≥3:1 for every entry in
      `BLUEPRINT_CELL_PALETTE`. **This requires relaxing the freeze on that file** — see the
      criterion change below.

### Phase B — Adopt Supabase's file architecture, complete. Pure move, zero value changes.

Full mirror of `packages/config/tailwind.config.css` and the tree it imports, **including the
Radix numbered colour scales**. Verified empirically against Tailwind 4.3.3 / Lightning CSS 1.32 /
Vite 8.2: relative imports, nested-directory imports, bare package imports, `@theme inline` in an
imported file and `@custom-variant` in an imported file all work.

> **Recorded reservation.** The Radix scales are HSL literals — `--color-amber-900: hsl(39, 100%, 57%)`
> — so this bolts a second, non-parametric colour system alongside the OKLCH engine, and 16 of the
> 17 families ship with zero consumers on day one. The counter-argument is parity: a component
> lifted from Supabase resolves, and Radix's 12 steps are perceptually engineered with APCA-checked
> contrast targets, which Tailwind's defaults are not. Decision taken deliberately; noted here so a
> future reader knows it was weighed.

#### The mapping

| Supabase | Ours | Role |
| --- | --- | --- |
| `config/tailwind.config.css` | `src/styles/tailwind.config.css` | **Entry — imports only.** Same filename: it is not a Tailwind convention (v4 looks for no such file), but matching removes a needless divergence when cross-referencing their repo. |
| `ui/…/source/global.css` | `src/styles/global.css` | Raw palette primitives — `--colors-*` HSL literals |
| `ui/…/source/semantic.css` | `src/styles/semantic.css` | Dials + derivation engine — **our one divergence, below** |
| `ui/…/source/compat.css` | *(omit — see note)* | Legacy alias shim |
| `ui/…/themes/dark.css` | `src/styles/themes/dark.css` | `.dark` dial overrides + step-scale literals |
| `ui/…/themes/light.css` | `src/styles/themes/light.css` | `:root, .light` equivalent |
| `config/unset-tw-colors.css` | `src/styles/unset-tw-colors.css` | `--color-{family}-*: initial` × 16 |
| `config/css/colors.css` | `src/styles/colors.css` | Radix scales as `--color-*`, per theme |
| `config/css/theme.css` | `src/styles/theme.css` | `@theme inline` token map |
| `config/css/animations.css` | `src/styles/animations.css` | `--animate-*` / `--duration-*` tokens + `@keyframes` |
| `config/css/utilities.css` | `src/styles/utilities.css` | `@utility` definitions |
| `config/css/variants.css` | `src/styles/variants.css` | `@custom-variant` |
| `config/css/base.css` | `src/styles/base.css` | `@layer base` |
| *(no analogue)* | `src/styles/blueprint.css` | Frozen-palette `data-*` rules + the four shadow literals |
| *(no analogue)* | `src/styles/print.css` | `@page` + `@media print` — dials *and* layout |

**`compat.css` is the one omission, and not out of conservatism.** It aliases Supabase's *own*
retired token names (`--background-surface-100` → `--card`) so their un-migrated call sites keep
resolving. Their header: *"Nothing new should reference them… the file goes away once it is empty."*
We never had those names, so the file would be empty on arrival — copying it would import their
deprecation debt, not their architecture.

#### The entry

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';
@import '@fontsource-variable/inter';
@import '@fontsource-variable/manrope';
@import '@fontsource-variable/source-code-pro';

/* Define the semantic system first, then override its core inputs per theme.
 * This order is significant because :root and a single class selector have
 * equal specificity. (Comment adapted from Supabase's own entry.) */
@import './global.css';
@import './semantic.css';
@import './themes/dark.css';
@import './themes/light.css';

/* Reset Tailwind's built-in colour tokens before re-defining our own. */
@import './unset-tw-colors.css';
@import './colors.css';
@import './theme.css';

@import './animations.css';
@import './utilities.css';
@import './variants.css';
@import './base.css';
@import './blueprint.css';
@import './print.css';
```

Two rules carried over from their entry, both of which fix defects in my earlier draft:

1. **`@import 'tailwindcss'` first.** It emits `@layer theme, base, components, utilities;`, and
   CSS fixes layer order at first appearance. A file containing `@layer base {…}` imported before
   it inverts the cascade.
2. **Nothing but imports in the entry.** My draft put `@custom-variant` between two `@import`s,
   which is invalid CSS. Supabase never hits this because every at-rule lives in an imported file
   — `@custom-variant` in `variants.css`, imported late.

#### Migrating off Tailwind's palette

`unset-tw-colors.css` sets 16 families to `initial`: amber, blue, crimson, gold, gray, green,
indigo, orange, pink, purple, red, slate, tomato, violet, yellow, scale.

**`neutral` and `emerald` are not on that list**, so the 13 `bg-neutral-*` / `text-neutral-*` uses
in the annotation layer — deliberately outside the token system, sitting on a fixed dark scrim —
and both `bg-emerald-500` survive untouched.

Actually affected: **24 uses**, and 10 of them should be deleted rather than remapped.

| File | Uses | Action |
| --- | --- | --- |
| `lib/pathTypeTheme.ts` | 10 | **Delete.** `PATH_TYPE_BADGE_CLASSES` and `PATH_TYPE_SWATCH_CLASSES` are a Tailwind-class mirror of colours that already exist as hex in `pathColorTheme.ts`. `PathLabelBadge` already renders from the hex via `getPathBadgeStyle()`; `PathTypeBadge` should do the same, and `PATH_TYPE_SWATCH_CLASSES` has zero consumers. This kills a live two-sources-of-truth drift risk, and is worth doing whether or not the scales land. |
| `CanvasAnnotationToolbar.tsx` | 4 | Remap |
| `EditorSequenceNav.tsx` | 2 | Remap |
| `ui/alert.tsx`, `SliceHeaderBand.tsx`, `CellResourcesTab.tsx`, `CellDependencySections.tsx` | 1 each | Remap |
| `CanvasAnnotationLayer.tsx` | 10 | **No change** — all `neutral`, not unset |

**The remap is semantic, not numeric.** Radix runs 100→1200 with fixed meanings per step, which do
not line up with Tailwind's:

| Radix step | Means | Tailwind equivalent |
| --- | --- | --- |
| 100–200 | app background | `-50` / `-100` |
| 300–500 | component bg (rest / hover / active) | `-100` / `-200` |
| 600–800 | borders (subtle / ui / focus) | `-300` / `-400` |
| **900** | **solid fill — the vivid step** | **`-500`** |
| 1000 | solid hover | `-600` |
| 1100–1200 | low- / high-contrast text | `-700` / `-900` |

So: `bg-amber-500 → bg-amber-900`, `text-amber-700 → text-amber-1100`,
`border-blue-500 → border-blue-800`, `bg-violet-100 → bg-violet-300`,
`ring-violet-400 → ring-violet-800`, `bg-red-500 → bg-red-900`,
`bg-indigo-500 → bg-indigo-900`.

#### Our one divergence, and why

Supabase's `semantic.css` declares the derived engine once at `:root` and lets `themes/*.css`
override dials, because their `[data-theme]` sits on the **root element**. Ours is a **subtree**
(`SlicePresentation.tsx:164,183,225,500`), and a custom property declared only at `:root` is
substituted before it inherits — a descendant re-declaring a dial cannot retroactively re-derive it.

So `semantic.css` here declares the derived block under `:root, .dark`, and `themes/*.css` hold only
dial overrides. Everything else about the split is theirs. Record it in the file header as the single
intentional structural difference.

#### What adopting their structure fixes, beyond tidiness

- **`animations.css` retires the third motion vocabulary.** Supabase puts `--animate-*` tokens in
  `@theme` alongside the keyframes they reference. Doing the same with `--duration-structural: 320ms`
  / `--duration-fade: 200ms` / `--duration-micro: 150ms` / `--duration-camera: 420ms` makes
  `duration-structural` a real utility class — retiring the 46 ad-hoc `duration-*` uses, including
  the `duration-300` and `duration-450` that have drifted off `MOTION_STRUCTURAL_MS` (320) and
  `MOTION_CAMERA_MS` (420). `lib/motion.ts` finally has exactly one CSS counterpart.
- **`utilities.css` + `@utility` gives the orphans a home.** Tailwind v4 no longer hijacks
  `@layer utilities`; `@utility` is the supported form and gets variant support automatically.
  Destination for `delayed-appear`, `blueprint-scroll` and the pen-cursor rule.
- **`variants.css` fixes a specificity bug.** Ours is `@custom-variant dark (&:is(.dark *))`, and
  `:is()` takes the specificity of its most specific argument — so `dark:bg-x` lands at (0,2,0) and
  can beat rules it shouldn't. Supabase deliberately uses `:where()`, always (0,0,0). Adopt
  `&:where(.dark *)`.

#### Tasks

- [ ] Create the tree above; move each concern verbatim. No value changes.
- [ ] Point `src/main.tsx` at `./styles/tailwind.config.css`.
- [ ] Port `global.css` + `colors.css` + `unset-tw-colors.css` from Supabase, adjusting only the
      brand family to our hue.
- [ ] Delete `PATH_TYPE_BADGE_CLASSES` / `PATH_TYPE_SWATCH_CLASSES`; route `PathTypeBadge` through
      `getPathBadgeStyle()`.
- [ ] Remap the 14 remaining Tailwind-palette uses per the table above.
- [ ] Prefix every dial `--dial-*`, so "dials only in `themes/`, derivation only in `semantic.css`"
      is a two-line CI grep rather than a convention.
- [ ] CI check: no custom-property name declared in both `themes/*.css` and `semantic.css`.
- [ ] CI check: `tailwind.config.css` contains only `@import` lines.
- [ ] CI check: no `bg-|text-|border-|ring-` against an unset Tailwind family.
- [ ] Resolve the three phantom classes (new finding 6) **before** the move — no-visual-diff
      screenshots cannot distinguish "unstyled surface" from "vestigial class".
- [ ] Resolve the `transition-property` conflict between `index.css:315` and `button.tsx:22` — the
      split changes source order and will silently flip which wins.
- [ ] Keep hand-written CSS on **dial** variables, never `--color-*`: `@theme inline` tokens are not
      emitted as custom properties, so `var(--color-canvas)` is undefined. Current exposure is zero;
      a CI grep keeps it there.
- [ ] Verify: no visual diff. Screenshot the canvas, a scenario, the presentation stage and a print
      preview before and after.

### Phase C — Trim and correct the engine.

Phase B ports their *files*; this phase is about the contents of `semantic.css` specifically. It
is not a wholesale port — the measured verdict is that several pieces of Supabase's newer
derivation machinery either already exist here or have no consumer.

- [ ] **Elevation as named ratios, split by mechanism.** The current literals
      (1.4 / 1.6 / 1.8 / 2.2 / 2.8) are opaque, and after the overlay conversion they no longer
      describe one thing. Two groups, named by role rather than index:

      | Group | Tokens | Ratio drives |
      | --- | --- | --- |
      | Raised (additive lightness) | `--elevation-sidebar`, `-secondary`, `-card`, `-popover` | `calc(l + step × ratio)` |
      | State (subtractive alpha) | `--overlay-muted`, `-accent`, `-tertiary` | `alpha = unit × ratio` |

      `--muted` currently sits at ×1.6, byte-identical to `--secondary`; it leaves the raised group
      entirely. A numeric `--elevation-1..4` ladder would be worse here — it starts at 1.4, skips a
      rung, and now spans two different mechanisms.
- [ ] **Two contrast floors, not six new dials.** `--border-opacity` is *already* squared; the
      only substantive addition Supabase makes is a floor:
      ```css
      --border-opacity: max(0.05, calc(0.06 + var(--dial-contrast) * var(--dial-contrast) * 0.16));
      --muted-text-t:   min(0.90, calc(0.52 + var(--dial-contrast) * 0.24));
      ```
- [ ] **The light ladder is not a decision — it is the missing second mechanism.** See below.
      Adopt `--surface: 0.995` **together with** the overlay conversion, never before it.

#### The two-mechanism system

This is the part our fork lost, and it explains both the dead ladder and the invisible-hover bug.

Supabase's light theme clips exactly like ours — `--surface: 0.995` + `--elevation-step: 0.024`
puts card at L 1.019, popover at 1.031, secondary at 1.043, **all pure white**. That is not a
defect they tolerate; it is the design. Light mode is white surfaces on a `#FDFDFD` canvas,
separated by hairline borders.

The elevation you actually *see* in light mode comes from the other mechanism:

| Role | Mechanism | Light-mode behaviour |
| --- | --- | --- |
| **Raised** — `card`, `popover`, `secondary` | Additive lightness, `oklch(from var(--background) calc(l + step × ratio) c h)` | Clips to white; separation carried by `--border` |
| **State** — `muted`, `accent`, `tertiary` | **Subtractive**, `oklch(from var(--foreground) l c h / alpha)` | *Darkens* whatever it sits on — works at any gamut position |

With Supabase's light dials, `--surface-overlay-unit` = `0.024 / 0.895` = **0.0268**, giving
alphas of 0.027 / 0.040 / 0.054. Measured over a white card:

| Token | Alpha | Renders | Contrast vs card |
| --- | --- | --- | --- |
| `--muted` | 0.027 | `#F8F8F8` | 1.06 |
| `--accent` | 0.040 | `#F5F5F5` | 1.09 |
| `--tertiary` | 0.054 | `#F2F2F4` | 1.12 |
| **ours today** (opaque `--accent` over opaque `--card`) | — | `#FFFFFF` over `#FFFFFF` | **1.00 — invisible** |

That last row is the bug. `NavbarSlideTitleNav.tsx:150` is not a one-off mistake; it is the
first place someone noticed a systemic property — **every hover, muted and accent state in light
mode currently resolves to the same white as the surface beneath it.**

So the conversion is the fix, and the 23 slash-opacity sites are its migration cost rather than
a reason to skip it. Sequencing: convert the three tokens, then re-tune the 23 sites (Tailwind's
`withAlpha` emits `color-mix(… <alpha>, transparent)`, so the modifier **multiplies** — `bg-muted/50`
over a 2.7 % token lands at 1.3 %, i.e. nothing). Blueprint cells are unaffected throughout: they
always carry inline hex vars and never resolve these tokens.
- [ ] **Delete dead tokens:** `--tertiary-foreground`, `--chart-1..5`, `--sidebar-primary`,
      `--sidebar-primary-foreground`. Zero consumers each; ~25 lines.
- [ ] **`@property` registration** for the derived colour tokens, with `syntax: "<color>"` and an
      `initial-value`. This is for the failure mode, not for speed: an invalid
      `oklch(…)` currently falls back to the *inherited* value, which in the `.dark` subtree means
      light tokens leaking onto the presentation stage. Registered, it falls back to a declared
      initial value — a loud, deterministic wrong colour instead of a silent leak. Measure the
      `.dark` toggle after, since registered properties have historically been excluded from
      Blink's `IndependentInherit` fast path.
- [ ] **Adopt `oklch(from …)`**, matching Supabase. It is what makes the overlay mechanism
      expressible (`oklch(from var(--foreground) l c h / var(--muted-alpha))`). Record in the
      `semantic.css` header that Tailwind's hardcoded Chrome 111 target predates RCS (Chrome 119),
      so Chrome 111–118 drops these declarations — the same exposure Supabase ships with.
      **Avoid `abs()`** (Supabase uses it for `--surface-overlay-unit`); it is newer than RCS.
      The sign of `--tone-span` is known per theme, so author the unit directly in each theme file.
- [ ] **Drop `--status-hue-pull`.** The measured effect is **+2.79°** on an amber, a red and a
      violet — imperceptible, for ~10 lines of derivation and three `clamp()`s. Supabase needs it
      because they re-theme across hues; this app has one brand. Keep the fixed 75 / 25 / 288.

- [ ] **Convert `--muted` / `--accent` / `--tertiary` to subtractive alpha overlays.** This is
      load-bearing, not cosmetic — see "The two-mechanism system" below.

### Phase D — Rebrand.

```css
/* semantic.css */
--dial-primary-hue: 177.6;

/* Functional accent. Mode-invariant, in gamut (sRGB max C at this L and hue is ~0.118). */
--primary: oklch(0.64 0.116 var(--dial-primary-hue));

/* Identity. Fills on dark surfaces only — never a line, never on the light canvas.
   Named for its constraint so `bg-primary-on-dark` reads wrong at a light call site. */
--primary-on-dark: oklch(0.874 0.1025 var(--dial-primary-hue));

--ring: var(--primary);
--ring-glow: color-mix(in oklab, var(--primary) 50%, transparent);
```

| Token | Renders | Light canvas | Dark canvas | On-colour |
| --- | --- | --- | --- | --- |
| `--primary` | `#0EA38C` | 3.13 ✅ | 5.81 ✅ | dark ink, 6.38 ✅ |
| `--primary-on-dark` | `#85ECD5` | 1.38 *(unused there)* | 13.14 ✅ | dark ink, 14.44 ✅ |

Same hue, one identity, two jobs. `#85ECD5` ships unmodified on the presentation stage — the
surface most likely to be screenshotted.

**But `--primary` at 3.13 is measured against the light canvas only.** On the blueprint canvas
`#E8E8ED` it is 2.59, and on the eight pastel fills 2.31–2.83. Two options:

- **Two-tone ring** — 2px `--primary` inner + 1px contrasting outer halo. Backdrop-independent,
  keeps the teal at full saturation. Preferred.
- **Single darker anchor** — `oklch(0.544 0.0974 179.1)` = `#0A8271` clears 3:1 on all ten
  surfaces (min 3.45), at the cost of a visibly deeper teal.

Also in this phase:

- [ ] `--brand-hue-reference` is deleted along with `--status-hue-pull`. (It was a naming
      inversion regardless: today `--brand-hue: 159` *is* `--primary`'s hue, so a token named
      `--brand-*` describing something `--primary-on-dark` never uses would have been actively
      misleading.)
- [ ] Darken path fills: happy `#10B981` → `#0D986A`, unhappy `#F59E0B` → `#B97708` — both reach
      3.00 against `#E8E8ED`. Then switch `PathLabelBadge` from `text-white` (2.15–4.47:1, all
      failing) to dark ink (5.58–5.72:1).
- [ ] Apply `bg-primary-on-dark` at the three identity surfaces: `SlicePresentation`,
      `Homepage.tsx`, `CanvasEmptyState.tsx`. Lint guardrail is a three-file allowlist grep, not a
      rule — three call sites do not justify anything cleverer.

### Phase E — Non-colour accessibility.

- [ ] Extract one `focusRing` constant; migrate all 41 raw buttons off the six competing recipes.
      Start with the two shared utilities — `lib/filterToolbarButton.ts` (no focus rule at all)
      and `SidebarNav.tsx:29`. Upgrade the four `ring-1` sites (SC 2.4.11 focus area).
- [ ] Per-path `strokeDasharray` + distinct arrowhead geometry through `blueprintArrowPathProps`
      and `BlueprintArrowMarkerDefs`; mirror the dash onto `borderStyle` in
      `IntegratedPathSectionFrame`. *(SC 1.4.1)*
- [ ] **Render `pathsLegend` in the `embedded` branch** (`IntegratedBlueprintGrid.tsx:363`).
      Currently no persistent colour→name mapping exists in either shipping view — this is what
      turns arrows-by-colour from marginal into a clear failure. *(SC 1.4.1)*
- [ ] Slice-focus dim: raise `opacity: 0.22` (1.58–1.65:1 for `#000` text — a failure recorded in
      a code comment) to ≥0.45, or mark dimmed cells `aria-hidden` + `inert` so the text is not
      content. The perf constraint is preserved either way: the fix is the static value, not the
      transition. *(SC 1.4.3)*
- [ ] Add a `@media (forced-colors: active)` block. Zero handling exists today, and the frozen
      palette plus inline styles are overridden wholesale by the OS palette — for exactly the
      users who need contrast most. *(SC 1.4.1, 1.4.11)*
- [ ] Expand the 11 sub-24px targets, worst first: `VisualWalkthroughModal.tsx:219` (**6px**),
      `PathLabelBadge.tsx:58` and `CanvasAnnotationLayer.tsx:307` (12px). *(SC 2.5.8)*
- [ ] `role="tablist"` on `TabStrip.tsx:281` — orphaned `role="tab"`. *(SC 1.3.1)*
- [ ] Keyboard resize for `ResizableComparePanel.tsx:282`. *(SC 2.1.1)*

### Phase F — Cleanups this refactor should absorb.

- [ ] **`React.memo` on `BlueprintCellButton`**, with a per-cell selector instead of whole-context
      consumption. Every cell currently re-renders on every hover; this is a prerequisite for any
      later canvas work, and it is the largest performance number in the review.
- [ ] Collapse the blueprint cell fallback ladder. `--blueprint-cell-bg-origin` and
      `--blueprint-cell-bg` are always set to the same value, `--blueprint-cell-bg-panel` has one
      setter, and the `var(--secondary)` terminal is unreachable. Replace with two always-set
      tokens computed in TS.
- [ ] Delete `lib/filterToolbarButton.ts` — one call site, and its sibling in the same file
      hand-rolls the same pressed-state logic inline. Both go to `ToggleGroup`.
- [ ] Fold `techPillTheme.ts` (19 lines, one function) into `techPillColors.ts`. Rename
      `pathTypeTheme.ts` → `pathTypeLabels.ts` and move its two delegating colour functions into
      `pathColorTheme.ts` — three of nine importers currently reach into both.
- [ ] Move `blueprintCellButtonClassName` out of `blueprintCellStyle.ts` (layout classes in a
      colour-math module). Delete `getBlueprintCellRingColor` — `@deprecated`, zero importers.
- [ ] Fix `getBlueprintCellInteractionColors`: it returns the literal string `"#NaNNaNNaN"` for any
      non-6-digit hex, and its neutral branch *raises* chroma from ~0 to a fixed 14, amplifying
      rounding noise into a visible hue — `#F2F2F4` yields a blue-grey ring, `#F4F2F2` a red-grey
      one, 240° apart.
- [ ] Delete `@radix-ui/react-slot` (0 importers), `PATH_TYPE_SWATCH_CLASSES` (0 consumers),
      `defaultPathTypeMarkerIds` / `defaultPathTypeMarkerColors` (0 consumers), and
      `ScenarioSlideFilters.tsx` / `ScenarioSlideHeader.tsx` (no importers anywhere).
- [ ] `noImplicitReturns: true` in `tsconfig.app.json`. Only one of 24 `.status` comparisons is
      exhaustiveness-checked today, and only by accident.
- [ ] Add `text-2xs` to the retuned ramp (not appended at 0.625rem); migrate the 35
      `text-[10px]` / `text-[11px]` uses.
- [ ] Map the class-layer durations onto `@theme` keys (`--duration-structural: 320ms` →
      `duration-structural`). 46 `duration-*` utilities exist, including `duration-300` and
      `duration-450` — near-misses for `MOTION_STRUCTURAL_MS` (320) and `MOTION_CAMERA_MS` (420)
      that have silently drifted.
- [ ] Replace the `data-leaving` + magic 320 ms hold in `EditorShell.tsx:117` with an
      `animationend` listener (timeout as backstop) and a `preExit/exiting/exited` state so a fast
      re-entry reverses instead of being swallowed by `if (leaveTimer.current !== null) return`.
      The 320 in the timer and the `200ms + 120ms` in the CSS are two independent numbers that
      happen to sum.
- [ ] Add Base UI **`toast`** (`npx shadcn@latest add toast`) — zero new deps, and its
      `createToastManager()` module singleton is callable from `lib/sliceMutations.ts`. Wire the
      **success** path; keep the existing inline `<Alert>` error branch. Add `motion-reduce:`
      guards — Base UI ships no reduced-motion defaults.
- [ ] `ui/badge.tsx` uses `ring-[3px]`, `ui/button.tsx` uses `ring-3`. Same value, two spellings,
      in the two files Phase A touches.

### Phase G — Root-level light/dark, mirroring their theming model.

Supabase supports themes, so the migration does too. Their implementation is fifteen lines
(`packages/common/Providers.tsx`):

```tsx
<NextThemesProvider
  themes={['dark', 'light', 'classic-dark']}
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
```

`next-themes` 0.4.6 has **zero dependencies** and peers only on `react` / `react-dom` (React 19
included). Despite the name it is framework-agnostic — it is `localStorage` + `matchMedia` + a
blocking inline script. It works in a Vite SPA unchanged, so we adopt their provider verbatim
with `themes={['light', 'dark']}`.

Three of their four flags matter to us specifically:

- **`defaultTheme="system"` + `enableSystem`** — follows the OS, user can override. The app has no
  `prefers-color-scheme` handling at all today.
- **`disableTransitionOnChange`** — load-bearing here. We ship 46 `duration-*` utilities plus the
  `lib/motion.ts` vocabulary; without this flag a theme flip animates every colour property on
  every element simultaneously.
- **The injected blocking script removes the FOUC problem** — no hand-written `index.html`
  bootstrap needed. `index.html` currently has none.

#### What already works after Phases B–D

- `semantic.css` declares under `:root, .dark`, so `<html class="dark">` re-derives the whole
  engine — the same mechanism the presentation subtree already relies on. No new CSS.
- `themes/light.css` and `themes/dark.css` are written in Phase B regardless.
- **The Radix scales ship per-theme values** (`colors.css` carries light and dark blocks). This is
  where the Option-2 decision pays for itself: on the semantic-layer-only path, dark scale values
  would have been a separate job.
- **The overlay mechanism flips for free.** `--muted: oklch(from var(--foreground) l c h / alpha)`
  darkens in light (foreground L 0.1) and lightens in dark (L 0.95). One declaration, both
  directions.
- `--primary` is mode-invariant by measurement — 3.13 light / 5.81 dark.
- `print.css` forces light dials, so printing from dark mode stays correct.
- **Dark mode will look better than light does today.** The dark ladder is genuinely distinct
  (0.19 → 0.225 → 0.23 → 0.235 → 0.245 → 0.26, no clipping). Light is the degenerate case.

#### Tasks

- [ ] Add `next-themes`; wrap the app in their provider shape with `themes={['light','dark']}`.
- [ ] Declare `color-scheme: light` / `color-scheme: dark` in the respective theme files, so form
      controls, scrollbars and `input` widgets follow. Ours declares none today.
- [ ] Switch the presentation stage off its hardcoded `.dark` class onto a scoped
      `data-theme="dark"` (`SlicePresentation.tsx:164,183,225,500`). Under a root toggle the
      current form nests `.dark` inside `.dark`, redundantly re-substituting ~60 properties.
- [ ] Add a theme toggle to the editor chrome.
- [ ] **Per-surface dark audit** — the real work. See below.
- [ ] Widen the `--primary-on-dark` allowlist guardrail; its three-file scope was justified by
      "the presentation stage is the only dark surface", which stops being true.

#### The risk, stated plainly

**Nothing in this app has ever rendered at root-dark.** The presentation stage is one constrained
layout. Every panel, sidebar, tab strip, menubar, cell detail panel and compare grid is untested.
There are 30 `dark:` utilities in `components/ui/` (shadcn's own, likely correct) but only **7 in
all of app code** — so app-level dark treatment does not exist; it will be whatever the tokens
produce. Budget a real visual pass, not a switch flip.

Audit checklist, one screenshot each in both themes: overview canvas · scenario grid · cell detail
panel · sidebar at depth (phase → path → slice) · tab strip with a context menu open · menubar ·
compare grid · annotation toolbar · empty states · print preview.

#### Decision recorded: the blueprint canvas stays bright

`lib/blueprintTheme.ts` is fixed-hex for Figma and print parity, so dark mode means a dark shell
around a white blueprint. Figma itself works exactly this way. If the canvas should darken
instead, that unwinds the two-palette premise and the print guarantee with it — so it is a
deliberate call, not an oversight. State it in `blueprint.css`'s header.

#### Adding a third theme later is cheap

Supabase ships `classic-dark` (warmer, `--chroma: 0.014`, `--surface: 0.205`) as proof: a new
theme is one file of dial overrides plus one array entry. Nothing else changes.


### Phase H — Data layer: TanStack Query, matching theirs.

`@tanstack/react-query` 5.101.4 (Supabase catalog: ~5.83.0, so we lead). Devtools as a
`devDependency`, dynamically imported behind `import.meta.env.DEV` — the package has historically
not tree-shaken reliably out of production builds.

**Corrected rationale.** My original justification was wrong: `useSupabaseQuery.ts` *does* have
in-flight dedup (`:153`) and stale-while-revalidate (`:185-188`, with a comment saying so). The
real gaps are narrower and all verified:

- `raceSupabaseQuery` **leaks twice** — `Promise.race` never aborts the request and the
  `setTimeout` is never cleared. `.abortSignal(AbortSignal.any([signal, AbortSignal.timeout(10_000)]))`
  fixes both.
- `useSliceScenarioId:19` keys on `cellIds.join('|')` — **order-sensitive**, over an
  order-independent `.in()` query. Array keys eliminate the class; sorting in the key factory fixes
  the live bug.
- `useSliceBlueprint` is a **3-deep serial waterfall** (4 counting `findFirstLifecycleId`).
  TanStack does not fix it but makes it visible, and `useQueries` parallelises the fan-out.
- `queryCache` is a module-level `Map` that only shrinks on explicit invalidation — **unbounded**.
- No retry/backoff, no devtools.

#### Two things that will break silently if missed

1. **`source: 'database' | 'fallback'` has no TanStack equivalent.** It is produced at
   `useSupabaseQuery.ts:122` and branched on at `useCanvasBlueprints.ts:192`. An adapter that
   always emits `'database'` **typechecks perfectly** and silently turns that branch into dead
   code — the offline demo blueprints in `src/data/` (47 files) stop rendering, with no compile
   error and no throw. Carry provenance in the *resolved value* (`Sourced<T> = { data, source }`)
   so the `queryFn` is obliged to state it, and rewrite the consumer as a `switch` so a narrowed
   union becomes a type error.
2. **`refetchOnWindowFocus` defaults to `true`.** `SlicePresentation.tsx:90` holds `frame` in
   state and derives `clampedFrame` from `items.length`. A presenter alt-tabs, TanStack refetches,
   a collaborator's edit shortens the deck — **the slide changes mid-sentence, on a projector.**
   Set `false` globally with per-query opt-in.

#### Config

```ts
staleTime: 5 * 60 * 1000,        // editor content; revalidation is explicit
gcTime: 30 * 60 * 1000,          // survive long tab-switch round trips
refetchOnWindowFocus: false,     // see above — not a preference
refetchOnReconnect: true,
retry: (n, e) => !String((e as PostgrestError)?.code).startsWith('42') && n < 2,
```

`retry: 3` (the default) would take ~7 s of backoff before the offline fallback appears — a
visible regression against today's fail-fast behaviour.

#### Migration — strangler, one hook per PR

- [ ] `src/lib/queryClient.ts` (module scope, **never** in a render body — StrictMode would mint two)
      + `src/lib/queryKeys.ts` hierarchical factory, all segments `as const`, array segments sorted.
- [ ] `src/hooks/queryResult.ts` — the `toQueryResult` adapter. **This is what makes the migration
      incremental**: the app-facing `QueryResult<T>` union is unchanged, so no component moves.
      Order matters inside it — check `data !== undefined` *before* `status === 'error'`, so a
      failed refetch keeps serving the last DB value instead of snapping back to the demo board.
- [ ] Dual-dispatch bridge in the legacy `invalidateQueries` so `TabStrip.tsx:72-73` keeps working
      while hooks migrate one at a time.
- [ ] Migrate leaf-first: `useCellSpec` → `useEvidence` (delete its `reloadToken` cache-buster) →
      `useSlices`, `useLifecyclePhases` → `useSlice`, `useSliceScenarioId`, `useCanvasBlueprints` →
      `useSliceBlueprint` last (pure composition, migrates for free).
- [ ] Use `removeQueries` for deletes, not `invalidateQueries` — theirs means "refetch", ours meant
      "drop", and an inactive tab would otherwise serve a deleted slice from cache.
- [ ] Delete `useSupabaseQuery.ts` + `supabaseFetchTimeout.ts`.
- [ ] `noImplicitReturns: true` in `tsconfig.app.json` **before** starting — only 1 of 24 `.status`
      comparisons is exhaustiveness-checked today, and that one only by accident.
- [ ] Never spread the query result in a wrapper hook; it defeats `notifyOnChangeProps: 'tracked'`.
- [ ] `loading` maps to `isPending`, **never** `isFetching` — otherwise every background refetch
      creates a fresh `DeferredSkeleton` session and the canvas blinks.

Note: 7 of the 16 files in `src/hooks/` are query hooks. `src/hooks/` shrinks by one 190-line file;
the 7 get slightly longer once each declares its provenance.

### Phase I — Motion: framer-motion, scoped.

`framer-motion` 12.43.0 — same package as `motion` under Supabase's name, current version
(they are on 11.18.2). React 19 peer supported.

**The one hard constraint: no `motion` component inside `components/blueprint/`.** Neither grid
uses `React.memo`, and `BlueprintCellButton.tsx:89` consumes a hover context, so every cell
re-renders on every hover today. Per-cell `motion.div` on top of that is a measurable regression.
Supabase's studio has no 500-cell canvas; this is where our app genuinely differs from theirs.
Ship `React.memo` on `BlueprintCellButton` (Phase F) **first**.

#### Where it earns its place

| Motion | Today | With framer-motion |
| --- | --- | --- |
| Presentation enter/exit | `data-leaving` + a magic 320 ms `setTimeout` in `EditorShell.tsx:117`, decoupled from the CSS's `200ms + 120ms` | `AnimatePresence` — this *is* the hand-rolled thing |
| Tab / surface crossfade | CSS keyframes | `AnimatePresence` with the shared vocabulary |
| Sidebar collapse | CSS 320 ms | keep CSS — already correct |
| Camera zoom/pan ease | rAF `easeInOutCubic` | **keep rAF** — must stay interruptible and coordinate-space aware |
| Cell hover / badges | CSS transitions | **keep CSS** — see the constraint above |

#### Tasks

- [ ] Add `framer-motion@12`. Import via `LazyMotion` + `m` where practical; note honestly that
      `AnimatePresence` needs the `domAnimation` feature bundle, so the real cost is ~4.6 KB
      initial + ~15 KB deferred, not the ~6 KB I originally quoted.
- [ ] Replace the `data-leaving` + `setTimeout` pair in `EditorShell.tsx:105,117` with
      `AnimatePresence`. This also fixes two live defects: the 320 ms timer and the CSS's
      `200ms + 120ms` are independent numbers that merely happen to sum, and
      `if (leaveTimer.current !== null) return` swallows a fast toggle back into presentation.
- [ ] Drive every duration from `lib/motion.ts`, and mirror them as `--duration-*` tokens in
      `animations.css` (Phase B) so the CSS and JS sides cannot drift. **Three motion systems is
      the failure mode** — CSS keyframes, `lib/motion.ts`, and the 46 ad-hoc `duration-*`
      utilities already exist; framer-motion must replace the first, not become a fourth.
- [ ] `<LazyMotion strict>` so a stray `motion.*` import is a runtime error rather than a silent
      +34 KB.
- [ ] Honour `prefersReducedMotion()` at every `AnimatePresence` — it is read live in
      `lib/motion.ts`, which is the correct behaviour and must not regress to a mount-time capture.

### Forms and charts

- **`react-hook-form` 7.84.0** (Supabase: ^7.71.2) — adopt, but **with the panel editor**, not
  before. The app has exactly one `ui/input` usage and no forms today, so adding it now ships a
  dependency with zero consumers. Pair with `@hookform/resolvers` + `zod`; note Supabase pins
  `zod` 3.25.76 while current is 4.4.3, so that is a live choice at adoption time.
- **`recharts`** — deferred by decision. Nothing renders a chart, and `--chart-1..5` are deleted in
  Phase C. When charts land, rebuild those tokens from the brand rather than the neutral ramp.

## Dependency state after migration

Versions checked 2026-08-04 against npm and against `supabase/supabase` (`apps/studio/package.json`
plus the `pnpm-workspace.yaml` catalog).

### Bumps this plan takes

| Package | Ours now | To | Why |
| --- | --- | --- | --- |
| `@base-ui/react` | 1.6.0 | **1.7.0** | Released 2026-08-04. No breaking changes. Includes *"Restore visible focus after keyboard close in Safari and Firefox"* — lands directly on Phase A/E — plus popup and store bundle-size reductions. |
| `tailwindcss` + `@tailwindcss/vite` | 4.3.0 | 4.3.3 | Patch. |
| `vite` | 8.0.12 | 8.2.0 | |
| `react` / `react-dom` | 19.2.6 | 19.2.8 | Patch. |
| `lucide-react` | 1.17.0 | 1.28.0 | |
| `@supabase/supabase-js` | 2.107.0 | 2.112.0 | |
| `shadcn` (CLI) | 4.13.0 | 4.16.1 | devDependency. |
| `next-themes` | — | **0.4.6** | New — Phase G. Zero dependencies, React 19 peer. |
| `@radix-ui/react-slot` | 1.2.4 | **removed** | Zero importers. |
| `@tanstack/react-query` | — | **5.101.4** | New — Phase H. Supabase catalog is ~5.83.0. Devtools as a devDependency, dynamically imported behind `import.meta.env.DEV`. |
| `framer-motion` | — | **12.43.0** | New — Phase I. Same package as `motion`; we use Supabase's package *name* at the current version (they are on 11.18.2). |
| `react-hook-form` | — | 7.84.0 | **Not yet** — adopt with the panel editor. Zero consumers today. |
| `recharts` | — | — | Deferred by decision; nothing renders a chart. |

**Not chasing TypeScript 7.0.2.** We are on `~6.0.2` and so is Supabase's catalog — staying put
*is* parity. TS 7 is the Go rewrite; that is its own migration, not this one.

### Where we land relative to Supabase Studio

| | Ours (after) | Supabase Studio | |
| --- | --- | --- | --- |
| React | 19.2.8 | 19.2.6 | same line |
| TypeScript | ~6.0.2 | ~6.0.2 | **identical** |
| Vite | 8.2.0 | 8.0.16 | we lead |
| Tailwind | 4.3.3 | 4.2.4 | **we lead** |
| CSS architecture | 14-file mirror | source of truth | **identical** |
| Type stack | Inter / Manrope / Source Code Pro | same | **identical** |
| `next-themes` | 0.4.6 | 0.4.6 | **identical** |
| `class-variance-authority` | 0.7.1 | 0.7.1 | identical |
| `lucide-react` | 1.28.0 | 0.436.0 | we lead by a lot |
| **Primitives** | `@base-ui/react` 1.7.0 | `radix-ui` 1.4.3 | **deliberate divergence** |
| App framework | Vite SPA | Next 16.2.11 | structural, not closable |
| Toasts | Base UI Toast | `sonner` 1.5.0 | deliberate |
| **Motion** | `framer-motion` 12.43 | `framer-motion` 11.18 | **same library, we lead** |
| **Data layer** | `@tanstack/react-query` 5.101 | `@tanstack/react-query` 5.83 | **same, we lead** |
| Forms | `react-hook-form` 7.84 *(with the panel editor)* | `react-hook-form` 7.71 | same, sequenced |
| Charts | — | `recharts` 2.15 | deferred — no charts yet |
| Dependency count | ~20 + 16 dev | 122 + 57 dev | different scale of app |

The two systems converge exactly where it matters — the design system — and stay apart where the
apps genuinely differ. Notably we end up **ahead of Supabase on Tailwind itself**, so the mirror
targets an architecture they are still on the previous minor of.

## Descoped — each to its own plan

| Item | Why separate | Corrected rationale to carry over |
| --- | --- | --- |
| **⌘K palette** | New user-facing feature, zero relationship to colour. | Use Base UI **Autocomplete**, not Combobox — Base UI's own command-palette example is under Autocomplete, and `ComboboxContent` can't render inline in a Dialog. No shadcn `autocomplete` registry item exists (404), so budget a real ~150-line component; or use `cmdk` via `add command` and accept one non-Base-UI dep. |
| **`perfect-freehand`** | Best value-to-risk of the library additions (v1.2.3, Feb 2026, 2 KB gzip, zero deps, one file, revertible), but it belongs with the `CanvasAnnotationLayer` split. | `CanvasAnnotationLayer` has **zero `useMemo`** across 2151 lines and re-runs `pointsToPath` for every committed annotation on every draft frame. `getStroke` is 5–10× that cost and has **no incremental API** — it re-solves the whole point array per pointermove. Memoize by `annotation.id` **first**. Gate zoom while a stroke is in flight: simulated pressure is `distance / size`, so the same hand speed at zoom 0.25 reads as 4× faster and the stroke retroactively changes width. Store **raw input points plus the options object**, never the outline — the outline is the algorithm's output and would silently reshape on an upstream tweak. `getStroke` returns a **filled polygon**, so `vector-effect="non-scaling-stroke"` does nothing; constant screen-space width is not achievable without regenerating. Detect simulated pressure with Excalidraw's heuristic (`event.pressure === 0.5` ⇒ mouse/trackpad); feeding a trackpad's raw `0` with `simulatePressure: false` yields invisible ink. Bus factor 1, and tldraw has already vendored its own fork — at 4 KB of pure math, vendoring is a viable exit. |
| **Canvas input normalization** (~150 lines, replaces the `@use-gesture` idea) | Three verified cross-browser bugs, independent of everything else here. | **Desktop Safari pinch-to-zoom does not work today** — zero handling of `gesturestart`/`gesturechange`/`gestureend` anywhere in the repo, and macOS Safari trackpad pinch emits those rather than `ctrl+wheel`, so the browser page-zooms instead. **Firefox wheel speed is ~40× off** — `useZoomPanViewport.ts:418` reads `e.deltaY` raw with no `deltaMode` check (Firefox reports lines, not pixels). **No `touch-action`** declared anywhere, so touch pinch fights native gestures. Also add `document`-level `gesturestart`/`gesturechange` suppression, or Safari's accessibility zoom fights the canvas. |
| **Overlay conversion** | 23 breakage sites for a benefit confined to ~100 chrome elements in a single-theme app. | Trigger: root-level dark mode. |

## Rejected

- **Radix migration** — shadcn made Base UI the default in July 2026; 26 wrappers rewritten to
  land on the deprioritised layer, and the colour system has zero primitive coupling.
- **Vendoring `@supabase/ui`** — pulls Radix, framer-motion, cmdk, vaul, recharts and a ~60-name
  compat layer.
- **View Transitions** — see Enhancement Summary #7. Two independent teardowns.
- **`@use-gesture/react`** — two independent reasons. It regresses the one hot path that
  deliberately avoids React (`commitTransform(syncReact=false)`), since its idiom is
  handler→setState and the grid is unmemoized. And it is **frozen**: no code release since
  2024-03-21, no `main` commit since 2024-07-15, with PRs from 2025–26 unmerged including a
  one-line `setPointerCapture` crash fix (#701/#706). Its wheel normalization is
  `deltaMode × 40 / × 800` — one line. Its *pinch* normalization is genuinely valuable (four
  input paths behind one event, including the Safari gesture events the app is missing), but
  that is ~150 lines worth owning rather than an 8.9 KB unmaintained dependency. Also requires
  `target` + `eventOptions: { passive: false }`, so it is not a drop-in spread.
- **`sonner`** — conclusion unchanged, but **one of the two original reasons no longer applies.**
  I rejected it partly because its `base-nova` entry pulls `next-themes` into a Vite SPA that had
  none; Phase G now adopts `next-themes` deliberately, so that objection is void. It still loses on
  the rest: Base UI Toast adds **zero** new dependencies (`@base-ui/react` is already installed),
  keeps the UI layer on one primitive library, and offers anchored toasts via `Toast.Positioner` —
  genuinely useful on a canvas ("Slice deleted", near the tab strip) and something sonner cannot
  do. Base UI 1.6 also closed the gap that made sonner attractive: swipe-to-dismiss,
  collapse/expand stacking, `toast.promise()`, upsert-by-id and undo actions all ship.
- **`vaul`** — `ui/drawer.tsx` already wraps `@base-ui/react/drawer`.
- **`react-resizable-panels`** — 1D panel-group splitting; `ResizableComparePanel` is free 2D
  resize with content auto-fit. Wrong shape.

**No longer rejected** (superseded by the parity decision, 2026-08-04): `framer-motion` → Phase I,
`@tanstack/react-query` → Phase H, `react-hook-form` → adopted with the panel editor,
`recharts` → deferred until charts exist.

## Acceptance Criteria

### Functional

- [ ] Focus indicator ≥3:1 against **all ten** surfaces: light canvas, dark canvas, blueprint
      canvas `#E8E8ED`, and each of the 8 `BLUEPRINT_CELL_PALETTE` fills
- [ ] `index.css` global outline is full-alpha; no `outline-ring/50` remains
- [ ] Unit test asserts `ringSoft` ≥3:1 for every entry in `BLUEPRINT_CELL_PALETTE`
- [ ] `--success` is not an alias of `--primary`
- [ ] `--primary-on-dark` resolves to `oklch(0.874 0.1025 177.6)` and appears only in the three
      allowlisted files
- [ ] `oklch(from …)` survives the build unflattened — `grep -c "oklch(from" dist/assets/*.css`
      returns non-zero (Lightning CSS can only statically fold RCS over *literal* origins; a zero
      would mean it flattened ours and the theme is frozen at build time)
- [ ] No `abs()` in any authored CSS
- [ ] `--accent` over `--card` measures > 1.00 contrast in light mode — the overlay conversion's
      whole purpose
- [ ] No hex literal under `src/styles/` **except `blueprint.css` and `print.css`**
- [ ] No custom-property name declared in both `themes/*.css` and `semantic.css`
- [ ] No `var(--color-*)` in hand-written CSS
- [ ] The `.dark` subtree at `SlicePresentation.tsx:164` resolves fully dark tokens
- [ ] `<html class="dark">` at the root resolves fully dark tokens, with no nested re-derivation
      from the presentation stage
- [ ] Theme follows the OS by default and persists a user override across reloads
- [ ] No flash of the wrong theme on first paint, in either direction
- [ ] Switching themes animates nothing (`disableTransitionOnChange`)
- [ ] `color-scheme` is declared per theme, so native form controls and scrollbars follow
- [ ] Every surface in the audit checklist screenshotted in both themes
- [ ] Print output byte-identical to the pre-refactor baseline
- [ ] `BLUEPRINT_CELL_PALETTE`, `PATH_TYPE_COLORS`, `TECH_PILL_COLORS` **values** unchanged
      *(relaxed from "files byte-identical" — that criterion froze the `ringSoft` defect, a
      `Record<string,string>` that accepts any key, and a focus-ring hue set by rounding noise)*

### Non-functional

- [ ] `--primary` ≥3:1 on light canvas, dark canvas and sidebar
- [ ] On-colours ≥4.5:1 in both themes
- [ ] Style-recalc total (DevTools CSS selector stats, 3 s on the overview canvas, one
      slice-focus toggle) grows ≤15 %
- [ ] Composited layer count does not increase
- [ ] Zero new runtime dependencies in Phases A–F
- [ ] `npm run build` clean; no new eslint errors

### Quality gates

- [ ] Phase B verified by screenshot on 4 routes + a print preview, before any value changes
- [ ] Phase A verified by keyboard-tabbing the toolbar, tab strip, sidebar and cell panel, with a
      measured ratio for each focus stop
- [ ] Screenshot test of sidebar selection **with `--sidebar-selected` disabled** — proves the
      rail carries the affordance rather than asserting it
- [ ] The Phase B swatch page becomes a **permanent dev route**, not a throwaway. It is the only
      regression test available for a system with no error channel.

## Adjudications

**`--sidebar-selected` at 1.24:1 — the argument holds.** SC 1.4.11 requires only the cue(s)
*needed* to identify the state to meet 3:1; the 2px full-chroma rail at 3.13 is a conforming
indicator and the tint is supplementary. SC 1.4.1 is satisfied because the rail is a
presence/position cue, not a colour, and `SidebarNav.tsx:145` already sets `aria-current`.
Four conditions make it testable rather than asserted: the rail must survive the collapsed
hover-peek state; measure the *rendered* rail at DPR 1 (2px + radius can go sub-pixel); it needs
a `Highlight` fallback under `forced-colors`; and hover / selected / ancestor must differ by more
than tint alpha.

**Blueprint theme-immunity — defensible, and under-sold.** The frozen palette is the *most*
accessible surface in the product: 15.35–18.78:1 body text, 6.32–7.08:1 lane labels, every border
far past 3:1. WCAG imposes no requirement that content respond to a theme preference. The defect
is not the palette — it is **semantic tokens leaking onto it**: the ring today, and overlays
prospectively. The two-palette rule protects the blueprint *from* the theme and currently does
nothing to stop the theme's focus colour landing on top of it. The real gap is `forced-colors`,
not dark mode.

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Import order regressed by a formatter or tidy-up | Medium | **High** — silent dark + print failure | CI check on disjoint property names; header comment stating order is semantic |
| Light-ladder decision deferred, `--surface` raised alone | Medium | High | Bound: `--surface` must not change before the elevation work |
| Two-tone ring rejected on aesthetics, single anchor too dark | Medium | Medium | `#0A8271` pre-measured on all ten surfaces (min 3.45) |
| `ringSoft` fix shifts cell focus appearance | High | Low | It is currently 1.86:1; any change is an improvement. Unit-test the floor |
| Phantom classes turn out to be load-bearing | Low | Medium | Resolve before Phase B, not during |
| Path dash patterns clash visually with the Figma reference | Medium | Low | Prototype on one scenario before rolling out |

## Sources & References

### Internal

- Design-system audit: <https://claude.ai/code/artifact/5327dfd0-d1cb-48f7-89a7-177234b8dfc8>
- `src/index.css` — `:10-71` token map, `:85-233` dials + derived, `:235-410` utilities,
  `:414` global outline, `:454-565` motion, `:572-670` print
- `src/lib/blueprintCellStyle.ts:118` — `ringSoft` floor; `:5-158` colour math
- `src/lib/blueprintTheme.ts:94-104` — frozen palette
- `src/components/ui/button.tsx:22-24` — blueprint variant fallback chain
- `src/components/blueprint/BlueprintCellButton.tsx:19,89,125` — required `fill`, hover context
- `src/components/editor/SlicePresentation.tsx:164,183,225,500` — the `.dark` subtree
- `src/components/editor/EditorShell.tsx:105,117` — re-entry guard, magic 320 ms
- `src/components/editor/NavbarSlideTitleNav.tsx:150` — invisible focus
- `src/components/blueprint/IntegratedBlueprintGrid.tsx:363` — suppressed legend
- `src/hooks/useSupabaseQuery.ts:153,185-188` — dedup and SWR
- Prior plans: `docs/plans/2026-07-30-001-…`, `docs/plans/2026-07-30-002-…`

### External

- Supabase semantic engine, themes, Tailwind token map —
  <https://github.com/supabase/supabase/tree/master/packages/ui/build/css>,
  <https://github.com/supabase/supabase/blob/master/packages/config/css/theme.css>
- shadcn: Base UI as the default, July 2026 —
  <https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default>
- Tailwind v4 hardcoded Lightning CSS targets —
  <https://github.com/tailwindlabs/tailwindcss/blob/main/packages/%40tailwindcss-node/src/optimize.ts>
- Lightning CSS transpilation — <https://lightningcss.dev/transpilation.html>
- css-color-5, relative colors (values are **not** clamped except alpha) —
  <https://drafts.csswg.org/css-color-5/#relative-colors>
- css-variables-1, invalid at computed-value time —
  <https://www.w3.org/TR/css-variables-1/#invalid-variables>
- WCAG 2.2 SC 1.4.11 — <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>
- Base UI Toast / Autocomplete — <https://base-ui.com/react/components/toast>,
  <https://base-ui.com/react/components/autocomplete>

### Research notes

Contrast and gamut figures computed locally (sRGB → OKLab → WCAG relative luminance, binary-search
gamut mapping per hue) and independently reproduced by the accessibility sweep. Tailwind v4
behaviour verified by building the planned split against Tailwind 4.3.3 / Lightning CSS 1.32 /
Vite 8.2. Registry dependencies checked against
`https://ui.shadcn.com/r/styles/base-nova/{toast,combobox,command,sonner,autocomplete}.json` on
2026-08-04.
