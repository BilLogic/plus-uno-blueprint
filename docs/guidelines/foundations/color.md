---
audience: designers
summary: The four color-token tiers, semantic-only consumption, the retune record behind the brand dials, dark mode as a class, the forced-colors stance, lane tints, the annotation chrome ink ladder, and the agent-ink precedent.
sources: src/styles/colors.css, src/styles/semantic.css, src/styles/theme.css, src/styles/blueprint.css, src/styles/themes/, src/lib/canvasAnnotations.ts, src/config.ts, src/lib/brandAccent.ts
last-reviewed: 2026-09-08
---

# Color

## Philosophy: semantic tokens, nothing else

Components consume **semantic roles**, never raw palette steps: `text-warning`,
not `text-amber-1100`. A color in a `.tsx` file answers "what is this thing's
role?", and the palette exists only so the semantic layer has something to
derive from. This is Supabase's rule, adopted verbatim; it is what lets dark
mode, theming dials (`--hue`, `--contrast`, `--chroma`), and forced-colors all
work without touching a single component.

## The one raw color, and where it enters

The rule above is "no raw color where a token exists", and there is exactly one
place where none does: `brand.accent` in `src/config.ts`, the deployment's own
accent. It is the value the brand tokens are derived *from*, so it is written
the way a deployer knows it — a CSS hex — and `src/lib/brandAccent.ts` reads it
at boot, converts it to its OKLCH hue and writes that onto the root element as
`--hue`. An inline custom property on `documentElement` outranks every
stylesheet selector, so the accent wins under `:root`, under `.dark` and in
print.

`tokenDiscipline.test.ts` allows that one hex and nothing else, and it checks
the exemption rather than trusting it: the file may carry a single hex and it
has to be the accent the module exports.

What the accent reaches is the hue, and only the hue. Everything else the two
brand fills are made of is an authored dial — `--primary-lightness` and
`--primary-chroma` for the filled control, `--brand-lightness` and
`--brand-chroma` for the identity fill — and all four live in
`src/styles/themes/light.css` and `dark.css`, at one value in both. Those are
tuning decisions rather than brand facts; the three walked-back passes behind
the control's pair are [the `--primary` retune](#the---primary-retune) below.
`semantic.css` derives and declares no dial of its own, which is what lets its
text be the template's, byte for byte
([template-relationship](../../engineering/template-relationship.md)).

So rebranding is one move where it used to be two: set the accent, and both
fills follow it onto the new hue, because `--primary-hue` is `var(--hue)` and
`--brand` reads the same. `palette.test.ts` holds the dials against the accent
this deployment ships, and `brandAccent.test.ts` measures that any accent, set
or unset, still clears the contrast floors in both themes.

## The `--primary` retune

