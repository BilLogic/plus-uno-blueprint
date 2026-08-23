---
title: "One visual vocabulary: five layers, five defects, and a value written once"
type: refactor
status: active
date: 2026-08-22
updated: 2026-08-22 — benchmarked against supabase/supabase @ master; issue ledger added; Part 7 scopes the audit extension; Part 8 records Lane F/A/B results — rows 1, 2, 8 re-spec'd, rows 25-34 added
repos: uno-blueprint
benchmark: github.com/supabase/supabase packages/config + packages/ui/build/css
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

**The benchmark is not a comparison — it is a diff against our own upstream.**
`src/styles/` was forked file-for-file from Supabase's config layer on
2026-08-04 (`a169838`, `65a94b6`: "mirror Supabase's CSS architecture"). So
Part 0 below reads as *where we diverged, what we inherited, and what upstream
does that we should pull*. Two of the five live defects are fork divergences.

---

## The ledger — every issue caught, and the fix proposed

One row per finding. "Phase" refers to Part 5. Evidence for each row is in the
part named in the last column.

| # | Issue | Where | Proposed fix | Phase | Detail |
| --- | --- | --- | --- | --- | --- |
| 1 | Dark mode runs `--surface-hue: 34` (warm brown), not the brand hue | `themes/light.css:31` declares on `:root, .light` | ⚠ **Fix re-spec'd — the stated root cause is wrong.** The defaults were never deleted; they lose on source order. See Part 8 §D1 | 1 | Part 8 §D1, Part 1 D1 |
| 2 | Divider caption contrast 2.63:1 (AA needs 4.5) | `BLUEPRINT_THEME.dividerLabel` = gray-900 | ⚠ **gray-1100 does NOT clear AA in light (4.11:1).** Use step 1200. See Part 8 §D2 | 1 | Part 8 §D2, Part 1 D2 |
| 3 | Annotation checkmarks 1.13:1 in dark — **and the one 'safe' swatch is broken too, and light mode fails on the stroke row** | `isPaleAnnotationSwatch()` pairs a frozen ink with a flipping fill | Delete the conditional; use `[data-blueprint-fill]` derivation; long-term, L3 frozen layer | 1 → 4 | Part 1 D3, Part 3 |
| 4 | Bare `rounded` is a literal 4px that ignores `--radius` | 11 sites | Role ladder replaces it; `tokenDiscipline` forbids bare `rounded` | 1 → 4 | Part 1 D4 |
| 5 | `palette.test.ts` asserts paths are off lane families but samples only `variant`; `happy` collides with `actor`. **Verified by extending the test — it fails.** Also: `pathColorTheme.ts:62` says eight lane families; there are nine | `palette.test.ts:469` | Extend sampling to all of `PATH_TYPE_COLORS`; narrow the documented claim | 1 | Part 1 D5, Part 6 |
| 6 | `scale` ramp is byte-exact slate/gray, 24 values, 0 consumers | `colors.css` (inherited verbatim) | Delete | 3 | Part 2 |
| 7 | `--colors-gray-*` is a third neutral ramp | `global.css` (inherited verbatim) | Delete | 3 | Part 2 |
| 8 | **37** Figma-export primitives with zero consumers (not 33) | `global.css` — upstream ships the same dead set | ⚠ **Deleting `--padding-x-sm` breaks `--card-padding-x`; eight colour primitives in the file are live.** See Part 8 §Row 8 | 3 | Part 8 §Row 8, Part 0 §2 |
| 9 | 24 zero-consumer semantic names; `--color-tertiary-foreground` and `--color-foreground-contrast` each declared twice | `semantic.css`, `theme.css` | Delete | 3 | Part 2 |
| 10 | `BLUEPRINT_THEME`: 13 keys, 8 distinct values; a background and a text colour share one | `blueprintTheme.ts` | One key per distinct value | 4 | Part 2 |
| 11 | `--ring-blueprint-cell` ≡ `-soft`, `--background-blueprint-cell` ≡ `-origin` in 16/16 blocks | `blueprint.css` | Collapse to six L4 domain names | 4 | Part 2, Part 3 |
| 12 | Two radius systems at once — shadcn's dial-derived `--radius-sm…xl` and upstream's literal `--radius-panel: 6px` — plus unused `2xl/3xl/4xl` | `theme.css:12-15, 415` | Six role-named rungs; retire `-panel`, `3xl`, `4xl` | 4 | Part 3 Radius |
| 13 | Two card radii ship (18px / 14px); three region frames at two radii and three border widths | project cards, `Card`, canvas frames | `--radius-card`, `--radius-region`, `--border-region` | 4 | Part 3 |
| 14 | 3px region outline declared twice; the common path reads the literal | `blueprintLayout.ts`, `pathTypeTheme.ts`, `CompareDifferencesSurface.tsx` | `--border-region` + `BLUEPRINT_REGION_OUTLINE_WIDTH` as the one TS owner | 4 | Part 3 Border |
| 15 | Focus pulse 1300ms in TS, 1260ms in CSS — already drifted | `animations.css`, focus hook | `--motion-ambient: 1260ms`, TS reads it | 4 | Part 3 Motion |
| 16 | `--default-transition-duration: 150ms` is an unpinned third copy of `--motion-micro`, consumed by ~130 bare `transition` classes | Tailwind default | Bind the default to `var(--motion-micro)` | 4 | Part 3 Motion |
| 17 | One role ("small uppercase label") has eight treatments across 15 sites; no text-role utilities exist at all | components | `typography.css` with `@utility` roles — upstream's form, not a TS map | 4 | Part 3 Type, Part 0 §3 |
| 18 | `tracking-tight` at ≤14px in ~12 sites, contradicting `panelText.ts:20-27` | `menubarHeaderLayout.ts:72` and others | Three trackings; `tracking-tight` only ≥24px, enforced | 4 | Part 3 Type |
| 19 | z-50 cell detail panel wears the weakest shadow; eight floating surfaces picked `shadow-md/lg` by eye | components | Shadow rung is a function of the z band | 4 | Part 3 Shadow |
| 20 | Layout constants declared in TS **and** re-declared in CSS (the 2026-08-21 rail/slot inset bug) | `canvasHeaderStyle.ts`, `BlueprintLabelRail.tsx`, `theme.css --width-cell-panel*` | TS owns every layout number and pushes it as a CSS var at the boundary (upstream `sidebar.tsx` pattern); CSS never redeclares | 4 | Part 3 Spacing, Part 0 §2 |
| 21 | Four guards sample only where the property holds (`tokenDiscipline`, `palette`, `motion`, `canvasStacking`) | `src/lib/*.test.ts` | Extend coverage before any rename | 2 | Part 4 |
| 22 | Palette fully allocated (9 lanes + 7 tones = 16/16) and nothing says so | `colors.css`, `pathColorTheme.ts` | State it in code; reserve explicit headroom | 4 | Part 6 |
| 23 | Five foundations docs make claims this plan falsifies | `docs/design/foundations/*.md` | Rewrite after Phase 4 | 5 | Part 5 |
| 24 | `compat.css` has no exit condition | `compat.css` (17 lines — already trimmed from upstream's 56) | Header states: alias only, dated, deleted when consumers reach 0 | 3 | Part 0 §4 |
| 25 | **Tailwind's content scan includes `docs/**/*.md`, so this plan generates the classes it cites as evidence** — `bg-field` appears in compiled CSS solely because line 828 mentions it | build config | Exclude `docs/` from the content scan before any deletion is verified against compiled output; grep `dist/**/*.js` too | 2 | Part 8 §Row 8 |
| 26 | The mobile boundary is declared three times mechanically and once in prose — `MOBILE_BREAKPOINT = 768`, `MOBILE_SHELL_QUERY = '(max-width: 767px)'`, Tailwind's `md:` (18 uses) | `use-mobile.ts:3` (vendored), `useMobileShell.ts:14`, `EditorShell.tsx:86` | Ours derives from the vendored constant, or a test pins them; `md:` usage documented as the same line | 4 | Part 8 §Lane B |
| 27 | Three z-index values are each spelled two ways — `z-30`/`z-[30]`, `z-60`/`z-[60]`, `z-1`/`z-[1]` — plus four off-scale arbitraries (`z-[5]`, `z-[35]`, `z-[45]`, `z-[9999]`) | 107 sites; one `z-index` in all of `src/styles/` | A z band vocabulary, which Part 3's shadow rung already presumes exists | 4 | Part 8 §Lane B |
| 28 | 19 distinct `size-*` values; three of them carry 257 of ~345 uses and none is named | components | Name the three; Phase 3 deletes the dead `--icon-*` and replaces nothing | 4 | Part 8 §Lane B |
| 29 | **`carousel.tsx` is a stale pre-base-nova vendor copy that drops the arrow-key handler** — an a11y regression against vendor | `ui/carousel.tsx` (13 hunks, 12 revert) | Re-vendor; first port our `api.off("reInit", onSelect)` leak fix back upstream-side | 1 | Part 8 §Lane A |
| 30 | `card.tsx` replaces vendor's `[--card-spacing:--spacing(4)]` custom property with hardcoded `gap-4/py-4/px-4/p-4` plus four hand-written `group-data-[size=sm]/card:*` duplicates | `ui/card.tsx:15,28,76,87` | Revert to the custom-property mechanism; keep only the `ring-border-overlay` swap | 4 | Part 8 §Lane A |
| 31 | `spinner.tsx` is a local `DelayedSpinner` squatting in a vendor filename; the vendor `Spinner` export no longer exists | `ui/spinner.tsx` | Restore vendor `spinner.tsx`; move `DelayedSpinner` beside `deferred-skeleton.tsx` | 3 | Part 8 §Lane A |
| 32 | `dialog.tsx` silently drops the `DialogOverlay`/`DialogPortal` exports and vendor's link styling in `DialogDescription`, while `accordion`/`marker`/`tooltip` keep that recipe | `ui/dialog.tsx:133, 146-148` | Revert both; 3 further dialog divergences are UNCLEAR and need a decision, not a guess | 4 | Part 8 §Lane A |
| 33 | `"use client"` sits on a third, different set of 8 files — vendor output has 9, the registry JSON 18 — and it is a no-op in a Vite SPA | 8 files in `ui/` | One repo-wide policy (recommend: strip all), recorded in the vendoring notes. Do not revert file-by-file; it returns on the next `shadcn add` | 3 | Part 8 §Lane A |
| 34 | `navigation-menu.tsx` (168 lines) has zero importers outside `components/ui/` | `ui/navigation-menu.tsx` | Deletion candidate | 3 | Part 8 §Lane A |

---

## Part 0 — Benchmark: the diff against upstream

Upstream: `supabase/supabase @ master`, fetched 2026-08-22. Files compared
line-for-line: `packages/ui/build/css/{source/semantic,source/compat,
source/global,themes/light,themes/dark}.css`, `packages/config/css/{theme,
colors,utilities}.css`, `packages/config/typography.css`,
`packages/ui/src/lib/constants.ts`, `packages/ui/src/components/shadcn/ui/sidebar.tsx`.

| File | Upstream lines | Ours | Changed | What changed |
| --- | --- | --- | --- | --- |
| `themes/light.css` | 60 | 85 | 83 | selector `[data-theme='light']` → **`:root`**; code-block/secondary dropped; success added; brand ramp re-derived at 177.6 |
| `themes/dark.css` | 44 | 56 | 54 | same selector change; same additions |
| `semantic.css` | 267 | 553 | 664 | **dial defaults removed**; +sidebar(12), chart(5), annotation(5), success(4), canvas, `--tone-span-abs` |
| `compat.css` | 56 | 17 | 63 | synonym layer cut from ~30 aliases to 5 — **ahead of upstream** |
| `theme.css` | 377 | 459 | 352 | upstream's `background-color-surface-75…400`, `text-color-*`, `foreground-light/lighter/muted` registrations **removed** (ahead); +lime family, chart, sidebar, `--radius-sm…4xl`, `--text-2xs/3xs`, `--width-cell-panel*`, `--shadow-floating` |
| `global.css` | 141 | 151 | 10 | **byte-identical apart from 10 lines** — the Figma-export primitives came across untouched |
| `colors.css` | 429 | 489 | 488 | +lime; otherwise the same 15 Radix ramps incl. `scale` |
| `typography.css` | 81 | — | — | **not forked**. Upstream's text-role utilities do not exist here |

### §1 Colour — upstream is better on dial defaults; we are ahead on synonyms

**D1 is a fork divergence, and upstream does not have it.** Upstream
`semantic.css:10-22` declares a default for *every* dial in `:root` —
`--hue: 159; --surface-hue: var(--hue); --primary-hue: var(--hue); --chroma …` —
and the theme files override under `[data-theme='light'], .light` /
`[data-theme='dark'], .dark`. Because the light block is attribute-scoped, a
dial it sets and dark does not set falls back to the `:root` default, not to
light's value. We changed light's selector to `:root, .light` (so light is the
default with no attribute) and deleted the `:root` defaults from `semantic.css`
— the twelve "upstream-only" declarations in the diff are exactly the dial
defaults. That combination is what lets dark inherit light's `--surface-hue`.

The plan's parity test still stands, but the structural fix is to **restore
upstream's shape**: defaults in `semantic.css`, overrides scoped. The test then
guards against the *next* divergence rather than being the only thing holding
the line.

**Upstream also has a mode-invariant layer, implicitly.** `--primary` is
"mode-invariant and decoupled from the `--chroma` knob", and
`--expressive-chroma: 0.14` is a flat constant so status colours survive a
grayscale brand. Part 3's L3 makes that implicit layer explicit and names it —
upstream's form, with the label upstream never wrote.

**Upstream's mess we did not inherit.** Three raw colour formats (HSL triplets,
`hsl()`, `oklch()`); ~17 background synonyms collapsing to 7 values;
`foreground-lighter` ≡ `foreground-muted`; two disjoint brand scales with
`brand` ≠ `primary`. Our `compat.css` and `theme.css` already cut most of this.
The one piece we *did* inherit is the `scale` ramp (row 6) and the
`--colors-gray-*` export (row 7) — both are upstream dead weight too.

