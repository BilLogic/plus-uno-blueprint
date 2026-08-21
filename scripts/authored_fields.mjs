#!/usr/bin/env node
/**
 * Export and restore the fields authored in the app.
 *
 * Why this exists: the blueprint tables are rebuilt by re-running
 * `supabase/seed.sql`, which deletes and recreates every row. Anything typed
 * into the app that lives on those tables — Function, Form, Value, the owner
 * pair, lane metadata, phase metadata — is destroyed by that, silently. The
 * derived lane (slices, findings, evidence) survives because it was designed
 * to; these columns were not.
 *
 * So: `export` before any destructive database work, `restore` after.
 *
 * Everything is keyed by **natural keys**, never UUIDs — a reset is precisely
 * the thing that changes UUIDs, and names are what carries across it. A row
 * whose names no longer match is reported, not guessed at: a near-miss restore
 * writing someone's Function text onto the wrong cell is worse than a failed
 * restore.
 *
 * The key is qualified all the way up — phase / scenario / path / lane / step.
 * It used to be path / lane / step, which is not unique: "Happy Path" names a
 * version in most scenarios, so that key collided on 27 of 737 cells and the
 * lookup map silently kept whichever row it saw last. None of the currently
 * exported cells happened to sit on a collision, so nothing was corrupted —
 * but the next authored cell in one would have been, quietly.
 *
 * Qualifying is necessary and still not sufficient: Application / Discovery /
 * Happy Path contains five distinct steps all named "Discovers PLUS", so 17
 * cells remain unaddressable by any name-based key. Those are **reported as
 * ambiguous and skipped**, never restored by picking one. A key that resolves
 * to two rows is not a match.
 *
 * Usage:
 *   export SUPABASE_URL="https://<ref>.supabase.co"
 *   export SUPABASE_SERVICE_KEY="<service_role key>"   # never written to disk
 *   node scripts/authored_fields.mjs export
 *   node scripts/authored_fields.mjs restore [--dry-run]
 *
 * The output file (docs/authored-fields.json) is committed on purpose:
 * authored content should have a home in git, not only in one database.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(REPO_ROOT, 'docs/authored-fields.json')

/*
  `content`, `summary`, `links` and `maturity` were added here in Aug 2026,
  after a session wrote ~900 summaries and it turned out nothing in the repo
  would have survived a `supabase:reset`.

  The original list covered only the fields typed into the app's authoring UI,
  on the reasoning that everything else came from `seed.sql`. That stopped
  being true: seed.sql carries no cells at all any more (9KB, no INSERT into
  cells, last touched Aug 19), so the blueprint's actual prose lives in the
  database and nowhere else. These four are that prose.
*/
const CELL_FIELDS = [
  'content',
  'summary',
  'links',
  'maturity',
  'function',
  'form',
  'value_props',
  'owner',
  'perceived_owner',
]
const LAYER_FIELDS = ['owner_team', 'kpis', 'tools']
const PHASE_FIELDS = ['business_impact', 'operational_requirements']

const url = process.env.SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_KEY?.trim()

if (!url || !key) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.\n' +
      '  export SUPABASE_URL="https://<project-ref>.supabase.co"\n' +
      '  export SUPABASE_SERVICE_KEY="<service_role key>"\n' +
      'The service key is read from the environment only — never write it to a file.',
  )
  process.exit(1)
}

