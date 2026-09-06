---
audience: designers
summary: The four color-token tiers, semantic-only consumption, dark mode as a class, the forced-colors stance, lane tints, and the agent-ink precedent.
sources: src/styles/colors.css, src/styles/semantic.css, src/styles/theme.css, src/styles/blueprint.css, src/styles/themes/, src/lib/canvasAnnotations.ts, src/config.ts, src/lib/brandAccent.ts
last-reviewed: 2026-09-06
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

What the accent reaches is the hue, and only the hue. The filled control's
lightness and chroma are `--primary-lightness` and `--primary-chroma` in
`semantic.css` — a tuning decision with three walked-back passes recorded above
`--primary`, not a brand fact — and the `--brand-*` ramp is per-theme HSL
literals each deployment authors in its own theme files. So rebranding is two
moves that belong together: set the accent, and re-derive the ramp on its hue.
`palette.test.ts` holds the two against each other for the accent this
deployment ships, and `brandAccent.test.ts` measures that any accent, set or
unset, still clears the contrast floors in both themes.

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
