/**
 * A lane is a row of the board, and nothing else here is a lane.
 *
 * A **lane** is one actor's activity across the steps: a ROW, a `lanes` row,
 * carrying a `lane_role` from a closed set. It is one of the board's shared
 * words, so `CONTEXT.md` defers the definition to the template's and adds
 * only what this deployment says on top of it — a lane's name says who, or it
 * says what. A **layer** is anything stacked, staged, composited or tiered:
 * the CSS cascade's `@layer`, a composited paint layer, the opaque cover the
 * shell holds over the sidebar while it boots, a rung of the canvas reveal, a
 * design-token tier, an architectural tier like the derived layer. The two
 * words name disjoint things and this repository needs both.
 *
 * #143 renamed the table `layers` to `lanes` and the prose was carried across
 * by word replacement, so every sentence using `layer` in one of those OTHER
 * senses came out saying `lane`. That damage has now been cleared twice:
 * `20260831100000_three_variables_that_still_said_layer.sql` took three
 * variables and a comment out of the function bodies, and #605 took roughly
 * forty-six sentences out of comments, test titles, an ADR summary, the
 * generated index and one paragraph a reader meets. Nothing stood between the
 * two of them, and nothing stood after. This file is what stands after,
 * ported from the template's guard of the same name.
 *
 * WHY THE OTHER GUARDS COULD NOT SEE THEM. `check:identifiers` and
 * `a-doc-names-the-schema-it-has` read database identifiers, and none of
 * these is one. `retired-copy` reads the strings a reader meets, and almost
 * none of these reaches a reader. `a-rename-leaves-no-mangled-english` next
 * door reads what a replacement makes of a word it lands INSIDE, which comes
 * out as a string in no dictionary and is therefore decidable without reading
 * the sentence at all. None of that reaches a valid English word standing for
 * the wrong idea, which is the other half of what a rename over prose
 * produces and the half this file is for.
 *
 * That sweep reads THIS file, and deliberately. Its header says an exemption
 * is indistinguishable from a mistake three months later, so the residue
 * shapes are described here rather than spelled and this file takes no
 * exemption from it. The exemption runs the other way: the list below lets
 * that sweep plant its own shapes without tripping this one.
 *
 * ── SUBJECT: PROSE INCLUDED ────────────────────────────────────────────────
 *
 * The guards that read names with comments stripped are right to: prose may
 * use an English word, a name may not misuse one. Here that rule is exactly
 * inverted. `lane` is this vocabulary's OWN word, so the damage is not a name
 * misusing English — it is prose using the domain word for something that is
 * not in the domain, and all but a handful of the sites #605 repaired live in
 * a comment. So comments are IN the subject, over the whole tree
 * (`scripts/scanned-files.mjs`), and the price of that is paid below: every
 * pattern has to earn its place one at a time.
 *
 * ── WHY THIS IS COLLOCATION AND NOT A LIST OF SITES ────────────────────────
 *
 * Four cheaper shapes were considered against this tree first, and each is
 * recorded because the next person will think of them too.
 *
 * POSITION does not separate the senses. Both senses live in comments, and
 * they live in the same comment: `PhaseScenarioOverview.tsx` opens one block
 * with "The reveal's arrow layer (stage 4)" and says, three lines later, "it
 * was surfacing with the lanes at stage 1". One file, one block, both words,
 * both correct.
 *
 * A PER-FILE SENSE DECLARATION fails for the same reason one level up.
 * `ServiceOverviewView.tsx` gave up fifteen lines to #605 and keeps every
 * genuine use it had — `CANVAS_REVEAL_LANES`, "phase frames + lane
 * structure", "176 lane headers". A file does not have a sense.
 *
 * THE PRE-RENAME TREE IS NOT AN ORACLE, though it is the best evidence there
 * is and it settled most of #605. Before the rename `layer` was BOTH words:
 * the schema's name for a row AND the stacking sense. So a pre-rename `layer`
 * may be either. Only the negative direction is sound — a pre-rename `lane`
 * was never touched by the sweep and is therefore the domain word.
 *
 * AN ALLOWLIST OF MODIFIERS is unbuildable. The words that precede `lane`
 * here are overwhelmingly determiners and ordinary adjectives — "an actor
 * lane", "the leftmost lane", "adjacent lanes" — so a rule requiring the
 * modifier to be board vocabulary would fail on ordinary writing.
 *
 * What is left, and what this file asserts, is the company the word keeps. A
 * lane is a row of the board: it is not painted over anything, it does not
 * stack, it is not a rung of an animation, and it is not a tier of software.
 * So `lane` may not stand in the vocabulary of the cascade, of compositing,
 * of stacking or of an architectural tier. EACH PATTERN NAMES A CONCEPT, NOT
 * A SITE. `boot lane` is forbidden because a row of the board does not boot,
 * not because eight lines said it; the ninth is caught the day it is written,
 * and this file has no idea how many there are.
 *
 * ── WHAT THIS CANNOT SEE, STATED RATHER THAN HIDDEN ────────────────────────
 *
 * A PASS HERE IS NOT A CLEAN TREE. Measured against #605: of the fifty-seven
 * removed lines that carry the word, these patterns read twenty. Four shapes
 * account for the rest, and all four are still open.
 *
 * ANAPHORA is the bulk of it. A comment names "the boot layer" in its first
 * sentence and says "the lane" four sentences later; #605 repaired "each lane
 * opens because the previous one", "the lane before it", "only the lane this
 * stage opened". The referent is a paragraph away and no line-local rule
 * reaches it. What makes that tolerable is that anaphora does not arrive
 * alone: a paragraph that says "the lane" meaning a layer almost always NAMES
 * the thing once, and naming it is what this file catches. The reader sent to
 * that line has the rest of the paragraph in front of them.
 *
 * AN ADJECTIVE OR A POSSESSIVE in place of the noun. "localStorage is the
 * always-there lane", "a deeper lane of the same cell", "depends on the
 * shell's lane" — all three were #605's, and all three read as ordinary board
 * prose to a rule that cannot build an allowlist of modifiers.
 *
 * A TEST TITLE. Of the four `it(...)` titles #605 repaired, one named the
 * thing — "behind the shell's boot lane" — and three did not. A title is a
 * sentence inside a string that takes its referent from the `describe` above
 * it, which is anaphora with an extra wall around it.
 *
 * A QUOTED IDENTIFIER INSIDE A COMMENT. The name patterns below read
 * compounds — `laneRef`, `getLaneScale` — so a comment quoting a bare local,
 * "the `lane` here is the annotation canvas", is prose to this file and
 * passes. The template found this shape and the test title on its own side
 * and is repairing both there separately.
 *
 * IDENTIFIERS NEED ONLY THEIR DECLARATION CAUGHT, which is why the name
 * patterns are short. `CanvasAnnotationLayer.tsx` held `const lane =
 * layerRef.current` twice, and those two lines fed twelve uses across
 * `getLayerScale`, `clientToLocal` and `releaseCapture`. Correcting a
 * declaration turns every use of it into a compiler error, so `tsc` does the
 * sweep; listing the uses here would enumerate what the compiler already
 * reports.
 *
 * IF THIS PRODUCES A FALSE POSITIVE, THE ANSWER IS A CONVERSATION ABOUT THE
 * SENTENCE, NOT A NEW EXEMPTION. A genuine board lane described with one of
 * these words is a sentence worth rereading; if it survives the reread, the
 * pattern was wrong about the concept and the pattern goes.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { scannedFiles } from '../scanned-files.mjs'

const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname)

/**
 * Documents that must be able to write the retired sense down.
 *
 * By path rule, never by line — a document explaining that "boot lane" became
 * "boot layer" quotes both in one sentence, and no pattern separates that
 * from the wreckage itself.
 *
 * This file plants every shape to prove the sweep reads it.
 * `a-rename-leaves-no-mangled-english.test.mjs` plants its own residue shapes
 * for the same reason and quotes them again explaining each one.
 * `annotation-capture.test.mjs` asserts from both ends that no reader of the
 * annotation canvas holds `data-canvas-annotation-lane`, and a check that
 * forbids a spelling has to spell it out. `supabase/migrations/` is the
 * fourth and the widest: a migration is a DATED RECORD of what was applied on
 * a day — the residue sweep next door exempts it for exactly this reason —
 * and `20260831100000_three_variables_that_still_said_layer.sql` is this
 * family's own first pass, quoting the wrong word in its header to explain
 * the variables it renamed underneath.
 *
 * Nothing else. An exemption in a vocabulary guard is indistinguishable from
 * a mistake three months later, so a file that trips this is a sentence to
 * reread and not a line to add here.
 */
