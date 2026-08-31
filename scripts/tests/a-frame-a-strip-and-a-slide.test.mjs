/**
 * #179 — the two halves of this rename that the rename map cannot hold.
 *
 * Three of the four names #179 moves ARE in the enforced map: `visual`,
 * `picture` and `slice_item` are all substrings of nothing that survives, so
 * `scripts/check-retired-identifiers.mjs` forbids them and will go on doing
 * so. Two things are left over, and both are here for the reasons #177's
 * `one-spelling-each.test.mjs` states for its own four.
 *
 * 1. **`slice_items.caption` → `slides.title`, and the dropped
 *    `slice_items.illustration`.** `caption` cannot be a fragment because it
 *    is a live, correct English word: `steps.summary` is *displayed* as a
 *    caption under a step's strip and its comment says exactly that. A bare
 *    fragment would flag a comment that is right, which is the one thing the
 *    word list must never do. So the subject is narrowed instead — to TABLE
 *    AND COLUMN NAMES, table-qualified — which is narrow enough to say
 *    `caption` without saying it about `steps.summary`. The dropped column is
 *    beside it because a drop is not a rename and does not belong in a rename
 *    table.
 *
 * 2. **No word on screen calls a slide a frame.** No schema check can see
 *    this: `frame` is a LIVE name now — it is one image on one cell — so it
 *    cannot go in the copy guard's word list without failing every correct
 *    use of it. What is wrong is `frame` (or `screen`) used for a SLIDE, and
 *    that is a fact about a handful of surfaces rather than about a word. So
 *    those surfaces are named, and the words are forbidden there.
 *
 * Every assertion is proved to go red, in the shape
 * `scripts/tests/rls-posture.test.mjs` argues for: a check that is green
 * against this tree could equally be a check that examines nothing.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

/* ------------------------------------------------------------ the schema */

/**
 * Each retirement, as `retired` → `current`. A bare table name means the
 * table; `table.column` means the column. `why` says which of the two lists a
 * future entry belongs in.
 */
export const NARROWED = Object.freeze([
  {
    retired: 'slice_items.caption',
    current: 'slides.title',
    why: '`caption` is still the right English word for what `steps.summary` is displayed as, so no fragment can be enforced',
  },
])

/** Dropped outright, with nothing taking their place. */
export const DROPPED = Object.freeze(['slides.illustration'])

const has = (schema, path) => {
  const [table, column] = path.split('.')
  const row = schema.tables.get(table)
  if (!row) return false
  return column === undefined ? true : row.columns.has(column)
}

/** Every place the schema still spells a retired name, or has lost a current one. */
export function residue(schema) {
  const out = []
  for (const entry of NARROWED) {
    if (has(schema, entry.retired)) {
      out.push(`${entry.retired} still exists — it is ${entry.current} now (${entry.why})`)
    }
    if (!has(schema, entry.current)) {
      out.push(`${entry.current} does not exist, so ${entry.retired} was not renamed to it`)
    }
  }
  for (const path of DROPPED) {
    if (has(schema, path)) {
      out.push(
        `${path} still exists — it was set on no row and held an image that ` +
          `REPLACED a slide's strip instead of joining it`,
      )
    }
  }
  return out
}

const SCHEMA = replayMigrations(resolve(ROOT, 'supabase/migrations'))

test('the schema spells a slide’s title one way, and carries no second image', () => {
  assert.deepEqual(
    residue(SCHEMA),
    [],
    'A retired spelling is still in the schema, or the name that replaced it is not. ' +
      'These are the parts of #179 scripts/retired-vocabulary.mjs cannot enforce as ' +
      'substrings — see the `why` on each entry.',
  )
})

test('the schema check goes red on a schema that never did the rename', () => {
  // The table renamed and the two columns left alone — the half-done shape a
  // rename most plausibly stops at.
  const before = {
    tables: new Map([
      ['slice_items', { name: 'slice_items', columns: new Map([['caption', {}]]) }],
      ['slides', { name: 'slides', columns: new Map([['illustration', {}]]) }],
    ]),
  }
  const found = residue(before)
  // One retirement failing both halves, and the column that should be gone.
  assert.equal(found.length, NARROWED.length * 2 + DROPPED.length)
  assert.ok(found.some((one) => /^slice_items\.caption still exists/.test(one)))
  assert.ok(found.some((one) => /^slides\.title does not exist/.test(one)))
  assert.ok(found.some((one) => /^slides\.illustration still exists/.test(one)))

  // And red the other way: the rename read as a drop, with nothing arriving.
  const dropped = { tables: new Map() }
  assert.equal(residue(dropped).length, NARROWED.length)
  assert.ok(residue(dropped).every((one) => /does not exist/.test(one)))
})

/**
 * The slide's own image column is gone, so a slide's picture IS its strip.
 * Asserted on the schema rather than on the component, because a component can
 * be rewritten and this is the property that makes the rewrite safe.
 */
test('a slide has no image column of its own to disagree with its strip', () => {
  const slides = SCHEMA.tables.get('slides')
  assert.ok(slides, 'public.slides is gone')
  const images = [...slides.columns.keys()].filter((column) =>
    /illustration|picture|image|screenshot/.test(column),
  )
  assert.deepEqual(
    images,
    [],
    `slides carries ${images.join(', ')}. A slide shows the frames of the cells it ` +
      'references; a second source for that image is a second answer to the same ' +
      'question, which is what #179 removed.',
  )
})

/* ------------------------------------------------- the words on the screen */

