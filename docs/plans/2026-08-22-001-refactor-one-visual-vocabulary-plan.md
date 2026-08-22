---
title: "One visual vocabulary: five layers, five defects, and a value written once"
type: refactor
status: active
date: 2026-08-22
repos: uno-blueprint
---

# One visual vocabulary

## Overview

Three audits — spacing, colour, and type/radius/border/shadow/motion — over
`src/components/blueprint/`, `src/components/editor/`, `src/lib/` and
`src/styles/`. Every claim below was re-verified in the running app before it
was written down.

**The headline is not what the numbers suggest.** 974 spacing utilities, 216
primitive colour steps, 81 registered colour names — but zero hex literals in
`.ts`/`.tsx`, zero primitive ramp class names in components, and 300 references
to named layout constants. **The plumbing is genuinely good, and a lint test
already enforces the hard part.**

What is wrong is the naming layer, and it is wrong in one specific way that
repeats on every axis:

> **A value that must equal another value, with nothing saying so.**

That single shape produced: two spacing constants declared twice under one
name, a whole colour ramp duplicated under a second name, a radius token that
duplicates its neighbour, a border width declared twice where the busier code
path reads the literal, and a duration that has already drifted 40ms apart in
two files. It also produced the bug that cost an afternoon on 2026-08-21 — the
lane rail and the cell slot hard-coding the same inset in different files.

Five of the findings are **live defects**, not tidiness. Three of those are
visible on screen right now.

The user has explicitly authorised changing values: *"it is totally ok to
change from original value, we want to ensure a robust visual system that is
clean, straightforward, easy to audit and comprehensive."* This plan takes that
seriously — several proposals below delete rungs and move values rather than
renaming what ships.

---

## Part 1 — The five live defects

Fix these first. They are independent of the restructure and each is small.

### D1 — Dark mode has been running the wrong hue

`--surface-hue: 34` is declared in `themes/light.css:31` on `:root, .light`.
`themes/dark.css` never redeclares it. `:root` still matches an element
carrying `.dark`, and light.css imports after semantic.css, so the light value
wins in both themes.

**Verified live:**

```
light   --surface-hue: 34    --background: oklch(0.995 0     34)
dark    --surface-hue: 34    --background: oklch(0.19  0.0025 34)   ← --hue is 177.6
```

`dark.css:18-19` sets `--chroma: 0.005` with a comment saying dark surfaces
"carry a trace of the brand hue." They carry a trace of hue 34 — warm brown —
instead of the brand's blue-green. A documented intent the cascade defeats.

**Fix:** add `--surface-hue: var(--hue)` to `dark.css`. **Then prevent the
class:** a three-line test comparing the key sets of `light.css` and `dark.css`
would have caught this and will catch the next one.

### D2 — The divider caption fails WCAG AA in both themes

`BLUEPRINT_THEME.dividerLabel = 'var(--color-gray-900)'` renders on rows filled
with `dividerBg = 'var(--color-slate-500)'`.

**Verified live:** `rgb(143,143,143)` on `rgb(230,232,235)` = **2.63:1**,
against 4.5:1 required for 11px text. Dark measures 2.74:1.

Step 900 is Radix's low-contrast *solid* step, not a text step. This is a value
that should **change**, not be renamed: move to step 1100, the text weight the
rest of the board already uses, for ~5.6:1.

Worth noting: this is the caption whose *position* was adjusted four times on
2026-08-21. Nobody checked whether it could be read.

### D3 — Annotation swatch checkmarks are invisible in dark mode

`isPaleAnnotationSwatch()` picks a **frozen** near-black ink for every swatch
but one, while the swatch fills are theme-flipping primitives (steps 300/500),
which are near-black in dark. Measured: **1.13–1.19:1** on fill swatches,
**1.33–1.72:1** on sticky swatches, 1.00:1 on paper. In light they are 13–17:1.

A membership test cannot answer "is this pale?" for a value that inverts.

**Fix:** the swatch button already sets `backgroundColor: color`. Add
`data-blueprint-fill` and delete the conditional — the existing CSS derivation
answers the on-colour question correctly in both themes, and is already the
mechanism path badges and divider tags use.

