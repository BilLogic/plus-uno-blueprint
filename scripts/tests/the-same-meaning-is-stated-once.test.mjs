/**
 * The cross-repository duplicate sweep's contract (#364, story 8), proven by
 * prose that breaks it.
 *
 * A guard seen only passing is not evidence. `CONTEXT.md`, `README.md` and
 * `AGENTS.md` pass today and would pass exactly as quietly if the comparison
 * had stopped looking, so every rule is driven from a fixture pair — one text
 * standing for this deployment, one for the template — and the shipped tree is
 * asserted last, as one case among several rather than as the whole suite.
 * Same shape as `the-glossary-is-a-glossary.test.mjs` and
 * `reconciled-files.test.mjs`, and for the same reason: `findings` is pure, so
 * a failing branch can be proven without editing the documents the check
 * protects.
 *
 * The four normalisation rules get a test each, because each one is a claim
 * that this check sees a duplicate `check:reconciled` cannot. If any of them
 * were quietly dropped the sweep would degrade into a byte comparison over a
 * narrower subject, which is the failure mode the check's own header argues
 * against — and nothing else in the suite would notice.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'

import {
  NOT_OUR_PROSE,
  PROSE_FLOOR,
  blocksIn,
  findings,
  normalise,
  subjectDocuments,
  sweep,
} from '../check-duplicate-meaning.mjs'
import { RECONCILED_FILES } from '../reconciled-files.mjs'
import { sweptDocs } from '../swept-docs.mjs'

/** One paragraph, comfortably over the floor, in this repository's voice. */
const SHARED = [
  '**sprawl** — a document too long even when every line of it is live:',
  'attention thins across the whole of it. The cure is the ladder rather than a',
  'shorter sentence. Distinct from *bloat*, which is dead weight.',
].join('\n')

/** A paragraph only this deployment could write, of comparable length. */
const OURS_ALONE = [
  '**hold** — `SKELETON_HOLD_MS`, 250 ms: how long a surface may load before its',
  'skeleton is allowed to paint, and the reason a fast load shows no placeholder',
  'at all rather than one that flashes.',
].join('\n')

const doc = (...blocks) => `${blocks.join('\n\n')}\n`

test('a document that shares no block with the template has no findings', () => {
  assert.deepEqual(
    findings({ ours: doc(OURS_ALONE), theirs: doc(SHARED), subject: 'CONTEXT.md' }),
    [],
  )
})

test('a block stated in both fails, and the failure names both line numbers', () => {
  const found = findings({
    ours: doc(OURS_ALONE, SHARED),
    theirs: doc(SHARED),
    subject: 'CONTEXT.md',
  })
  assert.equal(found.length, 1)
  assert.match(found[0], /^CONTEXT\.md:5 is stated in the template too, at /)
  assert.match(found[0], /agentic-service-blueprinting\/CONTEXT\.md:1 —/)
  assert.match(found[0], /\*\*sprawl\*\* — a document too long/)
})

/* ------------------------------------ the four things normalisation removes */

test('rewrapping a copied paragraph does not hide it', () => {
  // The two repositories wrap prose at different columns, so a copy that was
  // reflowed on arrival is byte-different and meaning-identical.
  const rewrapped = SHARED.replace(/\n/g, ' ')
  assert.notEqual(rewrapped, SHARED)
  assert.equal(findings({ ours: doc(rewrapped), theirs: doc(SHARED), subject: 'C.md' }).length, 1)
})

test('recasing the defined term does not hide a copy', () => {
  // The template capitalises its glossary terms and this repository does not.
  // That single character is the whole of the difference between the two live
  // copies of this very paragraph.
  const recased = SHARED.replace('**sprawl**', '**Sprawl**')
  assert.equal(findings({ ours: doc(SHARED), theirs: doc(recased), subject: 'C.md' }).length, 1)
})

test('adding a link or emphasis to a copied sentence does not hide it', () => {
  const decorated = SHARED.replace(
    'the ladder',
    '[the **ladder**](docs/engineering/standards.md)',
  )
  assert.equal(findings({ ours: doc(decorated), theirs: doc(SHARED), subject: 'C.md' }).length, 1)
})