**Upstream's guard we should copy: enforcement by construction.**
`packages/config/unset-tw-colors.css` sets every Tailwind default colour to
`initial`, so `text-gray-500` resolves to *their* gray or nothing. We forked
that file (23 lines) and it is in the import order — good. Upstream has no token
lint at all (no stylelint, no `eslint-plugin-tailwindcss`, 22 ratchet rules none
of them style) and raw `text-gray-*` survives in five studio files. Our
`tokenDiscipline` test is ahead; Part 4 widens it.

### §2 Spacing / layout — upstream pattern: TypeScript owns, CSS receives

Upstream uses Tailwind spacing bare with four named tokens total
(`--breakpoint-xs`, `--width-listbox`, `--spacing-content: 21px`,
`--spacing-card: var(--card-padding-x)`). Every *layout* number — sidebar width,
control heights, page widths — lives in TypeScript (`sidebar.tsx:20-22`
`SIDEBAR_WIDTH = '13rem'`; `constants.ts` `SIZE.height`, `PAGE_SIZE_CLASSES`)
and is pushed into CSS at the component boundary as a custom property
(`style={{ '--sidebar-width': SIDEBAR_WIDTH }}`). CSS never re-declares it.

That is the rule row 20 adopts. The 2026-08-21 rail bug was the rail and the
slot each declaring the same inset; under upstream's pattern there is one
declaration in `blueprintLayout.ts` and `BlueprintLabelRail` reads it as a var.

