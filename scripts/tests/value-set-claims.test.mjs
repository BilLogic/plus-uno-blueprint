/**
 * The value-set claim parser behind `check:contract:live`'s `documented value
 * sets` and `catalog comments` checks.
 *
 * Green against the docs proves nothing by itself — a parser that found no
 * claims prints the same line. What is asserted here is that it finds the
 * shapes the 2026-09-01 audit paid for, holds them to the right set, and
 * reads the four shapes that are not claims as English.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  catalogValueSets,
  parseValueSet,
  retiredValues,
  sentencesOf,
  valueSetFindings,
} from '../value-set-claims.mjs'

const rows = [
  { source: 'check', relation: 'scenarios', column_name: 'layout', name: 'scenarios_layout_check', definition: "CHECK ((layout = ANY (ARRAY['stacked'::text, 'merged'::text])))" },
  { source: 'check', relation: 'paths', column_name: 'kind', name: 'paths_kind_check', definition: "CHECK ((kind = ANY (ARRAY['happy'::text, 'variant'::text, 'exception'::text])))" },
  { source: 'check', relation: 'cell_dependencies', column_name: 'kind', name: 'cell_dependencies_kind_check', definition: "CHECK ((kind = ANY (ARRAY['leads_to'::text, 'enables'::text])))" },
  { source: 'check', relation: 'resources', column_name: 'kind', name: 'resources_kind_check', definition: "CHECK ((kind = ANY (ARRAY['link'::text, 'attachment'::text])))" },
  { source: 'check', relation: 'slices', column_name: 'kind', name: 'slices_kind_check', definition: "CHECK ((kind = ANY (ARRAY['journey'::text, 'step'::text, 'lane'::text, 'cell'::text, 'custom'::text])))" },
  { source: 'check', relation: 'stakeholders', column_name: 'kind', name: 'stakeholders_kind_check', definition: "CHECK ((kind = ANY (ARRAY['recipient'::text, 'staff'::text, 'partner'::text, 'provider'::text, 'team'::text])))" },
  { source: 'check', relation: 'paths', column_name: 'origin', name: 'paths_origin_check', definition: "CHECK ((origin = ANY (ARRAY['import'::text, 'app'::text])))" },
  { source: 'check', relation: 'lanes', column_name: 'lane_role', name: 'lanes_lane_role_check', definition: "CHECK (((lane_role IS NULL) OR (lane_role = ANY (ARRAY['customer_actions'::text, 'storyboard'::text]))))" },
  { source: 'check', relation: 'cells', column_name: null, name: 'cells_position_check', definition: 'CHECK ((position >= 0))' },
  { source: 'domain', relation: null, column_name: null, name: 'entity_status', definition: "CHECK ((VALUE = ANY (ARRAY['proposed'::text, 'planned'::text, 'built'::text, 'live'::text, 'at_risk'::text, 'deprecated'::text])))" },
  { source: 'domain', relation: 'paths', column_name: 'status', name: 'entity_status', definition: "CHECK ((VALUE = ANY (ARRAY['proposed'::text, 'planned'::text, 'built'::text, 'live'::text, 'at_risk'::text, 'deprecated'::text])))" },
  { source: 'domain', relation: 'cells', column_name: 'status', name: 'entity_status', definition: "CHECK ((VALUE = ANY (ARRAY['proposed'::text, 'planned'::text, 'built'::text, 'live'::text, 'at_risk'::text, 'deprecated'::text])))" },
]
const catalog = catalogValueSets(rows)
const retired = new Map([['single', { column: 'scenarios.layout', is: 'stacked', migration: '20260902120000' }]])

const markdown = (text, source = 'doc.md') =>
  valueSetFindings({ text, source, medium: 'markdown' }, catalog, retired)
const comment = (text, host) =>
  valueSetFindings(
    { text, source: host.column ? `comment on column ${host.relation}.${host.column}` : `comment on table ${host.relation}`, medium: 'comment', host },
    catalog,
    retired,
  )

/* ------------------------------------------------------------ the catalog */

