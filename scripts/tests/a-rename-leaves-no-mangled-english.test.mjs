/**
 * The residue a MECHANICAL rename leaves behind.
 *
 * `21000104` renamed `layers` to `lanes`, and the prose was carried over by
 * word replacement, so sentences using `layer` in its ordinary English sense
 * came out with `lane` substituted into the middle of a word or an unrelated
 * idea: "tabs laneed", "deliberately unlaneed", "the semantic lane" of design
 * tokens. Eleven of them survived in the template. Three survived here — this
 * repository ran the same rename — and every one passed `tsc`, `eslint`, every
 * check and review, because a sentence is the subject of almost nothing.
 *
 * SUBJECT: every file a commit would carry — tracked, plus untracked files git
 * would not ignore. Not `src` alone and not the swept docs alone: the residue
 * lands wherever the rename's `sed` reached, which is a comment in a
 * stylesheet, a heading in a guideline, a test's own name. This is the widest
 * subject in `scripts/tests/`, and it can afford to be, because the patterns
 * below match strings that are not English words rather than words that are.
 *
 * WHY IT IS NOT IN `retired-copy.test.mjs`, where the template put it: that
 * file fixes its subject in its header to JSX text nodes, reader-facing props
 * and figure `<text>` — "Nothing else. Not comments, not identifiers, not
 * imports, not test files". A whole-tree sweep bolted onto it would make the
 * header false, and the header is the part a person reads before deciding
 * whether a finding belongs there. `badge-and-tag.test.mjs` is fixed to `src`
 * for a reason of its own. So this is a sibling: one subject, one file.
 *
 * A RESIDUE SHAPE EARNS ITS PLACE BY BEING IMPOSSIBLE AS ENGLISH, not by
 * being suspicious. `laneed` and `unlaneed` are in no dictionary; `semantic
 * lane` standing where a TIER was meant is a phrase this codebase never means.
 * That is what lets the subject be the whole tree with no exemption for
 * ordinary prose. A pattern that could match a correct sentence belongs in a
 * narrower guard, or nowhere.
 *
 * THE LIST GROWS WITH EACH RENAME — that is the point, and a sweep that only
 * knows the last one is a fixed bug rather than a guard. #391 will rename
 * `visual` to `storyboard` across 386 sites, and the tree today holds 27
 * "visually", 5 "visualization" and a handful of "visual language" /
 * "visual vocabulary": a word replacement produces `storyboardly` and
 * `storyboardization` from the first two, and they are pre-registered below so
 * the rename lands against a guard instead of after one.
 *
 * `storyboard walkthrough` is deliberately NOT registered, and the omission is
 * the entry. It reads like residue and is this deployment's CURRENT, correct
 * name: `scripts/retired-vocabulary.mjs` records that the only reader-facing
 * "Visual walkthrough" was the storyboard played step by step and now says so,
 * and `VisualWalkthroughModal.tsx` labels it that on purpose. Registering it
 * would flag code that is right, which is the one thing this file must never
 * do. The same test that keeps "semantic lane roles" green keeps this green.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname)

/** Binary payloads git happens to track. Nothing to read a line out of. */
const BINARY = /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|pdf|zip|mp4|avif)$/i

/**
 * Every file a commit would carry: tracked, plus untracked files git would not
 * ignore.
 *
 * Tracked alone is a trap — a document written and checked locally before
 * `git add` is invisible to the sweep, then fails in CI the moment it is
 * committed. The two subjects are one function, and that function sees what a
 * commit would.
 *
 * Written here rather than imported: no check in this repository listed the
 * whole tree before this one, and the template's `scannedFiles` carries that
 * repository's exclusions, which are not ours.
 */
export function scannedFiles(root = REPO_ROOT) {
  const listed = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  const seen = new Set()
  return listed.split('\0').filter((path) => {
    if (path === '' || seen.has(path) || BINARY.test(path)) return false
    seen.add(path)
    return true
  })
}

/**
 * One entry per shape a mechanical rename produced, with the word it meant.
 *
 * The first three are `21000104`'s. `semantic lane_role` and "semantic lane
 * roles" are deliberately not residue: the column is named that, and roles
 * that are semantic is what this codebase means by the phrase. The negative
 * lookahead is what tells the two apart — the residue is `semantic lane`
 * standing where a tier was meant, with no role after it.
 *
 * The last two are #391's, registered before the rename rather than after it.
 */
const MANGLED = [
  { pattern: /\blaneed\b/i, meant: 'layered' },
  { pattern: /\bunlaneed\b/i, meant: 'unlayered' },
  { pattern: /\bsemantic lane(?![_ ]roles?\b)/i, meant: 'semantic layer' },
  { pattern: /\bstoryboardly\b/i, meant: 'visually' },
  { pattern: /\bstoryboardi[sz]ation\b/i, meant: 'visualization' },
]

