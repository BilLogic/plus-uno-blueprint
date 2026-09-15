#!/usr/bin/env node
/**
 * EXPORT THIS DEPLOYMENT'S BOARD THROUGH THE PUBLIC READ SURFACE, AS THE
 * REGISTRY `sample.blueprints` TAKES.
 *
 * ── WHAT THIS IS FOR ──────────────────────────────────────────────────────
 *
 * `sample.nav` and `sample.blueprints` are the two halves of the board a build
 * with no database shows. This deployment supplied the first and, until this
 * script existed, could not supply the second: the kit's own generator
 * (`scripts/generate_fallbacks.py --register`, inside the installed package)
 * takes a Service Blueprint IR, and this deployment has never had one. Its
 * board arrived as an import made elsewhere and its cell prose lives in the
 * live database and in no file here.
 *
 * So the export comes from the database instead — through THE SAME READ
 * SURFACE THE DEPLOYED SITE USES, the anon key already baked into the browser
 * bundle, and nothing else. Two variables, `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY`, which are repository VARIABLES rather than
 * secrets because they are public by design (`scripts/live-checks.mjs` §
 * publishable). A row RLS hides from anon is a row this file does not carry,
 * and the run says so rather than reaching for a credential that would see it.
 *
 * ── WHAT IT READS, AND IN WHAT ORDER ──────────────────────────────────────
 *
 * `deployment/data/sampleNav.ts` is the subject: every id it spells is put to
 * `scenarios`, and the ones that answer are this board's scenarios, in the
 * order the nav lists them. Reading the nav as TEXT is the same trick
 * `scripts/render-walk.mjs` plays on the same file and for the same reason —
 * the nav is a TypeScript module a plain Node script cannot import, and an id
 * is the only thing either file needs from it.
 *
 * Then one board query per scenario, the nested select the application's own
 * board makes (`PATH_BLUEPRINT_SELECT` in the package's
 * `src/lib/workflowQueries.ts`), plus `cell_key` and the lane spec columns the
 * offline shape carries and the live select does not need.
 *
 * ── DETERMINISM ───────────────────────────────────────────────────────────
 *
 * Every list is sorted on a key the database supplies, never on arrival order:
 * PostgREST promises no order for an embedded relation, and a file that
 * re-shuffles on every run is a file nobody can review.
 *
 * ── WHAT IT CAN AND CANNOT SEE ────────────────────────────────────────────
 *
 * Two different absences, and only one of them is detectable from here.
 *
 * TRUNCATION is caught: the cells of every scenario are counted a second time
 * as rows of their own and the run refuses on a disagreement, because a row cap
 * applies inside a 200 with no error to notice.
 *
 * ROW-LEVEL FILTERING is not, and cannot be. A policy that hides a row hides it
 * from every shape of the question equally, so a board RLS has trimmed looks
 * exactly like a smaller board. What this file therefore claims is the honest
 * half: every scenario the nav names returned at least one path, and every
 * scenario that returned none is named in a warning. It does not claim that
 * what anon sees is all there is. The only volatile
 * thing in the output is the generated-on line, and it is carried over from
 * the previous file whenever the body is byte-identical — so a run against
 * unchanged data produces NO DIFF AT ALL, and `git status` after a regenerate
 * is a real answer about the board rather than about the clock.
 *
 * Usage:
 *
 *   npm run export:sample-board            rewrite deployment/data/sampleBlueprints.ts
 *   npm run export:sample-board -- --check fail if the file is not what the database says
 *
 * `--check` is deliberately NOT wired into `gates`: the database moves whenever
 * somebody authors a cell, and a gate that fails because a colleague edited a
 * board would be a gate that teaches people to ignore it.
 *
 * What it IS wired into is `.github/workflows/offline-board.yml`, which runs it
 * nightly against production and on a pull request that touches this script or
 * the file it writes. Nightly, a red is the day's authoring: somebody clears it
 * by running the command above and committing the result, and the worst case is
 * a board one day stale rather than a board stale since whenever anyone last
 * remembered. On those pull requests a red is the change under review instead,
 * which is the one case where it belongs in front of a merge.
 *
 * A red says WHICH scenario moved first and by how much — see `driftReport`.
 * The freshness claim itself is not written here twice: it is the
 * `Generated on:` and `Board:` lines this script puts in the file's own header,
 * which the docs quote rather than restate, so no hand edit can make it lie.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseEnvFile } from './check-target-schema.mjs'
import { credentials, postgrest, rest } from './generate-agent-account.mjs'
import { BLUEPRINTS, NAV, idsIn } from './render-walk.mjs'

/** The tree this script runs in — the working directory, as every check here resolves it. */
const REPO_ROOT = process.cwd()