/** PostgREST request. Throws with the server's message rather than a bare status. */
async function rest(path, init = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} → ${response.status} ${await response.text()}`)
  }
  return response.status === 204 ? null : response.json()
}

/** True when every authored field on the row is empty — nothing worth carrying. */
function isEmpty(row, fields) {
  return fields.every((field) => {
    const value = row[field]
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim() === ''
    if (Array.isArray(value)) return value.length === 0
    return false
  })
}

function pick(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))
}

/** Key separator. `/` appears inside lane names ("Front Stage / Tech"); `§` does not. */
const SEP = '§'

function keyOf(...parts) {
  return parts.map((part) => part ?? '').join(SEP)
}

/**
 * Index rows by a natural key, keeping ambiguity visible.
 *
 * A plain `new Map(rows.map(…))` silently keeps the last row for a repeated
 * key, which is how a restore writes onto the wrong cell. Here a repeated key
 * is recorded instead: the caller can refuse it rather than resolve it.
 */
function indexBy(rows, keyFn) {
  const byKey = new Map()
  const ambiguous = new Set()
  for (const row of rows) {
    const key = keyFn(row)
    if (byKey.has(key)) ambiguous.add(key)
    else byKey.set(key, row.id)
  }
  for (const key of ambiguous) byKey.delete(key)
  return { byKey, ambiguous }
}

/** Nested selects that carry a row up to its phase. */
const PATH_CONTEXT = 'path:paths(name,scenario:scenarios(name,phase:phases(name)))'

function contextOf(row) {
  const scenario = row.path?.scenario
  return {
    phase: scenario?.phase?.name ?? null,
    scenario: scenario?.name ?? null,
    path: row.path?.name ?? null,
  }
}

async function runExport() {
  const cells = await rest(
    `cells?select=${CELL_FIELDS.join(',')},step:steps(name),lane:lanes(name),${PATH_CONTEXT}`,
  )
  const lanes = await rest(
    `lanes?select=name,${LAYER_FIELDS.join(',')},${PATH_CONTEXT}`,
  )
  const phases = await rest(`phases?select=name,${PHASE_FIELDS.join(',')}`)

  const sortKey = (entry, ...fields) => fields.map((f) => entry[f] ?? '').join(SEP)

  const payload = {
    exported_from: url,
    // No timestamp: it would make every export a diff even when nothing
    // changed, and the git history already records when.
    cells: cells
      .filter((row) => !isEmpty(row, CELL_FIELDS))
      .map((row) => ({
        ...contextOf(row),
        lane: row.lane?.name ?? null,
        step: row.step?.name ?? null,
        ...pick(row, CELL_FIELDS),
      }))
      .sort((a, b) =>
        sortKey(a, 'phase', 'scenario', 'path', 'lane', 'step').localeCompare(
          sortKey(b, 'phase', 'scenario', 'path', 'lane', 'step'),
        ),
      ),
    lanes: lanes
      .filter((row) => !isEmpty(row, LAYER_FIELDS))
      .map((row) => ({ ...contextOf(row), lane: row.name, ...pick(row, LAYER_FIELDS) }))
      .sort((a, b) =>
        sortKey(a, 'phase', 'scenario', 'path', 'lane').localeCompare(
          sortKey(b, 'phase', 'scenario', 'path', 'lane'),
        ),
      ),
    phases: phases
      .filter((row) => !isEmpty(row, PHASE_FIELDS))
      .map((row) => ({ phase: row.name, ...pick(row, PHASE_FIELDS) }))
      .sort((a, b) => a.phase.localeCompare(b.phase)),
  }

  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(
    `Exported ${payload.cells.length} cell(s), ${payload.lanes.length} lane(s), ` +
      `${payload.phases.length} phase(s) → docs/authored-fields.json`,
  )
}

async function runRestore(dryRun) {
  const payload = JSON.parse(await readFile(OUTPUT, 'utf8'))

  // One read of the current identity map, so matching is done locally and a
  // miss can be reported precisely instead of failing mid-write.
  const cells = await rest(
    `cells?select=id,step:steps(name),lane:lanes(name),${PATH_CONTEXT}`,
  )
  const lanes = await rest(`lanes?select=id,name,${PATH_CONTEXT}`)
  const phases = await rest('phases?select=id,name')

  const cellIndex = indexBy(cells, (row) => {
    const ctx = contextOf(row)
    return keyOf(ctx.phase, ctx.scenario, ctx.path, row.lane?.name, row.step?.name)
  })
  const layerIndex = indexBy(lanes, (row) => {
    const ctx = contextOf(row)
    return keyOf(ctx.phase, ctx.scenario, ctx.path, row.name)
  })
  const phaseIndex = indexBy(phases, (row) => keyOf(row.name))

  const missing = []
  const ambiguous = []
  const writes = []

  /**
   * Resolve one entry, telling "gone" apart from "matches more than one row".
   *
   * Different failures wanting different responses: a missing key is usually
   * a rename, an ambiguous one is duplicate names in the blueprint itself.
   * Neither is ever resolved by picking a row.
   */
  const resolve = (index, key, label) => {
    const id = index.byKey.get(key)
    if (id) return id
    if (index.ambiguous.has(key)) ambiguous.push(label)
    else missing.push(label)
    return null
  }

  for (const entry of payload.cells ?? []) {
    const label = `cell ${[entry.phase, entry.scenario, entry.path, entry.lane, entry.step]
      .filter(Boolean)
      .join(' / ')}`
    const id = resolve(
      cellIndex,
      keyOf(entry.phase, entry.scenario, entry.path, entry.lane, entry.step),
      label,
    )
    if (id) writes.push({ table: 'cells', id, values: pick(entry, CELL_FIELDS) })
  }
  for (const entry of payload.lanes ?? []) {
    const label = `lane ${[entry.phase, entry.scenario, entry.path, entry.lane]
      .filter(Boolean)
      .join(' / ')}`
    const id = resolve(
      layerIndex,
      keyOf(entry.phase, entry.scenario, entry.path, entry.lane),
      label,
    )
    if (id) writes.push({ table: 'lanes', id, values: pick(entry, LAYER_FIELDS) })
  }
  for (const entry of payload.phases ?? []) {
    const id = resolve(phaseIndex, keyOf(entry.phase), `phase ${entry.phase}`)
    if (id) writes.push({ table: 'phases', id, values: pick(entry, PHASE_FIELDS) })
  }

  if (missing.length > 0) {
    // Reported, never guessed at. A rename is a decision for a human.
    console.error(`\n${missing.length} entr(ies) no longer match anything in the database:`)
    for (const item of missing) console.error(`  · ${item}`)
    console.error('Rename in docs/authored-fields.json, or drop the entry, then re-run.\n')
  }

  if (ambiguous.length > 0) {
    console.error(
      `\n${ambiguous.length} entr(ies) match more than one row and were NOT restored:`,
    )
    for (const item of ambiguous) console.error(`  · ${item}`)
    console.error(
      'Two rows share these names, so nothing can tell which one the content\n' +
        'belongs to. Rename them apart in the blueprint, re-export, then re-run —\n' +
        'restoring onto a guess is worse than not restoring.\n',
    )
  }

  if (dryRun) {
    console.log(`Dry run: would update ${writes.length} row(s).`)
    return missing.length + ambiguous.length > 0 ? 1 : 0
  }

  for (const write of writes) {
    await rest(`${write.table}?id=eq.${write.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(write.values),
    })
  }
  console.log(`Restored ${writes.length} row(s).`)
  return missing.length + ambiguous.length > 0 ? 1 : 0
}

const command = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

try {
  if (command === 'export') {
    await runExport()
  } else if (command === 'restore') {
    process.exitCode = await runRestore(dryRun)
  } else {
    console.error('Usage: authored_fields.mjs export | restore [--dry-run]')
    process.exit(1)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
