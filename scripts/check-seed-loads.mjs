#!/usr/bin/env node
/**
 * #379 — the committed seed loads onto THIS repository's own schema, and renders.
 *
 * The template's `check:deployment-seed-load` asked this deployment's seed to
 * load onto the portable core and got 358 failing statements across all 23
 * seed files. Every one of them was a name this repository had retired in its
 * OWN migration series — `cells.picture`, `cells.links`, `description`,
 * `service_scenarios`, `steps.position` — so the seed would not have loaded
 * onto this repository's schema either. Nothing here asked it to. This does.
 *
 *   npm run check:seed-load
 *
 * The mechanism, and it is deliberately the same shape as the template's:
 *
 *   1. a fresh database, `scripts/replay-prelude.sql`, and every file in
 *      `supabase/migrations/` in filename order — the substrate
 *   2. every file `supabase/config.toml` `[db.seed]` names, IN ITS ORDER
 *   3. the reads a browser makes with the anon key
 *
 * ── Why the substrate is a replay and not a dump ──────────────────────────
 *
 * Because the replay is the only from-scratch schema this repository can
 * build. 157 of its migration files cannot apply against an empty database
 * and never will — the board arrived as imported data, so the series is a
 * narrative rather than a rebuild (ADR 0009). What replays is the DDL, which
 * is exactly and only what a seed needs. The recorded set is held here the
 * way `npm run replay:migrations` holds it: this check fails when a file that
 * was not in `docs/reference/migration-replay-baseline.json` fails now,
 * because then the substrate is not this repository's schema and no verdict
 * about the seed would mean anything.
 *
 * ── Why the seed half does not stop at the first error ────────────────────
 *
 * A seed loads in dependency order, so one broken statement takes a whole
 * subtree with it: a path that never inserted fails every lane's foreign key,
 * and every cell in those lanes then fails `cells_validate_path_match`.
 * Reporting forty of those beside the one column that started it buries the
 * finding. So the seed is applied with the stop switch OFF, every
 * `psql:file:line: ERROR:` is collected, and the groups are printed root
 * causes first with the knock-on ones under a heading that says so.
 *
 * ── What the anon reads prove ─────────────────────────────────────────────
 *
 * Loading is not rendering. Every table the seed inserts into must come back
 * non-empty TO THE ANON ROLE — an empty one is a table the seed wrote and the
 * deployed key cannot see, which is a blank screen in the browser and not a
 * failure `psql` would have reported. Beside them are the two joins the app
 * compiles `PATH_BLUEPRINT_SELECT` and `SERVICE_PHASES_SELECT` down to, plus
 * the two embeds #379 put content into: a cell's placements and a cell's
 * resources. `scripts/check-blueprint-contract.mjs` asks production the same
 * kind of question over PostgREST; this asks a database built from this
 * checkout, which is the half that can run before anything is deployed.
 *
 * ── Why it is not in CI ───────────────────────────────────────────────────
 *
 * It needs a Postgres 17 server and it takes minutes, and neither
 * `.github/workflows/gates.yml` nor `docs-harness.yml` stands one up — the
 * same reason `npm run replay:migrations` is a local instrument. Run it
 * before touching the seed and before a release; docs/engineering/standards.md
 * § Testing and docs/engineering/access-and-security.md § Migrations workflow
 * both say so.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { classifyFailure, errorMessage, ratchetFailures } from './postgres-replay.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS = join(ROOT, 'supabase', 'migrations')
const PRELUDE = join(ROOT, 'scripts', 'replay-prelude.sql')
const BASELINE = join(ROOT, 'docs', 'reference', 'migration-replay-baseline.json')
const SUPABASE = join(ROOT, 'supabase')

const DATABASE = process.env.SEED_CHECK_DATABASE ?? 'uno_seed_check'

// ── What the deployment loads, in what order ───────────────────────────────

/**
 * The `[db.seed]` table of a `config.toml`, as `{ enabled, sqlPaths }` — or
 * null when the file states no such section.
 *
 * A hand-rolled reader rather than a TOML parser, for the reason every check
 * in `scripts/` is dependency-free: the shape read here is one boolean and one
 * array of strings that may wrap across lines. Everything else in the section
 * is ignored on purpose, comments included, which is why the strings are taken
 * from the array's own text rather than from the line.
 */