/** The npm alias, spelled once so the header it writes and the errors agree. */
const COMMAND = 'npm run export:sample-board'

/* ------------------------------------------------------------ the shaping */

/**
 * The columns of the board select's cells block, spelled as PostgREST wants
 * them. `function` is a reserved word there and has to be quoted; `cell_key`
 * is not on the application's own select because the live board has the
 * database to ask, and the offline one does not.
 */
export const CELL_COLUMNS =
  'id,cell_key,lane_id,step_id,position,content,frame,summary,status,"function",form,value_props,owner,perceived_owner'

/** The board query, one scenario at a time. Mirrors the application's own. */
const PATH_SELECT = `id,name,summary,note,kind,status,scenario_id,` +
  `lanes(id,name,lane_role,position,kpis,tools),` +
  `path_steps(position,steps(id,name,summary)),` +
  `cells(${CELL_COLUMNS},` +
  `resources!resources_cell_id_fkey(id,position,kind,name,url,cell_touchpoint_id,featured),` +
  `cell_touchpoints(id,touchpoint_id,name,position,summary,role,touchpoints(name,kind,icon_url)),` +
  `outgoing:cell_dependencies!cell_dependencies_source_cell_id_fkey(id,target_cell_id,kind,name,note))`

/**
 * The six values `entity_status` accepts; anything else reads as unsaid.
 *
 * Restated from the package rather than imported, because a `.mjs` script
 * cannot import TypeScript out of `node_modules` — neither loader will compile
 * it. A restatement with nothing holding it to its original is a restatement
 * that drifts, so
 * `scripts/tests/the-exporter-restates-the-package-and-is-held-to-it.test.mjs`
 * reads the package's own sources as text and fails on a disagreement. Same
 * argument, and the same remedy, as `scripts/lane-roles.mjs`.
 */
export const ENTITY_STATUS = ['proposed', 'planned', 'built', 'live', 'at_risk', 'deprecated']

/** What a row gets when nobody has said otherwise. */
const DEFAULT_ENTITY_STATUS = 'live'

/** A status column narrowed to the vocabulary the renderer has treatments for. */
const STATUS_VALUES = new Set(ENTITY_STATUS)
const asEntityStatus = (value) => (STATUS_VALUES.has(value) ? value : null)

/** The two roles a placement can be marked with. Restated; held by the same test. */
export const TOUCHPOINT_ROLES = ['core', 'peripheral']

/** The two kinds a resource can be. Restated; held by the same test. */
export const RESOURCE_KINDS = ['link', 'attachment']

/** The column holds `core | peripheral`; null is a state of its own, not a quiet peripheral. */
const ROLE_VALUES = new Set(TOUCHPOINT_ROLES)
const asRole = (value) => (ROLE_VALUES.has(value) ? value : null)

/** The column holds `link | attachment`; anything else reads as a link. */
const asResourceKind = (value) => (value?.trim() === 'attachment' ? 'attachment' : 'link')

/** A comparator over several keys, so every sort below reads as the list it is. */
const by = (...keys) => (a, b) => {
  for (const key of keys) {
    const left = key(a)
    const right = key(b)
    if (left === right) continue
    return left < right ? -1 : 1
  }
  return 0
}