test("swapping one repository's name for the other does not hide a copy", () => {
  // `docs/agents/issue-tracker.md` is the live case: the two copies differ in
  // exactly one word, the repository named in the frontmatter, and seventeen
  // identical blocks sit behind it where no byte comparison can reach them.
  const sentence =
    'How the engineering skills read and write this repository\'s issue queue — GitHub Issues on '
  const ours = `${sentence}BilLogic/plus-uno-blueprint, reached through the gh CLI and nothing else.`
  const theirs = `${sentence}BilLogic/agentic-service-blueprinting, reached through the gh CLI and nothing else.`
  assert.notEqual(ours, theirs)
  assert.equal(findings({ ours: doc(ours), theirs: doc(theirs), subject: 'C.md' }).length, 1)
})

/* --------------------------------------------------- the floor and the fences */

test('a short block both repositories share is coincidence, not a copy', () => {
  const heading = '## The writing vocabulary'
  assert.ok(normalise(heading).length < PROSE_FLOOR)
  assert.deepEqual(findings({ ours: doc(heading), theirs: doc(heading), subject: 'C.md' }), [])
})

test('the floor is measured after normalising, not before', () => {
  // A paragraph padded out to the floor with backticks and asterisks is not a
  // paragraph; the markers come off first and the block falls below it.
  const padded = `\`${'*'.repeat(120)}\` short line`
  assert.ok(padded.length > PROSE_FLOOR)
  assert.ok(normalise(padded).length < PROSE_FLOOR)
  assert.deepEqual(findings({ ours: doc(padded), theirs: doc(padded), subject: 'C.md' }), [])
})

test('fenced code is not compared — whether two repositories share code is check:reconciled', () => {
  const fenced = ['```sql', SHARED, '```'].join('\n')
  assert.deepEqual(blocksIn(fenced), [])
  assert.deepEqual(findings({ ours: fenced, theirs: fenced, subject: 'C.md' }), [])
})

test('blocks are runs of non-blank lines, each carrying the line it starts on', () => {
  const found = blocksIn('alpha\nbeta\n\n\ngamma\n')
  assert.deepEqual(
    found.map((block) => [block.line, block.text]),
    [
      [1, 'alpha\nbeta'],
      [5, 'gamma'],
    ],
  )
})

/* ------------------------------------------------------------- the subject */

test('the subject is the swept prose the template also carries, and it is not empty', () => {
  // Not empty is the anti-vacuity assertion. A sweep whose subject has emptied
  // out reports green on any input, so the shape of the subject is asserted
  // here as well as guarded in the script's own main().
  const documents = subjectDocuments()
  assert.deepEqual(documents, ['CONTEXT.md', 'README.md', 'AGENTS.md'])
})

test('vendored skill config is out of subject, and it really is shared prose', () => {
  // `docs/agents/` is the configuration surface of the third-party
  // mattpocock-skills package. It IS swept prose, and it IS duplicated — which
  // is precisely why the exclusion has to be asserted rather than assumed: if
  // it were ever dropped, the sweep would start failing on prose neither
  // repository wrote.
  const swept = sweptDocs()
  assert.ok(swept.includes('docs/agents/issue-tracker.md'))
  assert.ok(NOT_OUR_PROSE.some((prefix) => 'docs/agents/issue-tracker.md'.startsWith(prefix)))
  assert.ok(!subjectDocuments().includes('docs/agents/issue-tracker.md'))
})

test('history is out of subject, inherited from swept-docs rather than restated here', () => {
  // A decision record states the decision of its day in the words of its day.
  // `docs/adr/0005-cross-surface-state-is-a-module-store.md` exists in both
  // repositories and shares four blocks; swept-docs already excludes it, and
  // this check must not grow a second list that can disagree with that one.
  assert.ok(!sweptDocs().some((rel) => rel.startsWith('docs/adr/')))
  assert.ok(!subjectDocuments().some((rel) => rel.startsWith('docs/adr/')))
})

test('anything check:reconciled already holds is left to check:reconciled', () => {
  const reconciled = new Set(RECONCILED_FILES)
  assert.ok(!subjectDocuments().some((rel) => reconciled.has(rel)))
})

/* -------------------------------------------------------- the shipped tree */

test('the shipped harness prose states nothing the template states', () => {
  const { failures, documents, compared } = sweep()
  assert.deepEqual(failures, [])
  assert.ok(documents.length > 0)
  // The census is the evidence the sweep looked at something. It was 77 blocks
  // when this landed; the assertion is a floor rather than the number, because
  // a document growing a paragraph is not a reason to edit a test.
  assert.ok(compared > 50, `expected the sweep to compare real prose, saw ${compared} block(s)`)
})
