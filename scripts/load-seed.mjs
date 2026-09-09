#!/usr/bin/env node
/**
 * #547 — the seed has one named way in, and it is this file.
 *
 * The seed used to be `supabase/config.toml` `[db.seed].sql_paths`, which is
 * not a list so much as a switch: four Supabase CLI subcommands read it, and
 * only one of them has the word "reset" in its name. `db reset --linked`,
 * `db reset --db-url`, and — the sharp one — `db push --include-seed`, whose
 * `--linked` IS the default and which is otherwise the ordinary way to ship
 * migrations. Any of them loaded 23 files at whatever the CLI was pointed at.
 *
 * What those files do on arrival is not "insert some demo rows". Six deletes
 * live in `supabase/seed.sql` and 86 more across the 22 scenario files, and
 * the deletes are the smaller half: every insert is keyed by a hand-minted id
 * under `on conflict … do update`, 183 of them, so a load onto a populated
 * database is an UPSERT. Zero errors, zero duplicates, and every column the
 * seed carries silently rewritten. A measured trial with all 92 deletes
 * stripped still destroyed 706 authored `cells.content` values.
 *
 * So `[db.seed]` names nothing now, and is disabled besides. Loading the seed
 * is this script, with a connection string typed on purpose and `--apply`
 * typed after it — the shape `scripts/apply-pending.mjs` already uses for the
 * other command in this repository that writes to a database.
 *
 * This is the FENCE. The SAFETY is in `supabase/seed.sql`, which opens with a
 * guard that refuses when the target already holds authored work, and that
 * guard is in SQL rather than here precisely so routing around this script
 * does not route around it.
 *
 *   SUPABASE_DB_URL=postgresql://… npm run seed:load            # the plan
 *   SUPABASE_DB_URL=postgresql://… npm run seed:load -- --apply # the load
 *
 * ── One transaction for all 23 files ──────────────────────────────────────
 *
 * psql takes repeated `-f`, and `--single-transaction` wraps the lot. A seed
 * that fails at file 19 with 18 committed is a database in a state no file
 * describes — the phases rebuilt, half the scenarios rewritten, and no way to
 * tell by looking. Either the whole board lands or none of it does.
 *
 * `scripts/check-seed-loads.mjs` deliberately does the opposite — one file at
 * a time with the stop switch OFF — because its job is to report EVERY
 * failing statement rather than the first. Two callers, two jobs; this one
 * loads and that one diagnoses.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SUPABASE = join(ROOT, 'supabase')

/**
 * The seed, in load order. Paths are relative to `supabase/`.
 *
 * Order is a dependency order, not an alphabet: `seed.sql` creates the service,
 * its phases and their scenarios, and each scenario file hangs paths, lanes,
 * steps and cells off what an earlier file created. Reordering this list
 * breaks foreign keys, which is why it is a list and not a glob.
 *
 * Copied verbatim from the `[db.seed].sql_paths` this replaced, so the change
 * that removed the CLI's reach did not also change what loads.
 */
export const SEED_FILES = [
  'seed.sql',
  'seeds/application_discovery_happy_path.sql',
  'seeds/application_discovery_sad_path.sql',
  'seeds/application_interview_happy_path.sql',
  'seeds/onboarding_tech_setup_happy_path.sql',
  'seeds/onboarding_modules_happy_path.sql',
  'seeds/lesson_modules_happy_path.sql',
  'seeds/onboarding_session_sign_up_happy_path.sql',
  'seeds/pre_session_standard_scheduling_happy_path.sql',
  'seeds/pre_session_fill_in_request_happy_path.sql',
  'seeds/pre_session_call_off_request_happy_path.sql',
  'seeds/in_session_before_students_join_happy_path.sql',
  'seeds/in_session_students_just_joined_happy_path.sql',
  'seeds/in_session_goal_setting_happy_path.sql',
  'seeds/in_session_goal_setting_detailed_path.sql',
  'seeds/in_session_goal_setting_check_update_paths.sql',
  'seeds/in_session_goal_setting_set_goals_edge_case.sql',
  'seeds/in_session_goal_setting_updated_goals_edge_case.sql',
  'seeds/goal_setting_parallel_session_pictures.sql',
  'seeds/in_session_help_request_happy_path.sql',
  'seeds/in_session_wrap_up_happy_path.sql',
  'seeds/warm_up_happy_path.sql',
  'seeds/warm_up_alternate_path.sql',
]