/**
 * An embedded relation as the application reads it: unnamed rows dropped,
 * the rest in the author's order, the name trimmed.
 *
 * The package's `orderedNamedRows` rule — a placement with no name has nothing
 * to draw, and PostgREST promises no order for an embed, so the position column
 * is what says which came first — PLUS an id tiebreak the package does not
 * have. The package sorts on position alone and takes whatever order the
 * comparator leaves rows that share one; a file re-shuffling those on every
 * export is a file nobody can review, so this settles them on their id. Two
 * rows at one position is already a defect in the data, and the two boards
 * disagreeing about which comes first is the smaller half of it.
 */
function orderedNamedRows(rows, project) {
  return (rows ?? [])
    .filter((row) => (row.name ?? '').trim())
    .sort(by((row) => row.position, (row) => row.id ?? ''))
    .map((row) => project(row, row.name.trim()))
}

/** One `cells` row, with its two embedded relations, as `BlueprintCell`. */
function toCell(row) {
  const cell = {
    id: row.id,
    lane_id: row.lane_id,
    step_id: row.step_id,
    position: row.position ?? 0,
    content: row.content,
    frame: row.frame ?? null,
    summary: row.summary ?? null,
    status: asEntityStatus(row.status),
    function: row.function ?? null,
    form: row.form ?? null,
    owner: row.owner ?? null,
    perceived_owner: row.perceived_owner ?? null,
    resources: orderedNamedRows(row.resources, (resource, name) => ({
      id: resource.id ?? null,
      name,
      kind: asResourceKind(resource.kind),
      url: resource.url?.trim() || null,
      placementId: resource.cell_touchpoint_id ?? null,
      featured: resource.featured ?? false,
    })),
    touchpoints: orderedNamedRows(
      (row.cell_touchpoints ?? []).map((placement) => ({
        ...placement,
        // The registry's spelling where there is a registry row; the
        // placement's own name where the registry lacks it.
        name: placement.touchpoints?.name ?? placement.name ?? null,
      })),
      (placement, name) => ({
        id: placement.id ?? null,
        touchpointId: placement.touchpoint_id ?? null,
        name,
        kind: placement.touchpoints?.kind ?? null,
        iconUrl: placement.touchpoints?.icon_url ?? null,
        summary: placement.summary?.trim() || null,
        role: asRole(placement.role),
      }),
    ),
  }
  // Absent rather than empty, so "unset" and "set to nothing" stay apart —
  // the same distinction the package's cell field list draws on this column.
  if (row.cell_key) cell.cell_key = row.cell_key
  if (row.value_props) cell.value_props = row.value_props
  return cell
}

/**
 * One `paths` row, with everything embedded under it, as `BlueprintData`.
 *
 * Cells are sorted the way the board reads them — down the lanes, across the
 * steps — rather than by id, so a diff over this file is a diff a person can
 * follow back to a column of the board.
 */