/**
 * The surfaces where a slide is named, and nothing else.
 *
 * A LIST OF FILES RATHER THAN A LIST OF WORDS, and that is the whole design.
 * `frame` is a live name — one image on one cell — so forbidding it globally
 * would flag every correct use. What is wrong is `frame` used for a SLIDE, and
 * only these surfaces name slides.
 *
 * A new slide surface has to be added here. That is a real maintenance cost
 * and it is the cheaper of the two: the alternative is a global word ban with
 * an exemption per correct use, and #146's guard ships with zero exemptions on
 * purpose.
 */
export const SLIDE_SURFACES = Object.freeze([
  'src/components/editor/SliceSlideEditor.tsx',
  'src/components/editor/SliceSlideComposer.tsx',
  'src/components/editor/SlicePresentation.tsx',
  'src/components/editor/CreateSliceSheet.tsx',
  'src/components/editor/SliceView.tsx',
  'src/components/editor/SliceEditSession.tsx',
  'src/components/editor/SlicesSidebarSection.tsx',
])

/** What a slide must never be called where a reader can see it. */
const RETIRED_SLIDE_WORDS = ['frame', 'frames', 'screen', 'screens']

/** The props whose string value a person reads — #146's subject, verbatim. */
const READER_FACING_PROPS = ['aria-label', 'title', 'placeholder', 'alt', 'label']

const PROP_VALUE = new RegExp(
  `\\b(${READER_FACING_PROPS.join('|')})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*['"\`]([^'"\`]*)['"\`]\\s*\\})`,
  'g',
)
const JSX_TEXT = />([^<>{}]+)</g

/** Reader-facing strings in one file's source. */
export function readerFacingStrings(file, code) {
  const out = []
  for (const match of code.matchAll(PROP_VALUE)) {
    const value = match[2] ?? match[3] ?? match[4]
    if (value) out.push({ file, where: `${match[1]}=`, value })
  }
  for (const match of code.matchAll(JSX_TEXT)) {
    const value = match[1].trim()
    if (value && /[A-Za-z]/.test(value)) out.push({ file, where: 'text', value })
  }
  return out
}

/** Reader-facing strings on a slide surface that call a slide something else. */
export function slidesCalledSomethingElse(sources) {
  const out = []
  for (const { file, code } of sources) {
    for (const entry of readerFacingStrings(file, code)) {
      for (const word of RETIRED_SLIDE_WORDS) {
        if (new RegExp(`\\b${word}\\b`, 'i').test(entry.value)) {
          out.push(`${file} (${entry.where}) "${entry.value}" — "${word}"`)
        }
      }
    }
  }
  return out
}

const surfaceSources = () =>
  SLIDE_SURFACES.map((file) => ({
    file,
    code: readFileSync(resolve(ROOT, file), 'utf8'),
  }))

test('every slide surface this check names is still a file', () => {
  // The failure mode this whole file exists to prevent, one level up: a check
  // that reads nothing passes exactly as loudly as a codebase that is clean.
  for (const file of SLIDE_SURFACES) {
    assert.ok(
      statSync(resolve(ROOT, file), { throwIfNoEntry: false })?.isFile(),
      `${file} is named as a slide surface and does not exist — move the entry or drop it`,
    )
  }
})

test('no reader-facing word on a slide surface calls a slide a frame', () => {
  const found = slidesCalledSomethingElse(surfaceSources())
  assert.deepEqual(
    found,
    [],
    'A slide is called something else on screen. "Frame" is one image on one cell ' +
      'now and "screen" is nothing at all, so either one here is the collision #179 ' +
      `ended, put back in front of a reader:\n${found.join('\n')}`,
  )
})

test('the reader check goes red on a slide called a frame', () => {
  const planted = [
    {
      file: 'components/editor/Planted.tsx',
      code: [
        '<p>This slice has no frames yet.</p>',
        '<Input placeholder="Screen caption" />',
        '<Button aria-label={`Delete frame ${index + 1}`} />',
      ].join('\n'),
    },
  ]
  const found = slidesCalledSomethingElse(planted).map((one) => one.split(' — ')[1])
  assert.deepEqual(found.sort(), ['"frame"', '"frames"', '"screen"'])
})

test('the reader check leaves a cell’s frame alone', () => {
  // The distinction the whole ticket is about: a frame is one image on one
  // cell, and saying so on a slide surface is correct. Only a SLIDE called a
  // frame is the defect, which is why the words are matched whole and the
  // sentence below passes.
  const quiet = [
    {
      file: 'components/editor/Quiet.tsx',
      code: [
        '<p>Slide 2 of 7</p>',
        '<Button aria-label="Delete slide 3" />',
        // A comment is not a reader-facing string, and neither is an identifier.
        '// the frames of the cells this slide references',
        'const framed = resolveSlideStrip(blueprint, item)',
      ].join('\n'),
    },
  ]
  assert.deepEqual(slidesCalledSomethingElse(quiet), [])
})

/**
 * The surfaces are named by hand, so the list can silently stop covering the
 * app. This is the guard on the guard: any component whose name says it is
 * about slices or slides is either on the list or has no reader-facing prose
 * at all.
 */
test('no slice component with reader-facing prose is missing from the list', () => {
  const dir = resolve(ROOT, 'src/components/editor')
  const missing = []
  for (const name of readdirSync(dir)) {
    if (!/^Slice.*\.tsx$/.test(name) || name.includes('.test.')) continue
    const file = relative(ROOT, join(dir, name))
    if (SLIDE_SURFACES.includes(file)) continue
    const strings = readerFacingStrings(file, readFileSync(join(dir, name), 'utf8'))
    if (strings.length > 0) missing.push(file)
  }
  assert.deepEqual(
    missing,
    [],
    `A slice component with words on screen is not in SLIDE_SURFACES: ${missing.join(', ')}. ` +
      'Add it, or the check stops covering the surface it was written for.',
  )
})