test('a deparsed IN list is a value set; a range is not', () => {
  assert.deepEqual(parseValueSet("CHECK ((kind = ANY (ARRAY['a'::text, 'b'::text])))"), ['a', 'b'])
  assert.deepEqual(parseValueSet("CHECK (kind IN ('a', 'b'))"), ['a', 'b'])
  assert.deepEqual(parseValueSet("CHECK (((x IS NULL) OR (x = ANY (ARRAY['it''s'::text]))))"), ["it's"])
  assert.equal(parseValueSet('CHECK ((position >= 0))'), null)
})

test('the catalog is indexed by column, by domain and by bare column name', () => {
  assert.deepEqual([...catalog.columns.get('scenarios.layout').values], ['stacked', 'merged'])
  assert.deepEqual([...catalog.domains.get('entity_status').values].length, 6)
  assert.equal(catalog.columns.get('paths.status'), catalog.domains.get('entity_status'))
  assert.deepEqual(catalog.byColumn.get('kind').sort(), [
    'cell_dependencies.kind',
    'paths.kind',
    'resources.kind',
    'slices.kind',
    'stakeholders.kind',
  ])
  assert.equal(catalog.columns.has('cells.position'), false)
})

test('the rename map records retired VALUES as well as identifiers', () => {
  const live = retiredValues()
  assert.deepEqual(live.get('single'), { column: 'scenarios.layout', is: 'stacked', migration: '20260902120000' })
})

/* -------------------------------------------------------------- markdown */

test('a bare column outside a run scopes it, and the claim is equality', () => {
  assert.deepEqual(markdown('`kind` is exactly three values: `happy`, `variant`, `exception`.'), [])
  const [finding] = markdown('`kind` is exactly four values: `happy`, `unhappy`, `exception`, `alternative`.')
  assert.match(finding, /doc\.md:1 documents/)
  assert.match(finding, /`paths\.kind`/)
  assert.match(finding, /paths_kind_check accepts \{happy, variant, exception\}/)
  // Missing one is drift too: the day a fourth value lands, "exactly three" is false.
  assert.equal(markdown('`kind` is `happy` or `variant`.').length, 1)
})

test('a column INSIDE the run is a member of a column list, not its scope', () => {
  assert.deepEqual(markdown('Table `scenarios`: `phase_id`, `name`, `summary`, `position`, `layout`.'), [])
  assert.deepEqual(markdown('path has `summary`, `note`, `kind` and `status`.'), [])
})

test('a qualified column names one set', () => {
  assert.deepEqual(markdown('The schema allows (`paths.kind` is `happy | variant | exception`).'), [])
  assert.equal(markdown('(`paths.kind` is `happy | unhappy | exception`)').length, 1)
})

test('a domain names its set', () => {
  const six = '`proposed`, `planned`, `built`, `live`, `at_risk`, `deprecated`'
  assert.deepEqual(markdown(`on one shared vocabulary, the \`entity_status\` domain: ${six}.`), [])
  const [finding] = markdown('the `entity_status` domain: `proposed`, `planned`, `built`, `live`.')
  assert.match(finding, /domain entity_status accepts/)
})

test('a parenthetical is its own sentence, scoped by the span before its bracket', () => {
  const line =
    'Table `resources`: `cell_id` — always — plus `kind` (`link` or `attachment`), `name`, `url`, `origin`, and `featured`.'
  assert.deepEqual(markdown(line), [])
  const [finding] = markdown(line.replace('`attachment`', '`file`'))
  assert.match(finding, /\{link, file\}/)
  assert.match(finding, /resources_kind_check accepts \{link, attachment\}/)
})

test('an unscoped pipe span must be some live set whenever it touches one', () => {
  assert.deepEqual(markdown('the CHECK constraint is `stacked | merged` — so a scenario left merged'), [])
  assert.deepEqual(markdown('the header is `loading | ready | error` at any moment'), [])
  const [finding] = markdown('the CHECK constraint is `stacked | merged | split`')
  assert.match(finding, /no constraint accepts that set/)
  assert.match(finding, /scenarios_layout_check accepts \{stacked, merged\}/)
})

test('an unscoped comma run is prose', () => {
  assert.deepEqual(markdown('It began as two values on cells, `planned` and `prototype`, and the boundary did not order.'), [])
  assert.deepEqual(markdown('Bare rows are `lanes`, `scenarios` and `steps`.'), [])
})