**Inherited dead weight, verified:** the 33 Figma-export primitives in
`global.css` (`--spacing-xs…xl`, `--sizing-xs…xl` on an odd 1.5× scale,
`--borderradius-*`, `--borderwidth-none…lg`, `--icon-*`, `--padding-x-*`,
`--input-sm-height`, `--datatable-*`, `--font-family-body`,
`--content-width-screen-xl`) have **zero references** outside the file, in ours
and in upstream. Only `--card-padding-x` is live. Row 8.

### §3 Typography — the one file we did not fork is the one we need

Upstream `packages/config/typography.css` defines text roles as Tailwind v4
`@utility` blocks — `heading-title/section/subSection/default/compact/meta`,
`text-default/subTitle/compact`, `text-link`, `text-code-inline` — then binds
`h1…h6/body/small/strong` to them in `@layer base`. Roles compose with variants
(`md:heading-title`), are greppable in one file, and the type *scale* is set
once in the app's globals (`--text-sm: 0.8125rem`, `--font-weight-normal: 450`).

We have no `typography.css` and no role utilities. Our roles live as TS string
constants (`PANEL_TEXT`, `panelText.ts`) — which is how eight treatments of one
role came to exist. **Part 3's `textRoles.ts` is withdrawn in favour of
`src/styles/typography.css` in upstream's form.** Keep a TS constant only
where layout math needs the number (line-height for rail geometry).

Upstream also has no tracking tokens — `tracking-tight`/`wider` appear only
inside the heading utilities, never at call sites. That is the enforcement
mechanism for row 18: if tracking is only reachable through a role, it cannot
be mis-applied at 12px.

Upstream wart to avoid: type scale and fonts defined in the *app* globals, not
the shared package, and `--color-typography-body-{light,dark}` pairs holding
identical values.

### §4 Radius / border / shadow — upstream is minimal; we are double

Upstream: Tailwind v4 default radii bare, **one** custom rung (`--radius-panel:
6px`), no border-width tokens (the real system is the border *colour* alpha
ladder), no shadow ladder, `focus-ring`/`focus-inset` as canonical utilities.

Ours: shadcn's `--radius-sm/md/lg/xl` derived from `--radius` **and**
upstream's literal `--radius-panel` **and** registered `2xl/3xl/4xl` — three
sources for one axis. Row 12. Part 3's six role rungs replace all three. The
border alpha ladder (`border` 2%+20%·c → `stronger` 5%+45%) we inherited intact
and it is good; Part 3's three border *widths* sit beside it, not instead.

Upstream's `compat.css` header is worth copying verbatim in spirit: *"nothing
new should reference these; delete as consumers migrate."* Ours has the layer
but not the sentence. Row 24.

### §5 What upstream gets wrong that this plan must not repeat

- Docs drift: the token docs page cites a generator that `require`s a path not
  in the tree, a `packages/ui/internals/tokens` that does not exist, and HSL
  opacity mechanics superseded by OKLCH. Phase 5 rewrites our foundations docs
  *after* Phase 4, with the token files as the source, not before.
- Identical `-light`/`-dark` pairs and three colour formats: the "value written
  once" rule in Part 2 is the guard.
- No enforcement beyond `unset-tw-colors`: Phase 2 before Phase 4.

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

**Root cause (from the benchmark, Part 0 §1):** upstream declares a default for
every dial in `semantic.css` `:root` and scopes each theme file to
`[data-theme='…']`. The fork moved light onto `:root` and deleted the defaults,
so a dial light sets and dark omits now inherits light's value instead of
falling back to the default.

