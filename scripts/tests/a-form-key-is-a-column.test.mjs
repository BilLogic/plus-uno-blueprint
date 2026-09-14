#!/usr/bin/env node
/**
 * A form key is a column, and a column arrives under its own name.
 *
 * `cells.description` became `cells.summary` on 2026-08-20 (`20260820090000`).
 * Twelve days later the cell editor's form still said `description` — filled
 * from `content.summary`, written back to `summary`, and the word survived in
 * between, in the one layer no check reads. Two more copies sat in the app's
 * own cell types, filled straight from `cell.summary` (#261).
 *
 * Nothing caught it because nothing could. `check-retired-identifiers` replays
 * the live database. `labels-name-their-columns` reads what a reader sees. A
 * form's state key is neither: it never reaches the schema and never reaches
 * the screen. `tsc` cannot help either — the key is renamed at both edges, so
 * the types agree with themselves.
 *
 * BOTH SUBJECTS ARE THE APPLICATION'S, AND THE APPLICATION IS THE INSTALLED
 * PACKAGE NOW. The paths below are relative to its source root and are read
 * through `scripts/app-source.mjs`; the schema they are judged against is the
 * generated `types/database.ts` that ships with it. That makes this a stronger
 * join than it was rather than a weaker one — the form keys are the ones this
 * deployment's editor actually renders, and the columns are the ones its
 * database actually has.
 *
 * TWO SUBJECTS, BOTH NARROW.
 *
 * 1. THE EDITOR FORM TYPES. Each panel declares a `FormState` for the table it
 *    saves to; every key must be a column of that table, spelled in camelCase.
 *    The panel→table map below is a declaration of the subject — which table a
 *    form edits is a fact this file has to be told — not a list of pardons.
 *    `suffix` is how a key that genuinely cannot be spelled as its column names
 *    the column anyway, with its reason beside it.
 *
 *    THE CELL PANEL'S FORM IS HALF DERIVED NOW, and this file reads both
 *    halves. Its state is `CellEdits & { placement }`: the second half is
 *    spelled in the panel and judged exactly as before, and the first is a
 *    mapped type over the cell field descriptors in `lib/cellFields.ts`. That
 *    is where the two keys that used to carry a `Text` suffix went — the form
 *    is keyed by column now, so nothing has to spell `function` or `form` as an
 *    identifier at all. A derived half cannot be read by counting keys in a
 *    type literal, so it is read at its source: every descriptor in the list is
 *    held to a column of `cells`, and the two type lines that tie the list's
 *    keys to the generated row are asserted, because the derivation is what
 *    makes the per-key parse unnecessary. Drop either line and the list is free
 *    to name a column the schema does not have again.
 *
 * 2. THE ASSIGNMENT SITE. `description: cell.summary` is a column changing its
 *    name on the way into the app, and it is the exact shape every renamed
 *    column takes when it drifts. The rename roster in `retired-vocabulary`
 *    already knows each pair; this reads the pairs and looks for `was: x.is`.
 *    Only qualified reads (`something.summary`) are matched, so a literal
 *    `description: 'Clear the selection.'` on a command is not a finding.
 *
 * WHAT IT DOES NOT JUDGE: a type that presents a row rather than mirrors one.
 * `phasesToSlides` gives every slide a `title` and a `summary` whatever the
 * source table calls them; that is a display vocabulary, and it is checked by
 * the second subject only where it is fed from a renamed column.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RENAME_MAP } from '../retired-vocabulary.mjs'
import { appSource, appSourceFiles, deploymentSourceFiles } from '../app-source.mjs'

const REPO_ROOT = process.cwd()
/** Named as the reader reports it; read out of the package by `appSource`. */
const DATABASE_TYPES = 'types/database.ts'

/**
 * Which table each editor form writes, by its path inside the application's
 * source. `nested` names a key whose value is itself a form for another table;
 * `suffix` names any key that could not be spelled as its column, of which
 * there are currently none; `derives` names the types a form intersects and the
 * module each is derived from, whose keys are judged at that source instead.
 */
