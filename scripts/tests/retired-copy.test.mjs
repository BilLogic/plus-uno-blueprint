/**
 * #146 — the words a person reads on screen match the words in the schema.
 *
 * Identifier drift between the app and the database is structurally impossible
 * here: the application's `types/database.ts` is generated from the schema,
 * so every table and column name reaches TypeScript by machine and `tsc`
 * fails if the app disagrees. Everything that broke in the 2026-08 rename sat
 * in the places the generator cannot reach, and this is the fourth of them —
 * the one no other ticket covers. Nothing asserts that a button says "lane"
 * when the table says `lanes`. It is true today because the rename was done
 * carefully by hand.
 *
 * SUBJECT: JSX text nodes, the props that reach a reader — `aria-label`,
 * `title`, `placeholder`, `alt`, `label` — and, since #635, the MESSAGE a
 * module hands a person: a quoted string bound to `message`, `error`,
 * `errorMessage`, `warning`, `notice`, `toast` or `fallback`. Nothing else.
 * Not comments, not identifiers, not imports, not test files, not `data-*`,
 * and not a string that names a database object — that is #145 Check B, a
 * different check with a different exemption list.
 *
 * IF THIS PRODUCES A FALSE POSITIVE, NARROW THE SUBJECT — NEVER THE WORD LIST.
 * Fewer prop names, fewer node kinds. The application's
 * `lib/tokenDiscipline.test.ts` states the reason: a pattern narrowed to dodge
 * a real case reads, to the next person, as a rule that never covered it.
 * Dropping `layer` from the word list to silence one legitimate use converts
 * this into a rule that never covered `layer` at all.
 *
 * IT SHIPS WITH ZERO EXEMPTIONS, and that is an outcome to protect rather than
 * an accident. `derived layer` was the one term that would have forced a
 * permanent one — a legitimate concept containing a retired word, sitting in
 * prose that could reach a panel heading. Renaming the concept out of it on
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
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { sourceFiles, stripComments } from '@/lib/tokenModel.ts'
import { deploymentSourceFiles } from '../app-source.mjs'
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

/**
 * THIRD SUBJECT (#635): the message a module hands a person.
 *
 * The two subjects above read `.tsx` only, and a `.tsx` file is where the
 * RENDERING lives. Copy that originates in a plain `.ts` module was invisible
 * to all of it — `lib/authoringErrors.ts` said "That column is not part of
 * this version yet" and "Two columns ended up in the same position", on screen,
 * for as long as this guard has existed. The guard's own header called those
 * words "enforced as retired copy", which was true of JSX and not of that file.
 *
 * HOW THE SUBJECT IS SCOPED, and it is by the NAME the string is bound to, not
 * by the string. Every quoted literal in every `.ts` file is not a subject —
 * it is table names, SQL fragments, route paths, CSS class names and test
 * fixtures, and a guard that read all of them would be argued down to nothing
 * within a week. A non-rendering module hands a reader one kind of string and
 * it is almost always a message: an error, a warning, a refusal. So the
 * subject is a quoted string bound with `:` or `=` to one of `MESSAGE_NAMES`,
 * in any `.ts` or `.tsx` of either source root — the application's, in the
 * installed package, and this deployment's own `deployment/`.
 *
 * WHAT THAT DELIBERATELY MISSES — written down because a guard whose blind
 * spot is recorded is worth more than one that claims to catch everything, and
 * every item here is a live string in this tree today, not a hypothetical:
 *
 *   1. Template literals and concatenation. `sliceValidation.ts` raises
 *      `` `Unknown slice type “${draft.sliceKind}”.` `` — "slice type" is
 *      retired for `slices.kind` — and this subject does not read it. That
 *      file is enrolled in the drift gate and says exactly what the template
 *      says, so the fix is upstream, not here; reading the static halves of
 *      template literals is the obvious next widening and belongs with it.
 *   2. Copy bound to any OTHER name. `panelTerms.ts` defines a step as
 *      "A column of the board", `coverContent.ts` has an `alt` and a
 *      `definition`, `CanvasAnnotationProvider.tsx` gives an agent command the
 *      summary "…the canvas scratch layer". Those names — `definition`,
 *      `summary`, `alt`, `description` — carry copy in CONTENT modules and
 *      developer-facing catalogues alike (`dev/arrowSituationCatalog.ts` is
 *      twelve legitimate uses of "column" about arrow geometry), and no
 *      name-list separates the two audiences. Widening to them is a decision
 *      about who the application's `dev/` and `lib/agent/` are written for,
 *      and that is a bigger question than this one.
 *   3. A string passed positionally — `toast('…')`, `new Error('…')`. There is
 *      no name to read, and `writeBoundaryContract.test.ts` already forbids the
 *      second from reaching a reader.
 *   4. The `hint` prop. `StepPanel.tsx` renders
 *      `hint="…makes the column legible…"`, which is JSX and therefore the
 *      FIRST subject's business — `READER_FACING_PROPS` simply does not list
 *      `hint` yet. Adding it there is a one-word change and a separate one.
 *
 * The word list is untouched by all of this, which is the rule the header
 * states. Everything above narrows WHERE a string is looked for.
 */
