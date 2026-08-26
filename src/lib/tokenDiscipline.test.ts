import { test } from 'vitest'
import assert from 'node:assert/strict'
import { classUsesMatching, sourceFiles, sourceMatching } from '@/lib/tokenModel'

/**
 * The token-discipline rule, enforced — now against the one model.
 *
 * `docs/guidelines/foundations/color.md` states it plainly: components consume
 * the SEMANTIC lane, never the primitive ramps ("`text-warning`, not
 * `text-amber-1100`"), and no raw colour values where a token exists. Both
 * halves are convention, not types, and both had drifted.
 *
 * What changed here is not the rules, it is the sample. This file used to walk
 * `src/components/**.tsx` with its own reader, which is why
 * `src/lib/filterToolbarButton.ts` could carry `border-border/60` and
 * `border-border/50` — the exact pattern the third rule forbids — and stay
 * green for months. The sample now comes from `tokenModel`, which reads every
 * non-test file under `components/`, `contexts/`, `hooks/`, `lib/`, `data/`,
 * so widening it once widens it for every rule that asks (ADR 0001).
 */

/** Ramps colors.css owns. Semantic tokens derive from these; source may not. */
const PRIMITIVE_RAMPS = [
  'amber',
  'blue',
  'crimson',
  'gold',
  'gray',
  'green',
  'indigo',
  'lime',
  'orange',
  'pink',
  'purple',
  'red',
  'slate',
  'tomato',
  'violet',
  'yellow',
  'scale',
]

/**
 * Ramps Tailwind ships and this design system does not unset — so they
 * resolve, silently, to colours that belong to no lane at all. The frozen
 * canvas/annotation surfaces are what kept reaching for these; they have
 * named tokens now (`--background-canvas-chrome`, `--background-annotation-chrome`).
 */
const FOREIGN_RAMPS = [
  'neutral',
  'stone',
  'zinc',
  'sky',
  'teal',
  'emerald',
  'cyan',
  'rose',
  'fuchsia',
]

const UTILITY_PREFIXES =
  'bg|text|border|ring|fill|stroke|from|to|via|shadow|outline|divide|accent|caret|placeholder|decoration'

test('the model reads more than the component tree', () => {
  // A rule is only as good as its sample, and this file's sample used to be
  // one directory. If the reader ever narrows again, every assertion below
  // starts passing for the wrong reason.
  const roots = new Set(sourceFiles().map((file) => file.file.split('/')[0]))
  assert.ok(roots.has('components'), 'reads components/')
  assert.ok(roots.has('lib'), 'reads lib/')
  assert.ok(roots.has('hooks'), 'reads hooks/')
  assert.ok(roots.has('contexts'), 'reads contexts/')
  assert.ok(sourceFiles().length > 200, 'reads the whole tree, not a sample')
})

test('source takes colour from the semantic lane, not the primitive ramps', () => {
  const ramps = [...PRIMITIVE_RAMPS, ...FOREIGN_RAMPS].join('|')
  const offenders = sourceMatching(
    new RegExp(`\\b(?:${UTILITY_PREFIXES})-(?:${ramps})-[0-9]{2,4}\\b`, 'g'),
  )
  assert.deepEqual(
    offenders,
    [],
    `Primitive/foreign ramp steps in source — use the semantic token for the role instead:\n${offenders.join('\n')}`,
  )
})

test('source carries no raw hex colours', () => {
  // Six- and three-digit hex only: `#{id}` template strings and CSS ids are
  // not colours, and neither is an 8-digit anything this codebase writes.
  const offenders = sourceMatching(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)
  assert.deepEqual(
    offenders,
    [],
    `Raw hex in source — add or use a token (see guidelines/foundations/color.md):\n${offenders.join('\n')}`,
  )
})

/**
 * Border strengths are named, not dialled.
 *
 * Supabase names every rung — across 1972 of their components: 101
 * `border-default`, 76 `border-strong`, 66 `border-overlay`, 56
 * `border-muted`, 43 `border-control-hover`, and roughly ten alpha modifiers
 * in total. This codebase had the inverse: `border-border` plus 43 hand-tuned
 * alphas (`/35`, `/50`, `/60`, `/70`, `/80`) and ten `ring-foreground/10`, each
 * a strength with no name and no way to reuse it.
 *
 * So the modifier is the thing under test, and only on the two NEUTRAL edge
 * tokens, which now have rungs: `--border-muted`, `--border`, `--input`,
 * `--border-overlay`, `--border-control-hover`. A new alpha on one of those
 * means a rung is missing.
 *
 * Role colours keep their modifiers — `border-primary/50`,
 * `border-destructive/30`, `ring-ring/50`, `border-foreground/70` are a tint of
 * a MEANING rather than an invented strength, and upstream writes those too
 * (32 `border-foreground`, plus `/20` and `/10`).
 */