**Fix:** restore upstream's shape — dial defaults back in `semantic.css`, theme
overrides under scoped selectors (keep `:root` only as the defaults block).
**Then prevent the class:** a three-line test comparing the key sets of
`light.css` and `dark.css` would have caught this and will catch the next one.

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
L0  DIALS        ~20. DEFAULT in semantic.css :root (upstream's shape),
                 OVERRIDE per theme under [data-theme] / .light / .dark,
                 PARITY ENFORCED BY TEST
                 --hue --surface-hue --chroma --surface --contrast
                 --{warning,destructive,info,success}-lightness …
                 ↓ a dial one theme omits falls to the default, never to
                   the other theme. D1 cannot recur.
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
survives. It is consumed 20 times and has not drifted.

**The home for roles is `src/styles/typography.css`, as `@utility` blocks —
upstream's form (Part 0 §3), not a TS map.** A role utility composes with
variants, is greppable in one file, and — the part that matters for row 18 —
is the only place a tracking value is allowed to appear. Eleven roles,
mirroring upstream's names where the role is the same:

```css
@utility heading-title    { @apply text-2xl tracking-tight; }      /* display, ≥24px */
@utility heading-section  { @apply text-xl; }
@utility heading-default  { @apply text-sm font-medium; }
@utility heading-meta     { @apply text-xs uppercase tracking-wider font-medium; } /* eyebrow */
@utility text-default     { @apply text-base; }
@utility text-compact     { @apply text-xs; }
@utility text-caption     { @apply text-2xs leading-tight; }
@utility text-time-marker { @apply text-3xs uppercase tracking-wider tabular-nums; }
@utility text-badge       { @apply text-2xs font-medium leading-none; }
@utility text-link        { @apply underline underline-offset-4 …; }
@utility text-code-inline { @apply text-xs font-mono …; }
```

`PANEL_TEXT` becomes `@apply text-compact` and its TS constant is deleted; a
TS constant survives only where layout math needs the number (the rail's
line-height). `h1…h6/body/small/strong` bind to roles in `@layer base`, as
upstream does.

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

### Spacing / layout — one owner, and it is TypeScript

Tailwind's spacing scale stays bare — upstream runs on it with four named
tokens, and 974 utilities here are on-scale. The problem is the *layout
numbers*: slot insets, rail widths, gutters, panel widths. Today
`canvasHeaderStyle.ts` declares `BLUEPRINT_SLOT_INSET = 'px-3.5'` as a class
string, `blueprintLayout.ts` declares pixel constants, and `theme.css`
declares `--width-cell-panel` — three vocabularies for one kind of value, and
the rail/slot inset bug on 2026-08-21 was two of them disagreeing.

**Rule, from upstream's `sidebar.tsx`:** every layout number is declared once,
in TypeScript, as a number. A component that needs it in CSS pushes it across
the boundary as a custom property on its root element:

```tsx
<div style={{ '--blueprint-slot-inset': `${BLUEPRINT_SLOT_INSET}px` } as CSSProperties}>
```

CSS and class strings read the var; they never re-declare the value.
`theme.css` loses `--width-cell-panel*`; `canvasHeaderStyle.ts` loses its
`px-*` string twins. `railRhythmContract.test.ts` already asserts the geometry
from the numbers — under this rule it is asserting the only copy.

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
`--colors-gray-*` half of `global.css` **and its 33 Figma-export primitives**
(row 8 — the file shrinks to `--card-padding-x` and the font-face block), the
24 zero-consumer semantic names, the double-declared pairs, `--radius-panel`,
`--radius-3xl`/`4xl`, `--ring-blueprint-cell`,
`--background-blueprint-cell-origin`. Give `compat.css` upstream's exit
sentence. Deletion only — no renames — so the diff is reviewable and any
breakage is a missing import rather than a wrong value.

**Phase 4 — the layers.** Colour L0–L4 (restoring dial defaults to
`semantic.css` first), `typography.css`, the spacing ownership rule, the radius
and shadow ladders. This is the large one. Do it axis by axis, not all at once.

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

## Part 7 — Audit scope extension

Parts 0–6 audited `src/components/blueprint/`, `src/components/editor/`,
`src/lib/` and `src/styles/` across seven axes. That is roughly half the
frontend and most, but not all, of the axes. This part records what the sweep
does **not** yet cover, and the method for each gap. It is scope, not findings:
every row below is work to do, and the ledger above grows as each lane reports.

Rule for the extension: **one ledger**. New findings become new rows in the
table at the top of this plan, in the same shape, with the same evidence bar
(a claim is verified live or it is marked as unverified). Proposals stay
unratified until reviewed.

### The un-audited half

| Area | Files | Lines | Arbitrary utils | Alpha modifiers |
| --- | --- | --- | --- | --- |
| `src/components/ui/` | 34 | 4,688 | 33 | 93 |
| `src/components/mobile/` | 11 | 1,290 | 4 | 3 |
| `src/components/cover/` | 11 | 1,595 | 5 | 6 |
| `src/hooks/` | 30 | 3,910 | 0 | 0 |
| `src/contexts/` | 18 | 3,076 | 0 | 0 |
| `src/data/` | 48 | 11,397 | — | — |

`src/components/ui/` is the design system itself and the second-densest
arbitrary-value site in the repo, entirely outside Parts 1–3. `hooks/` and
`contexts/` measure clean on both counts, which is itself worth recording —
they are the proof that the plumbing claim in the Overview holds where nobody
was watching.

### Lane A — coverage, with a vendor oracle

Audit the six areas above on all seven existing axes. Every finding carries a
`vendor` / `ours` tag.

`src/components/ui/` is vendored shadcn in its base-ui flavour
(`components.json`: `style: base-nova`, `shadcn@4.13.0`, `@base-ui/react@1.7.0`),
so its findings get a second tag against a **pristine baseline**:

```
npx shadcn@latest add <component> --overwrite   # into a scratch dir, not src/
diff scratch/<component>.tsx src/components/ui/<component>.tsx
```

Every hunk is then one of two things:

- **`revert`** — a local edit with no stated reason. Restore the vendor line.
  Divergence from a vendored primitive is a maintenance tax paid on every
  upgrade; it must buy something.
- **`justified-divergence`** — a deliberate edit. It stays, and this audit is
  where the justification finally gets written down.

This is the only lane in the sweep with a hard oracle: the vendor file either
matches or it does not. It is therefore the lane to run first and the lane to
run mechanically.

Upstream sanctions divergence — `packages/config/unset-tw-colors.css` overrides
Tailwind's defaults wholesale — so the test is not "did we change it" but
"did we say why".

### Lane B — the axes Parts 1–3 do not treat

| Axis | Sites | Why it is an axis, not a nit |
| --- | --- | --- |
| **Alpha / opacity** | 299 | Named only as a `tokenDiscipline` blind spot in Part 4; no ladder is proposed anywhere. Tailwind v4's `withAlpha` emits `color-mix(in oklab, <value> <alpha>, transparent)`, so alpha over an alpha token is **multiplicative** — 299 unaudited multiplications, and the border ladder this plan praises is itself alpha-based |
| **z-index** | 107 | `canvasStackingContract.test.ts` pins `z-[30]` in its arbitrary spelling and thereby *enforces* the off-scale form (row 21). Part 3's shadow ladder is defined as a function of the z band, so the band vocabulary has to be real before that rule is testable |
| **Icon sizing** | — | `global.css`'s dead `--icon-*` primitives (row 8) are deleted by Phase 3; nothing replaces them and no rule says what sizes an icon may be |
| **Breakpoints** | — | Upstream ships exactly one custom breakpoint (`--breakpoint-xs`); we have a mobile shell with its own vocabulary and no stated relationship between the two |

**Open research question for the alpha axis**, to be answered from upstream
before any ladder is proposed: is `border-border/60` — a tokenised base with an
untokenised alpha — Supabase **convention** or **exception**? Upstream's border
system is an alpha ladder authored in the token (`border` 2%+20%·c →
`stronger` 5%+45%), which suggests call-site alpha is the exception and the
ladder is the convention. If that holds, the proposal is to ban the modifier
on ladder tokens rather than to name the 299 values.

### Lane C — three finding classes, never merged

A single "one-off value" count is unactionable, because three different defects
wear that name and each has a different fix, cost, and owner:

| Class | Shape | Repo-wide | Fix cost |
| --- | --- | --- | --- |
| **(i) arbitrary utility** | `w-[13px]` — off-scale, mechanically greppable | 115 | mechanical; a lint rule closes the class |
| **(ii) on-scale but role-less** | `rounded-xl` where no rule says which things are `xl` | most of the ledger above | Phase 4's rename; the expensive one |
| **(iii) alpha modifier** | `border-border/60` — tokenised base, untokenised alpha | 299 | blocked on Lane B's research question |

Every count this audit publishes is broken down by class.

### Lane D — two more upstream surfaces

Part 0 diffed eight files, all of them config/ui CSS. Two more surfaces get
read, chosen because they bear on decisions this plan already makes:

- **Enforcement setup** — their lint, ratchet, and CI. Part 0 §1 already
  records that upstream has *no* style enforcement beyond `unset-tw-colors.css`
  and that raw `text-gray-*` survives in five studio files. Confirm it, because
  Phase 2 is premised on us being ahead here, and "ahead of upstream" is a claim
  worth being right about.
- **`packages/ui/src/components/ui-patterns/`** — how they compose vendored
  primitives into product components. Directly comparable to our
  `components/ui` → `components/blueprint` relationship, which Lane A is about
  to put under a microscope.

Explicitly **not** read: their data layer, their routing, their server
conventions. This plan is about tokens; architecture is a different plan.

### Lane E — the dev documentation

`docs/` holds 118 markdown files. Excluding `plans/`, the dev-facing set is
**29 files / 3,197 lines**: `design/` (14), `engineering/` (7),
`reference/` (7), `AGENTS.md`, `docs/INDEX.md`.

Out of scope, deliberately:

- `product/` (6 files) — user-facing prose, not developer documentation.
- `ideation/`, `brainstorms/`, `plans/` — `AGENTS.md` declares these HISTORY and
  tells readers not to trust them as current. Rewriting them would destroy the
  decision trail that makes the rest of the docs auditable.

The set splits by whether Phase 4 changes what the doc describes:

**Rewrite now — Phase 4 does not touch these.** Frontend only; the backend and
agent docs wait for their own pass.

- `docs/engineering/codebase-guide.md`, `docs/engineering/architecture.md`
  (frontend sections)
- `docs/reference/ui-inventory.md` — the need→primitive map Lane A is about to
  falsify or confirm
- `docs/design/components.md`, `interaction.md`, `responsive.md`,
  `accessibility.md`, `content-voice.md`
- `docs/engineering/standards.md` — **already false today**: it defines the
  Supabase benchmark as a 4-tier token model, and Part 3 replaces it with five
  layers. It is the doc every agent reads on boot, which makes it the highest-
  leverage single fix in this lane.
- `AGENTS.md` and `docs/INDEX.md` — only where they point at the above.

**Deferred to Phase 5** — `docs/design/foundations/*.md` (7 files). Row 23
already books these; Part 3 changes the structure they describe, so writing
them now means writing them twice.

**Deferred to a later pass** — `access-and-security.md`, `operations.md`,
`agent-system.md`, `agent-tools.md`. Backend and agent surface; out of scope
for a frontend cleanup.

Method is the same as every other lane: find the claims the code falsifies,
list them, then fix. Part 0 §5 records upstream's docs drifting exactly this
way — a generator that `require`s a path not in the tree, a package that does
not exist, HSL mechanics superseded by OKLCH. The lesson taken is that docs
rot silently unless something measures them, so the audit output is a list of
falsified claims, not an impression.

### Lane F — verify before extending

Nineteen of the twenty-four rows above rest on grep and read evidence; five
claim live verification. Re-verify **six** before the ledger grows:

- **D1–D5** — cheap and high-consequence. Measure the contrasts, mutate the
  dial, re-run `palette.test.ts` against all of `PATH_TYPE_COLORS`.
- **Row 8** — "33 primitives, zero consumers". Deletion rows are where a wrong
  claim costs the most, and this plan's own Risks table already names
  `--field` and `--control-raised` as live via compiled class names rather than
  source. **Grep the compiled output, not the source**, before any deletion row
  is trusted.

The remaining rows are trusted until Phase 3 touches them, at which point the
same compiled-output check applies.

### Execution

Lanes split by whether the finding has an oracle:

| Mode | Lanes | Why |
| --- | --- | --- |
| **Parallel, mechanical** | A (vendor diff, 34 components), B (axis counts), C (class counts), F (the five measurements) | Each has a check that either passes or fails. An agent cannot drift on a diff or a contrast ratio |
| **Single context** | D (upstream conventions), E (docs) | Judgment work. Parallel agents produce contradictory readings that then have to be refereed, and the value in Part 0 came from one careful pass |

Synthesis is single-context regardless: every lane reports into the one ledger,
in the one shape.

### What this extension does not change

Phases 1–5 in Part 5 stand as written. Lane F runs before the ledger grows;
Lanes A–E feed rows into it; the phases absorb those rows in the same order —
defects first, guards second, deletions third, structure fourth, docs fifth.
The one adjustment is that Lane E's "rewrite now" set does not wait for
Phase 4, because nothing in Phase 4 touches it.

---

## Part 8 — Verification results

Lane F (re-verify before extending) and Lane A (vendor diff) ran 2026-08-22.
Lane B's mechanical counts ran alongside them. This part records what survived
contact and what did not.

**Headline: five of the six re-verified rows are real, and two of the Phase 1
fixes as written would not have fixed the defect.** That is what Lane F was
for. Every measurement below was recomputed, not re-read.

### D1 — CONFIRMED, root cause REFUTED

The cascade bug is real. `--surface-hue` resolves to **34** under `.dark` while
`--hue` is 177.6 in both themes, and `dark.css:20` sets `--chroma: 0.005`, so
unlike light mode (`--chroma: 0`, hue moot) the warm-brown hue is genuinely
visible on every token derived through it (`semantic.css:92, 115, 120`).

**But the stated root cause is wrong.** The plan says upstream's dial defaults
were deleted from `semantic.css`. They were not — `semantic.css:34-35` still
declares `--surface-hue: var(--hue)` and `--primary-hue: var(--hue)` at
`:root, .dark, .light`. They lose on **source order**: semantic's rule and
light's rule are both specificity (0,1,0), light imports later (`:29` vs `:27`
in the entry sheet), and `:root` matches `<html class="dark">` because
next-themes puts the class on `documentElement` (`App.tsx:23`).