export function toBlueprintData(row) {
  const lanes = [...(row.lanes ?? [])]
    .sort(by((lane) => lane.position, (lane) => lane.id))
    .map((lane) => ({
      id: lane.id,
      name: lane.name,
      role: lane.lane_role ?? null,
      position: lane.position,
      ...(lane.kpis?.length ? { kpis: lane.kpis } : {}),
      ...(lane.tools?.length ? { tools: lane.tools } : {}),
    }))

  const steps = [...(row.path_steps ?? [])]
    .filter((junction) => junction.steps)
    .sort(by((junction) => junction.position, (junction) => junction.steps.id))
    .map((junction) => ({
      id: junction.steps.id,
      name: junction.steps.name,
      summary: junction.steps.summary ?? null,
      position: junction.position,
    }))

  const laneOrder = new Map(lanes.map((lane, index) => [lane.id, index]))
  const stepOrder = new Map(steps.map((step, index) => [step.id, index]))
  const cells = (row.cells ?? [])
    .map(toCell)
    .sort(
      by(
        (cell) => laneOrder.get(cell.lane_id) ?? Number.MAX_SAFE_INTEGER,
        (cell) => stepOrder.get(cell.step_id) ?? Number.MAX_SAFE_INTEGER,
        (cell) => cell.position,
        (cell) => cell.id,
      ),
    )

  const cellOrder = new Map(cells.map((cell, index) => [cell.id, index]))
  const dependencies = (row.cells ?? [])
    .flatMap((cell) =>
      (cell.outgoing ?? []).map((edge) => ({
        id: edge.id,
        source_cell_id: cell.id,
        target_cell_id: edge.target_cell_id,
        kind: edge.kind === 'enables' ? 'enables' : 'leads_to',
        name: edge.name ?? null,
        note: edge.note ?? null,
      })),
    )
    .sort(
      by(
        (edge) => cellOrder.get(edge.source_cell_id) ?? Number.MAX_SAFE_INTEGER,
        (edge) => edge.target_cell_id,
        (edge) => edge.id,
      ),
    )

  return {
    path: {
      id: row.id,
      name: row.name,
      summary: row.summary ?? null,
      note: row.note ?? null,
      kind: row.kind,
      status: asEntityStatus(row.status) ?? DEFAULT_ENTITY_STATUS,
    },
    lanes,
    steps,
    cells,
    dependencies,
  }
}

/**
 * The path a scenario draws when nobody has chosen one — the canonical "Happy
 * Path" by name, else any happy path, else the first.
 *
 * The registry's reader takes `blueprints[0]` as that default, and the live
 * board takes `pickPreferredPath`. The two have to agree or the offline board
 * opens on a different route than the same scenario does with a database, so
 * this is the package's rule restated rather than an ordering of convenience.
 */
export function preferredPathIndex(paths) {
  const named = paths.findIndex(
    (path) => path.kind === 'happy' && /^happy\s*path$/i.test(path.name.trim()),
  )
  if (named >= 0) return named
  const happy = paths.findIndex((path) => path.kind === 'happy')
  return happy >= 0 ? happy : 0
}

/**
 * THE SHAPING FUNCTION: raw rows in, the registry `sample.blueprints` takes
 * out. Pure — no clock, no network, no filesystem — which is what lets a test
 * hold it to a fixture instead of to a database.
 *
 * @param {string[]} scenarioIds The board's scenarios, in nav order.
 * @param {object[]} rows Every `paths` row, with its board embed.
 */
export function toSampleBlueprintRegistry(scenarioIds, rows) {
  const byScenario = new Map(scenarioIds.map((id) => [id, []]))
  for (const row of rows) {
    byScenario.get(row.scenario_id)?.push(row)
  }

  const blueprintsByScenario = {}
  for (const scenarioId of scenarioIds) {
    const paths = byScenario.get(scenarioId) ?? []
    if (paths.length === 0) continue
    // Alphabetical, and that is THE EXPORTER'S OWN ORDER rather than the live
    // board's. The picker lists paths in the order PostgREST returned them,
    // which is no order at all — nothing to reproduce, and a file that carried
    // it would re-shuffle on every export. What has to match the live board is
    // element 0, and that is what `preferredPathIndex` settles.
    const sorted = [...paths].sort(by((path) => path.name, (path) => path.id))
    const preferred = preferredPathIndex(sorted)
    const ordered = [sorted[preferred], ...sorted.filter((_, index) => index !== preferred)]
    blueprintsByScenario[scenarioId] = ordered.map(toBlueprintData)
  }

  // Nothing is hidden on this board: the column that would say so does not
  // exist, so the honest answer is the empty one rather than a guess.
  return { blueprintsByScenario, uiHiddenPathIdsByScenario: {} }
}

/* ------------------------------------------------------------- the module */