const QUOTES_THE_RETIRED_SENSE = [
  'scripts/tests/a-lane-is-not-a-layer.test.mjs',
  'scripts/tests/a-rename-leaves-no-mangled-english.test.mjs',
  'scripts/tests/annotation-capture.test.mjs',
]

/** Whether a path is one of those documents. */
export function quotesTheRetiredSense(path) {
  return (
    QUOTES_THE_RETIRED_SENSE.includes(path) ||
    path.startsWith('supabase/migrations/')
  )
}

/**
 * Words that belong to the cascade, to compositing, to stacking, to a staged
 * reveal, or to an architectural tier. A board row can be none of them.
 *
 * `derived` is this deployment's own entry: the derived layer — slices,
 * findings, evidence — is a tier of the schema, and #605 found it written as
 * a lane in `scripts/authored_fields.mjs`.
 *
 * `semantic` is the template's entry and is deliberately NOT here. The
 * residue sweep next door already registers that word standing in front of
 * this one, with the negative lookahead that keeps `semantic lane_role` and
 * "semantic lane roles" green, and one sentence should fail one guard.
 * Adding it here would report every such line twice, under two different
 * explanations, in two files that each claim to own it.
 */
const LAYER_SENSE = [
  'annotation', 'arrow', 'boot', 'cascade', 'chrome', 'composited',
  'compositing', 'context', 'derived', 'forward', 'opaque', 'overlay',
  'paint', 'painted', 'persistence', 'presentation', 'scratch', 'stacking',
  'token', 'tool', 'translucent', 'transport', 'ts', 'typescript', 'wrap',
  'z-index',
]