export function seedSectionFromConfig(toml) {
  const lines = toml.split('\n')
  const start = lines.findIndex((line) => line.trim() === '[db.seed]')
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => /^\s*\[/.test(line))
  // Whole-line comments go first, and the reason is this file specifically:
  // `supabase/config.toml` ships commented-out examples of nearly every key it
  // has, so a commented `sql_paths` above the live one would otherwise be the
  // list this check reads — and it would report a seed nobody loads.
  const body = (end === -1 ? rest : rest.slice(0, end))
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')

  const enabled = !/^\s*enabled\s*=\s*false/m.test(body)
  const array = body.match(/sql_paths\s*=\s*\[([\s\S]*?)\]/)
  if (!array) return { enabled, sqlPaths: [] }
  const sqlPaths = [...array[1].matchAll(/"([^"]*)"|'([^']*)'/g)]
    .map((m) => m[1] ?? m[2])
    .filter((path) => path !== '')
  return { enabled, sqlPaths }
}

/**
 * The config's entries as paths relative to `supabase/`, with `*` patterns
 * expanded against `list(dir)`. The format allows a glob and a deployment
 * that used one would otherwise load nothing; expansion is sorted, so a
 * glob's order is stable rather than filesystem order.
 */
export function expandSeedEntries(entries, list) {
  const out = []
  for (const entry of entries) {
    const clean = entry.replace(/^\.\//, '')
    if (!clean.includes('*')) {
      out.push(clean)
      continue
    }
    const dir = dirname(clean)
    const pattern = new RegExp(
      `^${basename(clean).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
    )
    for (const name of list(dir === '.' ? '' : dir).sort()) {
      if (pattern.test(name)) out.push(dir === '.' ? name : `${dir}/${name}`)
    }
  }
  return out
}

/**
 * Every file the seed loads, absolute, in order.
 *
 * `[db.seed].sql_paths` IS the seed — `supabase/seed.sql` is only its first
 * entry, and 22 scenario files follow it, each loaded after the file that
 * created the service they hang off. A check that read `seed.sql` alone would
 * pass on a fifteenth of the content.
 */
export function resolveSeedFiles(supabaseDir = SUPABASE) {
  const config = join(supabaseDir, 'config.toml')
  if (!existsSync(config)) return []
  const section = seedSectionFromConfig(readFileSync(config, 'utf8'))
  if (!section || !section.enabled || section.sqlPaths.length === 0) return []
  const list = (sub) => {
    try {
      return readdirSync(join(supabaseDir, sub))
    } catch {
      return []
    }
  }
  return expandSeedEntries(section.sqlPaths, list)
    .map((rel) => join(supabaseDir, rel))
    .filter((file) => existsSync(file) && statSync(file).isFile())
}

// ── Reading what psql said ─────────────────────────────────────────────────

/** `psql:<file>:<line>: ERROR:  <message>` — the only line shape that matters. */
export const PSQL_ERROR = /^psql:(.+):(\d+): ERROR:\s+(.*)$/

/** Every failing statement psql reported, as `{ file, line, message }`. */
export function parsePsqlErrors(stderr) {
  const failures = []
  for (const line of stderr.split('\n')) {
    const match = PSQL_ERROR.exec(line.trim())
    if (match) failures.push({ file: match[1], line: Number(match[2]), message: match[3] })
  }
  return failures
}

/**
 * Is this failure a consequence of an earlier one rather than a finding?
 *
 * Three shapes, and they are the whole knock-on surface. A lane whose path
 * never inserted fails its foreign key. Every cell in that lane then fails
 * `cells_validate_path_match`, which raises `cells: …` rather than a
 * constraint name. And a file loaded inside one transaction refuses every
 * statement after the first failure outright.
 */
export function isDownstream(message) {
  return (
    /violates foreign key constraint/.test(message) ||
    /^cells[.:]/.test(message) ||
    /current transaction is aborted/.test(message)
  )
}

/** Failures collapsed to distinct reasons, root causes first, commonest first. */
export function groupFailures(failures) {
  const byMessage = new Map()
  for (const failure of failures) {
    const group = byMessage.get(failure.message) ?? {
      message: failure.message,
      downstream: isDownstream(failure.message),
      count: 0,
      examples: [],
    }
    group.count += 1
    if (group.examples.length < 3) group.examples.push(`${failure.file}:${failure.line}`)
    byMessage.set(failure.message, group)
  }
  return [...byMessage.values()].sort(
    (a, b) => Number(a.downstream) - Number(b.downstream) || b.count - a.count,
  )
}

// ── Reading the loaded content back, as the deployed key ───────────────────

/** Tables the seed inserts into, in first-mention order. */
export function seededTables(sql) {
  const tables = []
  for (const match of sql.matchAll(/insert\s+into\s+public\.([a-z_][a-z0-9_]*)/gi)) {
    const table = match[1].toLowerCase()
    if (!tables.includes(table)) tables.push(table)
  }
  return tables
}

/**
 * The joins the app's own selects compile to.
 *
 * `@grid` is `PATH_BLUEPRINT_SELECT` (src/lib/workflowQueries.ts) and
 * `@hierarchy` is `SERVICE_PHASES_SELECT` (src/hooks/useServicePhases.ts) —
 * the two reads that draw a board and its navigation. `@placement` and
 * `@resource` are the two embeds inside the first that #379 filled: the
 * touchpoint placements `cells.links` used to carry, and the resources it
 * carried beside them. Both would be silently empty if the regeneration had
 * dropped that content instead of moving it.
 */
export const RENDER_READS = {
  '@grid':
    'select count(*) from public.paths p ' +
    'join public.path_steps ps on ps.path_id = p.id ' +
    'join public.steps s on s.id = ps.step_id ' +
    'join public.cells c on c.step_id = s.id and c.path_id = p.id ' +
    'join public.lanes l on l.id = c.lane_id',
  '@hierarchy':
    'select count(*) from public.services sv ' +
    'join public.phases ph on ph.service_id = sv.id ' +
    'join public.scenarios sc on sc.phase_id = ph.id ' +
    'join public.paths pa on pa.scenario_id = sc.id',
  '@placement':
    'select count(*) from public.cells c ' +
    'join public.cell_touchpoints ct on ct.cell_id = c.id',
  '@resource':
    'select count(*) from public.cells c join public.resources r on r.cell_id = c.id',
}

export const RENDER_READ_NAMES = {
  '@grid': 'the blueprint grid',
  '@hierarchy': 'the service hierarchy',
  '@placement': "a cell's touchpoint placements",
  '@resource': "a cell's resources",
}

/** The single `label|count` query, run as `anon`. */
export function buildInventorySql(tables) {
  const rows = [
    ...tables.map((t) => `select '${t}'::text as t, count(*)::bigint as n from public.${t}`),
    ...Object.entries(RENDER_READS).map(
      ([label, sql]) => `select '${label}', n from (${sql}) as ${label.slice(1)}(n)`,
    ),
  ]
  return `set role anon;\n${rows.join('\nunion all\n')}\norder by t;`
}

/** `label|count` lines to a Map. */
export function parseCounts(stdout) {
  const counts = new Map()
  for (const line of stdout.split('\n')) {
    const [label, value] = line.split('|')
    if (label && value !== undefined) counts.set(label.trim(), Number(value))
  }
  return counts
}

/** What is empty that the seed populated, and what does not render. */
export function evaluate(counts, tables) {
  const problems = []
  for (const table of tables) {
    const n = counts.get(table)
    if (n === undefined) {
      problems.push(`public.${table} returned no row — the anon read never reached it`)
    } else if (n === 0) {
      problems.push(
        `public.${table} is empty as anon — the seed writes it, but the deployed key ` +
          `cannot see a row of it`,
      )
    }
  }
  for (const label of Object.keys(RENDER_READS)) {
    if (!counts.get(label)) {
      problems.push(
        `${RENDER_READ_NAMES[label] ?? label} (${label}) returned no rows — the seed's ` +
          `content loaded but does not render`,
      )
    }
  }
  return problems
}