const NEUTRAL_EDGE_TOKENS = ['border', 'input']

test('neutral border and ring strengths come from a named rung', () => {
  const tokens = NEUTRAL_EDGE_TOKENS.join('|')
  const offenders = sourceMatching(
    new RegExp(
      `\\b(?:border|ring|divide|outline)-(?:${tokens})/(?:\\[[^\\]]+\\]|[0-9]+)`,
      'g',
    ),
  )
  assert.deepEqual(
    offenders,
    [],
    `Inline alpha on a neutral edge token — use a named rung (border-muted / border-border / border-input / border-overlay / border-control-hover):\n${offenders.join('\n')}`,
  )
})

/**
 * The bare radius utility is a literal that looks tokenised.
 *
 * `tailwindcss@4.3.3` declares `--radius: 0.25rem` under `@theme default
 * inline reference`. `inline` substitutes the literal straight into the
 * utility and `reference` emits no custom property, so `.rounded` compiles to
 * `border-radius: 0.25rem` and a `:root { --radius: … }` rule — which is where
 * ours is declared — cannot reach it. Proven by compilation: at
 * `--radius: 2rem`, `rounded-lg` moved to 32px and bare `rounded` stayed at
 * 4px.
 *
 * Every sided variant has the same problem (`rounded-l`, `rounded-t`, …), so
 * the rule is "a radius utility names its rung". `rounded-full` and
 * `rounded-none` are exempt because neither is a rung — they are the two ends,
 * and neither reads the dial by design.
 */
const SIDES = 'l|r|t|b|tl|tr|bl|br|s|e|ss|se|es|ee'

test('every radius utility names a rung, so the dial reaches all of them', () => {
  const offenders = classUsesMatching(
    new RegExp(`^rounded(?:-(?:${SIDES}))?$`),
  )
  assert.deepEqual(
    offenders,
    [],
    `Bare radius utility — 4px hardcoded by Tailwind, deaf to --radius. Name the rung (rounded-sm / -md / -lg / -xl), or rounded-full / rounded-none:\n${offenders.join('\n')}`,
  )
})

/**
 * One value, one spelling.
 *
 * Three z-index values were each written two ways — `z-30`/`z-[30]`,
 * `z-60`/`z-[60]`, `z-1`/`z-[1]` — and `canvasStackingContract.test.ts` pinned
 * the arbitrary spelling of one of them as an exact substring, so the test
 * enforced the minority form. Tailwind v4 takes a bare integer for z-index, so
 * the bracket buys nothing at all: every arbitrary spelling has a plain one,
 * and the plain one is the vocabulary.
 */
test('z-index is spelled one way, so a contract cannot pin the other', () => {
  const offenders = classUsesMatching(/^z-\[\d+\]$/)
  assert.deepEqual(
    offenders,
    [],
    `Arbitrary z-index — Tailwind v4 takes the bare number, so write z-30 not z-[30]:\n${offenders.join('\n')}`,
  )
})

/**
 * A font size in px is a rung that was never added.
 *
 * The type scale bottoms out below Tailwind's, on purpose: `--text-2xs` (11px)
 * and `--text-3xs` (10px) exist because the editor's dense chrome kept writing
 * `text-[11px]`/`text-[10px]`, and naming them made the ladder reusable. The
 * next two literals went in anyway — `text-[9px]` on a sequence badge,
 * `text-[8px]` on a visual-lane caption — each one a size with no name and no
 * way for the next call site to find it. They are `--text-4xs`/`--text-5xs`
 * now, and this is what stops the sixth.
 *
 * Scoped to px because px is the unit a rung is: every `--text-*` this
 * codebase declares is an absolute size, commented in px, and a px literal is
 * unambiguously one of them written out longhand. `em` is deliberately not a
 * rung — `text-[0.85em]` on markdown code is a proportion of whatever encloses
 * it, which no fixed size can express. The two `rem` display sizes
 * (`text-[2.5rem]`, `text-[2.25rem]`) are a real gap at the TOP of the scale,
 * and closing it means adding rungs above `text-xl`; that is a separate change
 * and this rule does not yet claim it.
 */
test('font sizes come from a named rung, not a px literal', () => {
  const offenders = classUsesMatching(/^text-\[\d+(?:\.\d+)?px\]$/)
  assert.deepEqual(
    offenders,
    [],
    `Arbitrary px font size — add a rung to the sub-xs scale in styles/theme.css and name it (text-2xs / -3xs / -4xs / -5xs):\n${offenders.join('\n')}`,
  )
})
