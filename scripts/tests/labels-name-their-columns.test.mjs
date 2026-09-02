/**
 * #182 — the word on a panel label is the word in the schema.
 *
 * Four labels named nothing a query could find. The interface said **Text**
 * where the column is `cells.content`, **Value** where it is
 * `cells.value_props`, **Columns** where it is `path_steps.position`, and
 * **Applies when** where it is `paths.summary`. A reader who asked an engineer
 * about any of the four asked about a word the engineer had never seen.
 *
 * TWO OF THE FOUR ARE IN THE ENFORCED MAP and two cannot be, which is the same
 * split `one-spelling-each.test.mjs` and `a-frame-a-strip-and-a-slide.test.mjs`
 * already carry. `columns` and `applies when` are enforced there as retired
 * copy, because nothing else on screen says either word. `text` and `value`
 * cannot be: "Text size" and "Add text…" on the annotation toolbar are correct
 * uses of `text`, and `value` is an ordinary English word the copy guard's
 * naive JSX extraction meets inside expressions. Adding either to the word
 * list would flag code that is right, which is the one thing that list must
 * never do — and the rule that a false positive is fixed by narrowing the
 * SUBJECT rather than the word applies here exactly as it did there.
 *
 * So the subject is narrowed to PANEL LABELS: the `label`, `term` and `title`
 * props of the five components that put a field's name in front of a reader.
 * That is narrow enough to say `Text` without saying it about "Text size".
 * It is element-shaped rather than a list of files, so a panel written next
 * week is inside the subject without anybody remembering to add it.
 *
 * The second half is the point of the ticket rather than a restatement of it:
 * every label this file maps has to name a column the schema actually has, so
 * a label cannot be "fixed" by pointing it at a word that is also not there.
 *
 * Both halves are proved to go red, in the shape
 * `scripts/tests/rls-posture.test.mjs` argues for.
 *
 * ---
 *
 * #171 — and the map itself, which is the half #182 could not carry.
 *
 * #182 fixed four labels. It could not say whether the labels it left alone
 * were right, because nothing recorded what any of them was bound to. A
 * divergence and a decision look identical from outside: `Author note` over
 * `paths.note` and `Design link` over `cell_touchpoints.url` are both a label
 * that is not its column's name, and only one document can say which is
 * deliberate.
 *
 * So `LABEL_COLUMNS` below is that document's enforced half — every word a
 * panel puts in front of a reader, the schema name behind it, and a reason
 * wherever the two differ. `CONTEXT.md`'s "The interface→schema map" section
 * is the documented half, and a parity test holds them together in the shape
 * `retired-vocabulary.test.mjs` already uses for the rename map: two lists
 * that do not derive from each other, and a failure when they disagree.
 *
 * FOUR RULES MAKE IT NON-VACUOUS, and each is a way the map could rot:
 *
 *   1. Every panel label is in the map. A label nobody bound to a column is
 *      the whole defect, so a new one fails until somebody says what it names.
 *   2. Every row is a label some panel actually says. A row for a label that
 *      no longer exists is a map of an interface that is gone.
 *   3. Every row names something the schema has. The same assertion #182 made
 *      about its four, applied to all of them.
 *   4. A divergent row carries a reason and an aligned row does not. The first
 *      half is the issue's ask — "a reason, or a rename". The second half is
 *      what keeps the reason column worth reading: a decision recorded about a
 *      row that never diverged is decoration, and decoration is what a reader
 *      learns to skip.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const SRC = resolve(ROOT, 'src')

/* ----------------------------------------------------------- the subject */

/**
 * The components that put a field's name in front of a reader.
 *
 * `Field` and `PanelTextareaField` label an editable field; `PanelTermLabel`
 * labels a read-only section and hangs the term's definition off it;
 * `SpecSection` heads one of the three spec blocks in the panel's overview;
 * `StringListField` labels a field a reader adds rows to.
 * Nothing else in the app labels a column.
 *
 * `StringListField` joined the list on #171, and the two labels it was hiding
 * are the argument for keeping this subject element-shaped rather than
 * file-shaped. It wraps `Field` and forwards the label through, so "KPIs" and
 * "Tools" reached readers from outside every check that had ever looked — not
 * because anybody excluded them, but because the wrapper was written after the
 * list was.
 */