// ── Running it ─────────────────────────────────────────────────────────────

/**
 * Homebrew's Postgres is keg-only, so the binaries are installed and not on
 * `PATH`. `scripts/replay-migrations.mjs` searches these same directories for
 * the same reason; a second copy of the list is cheaper than exporting one
 * from a script whose module scope runs a replay.
 */
const BIN_DIRS = [
  '/opt/homebrew/opt/postgresql@17/bin',
  '/opt/homebrew/opt/libpq/bin',
  '/usr/local/opt/postgresql@17/bin',
  '/usr/local/opt/libpq/bin',
]

function resolveBinary(name) {
  for (const dir of BIN_DIRS) {
    const candidate = join(dir, name)
    if (existsSync(candidate)) return candidate
  }
  return name
}

const PSQL = resolveBinary('psql')
const CREATEDB = resolveBinary('createdb')
const DROPDB = resolveBinary('dropdb')

function run(binary, args, extraEnv = {}) {
  return spawnSync(binary, args, {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    maxBuffer: 64 * 1024 * 1024,
  })
}

function psql(args, { stopOnError = true } = {}) {
  return run(
    PSQL,
    ['-X', '-q', '-v', `ON_ERROR_STOP=${stopOnError ? 1 : 0}`, '-d', DATABASE, ...args],
    { PGOPTIONS: '--client-min-messages=warning' },
  )
}