/** A value as a TS expression, via JSON. U+2028/9 are JSON-legal and JS-hostile. */
function tsLiteral(value) {
  return JSON.stringify(value, null, 2)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** What the board is, in numbers, for the header and for the run's own report. */
export function dimensions(registry) {
  const blueprints = Object.values(registry.blueprintsByScenario)
  const paths = blueprints.flat()
  return {
    scenarios: blueprints.length,
    paths: paths.length,
    lanes: paths.reduce((total, path) => total + path.lanes.length, 0),
    steps: paths.reduce((total, path) => total + path.steps.length, 0),
    cells: paths.reduce((total, path) => total + path.cells.length, 0),
    dependencies: paths.reduce((total, path) => total + path.dependencies.length, 0),
    touchpoints: paths.reduce(
      (total, path) => total + path.cells.reduce((n, cell) => n + cell.touchpoints.length, 0),
      0,
    ),
    resources: paths.reduce(
      (total, path) => total + path.cells.reduce((n, cell) => n + cell.resources.length, 0),
      0,
    ),
  }
}

/** The dimensions as one line, the spelling the header and every drift report reuse. */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * Every term the counts sentence says, in the order it says them.
 *
 * A list rather than eight lines of prose because two sentences are written
 * from it: the whole board's, which opens on the scenario count, and one
 * scenario's, which cannot — "1 scenario" inside a sentence about one scenario
 * is a word that carries nothing.
 */
const COUNT_TERMS = Object.freeze([
  ['scenarios', 'scenario', 'scenarios'],
  ['paths', 'path', 'paths'],
  ['lanes', 'lane', 'lanes'],
  ['steps', 'step', 'steps'],
  ['cells', 'cell', 'cells'],
  ['dependencies', 'dependency', 'dependencies'],
  ['touchpoints', 'touchpoint placement', 'touchpoint placements'],
  ['resources', 'resource', 'resources'],
])

export const countsSentence = (counts) =>
  COUNT_TERMS.map(([key, one, many]) => plural(counts[key], one, many)).join(', ')

/** The same sentence about ONE scenario's paths, which is every term but the first. */
const scenarioCounts = (paths) => dimensions({ blueprintsByScenario: { one: paths ?? [] } })

export const scenarioSentence = (paths) =>
  COUNT_TERMS.slice(1)
    .map(([key, one, many]) => plural(scenarioCounts(paths)[key], one, many))
    .join(', ')

/** Whether two scenarios hold the same number of every thing a board is made of. */
const sameCounts = (left, right) => {
  const [a, b] = [scenarioCounts(left), scenarioCounts(right)]
  return COUNT_TERMS.slice(1).every(([key]) => a[key] === b[key])
}

/**
 * The one line the registry literal hangs off, spelled once so writing the
 * module and reading one back cannot disagree about it.
 */
export const REGISTRY_MARKER = 'export const SAMPLE_BLUEPRINTS: SampleBlueprintRegistry = '

/**
 * The module text. Pure, and split from the write so the generated-on line can
 * be decided by comparing bodies rather than by asking the clock twice.
 *
 * @param {{ registry: object, generatedOn: string }} input
 */
export function renderModule({ registry, generatedOn }) {
  const counts = dimensions(registry)
  return `// GENERATED by \`${COMMAND}\` — DO NOT EDIT BY HAND.
//
// The content behind \`sampleNav.ts\`'s rows: the other half of this deployment's
// offline board, and what every no-database build draws. \`sample.nav\` lists the
// phases and scenarios; this is what each of those scenarios shows.
//
// It is an export of the LIVE board, read through the public read surface — the
// anon key the deployed site itself ships, and no other credential. The kit's own
// generator takes a Service Blueprint IR and this deployment has never had one,
// so \`scripts/export-sample-board.mjs\` reads the database the site reads instead.
// That script's header carries the whole of why.
//
// Regenerate it, never edit it:
//
//   ${COMMAND}
//
// Generated on: ${generatedOn}
// Board:        ${countsSentence(counts)}

import type { SampleBlueprintRegistry } from 'agentic-service-blueprinting'

${REGISTRY_MARKER}${tsLiteral(registry)}
`
}

/** The header's date line, so reading one back and writing one use the same spelling. */
const GENERATED_ON = /^\/\/ Generated on: (.+)$/m

/**
 * The module to write, keeping the previous generated-on date when nothing but
 * the date would change.
 *
 * @param {string | null} previous The file as it stands, or null when there is none.
 * @param {object} registry
 * @param {string} today
 */
export function moduleToWrite(previous, registry, today) {
  const fresh = renderModule({ registry, generatedOn: today })
  const carried = previous ? GENERATED_ON.exec(previous)?.[1] : null
  if (!carried) return fresh
  const asCarried = renderModule({ registry, generatedOn: carried })
  return asCarried === previous ? previous : fresh
}

/* ------------------------------------------------------------- the report */

/**
 * The registry a written module carries, read back out of its own literal.
 *
 * `tsLiteral` is `JSON.stringify`, so what follows the marker is plain JSON and
 * nothing has to evaluate TypeScript to get at it. A file that does not parse
 * is not drift and is not reported as drift: it is a hand edit, and the caller
 * says so in those words.
 */
export function registryIn(module) {
  if (!module) return null
  const at = module.indexOf(REGISTRY_MARKER)
  if (at < 0) return null
  try {
    return JSON.parse(module.slice(at + REGISTRY_MARKER.length))
  } catch {
    return null
  }
}

/**
 * THE FIRST SCENARIO THE COMMITTED BOARD AND THE LIVE ONE DISAGREE ABOUT.
 *
 * `--check` can already say THAT the two differ — the module it would write is
 * not the module on disk — and that on its own sends a reader to a 1.4 MB
 * generated diff with no idea what to look for. So the run also says WHICH
 * scenario moved first, in nav order, and what moved about it: a scenario one
 * side has and the other does not, a count that changed, or counts that agree
 * while something inside a row does not.
 *
 * Nav order rather than the registry's key order, because the nav is the order
 * a person reads the board in. Scenarios the committed file carries and the nav
 * no longer names come after, so a row orphaned by a nav edit is still named.
 *
 * @param {string[]} scenarioIds The board's scenarios, in nav order.
 * @param {object | null} committed The registry the committed module carries.
 * @param {object} live The registry this run just read.
 */
export function firstDrift(scenarioIds, committed, live) {
  if (!committed) return null
  const orphans = Object.keys(committed.blueprintsByScenario ?? {}).filter(
    (id) => !scenarioIds.includes(id),
  )
  for (const scenarioId of [...scenarioIds, ...orphans]) {
    const here = committed.blueprintsByScenario?.[scenarioId]
    const there = live.blueprintsByScenario?.[scenarioId]
    if (JSON.stringify(here ?? null) === JSON.stringify(there ?? null)) continue
    if (!here) {
      return {
        scenarioId,
        said: `the committed board carries no entry for it; the database answered with ${scenarioSentence(there)}`,
      }
    }
    if (!there) {
      return {
        scenarioId,
        said: `the database returned no path for it; the committed board carries ${scenarioSentence(here)}`,
      }
    }
    const mine = scenarioSentence(here)
    const theirs = scenarioSentence(there)
    // The COUNTS decide which sentence this is, never the two sentences: a
    // wording change in `COUNT_TERMS` would otherwise silently retune what the
    // run calls a row moving versus a row's contents moving.
    if (sameCounts(here, there)) {
      return {
        scenarioId,
        said:
          `both carry ${mine}, so what moved is INSIDE a row rather than a row itself — ` +
          'a name, a cell\'s prose, a status, a URL, or an order',
      }
    }
    return { scenarioId, said: `committed ${mine}; live ${theirs}` }
  }
  return null
}

/**
 * What a red `--check` prints, as lines. Pure, so a test can read the report
 * rather than a runner's scrollback.
 *
 * Only the first line is an annotation: GitHub renders one per `::error::` and
 * a report broken into eight of them is eight annotations saying one thing.
 * The rest are plain log lines directly under it.
 */
export function driftReport({ previous, live, scenarioIds }) {
  const committed = registryIn(previous)
  const lines = [
    `::error::${BLUEPRINTS} is not what the database says. Run \`${COMMAND}\` and commit the result.`,
    `  live:      ${countsSentence(dimensions(live))}`,
  ]
  if (previous === null || previous === undefined) {
    // Not drift and not a hand edit: there is no committed board at all, which
    // is the state before the first export and after somebody deletes it.
    lines.push(`  committed: nothing — ${BLUEPRINTS} does not exist in this tree.`)
    return lines
  }
  if (!committed) {
    lines.push(
      `  committed: unreadable — ${BLUEPRINTS} carries no registry literal this run could parse, ` +
        'which is a hand edit to a generated file rather than drift in the board.',
    )
    return lines
  }
  lines.push(`  committed: ${countsSentence(dimensions(committed))}`)
  const drift = firstDrift(scenarioIds, committed, live)
  lines.push(
    drift
      ? `  first differing scenario: ${drift.scenarioId} — ${drift.said}`
      : '  no scenario differs: what moved is OUTSIDE `blueprintsByScenario` — the module\'s ' +
        'header, its type import, or the hidden-path map beside it. That is an exporter change, ' +
        'not an authoring one.',
  )
  return lines
}

/* ---------------------------------------------------------------- the run */

/**
 * `.env` values, ignoring a missing file — the environment may carry them.
 *
 * The same four lines as `generate-agent-account.mjs`, and deliberately not
 * imported from it: that file is one of the scripts the template PUBLISHES and
 * this repository holds byte-identical (`check:reconciled`,
 * `check:shared-scripts`), so adding an export to it is an edit upstream owns.
 * Its `credentials`, `rest` and `postgrest` are imported above because they are
 * already exported; this is not, and four lines here is cheaper than a pin held
 * for a one-word release.
 */
function readDotenv() {
  try {
    return parseEnvFile(readFileSync(resolve(REPO_ROOT, '.env'), 'utf8'))
  } catch {
    return {}
  }
}

/** One read, or a refusal naming what PostgREST said. */
async function read(target, path, subject) {
  const response = await rest(target.url, target.key, path)
  if (!response.ok) {
    throw new Error(
      `the read surface answered ${response.status} for ${subject} — ${postgrest(response.body)}. ` +
        'Nothing is written: a partial board committed as a whole one is worse than no board.',
    )
  }
  return response.body
}

/**
 * Every id of `table` whose `column` is one of `values`, paged explicitly.
 *
 * PostgREST caps a response at its own `db-max-rows` and says so in a header
 * rather than in an error, so a read that asks for everything and takes what it
 * gets is a read that can silently return half a board. The pages are asked for
 * by number instead: a short page is the end, a full one is never assumed to be.
 */
async function flatIds(target, table, column, values, subject) {
  const PAGE = 500
  const ids = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await read(
      target,
      `${table}?select=id&${column}=in.(${values.join(',')})&order=id.asc&limit=${PAGE}&offset=${offset}`,
      subject,
    )
    ids.push(...page.map((row) => row.id))
    if (page.length < PAGE) return ids
  }
}