So "restore the defaults" is not the fix. The fix is that `themes/light.css`
must stop matching bare `:root` — scope it as upstream does, or change the
order. Row 1's proposed fix needs re-speccing before Phase 1 executes it.

Three further corrections:

- The declaration is at **`light.css:31`**, not `:7` (`:7` is where the
  selector list begins).
- The entry stylesheet is **`src/styles/tailwind.config.css`**, not
  `src/index.css`.
- The blast radius is **two** properties, not one. `--radius`
  (`light.css:11`) is also declared in light and absent from dark. It is
  mode-invariant by design so it leaks harmlessly — but the proposed
  key-parity test will fail on it without an explicit exemption.

Worth fixing alongside the declaration: `dark.css:18-19` carries a comment
asserting that `--surface-hue` "is left at its `var(--hue)` default". It is the
artifact that made the bug invisible.

### D2 — CONFIRMED, but the proposed fix does not clear AA

Both measurements are exact. The tokens are plain `hsl()` literals in
`colors.css` (light `:root` L32, dark `@media screen { .dark }` L265-267), so
no OKLCH conversion is involved:

| Theme | ink `gray-900` | ground `slate-500` | Ratio |
| --- | --- | --- | --- |
| light | rgb(143,143,143) | rgb(230,232,235) | **2.639:1** |
| dark | rgb(112,112,112) | rgb(43,47,49) | **2.739:1** |