/** Nouns a layer has and a row of a board does not. */
const LAYER_THING = ['boundary', 'boundaries', 'tree', 'hit-testing', 'hit-test']

/**
 * DOM and geometry handles. A lane is a row of DATA drawn by many elements
 * across the whole width of the board, so there is no single element that IS
 * a lane, and nothing to hold a ref, a rect or a scale of. A rendering layer
 * is exactly one element, which is why these compounds only ever meant one.
 */
const HANDLE = [
  'Ref', 'Rect', 'Element', 'Node', 'Scale', 'Interactive', 'Boundary',
  'Opacity', 'ZIndex',
]

export const PATTERNS = [
  {
    pattern: new RegExp(`\\b(?:${LAYER_SENSE.join('|')})[- ]lanes?\\b`, 'i'),
    means: 'a layer of the cascade, of paint, of the reveal, or of the stack',
  },
  {
    pattern: new RegExp(`\\blanes?[- ](?:${LAYER_THING.join('|')})\\b`, 'i'),
    means: 'a layer boundary or a layer tree',
  },
  {
    pattern: new RegExp(`[Ll]ane(?:${HANDLE.join('|')})\\b`),
    means: 'a handle on one element, which is a layer and never a row',
  },
  {
    pattern: /\blane[A-Za-z]*\s*:\s*[A-Za-z]*Layer\b/,
    means: 'a binding named for a lane and typed as a layer',
  },
  {
    // The shape this repository produced where the template produced the one
    // above: `const lane = layerRef.current`, a local named for a row of the
    // board holding the annotation canvas. Untyped, so nothing but the name
    // ever said what it was.
    pattern: /\blane[A-Za-z]*\s*=\s*[A-Za-z]*[Ll]ayer[A-Za-z]*\b/,
    means: 'a binding named for a lane and assigned a layer',
  },
]

/** Every line in `source` standing in the retired sense. */
export function layerSenseIn(source) {
  const hits = []
  source.split('\n').forEach((line, index) => {
    for (const { pattern, means } of PATTERNS) {
      if (pattern.test(line)) hits.push({ line: index + 1, means })
    }
  })
  return hits
}

test('nothing called a lane is a layer', () => {
  const found = scannedFiles(REPO_ROOT)
    .filter((path) => !quotesTheRetiredSense(path))
    .flatMap((path) => {
      let source
      try {
        source = readFileSync(resolve(REPO_ROOT, path), 'utf8')
      } catch {
        return [] // a submodule, or a path removed between listing and here
      }
      if (source.includes('\0')) return [] // binary the extension did not name
      return layerSenseIn(source).map((hit) => `${path}:${hit.line} — ${hit.means}`)
    })
  assert.deepEqual(
    found,
    [],
    "A lane is one actor's row across the steps — see CONTEXT.md. The word " +
      'here is standing for something stacked, staged, composited or tiered, ' +
      'which is a LAYER, and the rename that moved the table `layers` to ' +
      `\`lanes\` did not retire that English word:\n${found.join('\n')}`,
  )
})

test('the guard reads the company the word keeps', () => {
  // The subject, exercised directly. A guard whose extraction is wrong
  // reports clean forever and looks exactly like a codebase that is clean.
  //
  // Lines 1-9 are sentences #605 removed from this tree, one per concept.
  // Lines 10-12 are the two name shapes the template's own cleanup produced
  // and this repository did not: they stay because each pattern names a
  // concept rather than a site, and the concept is the same on both sides.
  assert.deepEqual(
    layerSenseIn(
      [
        "the shell reads that rung to decide when to lift the sidebar's boot lane",
        'Erase every annotation mark from the canvas scratch lane.',
        "The reveal's arrow lane (stage 4). This connector was the one",
        'All four sit on one shared context lane, so what any surface reads',
        '* derived lane (slices, findings, evidence) survives because it was',
        '/** Live CSS scale of the annotation lane (more reliable than zoom). */',
        "Three rules, taken from Figma's lane tree:",
        'and this element is TRANSFORMED — a composited lane boundary',
        '    const lane = layerRef.current',
        '  const laneRef = useRef<HTMLDivElement>(null)',
        'function getLaneScale(el: HTMLElement): number {',
        '  lane: ArrowLayer',
      ].join('\n'),
    ).map((hit) => hit.line),
    // Line 8 appears twice: "a composited lane boundary" trips two concepts,
    // and a sentence that is wrong twice is reported twice.
    [1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12],
  )
})

