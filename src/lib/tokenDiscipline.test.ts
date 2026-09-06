import { test } from 'vitest'
import assert from 'node:assert/strict'
import { classUsesMatching, sourceFiles, sourceMatching } from '@/lib/tokenModel'

/**
 * The token-discipline rule, enforced — now against the one model.
 *
 * `docs/guidelines/foundations/color.md` states it plainly: components consume
 * the SEMANTIC layer, never the primitive ramps ("`text-warning`, not
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

/**
 * A variant chain in front of a utility, as `classUses` sees it.
 *
 * `classUses` records each whitespace-delimited token WHOLE — `sm:z-[40]` is
 * one utility, not a variant plus `z-[40]` — so any rule anchored with `^` has
 * to spell the prefix out or it only holds at the default breakpoint. That is
 * exactly what went wrong: `/^z-\[\d+\]$/` read `sm:z-[40]` as a different
 * utility from `z-[40]` and passed it, and the radius rule had the same hole.
 *
 * Three shapes cover what this tree writes, and they chain, hence the `*`:
 * a plain variant (`sm:`, `hover:`, `before:`), a variant carrying a bracketed
 * argument (`peer-data-[variant=inset]:`, which `ui/sidebar.tsx` writes), and a
 * bare arbitrary selector (`[&>svg]:`). The bracketed two are why this is not
 * simply `(?:[\w-]+:)*` — `[\w-]+` stops at the `[`, so that shorter form
 * holds at every breakpoint but not behind a data-attribute variant, which is
 * the same class of hole one step along.
 *
 * Shared rather than repeated so the three anchored rules below cannot drift
 * apart again: one of them being widened and the others not is the state this
 * constant exists to end.
 */
const VARIANTS = '(?:[\\w-]+(?:-\\[[^\\]]*\\])?:|\\[[^\\]]*\\]:)*'

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