Font size confirmed at 11px (`--text-2xs`, `theme.css:457`); compact boards
render `--text-3xs` = 10px, which is worse. Both are below the large-text
threshold, so 4.5:1 applies and both themes fail.

**Step 1100 does not fix it.**

| Candidate ink on `slate-500` | light | dark |
| --- | --- | --- |
| gray-900 (current) | 2.639 | 2.739 |
| gray-1100 (proposed) | **4.108** ✗ | 5.199 |
| slate-1100 | **4.122** ✗ | 5.218 |
| gray-1200 | 14.647 | 11.609 |

The plan's "~5.6:1" was read off the dark side only, and even there it is 5.20.
**Step 1200 is the smallest rung clearing 4.5:1 in both themes.** Re-spec row 2.

### D3 — CONFIRMED, and understated in two ways

`isPaleAnnotationSwatch()` (`canvasAnnotations.ts:196-200`) is a pure membership
test — `Boolean(color) && color !== ANNOTATION_INK`. The plan's ranges are exact:
fill swatches (step 300) measure 1.129–1.195 in dark against 16.20–17.95 in
light; sticky swatches (step 500) measure 1.334–1.717 against 13.59–14.79.

Two things the plan does not say:

1. **The one exception is broken too.** The Ink swatch takes the `text-white`
   branch, and `--color-slate-1200` flips to near-white in dark, so it measures
   **1.171:1** — white on white. The framing "every swatch but one" implies that
   branch is safe. The same theme-flip breaks both branches, in opposite
   directions, which strengthens rather than weakens the L3-frozen-layer
   argument in Part 3.
2. **Light mode fails as well.** The stroke row (step 1100) puts the frozen
   near-black check on saturated mid-tones: **2.499** (violet) to **3.769**
   (lime) in light. Violet is below even 3:1. The plan characterises light as
   uniformly 13–17:1, which holds only for the fill and sticky rows.

Minor: "1.00:1 on paper" is really **1.002:1** — plate ink is `hsl(0,0%,8.6%)`
and dark `--color-gray-100` is `hsl(0,0%,8.5%)`. Functionally identical, but it
is a coincidence of two independently-authored near-blacks, not one shared
value. The benign reading would be the wrong one.

The applicable criterion is SC 1.4.11 (3:1) rather than 1.4.3 — the check is
`aria-hidden` with state carried on `aria-pressed`. Every dark-mode value still
fails that lower bar by a wide margin.

### D4 — CONFIRMED exactly, mechanism proven by compilation

`--radius: 0.625rem` is at `themes/light.css:11` inside a plain `:root, .light`
block, and it is the only `--radius:` declaration in `src/`.
`tailwindcss@4.3.3`'s own `theme.css:502-509` declares `--radius: 0.25rem` under
`@theme default inline reference` — `inline` substitutes the literal into the
utility, `reference` emits no custom property, and `default` means only a *user*
`@theme` can override it. A plain `:root` rule cannot. Compiled to confirm:

```
.rounded    { border-radius: 0.25rem; }        ← literal, ignores :root
.rounded-lg { border-radius: var(--radius); }  ← honours it
```

Exactly 11 sites, as stated: `EditorErrorBoundary.tsx:65`,
`AgentMarkdown.tsx:59`, `SliceHeaderBand.tsx:98`,
`CanvasAnnotationLayer.tsx:1308`, `EditorLoadingSkeletons.tsx:188` and `:194`,
`CompareDifferencesSurface.tsx:56` and `:69`, `PathMultiSelect.tsx:187`,
`coverInline.tsx:28`, `BlueprintDividerTag.tsx:80`.

Two notes for the fix: `BlueprintDividerTag.tsx:80` is
`connected ? 'rounded-l rounded-r-none' : 'rounded'`, so its two branches
already disagree with each other (4px vs `--radius`); and
`coverPage.test.tsx:196` asserts on the literal string `'rounded'` in a
duplicate-class check, so any rename must update it.

### D5 — CONFIRMED by making the test fail

`palette.test.ts:469` samples 40 synthetic names all hard-coded to
`path_type: 'variant'`. `getPathColor` (`pathColorTheme.ts:239`) short-circuits
every other type, so the sample can only produce `PATH_OPEN_FAMILIES` —
indigo, purple, gold, yellow — which are genuinely lane-disjoint. `happy`
(green) and `exception` (red) are structurally unreachable. The name says
"named paths"; the sample says "variant paths".