test('a retired value is a finding wherever it is listed', () => {
  const [finding] = markdown('`layout` is `single` or `stacked`.')
  assert.match(finding, /names `single`, which `scenarios\.layout` retired for `stacked` in 20260902120000/)
  const [pipe] = markdown('It was `single | side-by-side | integrated`.')
  assert.match(pipe, /names `single`/)
})

test('a sentence that records the retirement is history — verb AND migration', () => {
  assert.deepEqual(markdown('`single` and `side-by-side` became `stacked` in `20260902120000`.'), [])
  // The exemption is one sentence wide. The next sentence is judged on its own.
  const two = '`single` became `stacked` in `20260902120000`. `layout` is `single` or `stacked`.'
  assert.equal(markdown(two).length, 1)
  assert.equal(markdown('`layout` was `single` or `stacked`, and `single` became `stacked`.').length, 1)
})

test('fenced code and rename-table rows are not prose', () => {
  const fenced = ['```sql', "check (layout in ('single', 'stacked'))", '```'].join('\n')
  assert.deepEqual(markdown(fenced), [])
  const table = ['| Was | Is | Migration |', '|---|---|---|', "| `layout = 'single'` | `stacked` | `20260902120000` |"].join('\n')
  assert.deepEqual(markdown(table), [])
})

test('a wrapped list is one sentence and the finding names the line it starts on', () => {
  const text = ['# Heading', '', 'Filler.', '', 'The `entity_status` domain:', '`proposed`, `planned`,', '`built`.'].join('\n')
  const [finding] = markdown(text)
  assert.match(finding, /^doc\.md:5 /)
  assert.deepEqual(
    sentencesOf('One. Two\nthree.\n\nFour.').map((s) => [s.text, s.line]),
    [['One.', 1], ['Two three.', 1], ['Four.', 4]],
  )
})

/* -------------------------------------------------------------- comments */

test('a bracketed list in a table comment is held to the columns of that table', () => {
  const [finding] = comment('Service blueprint path (happy, unhappy, exception, alternative)', { relation: 'paths', column: null })
  assert.match(finding, /^comment on table paths documents `paths\.kind`/)
  assert.match(finding, /\{happy, unhappy, exception, alternative\}/)
  assert.deepEqual(comment('One route through a scenario — happy, variant or exception (kind).', { relation: 'paths', column: null }), [])
})

test('a comment glosses PART of a set and that is a subset, not drift', () => {
  const host = { relation: 'stakeholders', column: 'kind' }
  assert.deepEqual(comment('staff/recipient/partner/provider are ACTORS — they can be a lane\'s stakeholder. team is an accountable group.', host), [])
  assert.equal(comment('staff/recipient/partner/vendor are ACTORS.', host).length, 1)
})

test('a plain comma run that shares no value with the column is English', () => {
  const host = { relation: 'scenarios', column: 'layout' }
  assert.deepEqual(comment('How the board is drawn: the paths stacked as bands on a shared step axis, or merged into one grid.', host), [])
  assert.deepEqual(comment('Catalog of the tools, documents, channels and artifacts a service uses.', { relation: 'touchpoints', column: null }), [])
})

test('key = gloss pairs on a constrained column are held strictly', () => {
  const host = { relation: 'cell_dependencies', column: 'kind' }
  const [finding] = comment('trigger = temporal (sets off); needs = functional (source requires target). needs renders in the panel only.', host)
  assert.match(finding, /\{trigger, needs\}/)
  assert.match(finding, /cell_dependencies_kind_check accepts \{leads_to, enables\}/)
  assert.deepEqual(comment('leads_to = temporal (this cell makes the other happen); enables = functional (the other must already be in place).', host), [])
})

test('a piped list in a comment is held strictly', () => {
  const host = { relation: 'slices', column: 'kind' }
  assert.deepEqual(comment('How the cut was made: journey (experience closure for an actor) | step (one column) | lane (one lane across the whole service) | cell (single-cell spec) | custom.', host), [])
  assert.equal(comment('journey | step | lane | cell | freeform.', host).length, 1)
})

test('a comment that names another column or a domain is scoped by that name', () => {
  const host = { relation: 'paths', column: 'kind' }
  const text =
    'How this route relates to the scenario\'s main one: happy (it IS the main route), variant (equally normal, chosen by condition), exception (a rule or a failure diverts it). ' +
    'How far along the route is does not belong here: paths.status carries that, on the entity_status domain — proposed, planned, built, live, at_risk, deprecated.'
  assert.deepEqual(comment(text, host), [])
  assert.equal(comment(text.replace('at_risk', 'blocked'), host).length, 1)
})

