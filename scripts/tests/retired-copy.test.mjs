/**
 * #146 — the words a person reads on screen match the words in the schema.
 *
 * Identifier drift between the app and the database is structurally impossible
 * here: `src/types/database.ts` is generated from the schema, so every table
 * and column name reaches TypeScript by machine and `tsc` fails if the app
 * disagrees. Everything that broke in the 2026-08 rename sat in the places the
 * generator cannot reach, and this is the fourth of them — the one no other
 * ticket covers. Nothing asserts that a button says "lane" when the table says
 * `lanes`. It is true today because the rename was done carefully by hand.
 *
 * SUBJECT: JSX text nodes, and the props that reach a reader — `aria-label`,
 * `title`, `placeholder`, `alt`, `label`. Nothing else. Not comments, not
 * identifiers, not imports, not test files, not `data-*`, and not a string
 * that names a database object — that is #145 Check B, a different check with
 * a different exemption list.
 *
 * IF THIS PRODUCES A FALSE POSITIVE, NARROW THE SUBJECT — NEVER THE WORD LIST.
 * Fewer prop names, fewer node kinds. `src/lib/tokenDiscipline.test.ts` states
 * the reason: a pattern narrowed to dodge a real case reads, to the next
 * person, as a rule that never covered it. Dropping `layer` from the word list
 * to silence one legitimate use converts this into a rule that never covered
 * `layer` at all.
 *
 * IT SHIPS WITH ZERO EXEMPTIONS, and that is an outcome to protect rather than
 * an accident. `derived layer` was the one term that would have forced a
 * permanent one — a legitimate concept containing a retired word, sitting in
 * prose that could reach a panel heading. Renaming it to `analysis tier` on
 * #142 removes the collision instead of documenting it. An exemption in a copy
 * guard is indistinguishable from a mistake three months later.
 *
 * `sourceFiles()` is reused rather than reimplemented. Its docstring records
 * the sampling gap that bit the last guard — `lib/`, `hooks/` and `contexts/`
 * must be in the roots, not just `components/` — and a second walker would
 * drift from it.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { sourceFiles } from '../../src/lib/tokenModel.ts'
import { RETIRED_COPY_WORDS } from '../retired-vocabulary.mjs'

/** The props whose string value a person reads. */
const READER_FACING_PROPS = ['aria-label', 'title', 'placeholder', 'alt', 'label']

const PROP_VALUE = new RegExp(
  `\\b(${READER_FACING_PROPS.join('|')})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*['"\`]([^'"\`]*)['"\`]\\s*\\})`,
  'g',
)

/**
 * Text sitting between a closing `>` and the next opening `<`, carrying no
 * braces — a JSX text node, near enough. A real parser would be better and is
 * not worth a dependency here: the only way this misreads ordinary code is a
 * comparison like `a > b && c < d`, and that has to contain a retired word
 * before anyone hears about it.
 */
const JSX_TEXT = />([^<>{}]+)</g

/** Each retired spelling as a whole-word pattern, spaces matching any run. */
const PATTERNS = RETIRED_COPY_WORDS.map((word) => ({
  word,
  pattern: new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'i'),
}))

/** Every reader-facing string in the app, with where it came from. */
export function readerFacingStrings(files = sourceFiles()) {
  const out = []
  for (const { file, code } of files) {
    if (!file.endsWith('.tsx')) continue
    for (const match of code.matchAll(PROP_VALUE)) {
      const value = match[2] ?? match[3] ?? match[4]
      if (value) out.push({ file, where: `${match[1]}=`, value })
    }
    for (const match of code.matchAll(JSX_TEXT)) {
      const value = match[1].trim()
      if (value && /[A-Za-z]/.test(value)) out.push({ file, where: 'text', value })
    }
  }
  return out
}

/** Reader-facing strings carrying a retired spelling. */
export function offenders(strings = readerFacingStrings()) {
  return strings.flatMap((entry) => {
    const hit = PATTERNS.find(({ pattern }) => pattern.test(entry.value))
    return hit ? [`${entry.file} (${entry.where}) "${entry.value}" — "${hit.word}"`] : []
  })
}

test('no retired spelling reaches a reader', () => {
  const found = offenders()
  assert.deepEqual(
    found,
    [],
    'A retired word is on screen. The schema, the docs and the agent all use the ' +
      'current one, and a UI that disagrees is the same defect as a doc asserting ' +
      `an interface the code lacks — pointed at the user instead:\n${found.join('\n')}`,
  )
})

test('the guard reads the props and the text nodes it claims to', () => {
  // The subject, exercised directly. A guard whose extraction is wrong reports
  // nothing and looks identical to a codebase that is clean.
  const planted = [
    {
      file: 'components/planted.tsx',
      code: [
        '<Button aria-label="Add a layer">',
        '  <span>Every lifecycle starts here</span>',
        '</Button>',
        '<Field placeholder="row position" label={"Maturity"} />',
        '<img alt="a service scenario" />',
      ].join('\n'),
    },
  ]
  const found = offenders(readerFacingStrings(planted)).map((one) => one.split(' — ')[1])
  assert.deepEqual(found.sort(), [
    '"layer"',
    '"lifecycle"',
    '"maturity"',
    '"row position"',
    '"service scenario"',
  ])
})

test('the guard does not read what it excludes', () => {
  const quiet = [
    {
      file: 'components/quiet.tsx',
      code: [
        // An identifier, an import, a data attribute and a database name are
        // each somebody else's subject.
        "import { layerOf } from '@/lib/tokenModel'",
        '<div data-canvas-annotation-layer className="layer-1">',
        "  {supabase.from('service_lifecycles')}",
        '</div>',
      ].join('\n'),
    },
    { file: 'lib/not-a-component.ts', code: '<span>the layer</span>' },
  ]
  assert.deepEqual(offenders(readerFacingStrings(quiet)), [])
})