export const EDITOR_FORMS = [
  {
    file: 'components/blueprint/CellPanelEditor.tsx',
    type: 'FormState',
    table: 'cells',
    nested: { placement: 'cell_touchpoints' },
    // `CellEdits` is a mapped type over the cell field descriptors, so its keys
    // are columns by construction rather than by inspection. The list itself is
    // the subject of `the cell form's derived half is keyed by the cells row`
    // below; what is left to read here is the one key the panel still spells.
    derives: { CellEdits: 'lib/cellFields.ts' },
  },
  {
    file: 'lib/touchpointMutations.ts',
    type: 'PlacementDetailDraft',
    table: 'cell_touchpoints',
  },
  {
    file: 'components/blueprint/ServicePanel.tsx',
    type: 'FormState',
    table: ['services', 'business_models'],
  },
  {
    file: 'components/blueprint/PhasePanel.tsx',
    type: 'FormState',
    table: 'phases',
  },
  {
    file: 'components/blueprint/ScenarioPanel.tsx',
    type: 'FormState',
    table: 'scenarios',
    nested: { paths: 'paths' },
  },
  {
    file: 'components/blueprint/ScenarioPanel.tsx',
    type: 'PathForm',
    table: 'paths',
  },
  {
    file: 'components/blueprint/LanePanel.tsx',
    type: 'FormState',
    table: 'lanes',
  },
]

/** `tableName → Set<column>` from the generated `Row` blocks. */
export function tableColumns(source) {
  const tables = new Map()
  const re = /\n {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/g
  let match
  while ((match = re.exec(source))) {
    const columns = new Set(
      match[2]
        .split('\n')
        .map((line) => line.trim().split(':')[0].replace(/\?$/, ''))
        .filter(Boolean),
    )
    tables.set(match[1], columns)
  }
  return tables
}

/**
 * `type NAME = A & B & { … }` in `source`, as the types it intersects and the
 * keys it spells itself — top level only, and null when there is no such type.
 *
 * The intersection prefix is read rather than tolerated: a form that pulls half
 * its keys from a derived type says so in its own declaration, and a reader
 * that only knew how to parse `type NAME = {` reported such a form as a type it
 * could not find — which is the shape of "no subject", not of a clean form.
 */
export function typeShape(source, name) {
  const declaration = new RegExp(`type ${name} =\\s*((?:\\w+\\s*&\\s*)*)\\{`).exec(source)
  if (!declaration) return null
  const derives = declaration[1]
    .split('&')
    .map((part) => part.trim())
    .filter(Boolean)
  let depth = 0
  let i = declaration.index + declaration[0].length - 1
  const open = i
  for (; i < source.length; i++) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}' && --depth === 0) break
  }
  const body = source.slice(open + 1, i)
  const keys = []
  let level = 0
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (level === 0) {
      const key = /^(\w+)\??:/.exec(trimmed)
      if (key) keys.push(key[1])
    }
    level += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
  }
  return { derives, keys }
}

/** The keys `type NAME` spells itself, or null when there is no such type. */
export function typeKeys(source, name) {
  return typeShape(source, name)?.keys ?? null
}

const snake = (key) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

/**
 * Form keys that name no column of the table they write — and, before that, a
 * form whose declaration this file cannot account for.
 *
 * A type it cannot find is a finding, and so is a type that intersects
 * something `derives` does not name: the keys of an unaccounted-for half are
 * read by nobody, which is the silent pass this whole file exists to prevent.
 */
export function keysThatAreNotColumns(form, source, tables) {
  const shape = typeShape(source, form.type)
  if (!shape) return [`${form.file}: no \`type ${form.type}\` to read`]
  const unaccounted = shape.derives.filter((name) => !form.derives?.[name])
  if (unaccounted.length > 0) {
    return [
      `${form.file} ${form.type} intersects ${unaccounted.join(', ')}, which nothing ` +
        `reads: name the type in EDITOR_FORMS.derives with the module its keys come from`,
    ]
  }
  const keys = shape.keys
  const targets = [form.table].flat().map((t) => tables.get(t))
  if (targets.some((t) => !t)) return [`${form.file}: table not in ${DATABASE_TYPES}`]
  return keys.flatMap((key) => {
    if (form.nested?.[key]) return []
    const column = form.suffix?.[key] ?? snake(key)
    if (targets.some((t) => t.has(column))) return []
    return [`${form.file} ${form.type}.${key} — no column \`${column}\` on ${[form.table].flat().join('/')}`]
  })
}

/* ------------------------------------------ the cell form's derived half */

/** Where the cell field list lives inside the application's source. */
export const CELL_FIELDS_FILE = 'lib/cellFields.ts'

/**
 * The cell field descriptors, as `{ key, label, editable }`.
 *
 * Read out of the `CELL_FIELDS` literal rather than imported, because this
 * repository holds no TypeScript loader for the application's modules and a
 * list of one-line properties does not need one. Null when the literal is not
 * there — the caller says so with the path, rather than judging an empty list.
 */
export function cellFieldDescriptors(source) {
  const list = /export const CELL_FIELDS = \[([\s\S]*?)\n\] as const satisfies/.exec(source)
  if (!list) return null
  return list[1]
    .split(/\n {2}\{\n/)
    .slice(1)
    .map((chunk) => ({
      key: /^ {4}key: '([^']+)',$/m.exec(chunk)?.[1] ?? '',
      label: /^ {4}label: '([^']*)',$/m.exec(chunk)?.[1] ?? '',
      editable: /^ {4}editor: \{/m.test(chunk),
    }))
}

