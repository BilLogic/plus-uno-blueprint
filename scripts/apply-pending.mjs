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
 *
 * ── A migration may not open a transaction of its own ────────────────────
 *
 * `begin;` in the file defeats every word of that. Its `commit;` ends the
 * OUTER transaction, so everything after it — the ledger insert included —
 * runs in a transaction of its own. psql says so, in two warnings nobody has
 * to read:
 *
 *     WARNING:  there is already a transaction in progress
 *     WARNING:  there is no transaction in progress
 *
 * That is what `20260910010000` printed on its way into production on
 * 2026-09-10. It succeeded and its counts were verified, so nothing is wrong
 * in the database — but had it failed after its inner `commit;` it would have
 * left partial work behind AND a ledger row claiming it ran, which is the one
 * outcome this script exists to prevent, arriving as a warning.
 *
 * So `transactionControl` reads every queued file before any of them is
 * applied, in the dry run as well as under `--apply`, and the run stops naming
 * the file and the line. It reads the parse tree rather than the text because
 * `begin` is two different words here: 141 of the 877 files contain it and 16
 * mean the transaction. `20260910010000` holds one of each — transaction
 * control on line 34, a plpgsql `do $$ begin` on line 237 — and the grammar
 * sees the first as a statement and the second as the string constant it is.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'libpg-query'

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

/**
 * Transaction control that nests rather than ends: a savepoint is not a
 * transaction, and `release` and `rollback to` unwind to one. All three sit
 * INSIDE the transaction this script opened and take nothing away from the
 * ledger guarantee, so all three are allowed.
 *
 * Named as what passes rather than what fails, so a statement kind nobody here
 * anticipated is refused rather than admitted.
 */
const NESTED = new Set(['TRANS_STMT_SAVEPOINT', 'TRANS_STMT_RELEASE', 'TRANS_STMT_ROLLBACK_TO'])

/**
 * The transaction control a migration file carries itself, in file order.
 *
 * Read off the statement grammar, never off the text. `begin` opens a plpgsql
 * block as often as it opens a transaction in this series, and inside
 * `$$ … $$` it is not a statement at all — it is characters in a string
 * constant. A parse is the only reading that tells the two apart, and it gets
 * `-- begin;` in a comment and `raise notice 'commit;'` right for free.
 *
 * @returns {Promise<Array<{statement: string, line: number}>>}
 */
export async function transactionControl(sql) {
  // `stmt_location` and `stmt_len` are BYTE offsets — the parser works on
  // UTF-8, and these files carry em dashes in their comments. Counting
  // newlines by slicing the JavaScript string would drift by one for every
  // multi-byte character above the statement.
  const bytes = Buffer.from(sql, 'utf8')
  const { stmts = [] } = await parse(sql)
  const found = []
  for (const stmt of stmts) {
    const kind = stmt.stmt?.TransactionStmt?.kind
    if (!kind || NESTED.has(kind)) continue
    const at = stmt.stmt_location ?? 0
    found.push({
      statement: bytes
        .subarray(at, at + (stmt.stmt_len ?? 0))
        .toString('utf8')
        .trim(),
      line: bytes.subarray(0, at).toString('utf8').split('\n').length,
    })
  }
  return found
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

  // Before the dry run reports success, and long before anything is written.
  const carried = []
  for (const entry of queue) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, entry.file), 'utf8')
    try {
      for (const found of await transactionControl(sql)) carried.push({ file: entry.file, ...found })
    } catch (error) {
      console.error(
        `\n${entry.file} does not parse, so this script cannot tell whether it opens a ` +
          `transaction of its own: ${error.message}\n\nRun npm run check:migration-syntax.`,
      )
      process.exit(1)
    }
  }
  if (carried.length > 0) {
    console.error('\nrefusing to apply — these files open or close a transaction of their own:\n')
    for (const found of carried) console.error(`  ${found.file}:${found.line}  ${found.statement}`)
    console.error(
      '\nEach file is applied with --single-transaction and its ledger row is written inside ' +
        'that transaction, which is what stops a migration that fails from being recorded as ' +
        'applied. An inner commit ends that transaction early and the ledger row lands in a ' +
        'separate one, so a file that then fails commits partial work AND is recorded as ' +
        'applied. psql reports it only as "there is already a transaction in progress".\n\n' +
        'The fix is to delete the begin/commit: the file already runs in one transaction.',
    )
    process.exit(1)
  }

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
    } catch {
      // NOTHING IS SWALLOWED BY BINDING NO ERROR HERE, and the reason is in
      // `applyOne`: psql runs with stdout and stderr INHERITED, so Postgres has
      // already written the failing statement and its message to this
      // terminal by the time control reaches here. What the catch would hold is
      // `execFileSync`'s wrapper — "Command failed with exit code 3" — which
      // says less than the line above it already does. The binding is dropped
      // rather than renamed `_error`, because an underscore reads as "there is
      // something here we are choosing not to look at" and there is not.
      console.error(
        `\n${entry.file} failed. Its transaction rolled back, so it has NO ledger row ` +
          'and the database is as it was before this file. Nothing after it was attempted. ' +
          "psql's own error is above.",
      )
      process.exit(1)
    }
  }
  console.log('\nall applied. Now run: npm run check:migration-ledger:live')
}