/**
 * THE NESTED READ AGAINST A FLAT ONE, because a truncated board is a green run.
 *
 * The board query embeds a path's cells under it, and an embedded array is
 * subject to the same row cap the top level is — applied inside a 200, with no
 * error to notice. So the cells are counted a second way, as their own rows,
 * paged: the same role, the same policies, a different shape. A disagreement is
 * a refusal rather than a warning, because the script's own promise is that a
 * partial board is never committed as a whole one.
 *
 * It is a TRUNCATION guard and not an RLS one, and the difference matters. A
 * policy that hides rows hides them from both shapes equally; what this catches
 * is the read surface handing back fewer rows than it holds.
 */
async function refuseOnTruncation(target, scenarioIds, rows) {
  for (const scenarioId of scenarioIds) {
    const paths = rows.filter((row) => row.scenario_id === scenarioId)
    if (paths.length === 0) continue
    const embedded = paths.reduce((total, row) => total + (row.cells?.length ?? 0), 0)
    const flat = await flatIds(
      target,
      'cells',
      'path_id',
      paths.map((row) => row.id),
      `the cells of scenario ${scenarioId}, counted as rows`,
    )
    if (flat.length !== embedded) {
      throw new Error(
        `scenario ${scenarioId} answered with ${embedded} cells embedded under its paths and ` +
          `${flat.length} cells read as rows. The board query is being truncated — PostgREST caps ` +
          'an embedded array the same way it caps a top-level one, inside a 200. Nothing is ' +
          'written: a partial board committed as a whole one is worse than no board.',
      )
    }
  }
}