The record of how the filled control's dials reached `--primary-lightness:
0.83` and `--primary-chroma: 0.135` on `--hue: 177.6`. It lives here rather
than beside the declaration for one reason: `semantic.css` is the template's
copy verbatim, and a dated narrative about this deployment's numbers is true in
one repository and false in the other. What
generalises — why `--primary` stays a computed triple rather than aliasing a
ramp step, and why the derivation multipliers stay ratios rather than literals
— is stated in that shared file. What follows is the part that is ours.

| Date | Pass | What it established |
|---|---|---|
| 2026-08-05 | L 0.874 — the ramp's own `--brand-400` step | The 400 step is too pale to be the fill. It read as a pastel badge, not a control, against the near-white canvas. |
| 2026-08-06 | "matcha ceramic": L 0.78 / C 0.09, hue dial pushed to 183 | Lightness was what made the first pass too heavy. It dropped chroma at the same time, which was collateral, and moved the hue off the brand ramp, which was a mistake. |
| 2026-08-07a | C 0.09 → 0.12 at the same L | The chroma target is a ratio, not a number: match Supabase's utilisation of the sRGB ceiling at its own L/H (#3ECF8E is `oklch(0.762 0.154 159.4)`, 88.6% of its ceiling). |
| 2026-08-07b | Hue back to 177.6, L to 0.83, C to 0.135 | Both faults that were left had the same root — below. |

**Hue.** The 2026-08-06 pivot to 183 left `--primary` 5.4° off the `--brand-*`
ramp, which sat at OKLCH hue 177.6 at every step. The gap is small in the
abstract and load-bearing in practice: `--primary` was the only brand surface
derived from the hue dial, since every other brand usage read a ramp step, so
the filled button was the one element wearing a cyaner green than the brand it
belongs to. The dial is 177.6 now and the fill is on the ramp's hue by
construction — which is also why the ramp could later be deleted without this
fill moving.

**Lightness.** L 0.78 was chosen as a correction to 0.874 and overshot. L 0.83
is brighter, still 0.044 below the step that read as a badge, and the 1px
`--primary-border` hairline that did not exist in the 0.874 pass is what lets
the fill be lighter without going soft.

**Chroma** follows the ratio 2026-08-07a established: at L 0.83 / H 177.6 the
sRGB ceiling is C 0.1532 and 0.135 is 88.1% of it, with headroom so the fill
itself is never gamut-mapped. Rendered: **#48E4C7**, up from #46D0BF.

### What the shipped dials measure

After CSS Color 4 gamut mapping, for the accent this deployment ships:

| Token | Resolves to | Measurement |
|---|---|---|
| `--primary` | `oklch(0.83 0.135 177.6)`, #48E4C7 | 88.1% of the sRGB chroma ceiling at its own L/H. |
| `--primary-foreground` | #121917, the same ink in both themes | 11.19:1 on the fill, past AAA's 7:1. White on this fill would be about 1.4:1. |
| `--primary-border` | wants C 0.1688 at L 0.71, ceiling 0.1311, so it maps to the ceiling | The ×1.25 buys no chroma; the edge is carried entirely by the −0.12 lightness step, 1.52:1 against the fill. |
| `--ring` | #008F7A, also ceiling-bound (wants 0.1755 at L 0.58, ceiling 0.1071) | 4.00:1 on the light canvas and 4.55:1 on the dark one, clearing SC 1.4.11's 3:1 in both. Its dependants — `--sidebar-selected`, `--sidebar-selected-rail`, `--sidebar-ancestor` — moved with it. |

The ink is **derived by the flip, not written as a fixed dark**. A fixed ink is
only ever right for the accents that happen to be light: measured across the
accent range the fixed one falls to 3.19:1 at L 0.45 and 1.11:1 at L 0.15 —
black text on a black button — and it fails silently. The flip holds above
3.43:1 across the whole range, and since a deployment authors its own accent
that is not hypothetical.

The next retune argues about these dials, so it is argued where they are
declared: change them in both theme files, and add a row here.

## The tier system

Four tiers — three you can look up, one components set on themselves (the
authoritative statement is the header comment in `src/styles/blueprint.css`):

| Tier | File | Shape |
|---|---|---|
| 1 Primitive | `src/styles/colors.css` | `--color-{family}-{step}` — Radix scales + the brand ramp. Values only; components must not touch these. |
| 2 Semantic | `src/styles/semantic.css` | `--background`, `--primary`, `--warning`, `--sidebar-*` — every role, derived in OKLCH from a handful of theme dials (`src/styles/themes/light.css`, `dark.css`). |
| 3 Tailwind | `src/styles/theme.css` | `@theme inline` indirection so `bg-canvas`, `text-muted-foreground` exist as utilities. Never write `var(--color-canvas)` by hand — `@theme inline` keys are not emitted as properties. |
| 4 Component | `src/styles/blueprint.css` | `--{property}-blueprint-{part}-{state}` — variables a component sets on itself so shared rules can read them. Not design tokens: every value assigned is a tier-1/2 reference. The one carve-out is `--shadow-blueprint-annotation-fill`, whose per-theme `rgb()` alphas are a shadow, not a meaning-carrying color. |

Interaction states have **no tokens** by design (Supabase defines none):
state is expressed at the call site via alpha on the resting token
(`hover:bg-primary/90`) or a step of a numeric scale. The one exception is the
blueprint canvas, where the resting color comes from row data — hence tier 4.

## Dark mode

`next-themes` with `attribute="class"` puts `.dark` on the root; Tailwind's
dark variant keys off it (with `enableColorScheme` handling the UA color-scheme).
The part that is ours alone: **`.dark` can sit on a subtree** — the
presentation stage (`SlicePresentation`) goes dark while the app stays light.
That is why `semantic.css` declares its derivations at `:root, .dark, .light`
rather than `:root` only: custom properties resolve `var()`s before
inheritance, so every derivation must be re-declared at each scope that can
override a dial. `.light` exists so a subtree can force light inside a dark
ancestor.

## Forced colors

Windows High Contrast replaces every color, so anything whose meaning rides on
a background or ring alone disappears. The stance: **restate the affordance
with system keywords**, never fight the mode. `src/styles/base.css` restates
focus (`Highlight` outline), pressed/selected state
(`Highlight`/`HighlightText`, keyed off `aria-pressed`/`aria-selected`), and
gives blueprint cells a `CanvasText` border so the grid survives flattened
fills. The semantic-zoom blocks tier does the same (`blueprint.css`). Details
in [accessibility](accessibility.md).

## Lane tints

Blueprint lanes identify themselves by fill: the `[data-blueprint-lane='…']`
rules in `blueprint.css` set the tier-4 cell surface variables per lane, from
tier-1 family steps. Lane families are disjoint from the touchpoint-tone
families and from the open set a named path draws from
(`src/lib/pathColorTheme.ts`).

They are **not** disjoint from the path *types*: `happy` is green and the
`actor` lane is green. The palette is fully allocated — nine families to lanes,
seven to touchpoint tones, sixteen in all with nothing spare — so `happy`
cannot move off green without displacing something that is also on screen.
What separates them is weight: a path is a step-1100 line, a lane a step-400
fill. `src/lib/palette.test.ts` measures the stylesheet to hold contrast, holds
the open set disjoint, asserts the allocation, and asserts that the type
overlap is exactly that one and drawn heavier than the lane it crosses. A new
lane or path color must keep that test green — and there is no tenth family for
a new lane to take.

## The agent's ink

`ANNOTATION_AGENT_INK` (`src/lib/canvasAnnotations.ts`) is the precedent for
any "special" color: the agent's annotations draw in an attention-red no human
swatch offers, so its marks read as the agent's — but it is still **a token**
(`var(--color-red-900)`), so dark mode follows, and it still **announces a
name** — `annotationSwatchName` returns "Red" to a screen reader, never
"Custom". A color that can't meet both bars (tokenized, nameable) isn't ready
to ship.

## The annotation chrome's ink

The floating annotation bars sit on `--background-annotation-chrome`, the one
surface that does not follow the theme, and their foreground is a ladder that
does not either: `--foreground-annotation-chrome` and its `-secondary` /
`-tertiary` rungs, three `--border-annotation-chrome*` edges, two
`--wash-annotation-chrome*` states, and `--ring-annotation-chrome`. Every rung
is `--colors-white` at one alpha, declared beside the surface in
`semantic.css`, and `annotationChromeInk.test.ts` measures each ink against the
bar under both themes.

It is a ladder rather than an alpha at each call site — the exception to the
interaction-state rule in the tier table above — for the reason the neutral
edge rungs exist: `CanvasAnnotationLayer` had ten unnamed strengths of one
absolute white across forty-four call sites, which is a vocabulary nobody can
reuse and the style guard had to carve out.

These rungs have **no `@theme` entry**, so they are consumed as
`text-(--foreground-annotation-chrome)` rather than a `text-*` utility. That is
deliberate: tier 3 is `theme.css`, `theme.css` is on the reconciled allowlist,
and a name only this deployment has cannot be minted there. A rung that the
template adopts gets its utility when the template registers it.

## Adding a token

New color = new semantic role, argued for in the PR: which tier it lives in,
what it derives from, how it behaves in dark and forced-colors, and what
`palette.test.ts` says about it. Process and review checklist:
[engineering/standards.md](../../engineering/standards.md).

## The board ladder's primitive exception

`BLUEPRINT_THEME` and the annotation color families
(`src/lib/blueprintTheme.ts`, `src/lib/canvasAnnotations.ts`) reference
primitive color steps (`--color-slate-500`-class tokens) directly from
TypeScript. This is a reasoned exception to the components-use-semantic
rule: the board's lane ladder needs an ordered ramp with more steps than
the semantic layer defines, and inventing semantic names for each rung
would add vocabulary without adding meaning. The exception is scoped to
those two modules; everything else derives from semantic tokens.