function requireServer() {
  const probe = run(PSQL, ['-d', 'postgres', '-tAc', 'select 1'])
  if (probe.status === 0) return true
  const detail = (probe.stderr ?? '').trim() || probe.error?.message || 'unknown error'
  console.error(
    `[seed] no Postgres to load into: ${detail}\n` +
      `[seed] start one with:\n` +
      `         brew install postgresql@17 pgvector\n` +
      `         LC_ALL="en_US.UTF-8" pg_ctl -D /opt/homebrew/var/postgresql@17 start`,
  )
  return false
}

/** The substrate: prelude plus every migration, one transaction each. */
function buildSchema() {
  run(DROPDB, ['--if-exists', DATABASE])
  const created = run(CREATEDB, [DATABASE])
  if (created.status !== 0) {
    console.error(`[seed] could not create ${DATABASE}: ${(created.stderr ?? '').trim()}`)
    return null
  }
  run(PSQL, ['-q', '-d', DATABASE, '-c',
    `alter database ${DATABASE} set search_path = public, extensions`])
  const prelude = psql(['-f', PRELUDE])
  if (prelude.status !== 0) {
    console.error(`[seed] the prelude itself failed:\n${(prelude.stderr ?? '').trim()}`)
    return null
  }

  const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()
  const failures = []
  for (const file of files) {
    const applied = run(PSQL, [
      '-q', '-X', '-v', 'ON_ERROR_STOP=1', '-d', DATABASE,
      '--single-transaction', '-f', join(MIGRATIONS, file),
    ])
    if (applied.status === 0) continue
    const error = (applied.stderr ?? '').split('\n').find((line) => line.includes('ERROR:'))
    failures.push({ file, error: error ?? (applied.stderr ?? '').trim().split('\n')[0] ?? '' })
  }
  return { total: files.length, failures }
}