const LABEL_COMPONENTS = [
  'Field',
  'PanelTextareaField',
  'PanelTermLabel',
  'PanelSectionLabel',
  'SpecSection',
  'StringListField',
]

const LABEL_ELEMENT = new RegExp(
  `<(${LABEL_COMPONENTS.join('|')})\\b([^>]*)>([^<{]*)`,
  'g',
)
/*
  A label arrives as a prop or as children. `PanelSectionLabel` is the second
  shape — #244 gave it the nine labels that stopped carrying definitions, and a
  prop-only reader saw a panel that had gone silent rather than one that had
  simply stopped explaining itself.
*/
const LABEL_PROP = /\b(label|term|title)\s*=\s*"([^"]*)"/

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return walk(path)
    if (!/\.tsx$/.test(entry) || entry.includes('.test.')) return []
    return [path]
  })
}

export function panelSources() {
  return walk(SRC)
    .map((path) => ({
      file: relative(ROOT, path).split('\\').join('/'),
      code: readFileSync(path, 'utf8'),
    }))
    .sort((a, b) => a.file.localeCompare(b.file))
}

/** Every panel label in the app, with where it is written. */
export function panelLabels(sources) {
  const out = []
  for (const { file, code } of sources) {
    for (const element of code.matchAll(LABEL_ELEMENT)) {
      const prop = LABEL_PROP.exec(element[2])
      const children = element[3]?.trim()
      const label = prop ? prop[2] : children
      if (label) out.push({ file, component: element[1], label })
    }
  }
  return out
}

/* -------------------------------------------------- 1. the retired labels */

/**
 * What each retired label said, and what it says now.
 *
 * Matched WHOLE and case-insensitively, never as a substring: "Text size" on
 * the annotation toolbar is a correct use of the word and stays.
 */
export const RETIRED_LABELS = Object.freeze([
  { was: 'Text', is: 'Content', column: 'cells.content' },
  { was: 'Value', is: 'Value proposition', column: 'cells.value_props' },
  { was: 'Columns', is: 'Position', column: 'path_steps.position' },
  { was: 'Applies when', is: 'Summary', column: 'paths.summary' },
])

/** Panel labels still saying a word the schema has never heard. */
export function labelsThatNameNothing(labels) {
  return labels.flatMap((entry) => {
    const retired = RETIRED_LABELS.find(
      (one) => one.was.toLowerCase() === entry.label.trim().toLowerCase(),
    )
    return retired
      ? [`${entry.file} <${entry.component} …="${entry.label}"> — it is "${retired.is}" (${retired.column})`]
      : []
  })
}

test('no panel label says a word the schema has never heard', () => {
  const labels = panelLabels(panelSources())
  // The extraction, asserted before its result is trusted: a walker that found
  // no labels would pass exactly as loudly as an interface that is clean.
  assert.ok(labels.length > 15, `only ${labels.length} panel labels found — the extraction is wrong`)
  for (const component of LABEL_COMPONENTS) {
    assert.ok(
      labels.some((one) => one.component === component),
      `no <${component}> label was found — either it is gone or the extraction missed it`,
    )
  }
  const found = labelsThatNameNothing(labels)
  assert.deepEqual(
    found,
    [],
    'A panel label names nothing a query can find. A reader who asks an engineer ' +
      'about this word asks about a word the engineer has never seen, which is the ' +
      `whole of #182:\n${found.join('\n')}`,
  )
})

test('the label check goes red on each of the four, and leaves their neighbours alone', () => {
  const planted = [
    {
      file: 'src/components/blueprint/Planted.tsx',
      code: [
        '<Field label="Text" hint="What this cell says on the grid." />',
        '<Field label="Value" hint="Who gets what from it." />',
        '<PanelTermLabel term="Columns" definition={PANEL_TERMS.columns} />',
        '<PanelTextareaField label="Applies when" />',
        // Correct uses of the same words, which must survive: a whole-label
        // match is the difference between a rule and a word ban.
        '<Field label="Text size" />',
        '<SpecSection title="Value proposition" text={valueText} />',
        '<Field label="Summary" />',
      ].join('\n'),
    },
  ]
  const found = labelsThatNameNothing(panelLabels(planted))
  assert.deepEqual(found.map((one) => one.split('"')[1]), [
    'Text',
    'Value',
    'Columns',
    'Applies when',
  ])
})