### D4 — Bare `rounded` is a 4px rung that ignores the dial

**Verified live** by mutating the dial at runtime:

| | at `--radius: 0.625rem` | at `--radius: 2rem` |
| --- | --- | --- |
| `rounded` (bare) | 4px | **4px** |
| `rounded-lg` | 10px | 32px |

Tailwind v4 inlines its own `@theme` default for the bare utility, and this
repo sets `--radius` in a plain `:root` block, so the bare utility never sees
it. 11 sites. **A rung that silently ignores the dial is worse than an
arbitrary value, because it looks tokenised.**

### D5 — `palette.test.ts` asserts a property while sampling only where it holds

`palette.test.ts:469` — *"keeps named paths off the lane families too"* —
samples only `path_type: 'variant'`, i.e. only `PATH_OPEN_FAMILIES`. But
`happy` is `green-1100` and the `actor` lane is the green family. **They
collide, and the test never looks.** Disjointness is asserted in
`pathColorTheme.ts:61` and `docs/design/foundations/color.md:63`.

**Fix:** extend the test to `Object.values(PATH_TYPE_COLORS)` **and expect it
to fail** — that failure is the finding. Then either narrow the documented
claim (honest: the palette is fully allocated, see below) or move `happy`.

---

## Part 2 — The duplicates

Same shape, five axes. Each is a value that must equal another value with
nothing holding them together.

| Axis | Finding | Evidence |
| --- | --- | --- |
| Spacing | `VISUAL_PLAY_GUTTER = 28` exported **and** shadowed by a local const carrying a verbatim copy of the same doc comment | fixed 2026-08-22, `01eaf93` |
| Spacing | `INSERT_HIT_HALF_PX = 8` declared once per axis in two files | fixed, `01eaf93` |
| Spacing | `SERVICE_DIVIDER_RULE_OVERHANG = 20` with the addition done by hand beside a sibling reading `H_INSET + 12` | fixed, `01eaf93` |
| Colour | The **`scale` ramp** is byte-exact `slate` (light) / `gray` (dark) at 11–12/12 steps, **24 duplicated values, zero consumers** | open |
| Colour | `global.css` re-declares gray as `--colors-gray-*`, matching within 0.35% at all 24 steps — a **third** neutral ramp | open |
| Colour | `--color-tertiary-foreground` and `--color-foreground-contrast` each declared **twice**, both dead | open |
| Colour | `BLUEPRINT_THEME`: **13 keys, 8 distinct values**. One pair is `dividerTagBg`/`cellText` — a background and a text colour holding one value | open |
| Colour | `--ring-blueprint-cell` === `-soft` and `--background-blueprint-cell` === `-origin` in **16/16** blocks (32 duplicate declarations) | open |
| Radius | `--radius-panel: 6px` is dead and exactly equals `--radius-sm` — **verified**, and still documented as real in `layout.md` | open |
| Border | 3px path outline declared twice; `getPathTypeSectionBorderStyle` delegates for named paths, so **the common path never reads the constant** | open |
| Motion | Focus pulse is **1300ms in TS, 1260ms in CSS** — already drifted, unpinned | open |
| Motion | Tailwind's `--default-transition-duration: 150ms` is a **third, unpinned copy** of `--motion-micro` that ~130 bare `transition` classes consume | open |

**One rule would have prevented all of it, and it is the rule this plan
proposes adopting:**

> **A value may be written once. If two names want it, one is an alias, aliases
> live in `compat.css`, and aliases are deleted on a schedule.**

Today `slate-500` is the label rail, the divider row, the scenario panel *and*
the `visual` lane cell — four meanings, one value, and no way to change any of
them independently. That is the whole auditability problem in one token.

---

## Part 3 — The proposed structure

Top-down, five layers, with a hard rule that **a name may be declared in
exactly one layer**.

### Colour — five layers, ~35 semantic names (down from 81)

