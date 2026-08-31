#!/usr/bin/env node
/**
 * "Merged" and "applied" are two different facts, and only one of them had a
 * button.
 *
 * Twenty pull requests merged on 2026-08-31 and every one of their
 * descriptions ends with the same sentence: not applied to production. Eight
 * of those migrations were then applied by hand, in series order, each in one
 * transaction with its ledger row written inside it — and four still are not.
 * That procedure is exactly the kind a person gets wrong once: the order
 * matters (`20260830290000` takes privileges away and must go last), and a
 * ledger row written outside its migration's transaction is how #148's drift
 * happens again.
 *
 * So it gets a script. This does not decide anything — it reads the ledger,
 * lists what the repository has that the database does not, and applies them
 * in filename order, stopping at the first failure.
 *
 * ── It refuses to apply "everything unrecorded", and that is the point ────
 *
 * The obvious design is wrong and dangerously so. **172 of this repository's
 * 843 files have no ledger row**, and only four of them are actually pending:
 * the rest ran years ago over MCP `apply_migration`, which stamped the apply
 * time as the version, so the ledger records them under identities the files
 * cannot be matched to. That is #148 in one sentence, and it means "no ledger
 * row" does NOT mean "not yet applied".
 *
 * So this script will not run without an explicit `--from <version>`. There is
 * no flag that means "all of it". A tool that offered one would eventually be
 * used, and it would re-run the creation of a schema that already exists.
 *
 * `--dry-run` is the default even then. Applying is `--apply`, typed by a
 * person who has read the list. This exists to make a careful thing
 * repeatable, not to make an irreversible thing easy.
 *
 * ── The version it records is the FILENAME's ─────────────────────────────
 *
 * Not `now()`. That distinction is the whole of #148: the schema went in over
 * MCP `apply_migration`, which stamps the apply time, so not one of this
 * repository's 843 versions appears in a ledger of 709 rows. A row written
 * here is written under the version the file is named for, which is what makes
 * `check:migration-ledger:live` able to see it.
 *
 * ── One transaction per file, which is what Supabase does ────────────────
 *
 * `--single-transaction`, with the ledger insert appended INSIDE it. A
 * migration whose assertion fires therefore leaves no ledger row claiming it
 * ran — the failure mode that would otherwise convert a red migration into a
 * permanent silent gap. `scripts/replay-migrations.mjs` makes the same choice
 * and says why at greater length.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readLedger } from './check-migration-ledger.mjs'
import { ledgerDrift, parseMigrationFiles } from './migration-ledger.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations')

/**
 * Repository files with no ledger row, in filename order.
 *
 * Deliberately NOT "everything after the highest applied version". The ledger
 * holds 38 rows with no file and the series holds versions the ledger never
 * saw, so a high-water mark would skip real work in both directions.
 *
 * The comparison itself is `ledgerDrift`'s and is not reimplemented here.
 * Matching a row to a file has two shapes — bare name, and
 * `version_name` — and a second reader that handled only one would silently
 * re-apply migrations that had already run. `migration-ledger.mjs` says that
 * where it defines the matcher: "both populations, in one place, so no caller
 * can accidentally handle only one."
 */
export function pending(files, ledger, from) {
  if (!from) throw new Error('pending() needs a --from version; there is no "all" here')
  const parsed = parseMigrationFiles(files)
  const { neverApplied } = ledgerDrift({ files: parsed, ledger })
  const byFile = new Map(parsed.map((entry) => [entry.file, entry]))
  return neverApplied
    .map((file) => byFile.get(file))
    .filter((entry) => entry.version >= from)
    .sort((a, b) => a.version.localeCompare(b.version))
}

/** How many unrecorded files the cutoff is holding back, for the plan. */
export function withheld(files, ledger, from) {
  const parsed = parseMigrationFiles(files)
  const { neverApplied } = ledgerDrift({ files: parsed, ledger })
  const byFile = new Map(parsed.map((entry) => [entry.file, entry]))
  return neverApplied.map((file) => byFile.get(file)).filter((entry) => entry.version < from).length
}

/** The insert that goes in the same transaction as the migration itself. */
export function ledgerInsert(version, name) {
  const quoted = (value) => `'${String(value).replaceAll("'", "''")}'`
  return `insert into supabase_migrations.schema_migrations (version, name) values (${quoted(version)}, ${quoted(name)}) on conflict (version) do nothing;`
}

function applyOne(url, entry) {
  const body = fs.readFileSync(path.join(MIGRATIONS, entry.file), 'utf8')
  const script = `${body}\n\n-- written by scripts/apply-pending.mjs, inside this file's own transaction\n${ledgerInsert(entry.version, entry.name)}\n`
  execFileSync('psql', [url, '--single-transaction', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'], {
    input: script,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apply = process.argv.includes('--apply')
  const fromArg = process.argv.find((a) => a.startsWith('--from='))
  const from = fromArg ? fromArg.slice('--from='.length) : null
  const url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error(
      'needs SUPABASE_DB_URL (a direct postgres:// connection). It lives in .env.local, ' +
        'which is gitignored: set -a; . ./.env.local; set +a',
    )
    process.exit(1)
  }

  if (!from) {
    console.error(
      'this needs --from=<version>, and there is deliberately no flag meaning "all".\n\n' +
        'Most files with no ledger row are not pending: they ran over MCP ' +
        '`apply_migration`, which stamped the apply time as the version, so the ledger ' +
        'records them under identities no file can be matched to. That is #148. Running ' +
        'them again would re-create a schema that already exists.\n\n' +
        'Pick the cutoff by reading `git log` for the first migration that has not been ' +
        'applied, e.g. --from=20260830260000',
    )
    process.exit(1)
  }

  const files = fs.readdirSync(MIGRATIONS)
  const ledger = readLedger(url)
  const queue = pending(files, ledger, from)
  const held = withheld(files, ledger, from)
  if (queue.length === 0) {
    console.log(`ok — every migration file at or after ${from} has a ledger row`)
    process.exit(0)
  }

  console.log(
    `${queue.length} migration(s) at or after ${from} have no ledger row` +
      (held > 0 ? `, and ${held} earlier one(s) are being withheld by the cutoff` : '') +
      ':\n',
  )
  for (const entry of queue) console.log(`  ${entry.file}`)

  if (!apply) {
    console.log(
      '\nThis was a dry run. Re-run with --apply to write them, in this order, ' +
        "each in one transaction with its ledger row inside it.\n\nRead the list first: " +
        'a migration that takes privileges away belongs last, and this script sorts by ' +
        'filename rather than by judgement.',
    )
    process.exit(0)
  }

  for (const entry of queue) {
    console.log(`\n── ${entry.file}`)
    try {
      applyOne(url, entry)
      console.log(`   applied, ledger row written under ${entry.version}`)
    } catch (error) {
      console.error(
        `\n${entry.file} failed. Its transaction rolled back, so it has NO ledger row ` +
          'and the database is as it was before this file. Nothing after it was attempted.',
      )
      process.exit(1)
    }
  }
  console.log('\nall applied. Now run: npm run check:migration-ledger:live')
}