/* ------------------------------------------ 1b. and the figures that draw them */

/**
 * A figure that draws the panel is a LABEL SITE, and until now nobody checked it.
 *
 * `public/cover/*.svg` is not documentation: `EditorShell` renders those files
 * as a deck inside the app. `cell-anatomy.svg` draws the cell panel field by
 * field, and it was still labelling one of them **Value** — the first entry in
 * `RETIRED_LABELS`, retired because `cells` has no `value` column and a reader
 * asking an engineer about that word asks about a word the engineer has never
 * seen. The label was fixed in the panel and missed in the picture of the
 * panel, which is the same defect with a longer half-life: a figure is what a
 * new reader looks at first.
 *
 * SUBJECT: `<text class="uiLabel">` — the figures' own marker for "this node is
 * a UI label". Not every string in the file. The captions beside them are prose
 * and are `check:copy`'s subject, with a different rule and a different list.
 */
const FIGURES = resolve(ROOT, 'public', 'cover')

const UI_LABEL = /<text\b[^>]*class="uiLabel"[^>]*>([\s\S]*?)<\/text>/g

/** Every label a figure draws, in `panelLabels` shape so one rule judges both. */
export function figureLabels(files = figureFiles()) {
  const out = []
  for (const { file, code } of files) {
    for (const match of code.matchAll(UI_LABEL)) {
      const label = match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      // No quote in the component name: the failure line is `…="Label"`, and a
      // caller reading the label back out of it splits on the quote.
      if (label) out.push({ file, component: 'text.uiLabel', label })
    }
  }
  return out
}

function figureFiles() {
  return readdirSync(FIGURES)
    .filter((name) => name.endsWith('.svg'))
    .sort()
    .map((name) => ({
      file: `public/cover/${name}`,
      code: readFileSync(join(FIGURES, name), 'utf8'),
    }))
}

test('no figure draws a label the schema has never heard', () => {
  const found = labelsThatNameNothing(figureLabels())
  assert.deepEqual(
    found,
    [],
    'A diagram labels a field with a word no column answers to. It renders in ' +
      `the app, and it is the first thing a new reader reads:\n${found.join('\n')}`,
  )
})

test('the figure reader takes the labels and leaves the prose', () => {
  const planted = [
    {
      file: 'public/cover/planted.svg',
      code: [
        '<text x="10" y="20" class="uiLabel">Value</text>',
        '<text x="10" y="40" class="uiLabel"><tspan>Perceived</tspan> owner</text>',
        // Prose beside the labels, and a heading above them. Neither is a label
        // site, and "VALUE" as a section heading must not be read as one.
        '<text x="10" y="60" class="calloutBody">who gets what from it</text>',
        '<text x="10" y="80" class="calloutTitle">VALUE</text>',
      ].join('\n'),
    },
  ]
  const labels = figureLabels(planted)
  assert.deepEqual(labels.map((one) => one.label), ['Value', 'Perceived owner'])
  assert.deepEqual(
    labelsThatNameNothing(labels).map((one) => one.split('"')[1]),
    ['Value'],
  )
})

test('the figures are actually there to be read', () => {
  // A reader that found nothing passes the assertion above in silence.
  assert.ok(figureFiles().length >= 10, 'no figures found under public/cover')
  assert.ok(figureLabels().length >= 5, 'the figures parsed to almost no labels')
})

/* ------------------------------------------------------ 2. and the column */

const SCHEMA = replayMigrations(resolve(ROOT, 'supabase/migrations'))

/** Columns this file claims a label names, that the schema does not have. */
export function columnsThatDoNotExist(schema) {
  return RETIRED_LABELS.flatMap(({ is, column }) => {
    const [table, name] = column.split('.')
    const row = schema.tables.get(table)
    if (!row) return [`${column} — there is no ${table} table, so "${is}" names nothing`]
    if (!row.columns.has(name)) return [`${column} — ${table} has no ${name}, so "${is}" names nothing`]
    return []
  })
}