/**
 * Documents that must be able to write the residue down.
 *
 * This file plants every shape to prove the sweep reads it. A changeset and
 * the CHANGELOG are the same case one step out: the note explaining that "tabs
 * laneed" became "tabs layered" has to quote both. `supabase/migrations/` is
 * the third and oldest of them — a migration is a DATED RECORD of what was
 * applied on a day, and rewriting a record is worse than the word it removes
 * (`CONTEXT.md` keeps a retired name in a migration filename for the same
 * reason).
 *
 * Nothing else is exempt, and `scripts/reconciled-files.mjs` is the reason
 * that list stayed this short: its comments explained the template's wreckage
 * by quoting it, and they say the same thing now without carrying it. An
 * exemption in a vocabulary guard is indistinguishable from a mistake three
 * months later, so the fix was the sentence and not the list.
 */
const MANGLE_EXEMPT = [
  'scripts/tests/a-rename-leaves-no-mangled-english.test.mjs',
  'CHANGELOG.md',
]

/** Whether a path is one of those documents. */
export function mangleExempt(path) {
  return (
    MANGLE_EXEMPT.includes(path) ||
    path.startsWith('.changeset/') ||
    path.startsWith('supabase/migrations/')
  )
}

/** Every `{ line, meant }` in one file's source. */
export function mangledIn(source) {
  const hits = []
  source.split('\n').forEach((line, index) => {
    for (const { pattern, meant } of MANGLED) {
      if (pattern.test(line)) hits.push({ line: index + 1, meant })
    }
  })
  return hits
}

test('a rename left no mangled English behind', () => {
  const found = scannedFiles()
    .filter((path) => !mangleExempt(path))
    .flatMap((path) => {
      let source
      try {
        source = readFileSync(resolve(REPO_ROOT, path), 'utf8')
      } catch {
        return [] // a submodule, or a path removed between listing and here
      }
      if (source.includes('\0')) return [] // binary the extension did not name
      return mangledIn(source).map((hit) => `${path}:${hit.line} — meant "${hit.meant}"`)
    })
  assert.deepEqual(
    found,
    [],
    'A rename was carried into prose by word replacement and broke the ' +
      'sentence. These are not words: say the one that was meant, and if the ' +
      'sentence was about the design-token tier or a stack of tabs, the word ' +
      `is "layer" and always was:\n${found.join('\n')}`,
  )
})

test('the documents that record a rename may quote what it mangled', () => {
  // By path rule, not by line: a changeset explaining the fix quotes the
  // broken word and the right one in the same sentence, and no pattern
  // separates that from the wreckage itself.
  assert.ok(mangleExempt('.changeset/a-layer-of-tokens-is-not-a-lane.md'))
  assert.ok(mangleExempt('CHANGELOG.md'))
  assert.ok(mangleExempt('supabase/migrations/20260716120000_layer_role.sql'))
  assert.ok(mangleExempt('scripts/tests/a-rename-leaves-no-mangled-english.test.mjs'))
  assert.ok(!mangleExempt('docs/guidelines/foundations/tokens.md'))
  assert.ok(!mangleExempt('scripts/reconciled-files.mjs'))
  assert.ok(!mangleExempt('src/styles/blueprint.css'))
})

test('the sweep reads the residue and not the column it resembles', () => {
  assert.deepEqual(
    mangledIn(
      [
        'tabs laneed over the base view',
        'deliberately unlaneed so they win',
        'the semantic lane above has one job',
        'the semantic lane_role, never the display name',
        'Semantic lane roles — the contract between content and rendering',
        'a lane is a row of the blueprint',
      ].join('\n'),
    ).map((hit) => `${hit.line}:${hit.meant}`),
    ['1:layered', '2:unlayered', '3:semantic layer'],
  )
})

test('the shapes #391 will produce are registered before the rename', () => {
  // The two a `visual`→`storyboard` word replacement obviously makes, and the
  // three phrases it must leave alone: the deployment's current name for the
  // storyboard played step by step, and the word `storyboard` doing its job.
  assert.deepEqual(
    mangledIn(
      [
        'the label is storyboardly hidden but still read aloud',
        'a storyboardization of the whole path',
        'Storyboard walkthrough',
        'the storyboard lane holds one frame per step',
        'storyboards are rows, not media',
      ].join('\n'),
    ).map((hit) => `${hit.line}:${hit.meant}`),
    ['1:visually', '2:visualization'],
  )
})

test('the sweep reads the tree it claims to', () => {
  // A guard whose file listing is wrong reports nothing and looks identical to
  // a tree with no residue. Three facts about the corpus, cheap and
  // load-bearing: it is large, it reaches past `src`, and the exclusions
  // excluded something that is really there.
  const files = scannedFiles()
  assert.ok(files.length > 500, `only ${files.length} files listed`)
  for (const root of ['src/', 'scripts/', 'docs/', 'supabase/']) {
    assert.ok(
      files.some((path) => path.startsWith(root)),
      `${root} is not in the subject`,
    )
  }
  assert.ok(
    files.some((path) => path.startsWith('supabase/migrations/')),
    'migrations are listed and then exempted by path, not missing from the listing',
  )
  assert.ok(
    !files.some((path) => BINARY.test(path)),
    'a binary reached the sweep',
  )
})