Proof: baseline 123 passing. A throwaway test extending the sampling four ways
produced 3 failures, `expected [ 'green' ] to deeply equal []`. Temp file
deleted; suite back to 123.

Exactly one lane collision, the one the plan named: `happy`
(`--color-green-1100`) against the `actor` lane (green, `blueprint.css:383-390`)
— a green path line drawn across a green actor lane. `laneVsTone` came back
empty, so the existing `:461` assertion is sound. `exception` → red collides
with `[data-blueprint-tone='red']`, but neither the test nor the docs assert
path-vs-tone disjointness either way.

Two additions:

- **`pathColorTheme.ts:62` says "the eight lane families". There are nine** —
  slate, blue, green, violet, pink, lime, orange, gray, amber. The comment went
  stale the day `partner-action` was added (2026-08-21).
- **The tone gap is structural, not incidental.** The `interaction states`
  regex at `palette.test.ts:491` matches `[data-blueprint-lane=…]` only, so all
  seven tones are excluded from every contrast assertion in the file. Lanes get
  a 7-property completeness check plus ring/text/hover/pressed per theme; tones
  get set membership and a `size > 0` guard.

The documented claim this falsifies, `docs/design/foundations/color.md:63-66`,
says lane families are disjoint from "the path-**type** and touchpoint-tone
families" and that `palette.test.ts` holds it — i.e. the doc claims precisely
the property the test never samples. It is the cleanest instance of Part 4's
pattern in the repo.

### Row 8 — PARTIALLY CONFIRMED, and one deletion breaks the build

`global.css` is 151 lines, one `:root` block, **139** custom properties (100
colour, 39 non-colour). The Figma-export block is dead, as claimed. Four
specifics are wrong.

**The count is 37 dead, not 33.** The plan's list omits `--panel`, `--panel2`,
`--xxl`, `--options-icon`, `--card-padding-x-md` — 39 non-colour properties,
minus 1 live, minus those 5, is exactly 33.

**`--padding-x-sm` cannot be deleted.** The plan lists `--padding-x-*` as dead
*and* says keep `--card-padding-x` — but `global.css:141` is
`--card-padding-x: var(--padding-x-sm)`. Deleting it leaves `--card-padding-x`
resolving to nothing. Keep it, or inline `1rem`.

**Eight colour primitives in the same file are live**, and "delete the primitive
half of `global.css`, keep only `--card-padding-x`" reads as killing them:
`--colors-black` (`semantic.css:520`), `--colors-gray-dark-100`
(`semantic.css:510`), `--colors-gray-dark-300` (`semantic.css:507`),
`--colors-gray-dark-800/-1100` and `--colors-gray-light-100/-800`
(`utilities.css:78-89`, the swatch checkerboard), and **`--colors-white`
(`CanvasPenCursor.tsx:111`, `color="hsl(var(--colors-white))"`)**. That last
one has zero occurrences in compiled CSS and one in the JS bundle — a
compiled-CSS-only check calls it dead and is wrong. Six of these live consumers
sit inside **row 7's** delete territory, which needs the same re-check.

Also: there is no `@font-face` block in `global.css` — faces come from
`@fontsource-variable/*` imports in `tailwind.config.css`. The post-deletion
file is a one-line `:root` plus the live colour primitives, not what the plan
describes.

`--card-padding-x` is live **by reference only**: `theme.css:417` sets
`--spacing-card: var(--card-padding-x)`, but `--spacing-card` has zero `var()`
consumers in compiled CSS and no `p-card`/`px-card` utility is generated.

#### The verification method validates itself (row 25)

This is the finding with the widest consequence. The plan's Risks table says
*"`--field` and `--control-raised` are live via `bg-field`/`bg-control` — grep
compiled output, not source."* Checking it:

- `.bg-control` does not exist in compiled CSS at all — `theme.css:48`
  deliberately declines to register `--color-control`.
- `.bg-field{background-color:var(--field)}` **does** exist — and the only
  occurrence of the string `bg-field` anywhere in the repo, excluding
  `node_modules` and `dist`, is **line 828 of this plan document**.

Tailwind v4's automatic content detection scans the non-gitignored tree
including `docs/**/*.md`. The risk row generated the very class it cites as
evidence.

Consequences, which are not confined to row 8:

1. Every Phase 3 deletion verified by "grep compiled output" is unsound until
   `docs/` is excluded from the content scan.
2. Compiled CSS alone was never sufficient — `--colors-white` proves the JS
   bundle carries token references too. Grep `dist/**/*.js` as well.
3. `--control-raised` has one compiled consumer (`--control:
   var(--control-raised)`, `semantic.css:344`) and `--control` itself has zero
   `var()` consumers. Neither token is in `global.css`, so row 8's verdict
   stands — but the Risks row's warning is itself refuted and must be rewritten.

### Lane A — the vendor diff reverses a scope premise

Baselines obtained for **33 of 34** components from the real `base-nova`
registry via `shadcn@4.13.0`. Only `deferred-skeleton` is locally authored
(registry 404). Five components Part 7 guessed were local — `attachment`,
`bubble`, `marker`, `message`, `message-scroller` — are genuine upstream
components, and four of them are byte-identical to vendor.

**69 hunks: 23 revert, 41 justified, 5 unclear.** Six files are byte-identical
to vendor. The divergences concentrate in three files: `carousel` (13 hunks,
12 revert), `dialog` (9, 5 revert), `card` (4, 3 revert).

**The decisive result: the token debt in `components/ui` is inherited, not
authored.**

| | ours | vendor | ours-only |
| --- | --- | --- | --- |
| alpha modifiers | 93 | 96 | **13** |
| arbitrary values (all bracketed) | 99 | 89 | **7** |
| arbitrary values (hard literals only) | 40 | 39 | **1** |

The 13 ours-only alphas are deliberate, commented status-role work. The nine
vendor-only alphas are mostly `ring-foreground/10`, which this repo
systematically replaced with the `ring-border-overlay` token — so **net, the
repo reduced alpha-on-overlay usage against upstream**. The seven ours-only
arbitraries are six `ring-[color:var(--ring-blueprint-cell-soft,…)]` in
`button.tsx:47,49` (a `var()` reference, not a magic number — keep) and
`marker.tsx:63`'s `max-w-[85%]`, the single hardcoded literal this repo added
to a vendored file.

**Part 7's framing was true but misleading.** `components/ui` is the
second-densest arbitrary-value site in the repo, and almost none of it is ours.
The refactor budget does not belong there. What *does* belong there is the
revert list, because those are regressions against a baseline we can diff.