const MESSAGE_NAMES = [
  'message',
  'messages',
  'errorMessage',
  'error',
  'warning',
  'notice',
  'toast',
  'fallback',
]

/**
 * `name: 'value'` or `name = 'value'`, the name matched whole so `errorMessage`
 * is its own entry rather than a suffix of `message`, and `\s*` crossing lines
 * because the two strings that prompted this sit on the line below their key.
 * `!=` is excluded so `message !== 'x'` is a comparison, not a binding.
 */
const MESSAGE_VALUE = new RegExp(
  `(?<![\\w$])(${MESSAGE_NAMES.join('|')})\\s*(?::|=(?!=))\\s*` +
    `(?:'((?:[^'\\\\\\n]|\\\\.)*)'|"((?:[^"\\\\\\n]|\\\\.)*)")`,
  'gi',
)

/** Each retired spelling as a whole-word pattern, spaces matching any run. */
const PATTERNS = RETIRED_COPY_WORDS.map((word) => ({
  word,
  pattern: new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'i'),
}))

/**
 * Every module a reader-facing string can come out of, from BOTH source roots.
 *
 * `sourceFiles()` walks the application, and the application is the installed
 * package now — the same walk it always was, one repository further away, and
 * the module that defines it is the one whose docstring records the sampling
 * gap that bit the last guard, so it is still reused rather than reimplemented.
 *
 * What the move added is the second root. This deployment's own modules carry
 * copy of exactly the kind this guard is about — `deployment/content/` is the
 * text of the cover deck — and `sourceFiles()` cannot see them: they are not
 * under the package's `src`. Walking only the package would have quietly
 * narrowed the subject to the half of the tree this repository does not write.
 * `deploymentSourceFiles` refuses an empty walk, so a `deployment/` that went
 * missing fails here instead of reading as a deployment with no copy in it.
 *
 * Comments are stripped on both sides, with the package's own `stripComments`,
 * because a comment naming a retired word is not copy and the two roots have to
 * be read by one rule.
 */
export function copyBearingSources() {
  const ours = deploymentSourceFiles(
    (path) => /\.tsx?$/.test(path) && !path.includes('.test.'),
  )
  return [
    ...sourceFiles(),
    ...ours.map((file) => ({
      file,
      code: stripComments(readFileSync(resolve(process.cwd(), file), 'utf8')),
    })),
  ]
}

