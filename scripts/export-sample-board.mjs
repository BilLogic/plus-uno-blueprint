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
 * re-shuffles on every run is a file nobody can review. The only volatile
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
 * board would be a gate that teaches people to ignore it. The freshness note in
 * `docs/engineering/template-relationship.md` is the honest instrument — a date
 * and a count, refreshed when the board is re-exported.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseEnvFile } from './check-target-schema.mjs'
import { credentials, postgrest, rest } from './generate-agent-account.mjs'
import { BLUEPRINTS, NAV } from './render-walk.mjs'

/** The tree this script runs in — the working directory, as every check here resolves it. */
const REPO_ROOT = process.cwd()

/** The npm alias, spelled once so the header it writes and the errors agree. */
const COMMAND = 'npm run export:sample-board'

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

/**
 * Every id spelled in `text`, in the order it first appears and without
 * repeats. The nav lists phases and scenarios together; which of the two an id
 * is, is the database's answer rather than this file's guess.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function idsIn(text) {
  return [...new Set(text.match(UUID) ?? [])]
}

/* ------------------------------------------------------------ the shaping */

/**
 * The columns of the board select's cells block, spelled as PostgREST wants
 * them. `function` is a reserved word there and has to be quoted; `cell_key`
 * is not on the application's own select because the live board has the
 * database to ask, and the offline one does not.
 */
const CELL_COLUMNS =
  'id,cell_key,lane_id,step_id,position,content,frame,summary,status,"function",form,value_props,owner,perceived_owner'

/** The board query, one scenario at a time. Mirrors the application's own. */
const PATH_SELECT = `id,name,summary,note,kind,status,scenario_id,` +
  `lanes(id,name,lane_role,position,kpis,tools),` +
  `path_steps(position,steps(id,name,summary)),` +
  `cells(${CELL_COLUMNS},` +
  `resources!resources_cell_id_fkey(id,position,kind,name,url,cell_touchpoint_id,featured),` +
  `cell_touchpoints(id,touchpoint_id,name,position,summary,role,touchpoints(name,kind,icon_url)),` +
  `outgoing:cell_dependencies!cell_dependencies_source_cell_id_fkey(id,target_cell_id,kind,name,note))`

/** The six values `entity_status` accepts; anything else reads as unsaid. */
const ENTITY_STATUS = new Set(['proposed', 'planned', 'built', 'live', 'at_risk', 'deprecated'])

/** What a row gets when nobody has said otherwise. */
const DEFAULT_ENTITY_STATUS = 'live'

/** A status column narrowed to the vocabulary the renderer has treatments for. */
const asEntityStatus = (value) => (ENTITY_STATUS.has(value) ? value : null)

/** The column holds `core | peripheral`; null is a state of its own, not a quiet peripheral. */
const asRole = (value) => (value === 'core' || value === 'peripheral' ? value : null)

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
 * The same rule as the package's `orderedNamedRows`, and it is a rule rather
 * than a convenience — a placement with no name has nothing to draw, and
 * PostgREST promises no order for an embed, so the position column is the only
 * thing that says which came first.
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

/** The dimensions as one line, the spelling the docs' freshness note reuses. */
export const countsSentence = (counts) =>
  `${counts.scenarios} scenarios, ${counts.paths} paths, ${counts.lanes} lanes, ` +
  `${counts.steps} steps, ${counts.cells} cells, ${counts.dependencies} dependencies, ` +
  `${counts.touchpoints} touchpoint placements, ${counts.resources} resources`

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

import type { DeploymentConfig } from 'agentic-service-blueprinting'

/**
 * The registry \`sample.blueprints\` takes. Derived from \`DeploymentConfig\`
 * rather than imported: the package's index does not export
 * \`SampleBlueprintRegistry\` yet, and the config field is the same type.
 */
type SampleBlueprintRegistry = NonNullable<
  NonNullable<DeploymentConfig['sample']>['blueprints']
>

export const SAMPLE_BLUEPRINTS: SampleBlueprintRegistry = ${tsLiteral(registry)}
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

/* ---------------------------------------------------------------- the run */

/** `.env` values, ignoring a missing file — the environment may carry them. */
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
    console.error(
      `::error::${BLUEPRINTS} is not what the database says. Run \`${COMMAND}\` and commit the result.`,
    )
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