/**
 * Files that sit in `supabase/seeds/` and are NOT part of the seed.
 *
 * They were not part of it before this change either — `[db.seed].sql_paths`
 * named 22 of the 25 files in that directory, so these three have never been
 * loaded by anything and `check:seed-load` has never held them to the schema.
 * Nothing said so, because a list that omits a file omits it silently.
 *
 * Stating them here does not adopt them and does not fix them; it converts a
 * silent omission into one a reader can see and `scripts/tests/seed-loads.test.mjs`
 * can hold, by asserting that this list plus SEED_FILES accounts for the
 * directory exactly. A fourth file appearing untethered now fails a test.
 * Whether these three should join the seed is a separate question and a
 * separate issue — this one had no standing to answer it.
 */
export const NOT_LOADED = [
  {
    file: 'seeds/post_session_reporting_an_issue_happy_path.sql',
    reason:
      'Post-session → Reporting an Issue. Never named by [db.seed].sql_paths; ' +
      'unverified against the current schema.',
  },
  {
    file: 'seeds/post_session_reporting_hours_happy_path.sql',
    reason:
      'Post-session → Reporting Hours. Never named by [db.seed].sql_paths; ' +
      'unverified against the current schema.',
  },
  {
    file: 'seeds/warm_up_front_stage_tech_pictures.sql',
    reason:
      'Frame URLs for Warm-Up Front Stage Tech cells, the sibling of ' +
      'goal_setting_parallel_session_pictures.sql, which IS loaded. Never named ' +
      'by [db.seed].sql_paths.',
  },
]

/** Every file the seed loads, absolute, in order. */
export function resolveSeedFiles(supabaseDir = SUPABASE) {
  return SEED_FILES.map((rel) => join(supabaseDir, rel)).filter(
    (file) => existsSync(file) && statSync(file).isFile(),
  )
}

// ── Running it ─────────────────────────────────────────────────────────────

/**
 * Homebrew's Postgres is keg-only, so the binaries are installed and not on
 * `PATH`. The same list, for the same reason, as `check-seed-loads.mjs` and
 * `replay-migrations.mjs`.
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

function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const flagged = args.find((arg) => arg.startsWith('--db-url='))?.slice('--db-url='.length)
  const url = flagged ?? process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL

  if (!url) {
    console.error(
      'load-seed needs a connection string: --db-url=…, SUPABASE_DB_URL or DATABASE_URL.\n' +
        'It is typed rather than defaulted on purpose — the Supabase CLI defaulting to\n' +
        '`--linked` is what made `db push --include-seed` able to load this seed into a\n' +
        'deployment (#547). There is no default here, and there will not be one.',
    )
    process.exitCode = 1
    return
  }

  const files = resolveSeedFiles()
  const missing = SEED_FILES.filter((rel) => !existsSync(join(SUPABASE, rel)))
  if (missing.length > 0) {
    console.error(
      `load-seed names ${missing.length} file(s) that are not on disk, so the seed is\n` +
        `incomplete and none of it will be loaded:\n  ${missing.join('\n  ')}`,
    )
    process.exitCode = 1
    return
  }

  console.log(`[seed] ${files.length} files, in order:`)
  for (const file of files) console.log(`         ${relative(ROOT, file)}`)
  if (NOT_LOADED.length > 0) {
    console.log(
      `[seed] ${NOT_LOADED.length} file(s) under supabase/seeds/ are NOT part of the seed:`,
    )
    for (const entry of NOT_LOADED) console.log(`         supabase/${entry.file} — ${entry.reason}`)
  }

  if (!apply) {
    console.log(
      '\n[seed] dry run. Nothing was sent. Add --apply to load.\n' +
        '[seed] supabase/seed.sql opens with a guard that refuses on a database already\n' +
        '       holding authored work — export it first with\n' +
        '       `node scripts/authored_fields.mjs export` if that is where you are pointed.',
    )
    return
  }

  const loaded = spawnSync(
    resolveBinary('psql'),
    [
      url,
      '--single-transaction',
      '-X',
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
      ...files.flatMap((file) => ['-f', file]),
    ],
    { encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit'], maxBuffer: 64 * 1024 * 1024 },
  )

  if (loaded.status !== 0) {
    console.error(
      `\n[seed] nothing was loaded — the transaction rolled back. If the message above is\n` +
        `       the seed's own refusal, this database holds authored work and the seed\n` +
        `       would have overwritten it; \`node scripts/authored_fields.mjs export\`\n` +
        `       first. Otherwise \`npm run check:seed-load\` reports every failing\n` +
        `       statement rather than the first.`,
    )
    process.exitCode = loaded.status ?? 1
    return
  }
  console.log(`[seed] loaded ${files.length} files in one transaction.`)
}

// Compared against a resolved path rather than a hand-built `file://` URL:
// the URL form silently no-ops whenever the path needs escaping.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