/** Every reader-facing string in the app, with where it came from. */
export function readerFacingStrings(files = copyBearingSources()) {
  const out = []
  for (const { file, code } of files) {
    for (const match of code.matchAll(MESSAGE_VALUE)) {
      const value = match[2] ?? match[3]
      if (value && /[A-Za-z]/.test(value)) out.push({ file, where: `${match[1]}:`, value })
    }
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
  // Both roots, and there is something in each. A walk that found no modules
  // would report a clean tree in exactly the voice of a clean tree — the same
  // argument the figure count below makes, and the one that matters most now
  // that one of the two roots is a directory inside `node_modules`.
  const strings = readerFacingStrings()
  assert.ok(
    strings.length > 100,
    `only ${strings.length} reader-facing string(s) were read — an empty walk is not a pass`,
  )
  const found = offenders(strings)
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

/**
 * The two sentences #635 was filed about, planted as a `.ts` module.
 *
 * They are here rather than only in `authoringErrors.ts` because the fix to
 * that file and the guard are different things: the file can be corrected in
 * one edit, and only this test stops the next message being written the same
 * way. If `authoringErrors.ts` is ever replaced wholesale by the template's,
 * these cases survive the replacement.
 */
test('a message a module raises is read, even with no JSX in the file', () => {
  const planted = [
    {
      file: 'lib/planted.ts',
      code: [
        'const TRANSLATIONS = [',
        '  {',
        "    match: 'cells.step_id must be linked',",
        '    message:',
        "      'That column is not part of this version yet. Add the column to the version before putting a cell in it.',",
        '  },',
        '  {',
        "    match: 'path_steps_path_column_unique',",
        "    message: 'Two columns ended up in the same position. Reload and try the move again.',",
        '  },',
        ']',
      ].join('\n'),
    },
  ]
  assert.deepEqual(offenders(readerFacingStrings(planted)), [
    'lib/planted.ts (message:) "That column is not part of this version yet. Add the column to ' +
      'the version before putting a cell in it." — "column"',
    'lib/planted.ts (message:) "Two columns ended up in the same position. Reload and try the ' +
      'move again." — "columns"',
  ])
})

test('the other names in the message family are read too', () => {
  const planted = [
    {
      file: 'lib/planted.ts',
      code: [
        "const FALLBACK = 'That layer could not be saved.'",
        "const warning = 'This chip is already open.'",
        "toast({ errorMessage: 'Two lifecycles ended up with one name.' })",
      ].join('\n'),
    },
  ]
  const found = offenders(readerFacingStrings(planted)).map((one) => one.split(' — ')[1])
  assert.deepEqual(found.sort(), ['"chip"', '"layer"', '"lifecycles"'])
})

test('the message subject reads the binding and not everything else in a .ts file', () => {
  // The false positives the scoping exists to refuse. Every line here carries
  // a retired word and none of them is copy: the `match` half of the very
  // table the two sentences live in is the database's own text, which the
  // header says belongs to #145 Check B.
  const quiet = [
    {
      file: 'lib/quiet.ts',
      code: [
        "  match: 'path_steps_path_column_unique',",
        "  const columns = 'column, position'",
        "  supabase.from('cells').select('column_id, layer')",
        "  order('slot position')",
        '  type Problem = { message: string }',
        "  if (error.message !== 'column') return",
        '  const className = "grid-cols-3 flex-col"',
      ].join('\n'),
    },
  ]
  assert.deepEqual(offenders(readerFacingStrings(quiet)), [])
})

/* ------------------------------------------------------------- the figures */

/**
 * SECOND SUBJECT: the text inside the shipped diagrams.
 *
 * Added because the first subject missed four of them at once. `public/cover/`
 * is not documentation — `EditorShell` renders those files as a deck inside
 * the app, so their words reach a reader the same way a heading does, and
 * `data-model-hierarchy.svg` was still labelling the top of the hierarchy
 * **Service lifecycle** four months after `service_lifecycles` became
 * `services`. `cell-anatomy.svg` was drawing a Dependencies tab headed
 * "Set off by" / "Sets off", which is the wording `dependencyValidation.ts`
 * replaced with "Follows" / "Leads to" — and that file's own comment names
 * those two headings as the clearest place the old words showed.
 *
 * This is a widened SUBJECT, not a widened word list. The same
 * `RETIRED_COPY_WORDS` and the same `offenders()` decide; all that changed is
 * where a reader-facing string is looked for. A figure is read by more people
 * than most of the JSX above it and was the one reader-facing surface with no
 * guard on it at all.
 *
 * `<text>` only. Not `id`, not `class`, not a comment, not the filename — a
 * figure named `four-ways-in.svg` is nobody's copy.
 */
const FIGURES = join(process.cwd(), 'public', 'cover')

/** `<text>` content, with any `<tspan>` markup inside it flattened away. */
const SVG_TEXT = /<text\b[^>]*>([\s\S]*?)<\/text>/g

export function figureStrings(files = figureFiles()) {
  const out = []
  for (const { file, code } of files) {
    for (const match of code.matchAll(SVG_TEXT)) {
      const value = match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      if (value && /[A-Za-z]/.test(value)) out.push({ file, where: 'text', value })
    }
  }
  return out
}

function figureFiles() {
  return readdirSync(FIGURES)
    .filter((name) => name.endsWith('.svg'))
    .sort()
    .map((name) => ({ file: `public/cover/${name}`, code: readFileSync(join(FIGURES, name), 'utf8') }))
}

test('no retired spelling reaches a reader through a figure', () => {
  const found = offenders(figureStrings())
  assert.deepEqual(
    found,
    [],
    'A retired word is on screen in a diagram. These render in the app, not ' +
      `only in a README:\n${found.join('\n')}`,
  )
})

test('the figure guard reads the text nodes it claims to', () => {
  // The extraction, exercised on the shapes the real files use: a plain node,
  // one broken across lines, one built from tspans, and the attributes that
  // are deliberately NOT read.
  const planted = [
    {
      file: 'public/cover/planted.svg',
      code: [
        '<text x="10" y="20" class="uiLabel">Service lifecycle</text>',
        '<text x="10" y="40">what sets',
        '  off next</text>',
        '<text x="10" y="60"><tspan>row</tspan> <tspan>position</tspan></text>',
        '<text x="10" y="80">Enables</text>',
        '<rect id="layer-1" class="layer" data-note="the layer"/>',
        '<!-- a lifecycle in a comment is not copy -->',
      ].join('\n'),
    },
  ]
  const strings = figureStrings(planted)
  assert.deepEqual(
    strings.map((one) => one.value),
    ['Service lifecycle', 'what sets off next', 'row position', 'Enables'],
  )
  assert.deepEqual(offenders(strings).map((one) => one.split(' — ')[1]).sort(), [
    '"lifecycle"',
    '"row position"',
    '"sets off"',
  ])
})

test('every figure the deck ships is covered, and there are some', () => {
  // A reader that found no files would pass the assertion above in silence,
  // which is the failure this whole file is written against.
  const files = figureFiles()
  assert.ok(files.length >= 10, `only ${files.length} figure(s) found under public/cover`)
  assert.ok(figureStrings(files).length > 100, 'the figures parsed to almost no text')
})