test('every label this file settles names a column the schema has', () => {
  assert.deepEqual(
    columnsThatDoNotExist(SCHEMA),
    [],
    'A label was pointed at a column that does not exist. Renaming a label onto a ' +
      'second missing word is the defect, restated — not the fix for it.',
  )
})

test('the column check goes red on a schema missing them', () => {
  const empty = { tables: new Map() }
  const found = columnsThatDoNotExist(empty)
  assert.equal(found.length, RETIRED_LABELS.length)

  // And red one column at a time, which is the shape a half-done rename takes.
  const partial = {
    tables: new Map([
      ['cells', { name: 'cells', columns: new Map([['content', {}]]) }],
      ['paths', { name: 'paths', columns: new Map([['summary', {}]]) }],
      ['path_steps', { name: 'path_steps', columns: new Map([['position', {}]]) }],
    ]),
  }
  assert.deepEqual(columnsThatDoNotExist(partial), [
    'cells.value_props — cells has no value_props, so "Value proposition" names nothing',
  ])
})

/* ------------------------------------------ 3. and the map behind them all */

/**
 * Every panel label, the schema name behind it, and why they differ.
 *
 * `label` is matched against what a panel actually says, case-insensitively
 * and whole. `names` is one or more `table.column` names, or a bare table
 * where the label heads a whole relation rather than a field of one. `because`
 * is empty on every row whose label and name already agree, and required on
 * every row where they do not.
 *
 * ONE LABEL, SEVERAL NAMES is the ordinary case rather than an escape hatch:
 * six things on this board have a `summary`, and "Summary" is the right word
 * above all of them. A row is aligned only when it aligns with EVERY name it
 * lists, so a shared word cannot be smuggled past this by pairing a divergence
 * with an agreement.
 *
 * Ordered as a reader meets them: the cell and its placement, the lane, the
 * phase, the scenario's paths, the service, the step.
 */
export const LABEL_COLUMNS = Object.freeze(
  [
    { label: 'Content', names: ['cells.content'], because: '' },
    {
      label: 'Summary',
      names: [
        'cells.summary',
        'cell_touchpoints.summary',
        'paths.summary',
        'phases.summary',
        'scenarios.summary',
        'services.summary',
        'steps.summary',
      ],
      because: '',
    },
    { label: 'Status', names: ['cells.status', 'paths.status'], because: '' },
    { label: 'Owner', names: ['cells.owner'], because: '' },
    { label: 'Perceived owner', names: ['cells.perceived_owner'], because: '' },
    { label: 'Function', names: ['cells.function'], because: '' },
    { label: 'Form', names: ['cells.form'], because: '' },
    {
      label: 'Value proposition',
      names: ['cells.value_props'],
      because:
        '`props` abbreviates this exact phrase and no other. A label is read once and a name is typed daily, so the panel spells out what the schema shortens. Singular on purpose: a cell has one value proposition, stated once per audience — each row is a `for` and a `value` — and the plural on the column counts those statements, not separate propositions.',
    },
    { label: 'Touchpoint', names: ['touchpoints'], because: '' },
    { label: 'Screenshot', names: ['cell_touchpoints.screenshot'], because: '' },
    {
      label: 'Design link',
      names: ['cell_touchpoints.url'],
      because:
        'A placement carries two URLs — this one and `screenshot` — so `url` alone cannot say which field a reader is standing in, and it is not a word a panel says out loud. The label names what this one is for.',
    },
    { label: 'Role', names: ['cell_touchpoints.role'], because: '' },
    { label: 'Stakeholder', names: ['lanes.stakeholder_id'], because: '' },
    { label: 'Owner team', names: ['lanes.owner_team'], because: '' },
    { label: 'KPIs', names: ['lanes.kpis'], because: '' },
    { label: 'Tools', names: ['lanes.tools'], because: '' },
    { label: 'Business impact', names: ['phases.business_impact'], because: '' },
    {
      label: 'Operational requirements',
      names: ['phases.operational_requirements'],
      because: '',
    },
    { label: 'Paths', names: ['paths'], because: '' },
    {
      label: 'Author note',
      names: ['paths.note'],
      because:
        "`note` is this vocabulary's word for an author's aside, and the label says whose aside it is because it sits directly under Summary, which is the path's own sentence. That distinction is worth a word on screen and not worth a second column.",
    },
    { label: 'Funding', names: ['business_models.funding'], because: '' },
    { label: 'Pricing', names: ['business_models.pricing'], because: '' },
    { label: 'Delivery cost', names: ['business_models.delivery_cost'], because: '' },
    { label: 'Revenue model', names: ['business_models.revenue_model'], because: '' },
    { label: 'Partners', names: ['business_models.partners'], because: '' },
    { label: 'Position', names: ['path_steps.position'], because: '' },
    {
      label: 'Storyboard',
      names: ['lanes.lane_role'],
      because:
        'The one row whose right-hand side is a VALUE rather than the name of a place to put one: `storyboard` is one of the eight `lane_role` admits, and this label heads the frames of the lane carrying it. The word is in the schema; it is simply not a column name.',
    },
  ].map((row) => Object.freeze({ ...row, names: Object.freeze(row.names) })),
)