```
L0  DIALS        ~20, per theme, PARITY ENFORCED BY TEST
                 --hue --surface-hue --chroma --surface --contrast
                 --{warning,destructive,info,success}-lightness …
                 ↓ every dial in BOTH files, no inheritance. D1 cannot recur.
L1  PRIMITIVES   16 families × 12 steps  (delete `scale`, delete the
                 --colors-gray-* half of global.css)
                 ↓ referenced only by L2 and the 5 sanctioned board modules
L2  SEMANTIC     ~35 names, one per QUESTION A COMPONENT ASKS
                 surfaces(6) · ink(4) · edges(5, one ladder) · brand(4)
                 · status(16 — a uniform 4-token shape per role)
                 · selection(3)
                 ↓
L3  FROZEN       4 names, explicitly mode-invariant AND LABELLED SO
                 --background-annotation-chrome · --foreground-annotation-chrome
                 · --background-scrim · --background-logo-plate
                 ↓ a frozen ink may only pair with a frozen fill. D3 cannot recur.
L4  DOMAIN       6 names, not 12: -cell, -cell-hover, -cell-pressed,
                 -cell-ring, -cell-foreground, -panel
                 every fill derives its ink through one [data-blueprint-fill]
```

L3 is the load-bearing idea. D3 happened because a frozen ink was paired with a
flipping fill; giving frozen surfaces their own layer makes that pairing
visible at declaration time.

The status block deserves the uniform shape: today `warning`/`destructive` have
5-step ramps while `info`/`success` have none, and three of those steps have no
consumer.

### Typography — 10 sizes, 3 trackings, 4 leadings, 3 weights, 11 roles

The sizes are already disciplined. **The roles are not** — one semantic role,
"small uppercase label", has **eight** distinct treatments across 15 sites.

`PANEL_TEXT` already proved the fix works: name the role, and repetition
survives. It is consumed 20 times and has not drifted. The plan widens it to
`src/lib/textRoles.ts` with 11 roles including `eyebrow`, `timeMarker`,
`displayTitle`, `badge`.

**Tracking collapses to three values**, and the rule gets teeth:

```
tracking-tight   -0.025em   DISPLAY ONLY, ≥24px. Nothing smaller. Ever.
(default)         0          everything ≤20px
tracking-wider    0.05em     uppercase eyebrows and the time-marker register
```

