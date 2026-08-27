#!/usr/bin/env node
/**
 * Give every cell its key, and repoint the slices that reference it.
 *
 * Why: `slice_items.cell_keys` is how a slice survives a scenario re-import —
 * the import deletes and recreates every `cells` row, so ids change and keys
 * do not. That only works if the stored keys match what a cell can say about
 * itself, and today they do not. Three conventions are in the table at once
 * (raw UUIDs, and two abbreviation styles), none matching what
 * `mint_cell_key` produces. Until this runs, recovery is decorative: undo
 * cannot put back what it cannot match.
 *
 * The canonical key is what the migration's `mint_cell_key` builds. The
 * statement of record for its shape is the comment on `public.cells.cell_key`
 * (set by `20260826110000`): five slugified segments,
 * service/scenario/path/lane/step, with no phase segment. This file used to
 * call the third segment a "version", which is not a level the model has —
 * it is the path, and always was.
 *
 * The path segment is the path's **name**. `path_type` looked right — the
 * seeded keys read `warm-up/happy/...` — but several paths through one
 * scenario routinely share a type: Goal Setting has five all typed `named`.
 * Measured against this database, keying on type collides on 167 of 737 cells
 * and keying on name collides on 17. Those 17 are a real data defect
 * (Discovery holds five distinct steps all named "Discovers PLUS"), not a
 * flaw in the key, and they are reported rather than resolved.
 *
 * Usage:
 *   export SUPABASE_URL="https://<ref>.supabase.co"
 *   export SUPABASE_SERVICE_KEY="<service_role key>"   # never written to disk
 *   node scripts/backfill_cell_keys.mjs plan            # read-only, safe now
 *   node scripts/backfill_cell_keys.mjs apply           # needs the migration
 *
 * `plan` needs only read access and can be run before the migration lands —
 * it reports what `apply` would do and, more usefully, what it could not
 * resolve. Anything unresolved is left alone rather than guessed at: a slice
 * pointed at the wrong cell is worse than a slice that admits it is orphaned.
 */

const url = process.env.SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_KEY?.trim()

if (!url || !key) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.\n' +
      '  export SUPABASE_URL="https://<project-ref>.supabase.co"\n' +
      '  export SUPABASE_SERVICE_KEY="<service_role key>"\n' +
      'For `plan`, a read-only key is enough.',
  )
  process.exit(1)
}

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
    throw new Error(
      `${init.method ?? 'GET'} ${path} → ${response.status} ${await response.text()}`,
    )
  }
  return response.status === 204 ? null : response.json()
}

/** Same rule as the migration's `key_slug`. Kept in step deliberately. */
function slug(value) {
  return (
    String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || null
  )
}

function canonicalKey(row) {
  const parts = [
    slug(row.service),
    slug(row.scenario),
    slug(row.pathName) ?? slug(row.pathType),
    slug(row.lane),
    slug(row.step),
  ]
  return parts.join('/')
}

/** Everything needed to key a cell, flattened from the nested read. */
async function loadCells() {
  const rows = await rest(
    'cells?select=id,lane:lanes(name),step:steps(name),' +
      'path:paths(name,path_type,scenario:scenarios(name,' +
      'phase:phases(service:services(name))))',
  )
  return rows.map((row) => {
    const path = row.path ?? {}
    const scenario = path.scenario ?? {}
    const service = scenario.phase?.service ?? {}
    return {
      id: row.id,
      service: service.name,
      scenario: scenario.name,
      pathType: path.path_type,
      pathName: path.name,
      lane: row.lane?.name,
      step: row.step?.name,
    }
  })
}

function report(title, entries) {
  console.log(`\n${title} (${entries.length})`)
  for (const entry of entries.slice(0, 8)) console.log(`  · ${entry}`)
  if (entries.length > 8) console.log(`  … and ${entries.length - 8} more`)
}

async function run(mode) {
  const cells = await loadCells()
  const keyed = cells.map((cell) => ({ ...cell, key: canonicalKey(cell) }))

  // A key that names two cells cannot identify either. Those are left null:
  // the column's partial unique index would reject the second one anyway, and
  // a cell with no key is honest where a shared key is not.
  const byKey = new Map()
  for (const cell of keyed) {
    byKey.set(cell.key, (byKey.get(cell.key) ?? 0) + 1)
  }
  const unique = keyed.filter((cell) => byKey.get(cell.key) === 1)
  const colliding = keyed.filter((cell) => byKey.get(cell.key) > 1)

  console.log(`Cells: ${cells.length}`)
  console.log(`  keyable:   ${unique.length}`)
  console.log(`  colliding: ${colliding.length}  (left without a key)`)

  if (colliding.length > 0) {
    const groups = [...new Set(colliding.map((cell) => cell.key))]
    report('Keys naming more than one cell', groups)
    console.log(
      '\n  These are duplicate names inside one path. Rename them apart in\n' +
        '  the blueprint and re-run — nothing else can tell them apart.',
    )
  }

  // Slices: map each stored key onto a canonical one where possible.
  const items = await rest('slice_items?select=id,slice_id,cell_ids,cell_keys')
  const canonicalById = new Map(unique.map((cell) => [cell.id, cell.key]))

  let resolved = 0
  const orphans = []
  const rewrites = []

  for (const item of items) {
    const ids = item.cell_ids ?? []
    const next = ids.map((id) => canonicalById.get(id) ?? null)
    next.forEach((value, index) => {
      if (value) resolved += 1
      else orphans.push(`${item.slice_id} → cell ${ids[index]}`)
    })
    const before = JSON.stringify(item.cell_keys ?? [])
    if (before !== JSON.stringify(next)) {
      rewrites.push({ id: item.id, cell_keys: next })
    }
  }

  console.log(`\nSlice frames: ${items.length}`)
  console.log(`  keys resolvable: ${resolved}`)
  console.log(`  unresolvable:    ${orphans.length}`)
  console.log(`  frames to rewrite: ${rewrites.length}`)
  if (orphans.length > 0) {
    report('Frames whose cell no longer exists (left null)', orphans)
  }

  if (mode === 'plan') {
    console.log('\nPlan only — nothing written. Re-run with `apply` after the migration.')
    return orphans.length > 0 ? 1 : 0
  }

  // apply -------------------------------------------------------------------
  console.log('\nWriting cells.cell_key…')
  for (let i = 0; i < unique.length; i += 200) {
    const batch = unique.slice(i, i + 200)
    await Promise.all(
      batch.map((cell) =>
        rest(`cells?id=eq.${cell.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ cell_key: cell.key }),
        }),
      ),
    )
  }

  console.log('Rewriting slice_items.cell_keys…')
  for (const rewrite of rewrites) {
    await rest(`slice_items?id=eq.${rewrite.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ cell_keys: rewrite.cell_keys }),
    })
  }

  console.log(`\nDone. ${unique.length} cells keyed, ${rewrites.length} frames rewritten.`)
  return orphans.length > 0 ? 1 : 0
}

const mode = process.argv[2]
if (mode !== 'plan' && mode !== 'apply') {
  console.error('Usage: backfill_cell_keys.mjs plan | apply')
  process.exit(1)
}

try {
  process.exitCode = await run(mode)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