/**
 * A word reduced to what a comparison can see: lower case, and every run of
 * anything else read as one underscore. "Perceived owner" and
 * `perceived_owner` are the same word written for two audiences.
 */
const canonical = (word) =>
  String(word)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/**
 * The word a schema name puts in front of a reader: the last dotted segment,
 * with a foreign key's `_id` dropped. `lanes.stakeholder_id` holds a
 * stakeholder, and the panel is right to say so.
 */
const schemaWord = (name) => canonical(name.split('.').pop().replace(/_id$/, ''))

/**
 * True when a label and a schema name are the same word.
 *
 * Singular and plural count as agreement, and they have to: the label over a
 * relation is the thing ("Touchpoint"), the table is the collection
 * (`touchpoints`), and neither is wrong. Anything further apart than an `s` is
 * a divergence that owes a reason.
 */
export function aligns(label, name) {
  const said = canonical(label)
  const stored = schemaWord(name)
  return said === stored || `${said}s` === stored || said === `${stored}s`
}

/** The names a row's label does not say. Empty means the row is aligned. */
export function divergentNames(row) {
  return row.names.filter((name) => !aligns(row.label, name))
}

/* ---------------------------------------- rule 1: no label is unmapped */

/** Panel labels the map says nothing about. */
export function labelsMissingFromMap(labels, map = LABEL_COLUMNS) {
  const mapped = new Set(map.map((row) => canonical(row.label)))
  const seen = new Map()
  for (const entry of labels) {
    if (mapped.has(canonical(entry.label))) continue
    if (!seen.has(entry.label)) seen.set(entry.label, `"${entry.label}" (${entry.file})`)
  }
  return [...seen.values()].sort()
}

test('every panel label is a word the map binds to the schema', () => {
  const found = labelsMissingFromMap(panelLabels(panelSources()))
  assert.deepEqual(
    found,
    [],
    'A panel label is bound to nothing. This is #171 exactly: not that the word ' +
      'differs from its column, but that no document says which column it is, so ' +
      'nobody downstream can tell a decision from an accident. Add a row to ' +
      "LABEL_COLUMNS and to CONTEXT.md's interface→schema map — with a reason if " +
      `the two words differ:\n${found.join('\n')}`,
  )
})

test('the unmapped-label check goes red on a label nobody bound', () => {
  const planted = [
    {
      file: 'src/components/blueprint/Planted.tsx',
      code: [
        '<Field label="Cadence" hint="How often this repeats." />',
        // Already mapped, and must not be reported: the check is about words
        // with no row, not about words it dislikes.
        '<Field label="Content" />',
        '<PanelTermLabel term="Storyboard" />',
        // Case and spacing are the label's business, not the map's.
        '<Field label="perceived owner" />',
      ].join('\n'),
    },
  ]
  assert.deepEqual(labelsMissingFromMap(panelLabels(planted)), [
    '"Cadence" (src/components/blueprint/Planted.tsx)',
  ])
})

/* ---------------------------------------- rule 2: no row is a fossil */

