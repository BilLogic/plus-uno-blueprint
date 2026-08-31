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
 * props of the four components that put a field's name in front of a reader.
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
 * `SpecSection` heads one of the three spec blocks in the panel's overview.
 * Nothing else in the app labels a column.
 */
const LABEL_COMPONENTS = ['Field', 'PanelTextareaField', 'PanelTermLabel', 'SpecSection']

const LABEL_ELEMENT = new RegExp(`<(${LABEL_COMPONENTS.join('|')})\\b([^>]*)>`, 'g')
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
      if (prop) out.push({ file, component: element[1], label: prop[2] })
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