async function main() {
  const check = process.argv.includes('--check')
  const target = credentials(process.env, readDotenv())
  if (!target) {
    console.error(
      `::error::${COMMAND} needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY — the same two ` +
        'public values the deployed site is built with. Set them in `.env` (see `.env.example`) ' +
        'and run it again. No other credential will do, and none is wanted: this reads what a ' +
        'visitor can read.',
    )
    process.exitCode = 1
    return
  }

  const navPath = resolve(REPO_ROOT, NAV)
  const declared = idsIn(readFileSync(navPath, 'utf8'))
  const known = await read(
    target,
    `scenarios?select=id&id=in.(${declared.join(',')})`,
    `the scenarios ${NAV} names`,
  )
  const answered = new Set(known.map((row) => row.id))
  const scenarioIds = declared.filter((id) => answered.has(id))
  if (scenarioIds.length === 0) {
    throw new Error(
      `none of the ${declared.length} ids in ${NAV} is a scenario this read surface can see. ` +
        'Either the nav names another database, or anon cannot read `scenarios` here.',
    )
  }

  const rows = []
  for (const scenarioId of scenarioIds) {
    rows.push(
      ...(await read(
        target,
        `paths?select=${encodeURIComponent(PATH_SELECT)}&scenario_id=eq.${scenarioId}`,
        `the paths of scenario ${scenarioId}`,
      )),
    )
  }

  await refuseOnTruncation(target, scenarioIds, rows)

  const registry = toSampleBlueprintRegistry(scenarioIds, rows)
  const counts = dimensions(registry)

  // What the read surface DID NOT hand over, said out loud rather than papered
  // over: a scenario the nav names and the board has no path for is a scenario
  // that draws nothing offline, whether that is because it has no path or
  // because a policy hides it.
  const empty = scenarioIds.filter((id) => !(id in registry.blueprintsByScenario))
  for (const id of empty) {
    console.warn(
      `::warning::${NAV} names scenario ${id} and the read surface returned no path for it — ` +
        'it will draw its empty state offline, as it does with a database.',
    )
  }

  const path = resolve(REPO_ROOT, BLUEPRINTS)
  let previous = null
  try {
    previous = readFileSync(path, 'utf8')
  } catch {
    previous = null
  }
  const next = moduleToWrite(previous, registry, new Date().toISOString().slice(0, 10))

  if (check) {
    if (next === previous) {
      console.log(`ok — ${BLUEPRINTS} is what the database says: ${countsSentence(counts)}`)
      return
    }
    for (const line of driftReport({ previous, live: registry, scenarioIds })) console.error(line)
    process.exitCode = 1
    return
  }

  if (next === previous) {
    console.log(`unchanged — ${BLUEPRINTS} already says it: ${countsSentence(counts)}`)
    return
  }
  writeFileSync(path, next)
  console.log(`wrote ${BLUEPRINTS} — ${countsSentence(counts)}`)
  if (empty.length > 0) {
    console.log(`  ${empty.length} scenario(s) the nav names have no path on this read surface.`)
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  main().catch((error) => {
    console.error(`::error::export-sample-board: ${error.message}`)
    process.exitCode = 1
  })
}