/**
 * `was: x.is` assignments — a renamed column arriving under its old name.
 *
 * Reads the rename roster: for each `x.was → x.is` pair whose retired word
 * is a bare column name, looks for `was: <ident>.is` in source. Only these
 * pairs, only this shape.
 */
export function renamePairs(map = RENAME_MAP, tables = new Map()) {
  // A retired word that is still a LIVE column somewhere is not this check's
  // subject: `label` left `cell_dependencies` and stayed on `deleted_structure`,
  // so `label: path.name` is a UI label built from a name, not a rename
  // leaking. Same argument `one-spelling-each` makes, applied here as a
  // structural test rather than a list.
  const live = new Set([...tables.values()].flatMap((columns) => [...columns]))
  const pairs = []
  for (const entry of map) {
    entry.was.forEach((was, index) => {
      const is = entry.is[index]
      if (!was || !is || !was.includes('.') || !is.includes('.')) return
      const [wasTable, wasColumn] = was.split('.')
      const [isTable, isColumn] = is.split('.')
      if (wasTable !== isTable || !wasColumn || !isColumn || wasColumn === isColumn) return
      if (live.has(wasColumn)) return
      pairs.push({ was: wasColumn, is: isColumn, table: wasTable })
    })
  }
  return pairs
}

export function columnsArrivingUnderOldNames(source, pairs = renamePairs()) {
  const findings = []
  for (const { was, is } of pairs) {
    const re = new RegExp(`(^|[\\s{,])${was}\\s*:\\s*[\\w.?]+\\.${is}\\b`, 'g')
    let match
    while ((match = re.exec(source))) {
      findings.push({
        line: source.slice(0, match.index).split('\n').length,
        text: `\`${was}:\` is filled from \`.${is}\` — the column is called ${is}`,
      })
    }
  }
  return findings
}

/**
 * Every source file a renamed column could arrive in.
 *
 * TWO ROOTS: the application, read out of the package, and this deployment's
 * own source beside it — the same pair `scripts/check-database-names.mjs`
 * sweeps, for the same reason. A column arriving under its retired name in a
 * deployment file is the identical defect, and the sweep that could not see it
 * would say so in the affirmative.
 *
 * Both readers refuse an empty result. This walk used to be `src`, six hundred
 * files that threw on a typo; the root it points at now is inside
 * `node_modules`, where absent is a state a tree can genuinely be in, and a
 * walk of nothing reports no findings and reads as clean.
 */
function sourceFiles() {
  const wanted = (path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)
  return [...appSourceFiles(wanted), ...deploymentSourceFiles(wanted)]
}

test('every editor form key is a column of the table it writes', () => {
  const tables = tableColumns(appSource(DATABASE_TYPES))
  const found = EDITOR_FORMS.flatMap((form) =>
    keysThatAreNotColumns(form, appSource(form.file), tables),
  )
  assert.deepEqual(
    found,
    [],
    `A form key names the column it writes (#261). Rename the key, or if the ` +
      `column genuinely cannot be spelled, say why in EDITOR_FORMS.suffix:\n${found.join('\n')}`,
  )
})

test("the cell form's derived half is keyed by the cells row", () => {
  // `CellEdits` is not a type literal anybody can count keys in, so the claim
  // is made where the keys are decided: one descriptor per column, each named
  // as the schema names it, and two type lines that make a descriptor for a
  // column `cells` does not have a compile error rather than a finding here.
  const fields = appSource(CELL_FIELDS_FILE)
  const descriptors = cellFieldDescriptors(fields)
  assert.ok(
    descriptors,
    `no \`CELL_FIELDS\` list in ${CELL_FIELDS_FILE}: the cell form's keys come from ` +
      'that list, so a reader that cannot find it has no subject — not a clean form',
  )
  assert.ok(
    descriptors.length > 8,
    `only ${descriptors.length} cell field descriptors parsed — the reader is wrong`,
  )
  assert.ok(
    descriptors.some((descriptor) => descriptor.editable),
    'no descriptor carries an `editor` — the form is derived from the editable ones, ' +
      'so a list with none is a reader that stopped seeing them',
  )

  // Every descriptor names a column, editable or not: the list drives the board
  // select as well as the form, and a key that is not a column would be a
  // select that fails at runtime rather than a form key nobody can save.
  const columns = tableColumns(appSource(DATABASE_TYPES)).get('cells')
  assert.ok(columns, `cells is not in ${DATABASE_TYPES}`)
  const strays = descriptors
    .filter((descriptor) => !columns.has(descriptor.key))
    .map((descriptor) => `${CELL_FIELDS_FILE} CELL_FIELDS.${descriptor.key || '(unparsed)'} — no such column on cells`)
  assert.deepEqual(
    strays,
    [],
    `A cell field descriptor names something cells does not have:\n${strays.join('\n')}`,
  )

  // And the derivation itself, which is what excuses the per-key parse. The
  // first line keys the list against the generated row; the second and third
  // carry that key through to the form's state.
  assert.match(fields, /export type CellRow = Database\['public'\]\['Tables'\]\['cells'\]\['Row'\]/)
  assert.match(fields, /export type CellFieldKey = keyof CellRow & keyof BlueprintCell/)
  assert.match(fields, /export type CellEditKey = EditableCellField\['key'\]/)
  assert.match(fields, /export type CellEdits = \{ \[K in CellEditKey\]: CellEditValue<K> \}/)
})