/** Rows for labels no panel says any more. */
export function rowsNoPanelSays(labels, map = LABEL_COLUMNS) {
  const said = new Set(labels.map((entry) => canonical(entry.label)))
  return map.filter((row) => !said.has(canonical(row.label))).map((row) => row.label)
}

test('every row of the map is a label some panel still says', () => {
  const found = rowsNoPanelSays(panelLabels(panelSources()))
  assert.deepEqual(
    found,
    [],
    `The map describes an interface that is gone: ${found.join(', ')}. A stale row is ` +
      'worse than a missing one — a reader looking the word up finds an answer, and ' +
      'the answer is about a panel nobody can open. Delete the row, or restore the label.',
  )
})

test('the fossil check goes red on a row no panel says', () => {
  const map = [
    { label: 'Content', names: ['cells.content'], because: '' },
    { label: 'Applies when', names: ['paths.summary'], because: '' },
  ]
  const labels = [{ file: 'src/x.tsx', component: 'Field', label: 'Content' }]
  assert.deepEqual(rowsNoPanelSays(labels, map), ['Applies when'])
})

/* ------------------------------- rule 3: every row names something real */

/** Schema names the map claims, that the schema does not have. */
export function namesThatDoNotExist(schema, map = LABEL_COLUMNS) {
  return map.flatMap((row) =>
    row.names.flatMap((name) => {
      const [table, column] = name.split('.')
      const relation = schema.tables.get(table)
      if (!relation) return [`${name} — there is no ${table}, so "${row.label}" names nothing`]
      if (column === undefined) return []
      if (!relation.columns.has(column)) {
        return [`${name} — ${table} has no ${column}, so "${row.label}" names nothing`]
      }
      return []
    }),
  )
}

test('every row of the map names something the schema has', () => {
  assert.deepEqual(
    namesThatDoNotExist(SCHEMA),
    [],
    'A label is bound to a name the schema does not have. A map that points at a ' +
      'second missing word is the defect restated, not the fix for it.',
  )
})

test('the existence check goes red on a schema missing them', () => {
  const every = LABEL_COLUMNS.flatMap((row) => row.names)
  const empty = { tables: new Map() }
  assert.equal(namesThatDoNotExist(empty).length, every.length)

  // And one name at a time, which is the shape a half-done rename takes: the
  // table survives, the column under it does not.
  const partial = { tables: new Map() }
  for (const name of every) {
    const [table, column] = name.split('.')
    if (!partial.tables.has(table)) partial.tables.set(table, { name: table, columns: new Map() })
    if (column) partial.tables.get(table).columns.set(column, {})
  }
  assert.deepEqual(namesThatDoNotExist(partial), [])
  partial.tables.get('cells').columns.delete('value_props')
  assert.deepEqual(namesThatDoNotExist(partial), [
    'cells.value_props — cells has no value_props, so "Value proposition" names nothing',
  ])
})

/* --------------------- rule 4: a divergence is a decision, and nothing else */

/** Rows whose label is not its name, with no reason recorded. */
export function divergencesWithoutReason(map = LABEL_COLUMNS) {
  return map
    .filter((row) => divergentNames(row).length > 0 && row.because.trim().length < 40)
    .map((row) => `${row.label} → ${divergentNames(row).join(', ')}`)
}

/** Rows that agree with the schema and carry a reason anyway. */
export function reasonsWithoutDivergence(map = LABEL_COLUMNS) {
  return map
    .filter((row) => divergentNames(row).length === 0 && row.because.trim().length > 0)
    .map((row) => row.label)
}

test('every divergence is a decision somebody wrote down', () => {
  const found = divergencesWithoutReason()
  assert.deepEqual(
    found,
    [],
    `A label differs from its name with no reason a stranger can evaluate: ${found.join('; ')}. ` +
      'CONTEXT.md already keeps one word out of the interface on purpose and says why. ' +
      'That is the shape every divergence needs: a reason, or a rename.',
  )
})