Highest-value reverts, in order:

1. **`carousel.tsx` — the whole file (row 29).** Not a divergence but a stale
   copy from the pre-base-nova Radix era (`ArrowLeft` rather than
   `ChevronLeftIcon`, old Prettier trailing commas, no comments). It drops the
   arrow-key handler (`handleKeyDown`, vendor `:78-90`) — an **accessibility
   regression against vendor** — plus vertical-orientation support, `opts` in
   context, and the `useCarousel` export. One consumer. Salvage first: our
   `api.off("reInit", onSelect)` at `:88` fixes a listener leak vendor still
   has; port it back after re-vendoring.
2. **`card.tsx` (row 30).** Vendor's `[--card-spacing:--spacing(4)]` mechanism
   was replaced with hardcoded `gap-4/py-4/px-4/p-4` plus four hand-written
   `group-data-[size=sm]/card:*` duplicates. This is precisely the defect shape
   the rest of this plan is about — a token replaced by its own value, four
   times — and it arrived by editing a vendored file.
3. **`spinner.tsx` (row 31).** A local `DelayedSpinner` squatting in a vendor
   filename; the vendor `Spinner` export no longer exists.
4. **`dialog.tsx` (row 32).** Drops the `DialogOverlay`/`DialogPortal` exports
   and vendor's link styling in `DialogDescription`, while `accordion`,
   `marker` and `tooltip` all keep that same recipe. Plus four hunks of pure
   churn.
5. **`drawer.tsx:75`** moves the overlay to `bg-black/20` and removes
   `supports-backdrop-filter:backdrop-blur-xs`, uncommented, while
   `dialog.tsx:34` moves the *other* way and adds `backdrop-blur-sm`. Two
   overlays in one family disagreeing for no stated reason.

Five hunks are **unclear and must not be guessed**: `command.tsx:74`
(`border-input/30` → `border-muted`, a surface token used as a border),
`dialog.tsx:34` (overlay rewritten to `data-starting-style`),
`dialog.tsx:60` (`bg-popover` → `bg-card`, inconsistent with every other
overlay in the family), `dialog.tsx:92,118` (header and title restyled — note
the title takes `tracking-tight` at `text-lg` = 18px, which row 18's proposed
"≥24px display only" rule would forbid), and `marker.tsx:63`.

**The 41 justified divergences hold up.** Every token they depend on exists in
`src/styles/`; the `accordion-down`/`accordion-up` keyframes really are absent,
validating those fix comments; `skeleton.tsx`'s claim that the pulse moved to
`animations.css` keyed on `[data-slot=skeleton]` is confirmed at `:284-300`
including the reduced-motion branch; and `popover.tsx`'s added `anchor` prop is
a real base-ui `Positioner` prop vendor forgot to forward. The `text-sm` →
`text-xs` menu-item change is applied consistently across all three menu
families with a shared cross-referencing comment. This is the part of the
codebase that already works the way this plan wants the rest to work.

### Lane B — three axes, three instances of the same shape

**z-index (row 27).** 107 sites, 15 spellings, and three values each spelled
two ways: `z-30` (15) / `z-[30]` (4), `z-60` (3) / `z-[60]` (1), `z-1` (1) /
`z-[1]` (8). Row 21 already notes that `canvasStackingContract.test.ts` pins the
arbitrary spelling — it pins the *minority* spelling of a value that also has 15
scale-form uses. Four off-scale arbitraries: `z-[5]`, `z-[35]`, `z-[45]`,
`z-[9999]`. All of `src/styles/` contains one `z-index` declaration
(`blueprint.css:176`).

**Breakpoints (row 26).** The mobile boundary is declared three times
mechanically and once in prose:

- `use-mobile.ts:3` — `MOBILE_BREAKPOINT = 768`, vendored, consumed by
  `ui/sidebar.tsx`
- `useMobileShell.ts:14` — `MOBILE_SHELL_QUERY = '(max-width: 767px)'`,
  consumed by seven files
- Tailwind's default `md:` = 768px, used 18 times — silently the same line
- `EditorShell.tsx:86` states "(767px)" in a comment

They agree today only because 767 = 768 − 1. This is the 2026-08-21 rail/slot
bug in a different subsystem: one boundary, two owners, two files. The vendor
dimension makes it interesting — `use-mobile.ts` is vendored, so the fix is
neither revert nor diverge, but *ours derives from vendor, or a test pins them*.
Separately, `--breakpoint-xs: 480px` is registered and `xs:` is used four times.

**Icon sizing (row 28).** 19 distinct `size-*` values. `size-3.5` (99),
`size-3` (84) and `size-4` (74) carry 257 of roughly 345 uses and not one of
them is named. `size-1`, `size-1.5` and `size-2` are 4–8px. Phase 3 deletes the
dead `--icon-*` primitives and puts nothing in their place.

### What this changes about sequencing

Phase 1 cannot execute rows 1 and 2 as written — both need re-speccing first,
and row 2's re-spec is a one-token change (1100 → 1200) while row 1's is
structural. Row 29 (`carousel.tsx`) is an accessibility regression against a
known-good baseline and belongs **in Phase 1**, not in a later cleanup: it is a
revert, not a redesign, and the diff already exists.

Row 25 is a Phase 2 prerequisite, not a Phase 3 detail. Until `docs/` leaves
Tailwind's content scan, no deletion in Phase 3 can be verified by the method
Phase 3 specifies.

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
- [ ] Every dial has a default in `semantic.css`; theme files only override
- [ ] `global.css` declares no custom property with zero consumers
- [ ] Every text role is an `@utility` in `typography.css`; `tracking-*` appears in no component
- [ ] No layout number is declared in both a `.ts` file and a `.css` file

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
- Benchmark, `supabase/supabase @ master` fetched 2026-08-22 — `packages/ui/build/css/source/semantic.css` (dial defaults, mode-invariant `--primary`), `packages/ui/build/css/themes/{light,dark}.css` (scoped selectors), `packages/ui/build/css/source/compat.css` (exit sentence), `packages/ui/build/css/source/global.css` (the same dead primitives), `packages/config/css/theme.css`, `packages/config/unset-tw-colors.css`, `packages/config/typography.css` (`@utility` roles), `packages/ui/src/lib/constants.ts` and `packages/ui/src/components/shadcn/ui/sidebar.tsx` (TS-owns-layout pattern), `apps/design-system/content/docs/{color-usage,tailwind-classes,typography}.mdx` (docs drift)
- Fork point: `a169838` / `65a94b6` (2026-08-04) "mirror Supabase's CSS architecture"