test('the descriptor reader goes red on a list that has drifted', () => {
  const planted = [
    'export const CELL_FIELDS = [',
    '  {',
    "    key: 'content',",
    "    label: 'Content',",
    "    editor: { control: 'input' },",
    '  },',
    '  {',
    "    key: 'description',",
    "    label: 'Description',",
    '  },',
    '] as const satisfies readonly AnyCellField[]',
  ].join('\n')
  assert.deepEqual(cellFieldDescriptors(planted), [
    { key: 'content', label: 'Content', editable: true },
    { key: 'description', label: 'Description', editable: false },
  ])
  // And a file with no list at all reads as absent rather than as empty.
  assert.equal(cellFieldDescriptors('export const CELL_FIELDS = []'), null)
})

test('no column arrives in the app under a name the schema retired', () => {
  const tables = tableColumns(appSource(DATABASE_TYPES))
  const pairs = renamePairs(RENAME_MAP, tables)
  const found = []
  for (const path of sourceFiles()) {
    const source = readFileSync(resolve(REPO_ROOT, path), 'utf8')
    for (const finding of columnsArrivingUnderOldNames(source, pairs)) {
      found.push(`${path}:${finding.line}  ${finding.text}`)
    }
  }
  assert.deepEqual(found, [], `A column keeps its name on the way in (#261):\n${found.join('\n')}`)
})

test('the roster yields the pairs this check runs on', () => {
  const tables = tableColumns(appSource(DATABASE_TYPES))
  const pairs = renamePairs(RENAME_MAP, tables)
  assert.ok(!pairs.some((p) => p.was === 'label'), '`label` is still live on deleted_structure and must not be a pair')
  assert.ok(pairs.some((p) => p.was === 'description' && p.is === 'summary' && p.table === 'cells'),
    'cells.description → cells.summary is not on the rename roster; add it beside slices.description')
})

test('a key that spells its column in camelCase is not a finding', () => {
  const tables = new Map([['lanes', new Set(['owner_team', 'stakeholder_id', 'kpis'])]])
  const source = 'type FormState = {\n  ownerTeam: string\n  stakeholderId: string | null\n  kpis: string[]\n}'
  const form = { file: 'x', type: 'FormState', table: 'lanes' }
  assert.deepEqual(keysThatAreNotColumns(form, source, tables), [])
})

test('a key the schema never had is named with the column it would need', () => {
  const tables = new Map([['cells', new Set(['content', 'summary'])]])
  const source = 'type FormState = {\n  content: string\n  description: string\n}'
  const form = { file: 'x', type: 'FormState', table: 'cells' }
  assert.deepEqual(keysThatAreNotColumns(form, source, tables), [
    'x FormState.description — no column `description` on cells',
  ])
})

test('a nested form is judged against its own table, not the parent', () => {
  const tables = new Map([
    ['scenarios', new Set(['summary'])],
    ['paths', new Set(['summary', 'note', 'status'])],
  ])
  const source = 'type FormState = {\n  summary: string\n  paths: Record<string, PathForm>\n}'
  const form = { file: 'x', type: 'FormState', table: 'scenarios', nested: { paths: 'paths' } }
  assert.deepEqual(keysThatAreNotColumns(form, source, tables), [])
})

test('the assignment-site check matches the qualified read and nothing looser', () => {
  const pairs = [{ was: 'description', is: 'summary', table: 'cells' }]
  assert.equal(columnsArrivingUnderOldNames('{ description: cell.summary }', pairs).length, 1)
  assert.equal(columnsArrivingUnderOldNames("{ description: 'Clear the selection.' }", pairs).length, 0)
  assert.equal(columnsArrivingUnderOldNames('{ summary: cell.summary }', pairs).length, 0)
  assert.equal(columnsArrivingUnderOldNames('{ description: entry.content }', pairs).length, 0)
})