`panelText.ts:20-27` already argues this ("both are display-type devices…at
14px they do the opposite"). It is contradicted by `menubarHeaderLayout.ts:72`
— the same role, same size, same weight, differing only by the forbidden
tracking — and by ~12 call sites at 12px and below. A stale docblock at
`panelShell.tsx:328` still *documents* the removed string as "the cell panel's
typography", which will reintroduce it.

`leading-snug` (25 uses at 11–14px) is the second half of the pair the rule
rejected and was never cleaned up.

### Radius — six rungs named by ROLE

```css
--radius-hairline : 4px                        /* swatches, inline code, tooltip arrows */
--radius-control  : calc(var(--radius) - 2px)  /*  8px — buttons, inputs, menu items */
--radius-cell     : var(--radius)              /* 10px — cells, popovers, tooltips */
--radius-card     : calc(var(--radius) + 4px)  /* 14px — cards, dialogs, drawers */
--radius-region   : calc(var(--radius) + 8px)  /* 18px — canvas frames, panels */
--radius-pill     : 9999px
```

Named by role so a reviewer can ask "is this thing that kind of thing" rather
than "is 14 right here". Retires `--radius-panel` (dead dupe), `--radius-3xl`
(unused), `--radius-4xl` (props up one vendored badge class on a 20px element),
bare `rounded`, and the 1/2/3px arbitraries.

Resolves two real inconsistencies: **two card radii ship at once** (project
cards `rounded-2xl` 18px, vendored `Card` `rounded-xl` 14px), and **three
canvas region frames** draw the same kind of boundary at two radii and three
border widths with no stated meaning.

**Keep verbatim:** the concentric derivation at `BlueprintStepVisual.tsx:101` —
`calc(var(--radius-lg) - var(--spacing) - 1px)`. It is the best-argued token
decision in the repo, documented and pinned. Restate it against the new names.

### Border width — three, named for what they bound

```css
--border-hairline : 1px   /* every edge, divider, card outline — the default */
--border-emphasis : 2px   /* a selected object's own edge */
--border-region   : 3px   /* a boundary drawn AROUND a region of the board */
```

Runtime twin `BLUEPRINT_REGION_OUTLINE_WIDTH = 3` in `blueprintLayout.ts`,
consumed by `pathColorTheme`, `pathTypeTheme`, and
`CompareDifferencesSurface.tsx` (whose `border-t-[3px]` is a third spelling of
the same idea).

### Shadow — a ladder that is a function of the z band

```css
--shadow-resting  : none                          /* z-0…z-20 — lightness carries it */
--shadow-raised   : 0 1px 2px …, 0 1px 3px …      /* z-30 */
--shadow-floating : 0 8px 28px rgb(0 0 0 / .30)   /* z-40 — exists already */
--shadow-overlay  : 0 12px 32px -8px …            /* z-50 */
```

**Rule: the shadow rung is a function of the z band.** Testable, and it fixes
the current state where the z-50 cell detail panel wears the app's *weakest*
shadow while a z-30 mobile FAB wears `shadow-lg`.

`elevation.md:22` already states the rule — *"if it floats over the board, it
uses `--shadow-floating`"* — and names the cell detail panel and agent float
specifically. Both use something else. Eight floating surfaces picked
`shadow-md`/`lg` by eye; `shadow-md` (20 uses) is the de-facto floating shadow
and has no name.

### Motion — keep the five durations, close three holes

The motion system is **the model the other axes should copy**: five durations,
two eases, two homes, and `motion.test.ts` holding them together. Add:

```css
--motion-defer   : 300ms    /* the hold before a loading indicator may appear */
--motion-ambient : 1260ms   /* looping emphasis: skeleton breath, focus pulse */
--ease-exit      : cubic-bezier(0.4, 0, 1, 1)   /* the ease-in every exit uses by hand */

--default-transition-duration        : var(--motion-micro);
--default-transition-timing-function : var(--ease-structural);
```

That last pair is one line that makes ~130 bare `transition` classes join the
vocabulary instead of shadowing it.

---

## Part 4 — What the tests cannot currently see

Both audits found the same failure mode in the guards themselves, which is
worth naming because it is why these defects survived.

| Guard | Blind spot |
| --- | --- |
| `tokenDiscipline.test.ts` | Scans only `src/components/**.tsx`. `src/lib/filterToolbarButton.ts:8` already carries `border-border/60` and a raw `ring-black/[0.04]` — the exact patterns it forbids. Also cannot see `bg-*` alphas, `var(--color-ramp-step)` in `style={{}}`, or any `src/styles/*.css`. |
| `palette.test.ts` | Measures every pair whose halves come from the **same** primitive family, and none that cross families. **Every failure in this plan is a cross-family pair.** The 7 touchpoint tones get lane-equivalent treatment and zero assertions. |
| `motion.test.ts` | Reads only `animations.css` and `blueprint.css`. `utilities.css` holds an `animation:` with no reduced-motion block and is invisible to the guard. |
| `canvasStackingContract.test.ts` | Pins `z-[30]` in its arbitrary spelling, so the test now **enforces** the off-scale form. |
| `railRhythmContract.test.ts` | Hardcoded a caption width measured at an unrecorded zoom — 221px against a real 200px — and passed anyway, because it only compared the constant against itself. Fixed 2026-08-22. |

**The pattern: a guard that samples where the property holds.** Extending
coverage is higher-value than any single rename here.

---

## Part 5 — Sequencing

Five phases, ordered so each is independently shippable and the risky one comes
after the guards exist.

**Phase 1 — the five live defects.** D1–D5. Small, independent, no restructure.
Ship first; D1 and D2 are user-visible today.

**Phase 2 — the guards, before the restructure.** Extend `tokenDiscipline` to
`src/lib/**`, add cross-family pairs to `palette.test.ts`, add the theme-parity
test, point `motion.test.ts` at `utilities.css`. **This phase must land before
Phase 4**, because it is the only thing that will tell us whether a 900-site
rename broke something.

**Phase 3 — delete the dead.** `scale` (24 values + 12 registrations), the
`--colors-gray-*` half of `global.css`, the 24 zero-consumer semantic names,
the double-declared pairs, `--radius-panel`, `--radius-3xl`/`4xl`,
`--ring-blueprint-cell`, `--background-blueprint-cell-origin`. Deletion only —
no renames — so the diff is reviewable and any breakage is a missing import
rather than a wrong value.

**Phase 4 — the layers.** Colour L0–L4, `textRoles.ts`, the radius and shadow
ladders. This is the large one. Do it axis by axis, not all at once.

**Phase 5 — the docs.** `color.md`, `typography.md`, `elevation.md`,
`layout.md`, `motion.md` all contain claims this plan falsifies: the
"17 ramps with gray/scale free" premise is stale (`gray` went to
`partner-action` on 2026-08-21, `scale` is a duplicate), `elevation.md`'s
"exactly one addition" misses a second custom shadow, `layout.md` documents
`--radius-panel` as real.

---

## Part 6 — The constraint nobody has written down

**The palette is fully allocated.** 16 hue/neutral families: **9 to lanes**,
**7 to touchpoint tones**, zero spare. A tenth lane or an eighth tone has
nowhere to go, and nothing in the code says so.

This is the single most important thing to record, because it is invisible
until someone tries to add a lane and finds the palette full. The proposed
structure reserves two families explicitly with a comment naming them as the
headroom.

It also explains D5: `happy` cannot move off green without displacing
something. Narrowing the documented claim is the honest fix, not a reallocation.

---

## Acceptance criteria

### The defects

- [ ] `--surface-hue` resolves to `var(--hue)` in dark; a parity test compares the two theme files' key sets
- [ ] The divider caption measures ≥4.5:1 on its own row in both themes
- [ ] Annotation swatch checkmarks measure ≥4.5:1 on every swatch in both themes
- [ ] Changing `--radius` moves every radius in the app, including what is now bare `rounded`
- [ ] `palette.test.ts` checks all of `PATH_TYPE_COLORS` against lane families, and the docs match whatever it finds

### The structure

- [ ] No colour value is written twice under two names outside `compat.css`
- [ ] Every L0 dial is declared in both theme files
- [ ] `tracking-tight` appears only at ≥24px
- [ ] Every floating surface uses the shadow rung its z band names
- [ ] `BLUEPRINT_THEME` has one key per distinct value
- [ ] The allocated-palette constraint is stated in code, next to the families

### The guards

- [ ] `tokenDiscipline` covers `src/lib/**` and `bg-`/`text-` alphas
- [ ] `palette.test.ts` covers cross-family pairs, including all 7 touchpoint tones
- [ ] `motion.test.ts` reads every stylesheet that declares an `animation:`
- [ ] No contract test hardcodes a measurement without the conditions it was taken under

## Risks

| Risk | Mitigation |
| --- | --- |
| A 900-site rename breaks something no test covers | Phase 2 before Phase 4, deliberately |
| Deleting a "dead" token that is live via a compiled class | `--field` and `--control-raised` are live via `bg-field`/`bg-control`; grep compiled output, not source, before each deletion |
| Changing `dividerLabel` to step 1100 shifts a colour people know | It is a legibility fix, not a preference; the current value fails AA |
| The restructure stalls half-done | Phases 1–3 are independently valuable and leave the system better even if 4 never lands |

## Sources

- Spacing audit, 2026-08-22 — 974 utilities, 61 arbitraries, ~22 style-object literals against 300 constant references
- Colour audit, 2026-08-22 — 216 primitives, 81 registered names, 47 semantic declarations, 12 component tokens
- Type/radius/border/shadow/motion audit, 2026-08-22
- Live verification: `--surface-hue` in both themes; divider caption contrast; bare `rounded` against a mutated dial; `palette.test.ts:469`'s sampling
- `docs/design/foundations/{color,typography,elevation,layout,motion}.md` — the documented rules this plan measures against