test('a retired value in a comment is a finding, and a dated record of the rename is not', () => {
  const host = { relation: 'scenarios', column: 'layout' }
  const [finding] = comment('Drawn as single, stacked or merged.', host)
  assert.match(finding, /names `single`/)
  assert.deepEqual(comment('single became stacked in 20260902120000.', host), [])
})

/* --------------------------------------------- the shapes that are not claims */

test('a rename pair around an arrow is neither a list nor a scope', () => {
  assert.deepEqual(
    markdown('The payload keys move with their columns (`label` → `name`, `check_name` → `check_key`, `slice_type` → `kind`).'),
    [],
  )
})

test('a bare column scopes only through a predicate', () => {
  // "`kind`, `note`" — a column list; `kind` is a member, not a subject.
  assert.deepEqual(markdown('`id`, `service_id`, `name`, `kind`, `note`, plus the `parent_id` and `updated_at`.'), [])
  // "the retired `slice_type` and `check_name` spellings, and `origin` on slices"
  assert.deepEqual(markdown('still writes the retired `slice_type` and `check_name` spellings, and `origin` on slices.'), [])
  assert.equal(markdown('`kind`: `happy` / `variant` / `unhappy`').length, 1)
  assert.equal(markdown('`kind` = `leads_to` or `needs`').length, 1)
})

test('the rename section of a document is history', () => {
  const text = [
    '## The rename map',
    '',
    '`slices.origin` is renamed because its vocabulary (`generated`, `customized`, `human`)',
    'answers a different question from every other `origin` (`import`, `app`).',
    '',
    '| Was | Is | Migration |',
    '|---|---|---|',
    '| `x` | `y` | `20260101000000` |',
    '',
    '## Next',
    '',
    '`origin` is `import` or `app`.',
    '`origin` is `import` or `apps`.',
  ].join('\n')
  const findings = markdown(text)
  assert.equal(findings.length, 1)
  assert.match(findings[0], /^doc\.md:13 /)
})

test('a bracket is a list only when the run is the whole of it', () => {
  const host = { relation: 'lanes', column: 'lane_role' }
  assert.deepEqual(comment('Semantic role key that drives rendering (pill cells, storyboard rows, divider anchoring).', host), [])
  assert.equal(comment('Semantic role key (storyboard, sidebar).', host).length, 1)
})

test('or, and, null are not values', () => {
  const host = { relation: 'cell_touchpoints', column: 'role' }
  const text = 'What this touchpoint is to this moment: core (the step happens through it) or peripheral (present, but not what the step turns on), or null for the unmarked majority.'
  assert.deepEqual(valueSetFindings({ text, source: 'c', medium: 'comment', host }, catalogValueSets([
    ...rows,
    { source: 'check', relation: 'cell_touchpoints', column_name: 'role', name: 'cell_touchpoints_role_check', definition: "CHECK ((role = ANY (ARRAY['core'::text, 'peripheral'::text])))" },
  ]), retired), [])
})

test('a retired value that another column still accepts needs a scope to be stale', () => {
  const gone = new Map([
    ['custom', { column: 'paths.kind', is: 'variant', migration: '20260821220000' }],
    ['unhappy', { column: 'paths.kind', is: 'exception', migration: '20260821220000' }],
  ])
  const md = (text) => valueSetFindings({ text, source: 'doc.md', medium: 'markdown' }, catalog, gone)
  assert.deepEqual(md('a slice is `journey | step | lane | cell | custom`'), [])
  assert.deepEqual(md('`slices.kind` is `journey`, `step`, `lane`, `cell` or `custom`.'), [])
  assert.match(md('`paths.kind` is `happy`, `variant` or `custom`.')[0], /names `custom`/)
  assert.match(md('routes are `happy | unhappy | exception`')[0], /names `unhappy`/)
  const host = { relation: 'slices', column: 'kind' }
  assert.deepEqual(valueSetFindings({ text: 'journey | step | lane | cell | custom.', source: 'c', medium: 'comment', host }, catalog, gone), [])
})