function main() {
  const files = resolveSeedFiles()
  if (files.length === 0) {
    console.error(
      '[seed] supabase/config.toml names no seed files under [db.seed].sql_paths. ' +
        'That list IS the seed; without it there is nothing to check.',
    )
    process.exitCode = 1
    return
  }
  if (!requireServer()) {
    process.exitCode = 1
    return
  }

  try {
    const built = buildSchema()
    if (!built) {
      process.exitCode = 1
      return
    }

    let baseline = null
    try {
      baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
    } catch {
      baseline = null
    }
    if (!baseline) {
      console.error(
        `[seed] no replay baseline at ${relative(ROOT, BASELINE)}. Record one with ` +
          '`npm run replay:migrations -- --update` first — without it there is no way to ' +
          'tell a substrate this repository expects from one that just broke.',
      )
      process.exitCode = 1
      return
    }
    const { newlyFailing } = ratchetFailures(built.failures, baseline)
    if (newlyFailing.length > 0) {
      console.error(
        `[seed] the substrate is not this repository's schema: ${newlyFailing.length} ` +
          `migration(s) failed that the replay baseline does not record.\n  ` +
          newlyFailing
            .map((file) => {
              const failure = built.failures.find((f) => f.file === file)
              return `${file} — ${classifyFailure(failure?.error)}: ${errorMessage(failure?.error)}`
            })
            .join('\n  ') +
          '\n[seed] that is `npm run replay:migrations`\'s failure, not the seed\'s. Fix it there.',
      )
      process.exitCode = 1
      return
    }
    console.log(
      `[seed] substrate: ${built.total - built.failures.length}/${built.total} migrations ` +
        `applied (${built.failures.length} recorded as unable to replay — ADR 0009)`,
    )

    const failures = []
    for (const file of files) {
      const loaded = psql(['-f', file], { stopOnError: false })
      failures.push(...parsePsqlErrors(loaded.stderr ?? ''))
    }

    if (failures.length > 0) {
      const groups = groupFailures(failures)
      const causes = groups.filter((g) => !g.downstream)
      const knockOn = groups.filter((g) => g.downstream)
      const touched = new Set(failures.map((f) => f.file))
      const show = (path) => relative(ROOT, path)
      console.error(
        `\nThe committed seed does not load onto this repository's own schema: ` +
          `${failures.length} statement${failures.length === 1 ? '' : 's'} failed across ` +
          `${touched.size} of ${files.length} seed files.\n`,
      )
      console.error(`Root causes (${causes.length} distinct):\n`)
      for (const g of causes) {
        console.error(`  ${g.count}x  ${g.message}`)
        console.error(`        ${g.examples.map(show).join(', ')}`)
      }
      if (knockOn.length > 0) {
        console.error(
          `\nKnock-on (${knockOn.length} distinct) — rows an earlier failure never inserted:\n`,
        )
        for (const g of knockOn) {
          console.error(`  ${g.count}x  ${g.message}`)
          console.error(`        ${g.examples.map(show).join(', ')}`)
        }
      }
      console.error(
        `\nEvery root cause here is one of two things, and the message says which:\n` +
          `  - a name this repository RETIRED in its own migration series, which the seed\n` +
          `    still writes — the seed is behind. \`scripts/retired-vocabulary.mjs\`\n` +
          `    RENAME_MAP is the authority for what it became;\n` +
          `  - a column or table the schema genuinely lacks — then the migration is\n` +
          `    missing, not the seed.\n` +
          `Reproduce by hand with:\n` +
          `  createdb scratch\n` +
          `  psql -v ON_ERROR_STOP=1 -d scratch -f scripts/replay-prelude.sql\n` +
          `  for f in supabase/migrations/*.sql; do psql -q -d scratch --single-transaction -f "$f"; done\n` +
          `  psql -d scratch -f ${show(files[0])}   # then the rest, in config.toml's order`,
      )
      process.exitCode = 1
      return
    }

    const tables = seededTables(files.map((file) => readFileSync(file, 'utf8')).join('\n'))
    const inventory = psql(['-At', '-F', '|', '-c', buildInventorySql(tables)])
    if (inventory.status !== 0) {
      console.error('The seed applied, but the anon read was refused:\n')
      console.error(inventory.stderr?.trim() ?? '')
      process.exitCode = 1
      return
    }
    const problems = evaluate(parseCounts(inventory.stdout ?? ''), tables)
    if (problems.length > 0) {
      console.error('The seed loaded, but a keyless read does not see the content:\n')
      for (const problem of problems) console.error(`  ${problem}`)
      console.error(
        '\nThis is the deployed app reading with the anon key. A table it cannot see ' +
          'renders blank in the browser. Expose it to anon in a migration ' +
          '(`grant select … to anon` plus a select policy) — `check:new-table-grants` ' +
          'is where that debt is collected.',
      )
      process.exitCode = 1
      return
    }
    console.log(
      `the committed seed (${files.length} files under supabase/) loads on a fresh replay ` +
        `of the migration series with zero failing statements, and renders as anon ` +
        `(${tables.length} tables populated, ${Object.keys(RENDER_READS).length} render ` +
        `reads return rows)`,
    )
  } finally {
    run(DROPDB, ['--if-exists', DATABASE])
  }
}

// Compared against a resolved path rather than a hand-built `file://` URL:
// the URL form silently no-ops whenever the path needs escaping.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