test('no row that agrees with the schema carries a reason anyway', () => {
  const found = reasonsWithoutDivergence()
  assert.deepEqual(
    found,
    [],
    `A reason recorded about a label that never diverged: ${found.join(', ')}. It reads ` +
      'as a decision and settles nothing, and a reason column with decoration in it is ' +
      'a column readers learn to skip — which is how the four this map exists to hold ' +
      'would get skipped with it.',
  )
})

test('both halves of the reason rule go red', () => {
  assert.deepEqual(
    divergencesWithoutReason([
      { label: 'Author note', names: ['paths.note'], because: '' },
      { label: 'Blurb', names: ['paths.note'], because: 'too short to evaluate' },
      { label: 'Summary', names: ['paths.summary'], because: '' },
      {
        label: 'Storyboard',
        names: ['lanes.lane_role'],
        because: 'It names the value the role holds, not the name of the place holding it.',
      },
    ]),
    ['Author note → paths.note', 'Blurb → paths.note'],
  )
  assert.deepEqual(
    reasonsWithoutDivergence([
      { label: 'Summary', names: ['paths.summary'], because: 'Because somebody felt like it.' },
      { label: 'Content', names: ['cells.content'], because: '' },
    ]),
    ['Summary'],
  )
})

test('a row is divergent when ANY of its names disagrees', () => {
  // The failure this forbids: a shared word riding into the map on the one
  // name where it happens to match.
  assert.deepEqual(
    divergentNames({ label: 'Summary', names: ['paths.summary', 'paths.note'], because: '' }),
    ['paths.note'],
  )
  assert.deepEqual(divergentNames({ label: 'Touchpoint', names: ['touchpoints'], because: '' }), [])
  assert.deepEqual(
    divergentNames({ label: 'Stakeholder', names: ['lanes.stakeholder_id'], because: '' }),
    [],
  )
})

/* ------------------------------------------- and the map a person reads */

const CONTEXT = readFileSync(resolve(ROOT, 'CONTEXT.md'), 'utf8')

/** The `| … | … | … |` rows under the interface→schema heading. */
export function documentedRows(context = CONTEXT) {
  const section = /##\s+The interface→schema map[^\n]*\n([\s\S]*?)(?:\n##\s|$)/.exec(context)
  assert.ok(section, 'CONTEXT.md has no "## The interface→schema map" section any more')
  return section[1]
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .map((line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length === 3 && !/^-+$/.test(cells[0].replace(/[\s:]/g, '')))
    .filter((cells) => !/^the interface says$/i.test(cells[0].replace(/\*/g, '')))
    .map((cells) => ({
      label: cells[0].replace(/\*/g, '').trim(),
      names: [...cells[1].matchAll(/`([^`]+)`/g)].map((match) => match[1]),
      because: cells[2] === '—' ? '' : cells[2],
    }))
}

test('the enforced interface map still matches the one CONTEXT.md documents', () => {
  const enforced = LABEL_COLUMNS.map((row) => ({
    label: row.label,
    names: [...row.names],
    because: row.because,
  }))
  assert.deepEqual(
    enforced,
    documentedRows(),
    "CONTEXT.md's interface→schema map and LABEL_COLUMNS disagree. Whichever moved, " +
      'move the other: the documented map is what a person reads and this one is what ' +
      'CI acts on, and a difference between them is a lie in the file people trust to ' +
      'learn the vocabulary.',
  )
})

test('the parity check goes red on a table that has drifted', () => {
  const drifted = [
    '## The interface→schema map',
    '',
    '| The interface says | The schema says | Why they differ |',
    '|---|---|---|',
    '| **Content** | `cells.content` | — |',
    '',
    '## Next section',
  ].join('\n')
  assert.deepEqual(documentedRows(drifted), [
    { label: 'Content', names: ['cells.content'], because: '' },
  ])
  assert.notEqual(documentedRows(drifted).length, LABEL_COLUMNS.length)

  // A reason dropped from the documented half is a drift too, and the least
  // visible one: the table still has every row, and one of them has quietly
  // stopped explaining itself.
  const reasonless = drifted.replace(
    '| **Content** | `cells.content` | — |',
    '| **Author note** | `paths.note` | — |',
  )
  assert.deepEqual(documentedRows(reasonless), [
    { label: 'Author note', names: ['paths.note'], because: '' },
  ])
})