test('source takes colour from the semantic layer, not the primitive ramps', () => {
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
 *
 * `VARIANTS` is what makes that hold past the default breakpoint: anchored
 * straight at `rounded`, this pattern read `md:rounded` as a different utility
 * and let it through. Widening it reports nothing new, and the reason is worth
 * writing down rather than assuming — the tree has nine variant-prefixed
 * radius uses and every one already names a rung (`before:rounded-full`,
 * `after:rounded-full`, `data-active:before:rounded-full`,
 * `md:peer-data-[variant=inset]:rounded-xl`). There is no legitimate bare
 * variant use to exempt, so none is claimed.
 */
const SIDES = 'l|r|t|b|tl|tr|bl|br|s|e|ss|se|es|ee'

test('every radius utility names a rung, so the dial reaches all of them', () => {
  const offenders = classUsesMatching(
    new RegExp(`^${VARIANTS}rounded(?:-(?:${SIDES}))?$`),
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
 *
 * `VARIANTS` again, and the widening reports nothing new here either — but
 * not because a variant is hiding one. There is no `z-[…]` left anywhere in
 * the tree, at any breakpoint: the two variant-prefixed z-index uses that
 * exist are `focus:z-10` and `focus-visible:z-10` in `ui/toggle-group.tsx`,
 * both already the bare integer this rule asks for. Nothing to exempt.
 */
test('z-index is spelled one way, so a contract cannot pin the other', () => {
  const offenders = classUsesMatching(new RegExp(`^${VARIANTS}z-\\[\\d+\\]$`))
  assert.deepEqual(
    offenders,
    [],
    `Arbitrary z-index — Tailwind v4 takes the bare number, so write z-30 not z-[30]:\n${offenders.join('\n')}`,
  )
})

/**
 * A font size written out is a rung that was never added.
 *
 * The type scale bottoms out below Tailwind's, on purpose: `--text-2xs` (11px)
 * and `--text-3xs` (10px) exist because the editor's dense chrome kept writing
 * `text-[11px]`/`text-[10px]`, and naming them made the ladder reusable. The
 * next two literals went in anyway — `text-[9px]` on a sequence badge,
 * `text-[8px]` on a visual-lane caption — each one a size with no name and no
 * way for the next call site to find it. They are `--text-4xs`/`--text-5xs`
 * now, and this is what stops the sixth.
 *
 * The rule read px only, which left the identical gap open at the top of the
 * scale: the two display headings were written in rem — `text-[2.5rem]` on the
 * scenario slide title, `text-[2.25rem]` on the cover title — and a px-scoped
 * pattern stepped straight over both. 40px is `--text-5xl` now and 36px was
 * already Tailwind's `text-4xl`, so the rule reads both units and the top of
 * the ladder is named the way the bottom is.
 *
 * `em` is NOT covered, and that is a rule rather than a hole. `text-[0.85em]`
 * on markdown inline code and `text-[0.8em]` in `coverInline` are a proportion
 * of whatever encloses them — the same code at a different enclosing size is a
 * different number of pixels, which is the point — and no fixed rung can
 * express that. A rung is an absolute size: every `--text-*` this codebase
 * declares is one, commented in px.
 *
 * The other exemption is vendored, and it is a named list rather than a
 * narrower pattern — see `VENDORED_FONT_SIZE_LITERALS` directly below. A
 * pattern narrowed to dodge a real case reads, to the next person, as a rule
 * that never covered it.
 */

/**
 * Vendored shadcn files that carry an arbitrary font size from upstream.
 *
 * `docs/adr/0003-vendored-primitives-stay-pristine.md`: `src/components/ui/` is
 * regenerated by the shadcn CLI, and a divergence there with no stated reason
 * is a defect that gets reverted. Retuning upstream's `text-[0.8rem]` to a rung
 * would be exactly that divergence — deleted by the next `npx shadcn add
 * button`, and until then one more hunk in the vendor diff. The ADR's answer to
 * a product need the primitive does not meet is a wrapper in
 * `components/blueprint/`, not an edit here, and nothing needs one: these two
 * are upstream's own sizing, not a size this app reached for.
 *
 * Named here rather than carved out of the pattern, because the pattern is what
 * the next reader will take for the whole rule. Each entry is asserted below to
 * still carry a literal, so a re-vendor that drops one fails loudly instead of
 * leaving a dead exemption behind to widen quietly.
 */
const VENDORED_FONT_SIZE_LITERALS: ReadonlyArray<{
  file: string
  because: string
}> = [
  {
    file: 'components/ui/button.tsx',
    because: 'upstream shadcn button sizing (ADR 0003 — the CLI owns this file)',
  },
  {
    file: 'components/ui/toggle.tsx',
    because: 'upstream shadcn toggle sizing (ADR 0003 — the CLI owns this file)',
  },
]

/** Absolute font-size literals: px and rem, at any breakpoint. Not `em`. */
const FONT_SIZE_LITERAL = new RegExp(
  `^${VARIANTS}text-\\[(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:px|rem)\\]$`,
)

const isExempt = (use: string): boolean =>
  VENDORED_FONT_SIZE_LITERALS.some((entry) => use.startsWith(`${entry.file}:`))

test('font sizes come from a named rung, not a px or rem literal', () => {
  const offenders = classUsesMatching(FONT_SIZE_LITERAL).filter(
    (use) => !isExempt(use),
  )
  assert.deepEqual(
    offenders,
    [],
    `Arbitrary font size — name the rung in styles/theme.css instead (text-2xs / -3xs / -4xs / -5xs below text-xs, text-4xl / -5xl above text-3xl):\n${offenders.join('\n')}`,
  )
})

test('every vendored font-size exemption is still a file that needs one', () => {
  const literals = classUsesMatching(FONT_SIZE_LITERAL)
  const stale = VENDORED_FONT_SIZE_LITERALS.filter(
    (entry) => !literals.some((use) => use.startsWith(`${entry.file}:`)),
  ).map((entry) => entry.file)
  assert.deepEqual(
    stale,
    [],
    `Exempted from the font-size rule but no longer carrying a literal: ${stale.join(', ')}. ` +
      'If the file moved, move the exemption with it; if the re-vendor dropped the literal, delete the exemption.',
  )
})