test('the guard leaves the board alone', () => {
  // Every one of these is a real sentence from this tree about a real lane.
  // They are the reason the patterns name concepts a row cannot have rather
  // than a vocabulary of rendering words a board also uses — `ring`, `fill`
  // and `fade` are all over the correct sentences below.
  assert.deepEqual(
    layerSenseIn(
      [
        'Semantic lane roles — the stable contract between blueprint content and',
        'its `lane_role` carries the rendering semantics (touchpoint cells,',
        'accent rather than the lane ring used for saved membership: while',
        "but the touchpoint lane's `touchpoints` variant",
        '   *        stage 1  phase frames + lane structure',
        'single fade at stage 1 — the beat the canvas opens its phase lanes — so',
        '// onto adjacent lanes instead of overdrawing one line.',
        "A storyboard lane's face comes from the walkthrough lanes' frames,",
        ' * `references/lane-vocabulary.md` says an actor lane names a person',
        'it was surfacing with the lanes at stage 1 — an arrow',
        'the flag alone said "live" to all of them — 176 lane headers and 125 step',
        'a null role (e.g. an actor lane such as Student or Regular Tutor) renders',
        'const laneIndex = lanes.findIndex((row) => row.id === laneId)',
        'const laneFill = laneHasInteractionLine(lane) ? ACCENT : BASE',
      ].join('\n'),
    ),
    [],
  )
})

test('the two files that hold the most lanes are read whole and stay quiet', () => {
  // The acceptance test for the port, run against the files rather than
  // against a copy of their sentences. `ServiceOverviewView.tsx` is the
  // worst-hit file in the tree and keeps every genuine use it had;
  // `PhaseScenarioOverview.tsx` holds BOTH words in one comment block, three
  // lines apart, and is the standing proof that a per-file sense does not
  // exist. The floor on the count is what stops either assertion from going
  // quietly vacuous if the word leaves the file.
  const read = (path) => readFileSync(resolve(REPO_ROOT, path), 'utf8')

  const overview = read('src/components/editor/ServiceOverviewView.tsx')
  assert.ok(
    (overview.match(/lanes?/gi) ?? []).length >= 15,
    'ServiceOverviewView.tsx no longer holds the genuine uses this asserts about',
  )
  assert.deepEqual(layerSenseIn(overview), [])

  const phase = read('src/components/blueprint/PhaseScenarioOverview.tsx')
  assert.ok(
    phase.includes("The reveal's arrow layer (stage 4)"),
    'the layer sense left the block',
  )
  assert.ok(
    phase.includes('surfacing with the lanes at stage 1'),
    'the lane sense left the block',
  )
  assert.deepEqual(layerSenseIn(phase), [])
})

test('a name is caught at its declaration, and the compiler does the rest', () => {
  // `const lane = layerRef.current` was two lines feeding twelve uses. The
  // guard claims the declaration only; renaming it makes every use an
  // undefined name, so listing the uses here would enumerate what `tsc`
  // already says.
  assert.equal(layerSenseIn('  const lane = layerRef.current').length, 1)
  assert.equal(layerSenseIn('    const scale = getLayerScale(lane)').length, 0)
  assert.equal(layerSenseIn('    releaseCapture(lane, pointerId)').length, 0)
})

test('the documents that record the rename may quote what it mangled', () => {
  // By path rule, not by line.
  assert.ok(quotesTheRetiredSense('scripts/tests/a-lane-is-not-a-layer.test.mjs'))
  assert.ok(quotesTheRetiredSense('scripts/tests/annotation-capture.test.mjs'))
  assert.ok(
    quotesTheRetiredSense('scripts/tests/a-rename-leaves-no-mangled-english.test.mjs'),
  )
  assert.ok(
    quotesTheRetiredSense(
      'supabase/migrations/20260831100000_three_variables_that_still_said_layer.sql',
    ),
  )
  assert.ok(!quotesTheRetiredSense('src/styles/blueprint.css'))
  assert.ok(!quotesTheRetiredSense('src/components/editor/ServiceOverviewView.tsx'))
  assert.ok(!quotesTheRetiredSense('scripts/authored_fields.mjs'))
})
