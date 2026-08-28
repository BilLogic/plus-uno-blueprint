#!/usr/bin/env node
/**
 * #148 — every migration file, handed to the real Postgres parser.
 *
 * The series in `supabase/migrations/` has never been parsed by Postgres. The
 * schema was applied over MCP `apply_migration`, which takes the SQL as an
 * argument and stamps `version = now()`; the file was written separately
 * afterwards with a version picked by hand. Production's ledger and this
 * directory therefore agree on names and almost never on versions, and nothing
 * in the repository ever fed a file to a parser to find out whether it would
 * have run.
 *
 * Three files would not have. `20260820050000_search_blueprint_include.sql`
 * and `20260820060000_search_blueprint_include_fidelity.sql` both close
 * `everything as (…)` and open `picked_rows as (` with a comment between and no
 * comma — production carries the comma, so what ran was not what is filed.
 * `20260805170000_service_tier_rpc_enforcement.sql` builds its guard text out
 * of adjacent `E'…'` literals: Postgres concatenates two string constants
 * separated by whitespace containing a newline, but the continuation may not
 * carry its own `E` prefix, so the second literal is a syntax error. All 21
 * functions in production carry the guard that block installs, which is the
 * same proof from the other side.
 *
 * WHAT THIS ASSERTS, AND WHAT IT CANNOT
 *
 * Syntax, and only syntax. `pg.parse` runs the PostgreSQL grammar over the
 * statements; `pg.parsePlPgSQL` runs the plpgsql compiler over `create
 * function … language plpgsql` bodies and over `do $$ … $$` blocks, which is
 * the same pass `check_function_bodies` performs at CREATE time. So a file that
 * passes here is a file Postgres would accept the text of.
 *
 * It says nothing about whether the statements would SUCCEED. A missing table,
 * a column that was dropped three migrations earlier, a function called with
 * the wrong arity — all of that is resolved at execution, and none of it is
 * visible to a parser. Two further blind spots are worth naming because they
 * are the shapes this repository actually uses:
 *
 *   - a `language sql` body inside `$$ … $$` is a string literal to the
 *     grammar, so it is not parsed (seven files); the `begin atomic` form
 *     would be, and none of them use it
 *   - SQL built with `format()` and run with `execute` is text until runtime
 *     (three files)
 *
 * And it is a check on the FILES. Per #148 the files are not the apply path, so
 * a green run here is not a statement about production. `scripts/migration-replay.mjs`
 * makes the same disclaimer at greater length and is worth reading next to this:
 * it models what the statements DO and treats bodies as opaque, which is exactly
 * why it could not find these three. The two are complementary halves of one
 * question and neither is the answer on its own.
 *
 * PARSER VERSION. `libpg-query` ships the real parser compiled to WebAssembly —
 * no native build, so it runs in CI unmodified. The build carrying the plpgsql
 * entry point is the Postgres 18 one; `supabase/config.toml` pins 17. One major
 * of grammar skew, in the permissive direction for everything this series uses,
 * and all 822 files agree with it today. If a PG17-only spelling ever trips it,
 * that is a finding about the spelling, not a reason to drop the check.
 *
 * Static, needs no database, runs in `gates`.
 *
 * Run: node scripts/check-migration-syntax.mjs   (also: npm run check:migration-syntax)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parse, parsePlPgSQL } from 'libpg-query'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)
const MIGRATIONS = resolve(REPO_ROOT, 'supabase/migrations')

/** Every `.sql` file in a migration directory, in the order Postgres would see them. */
export function migrationFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(dir, name))
}

/**
 * The line a parse error points at, recovered from its own message.
 *
 * The WebAssembly build throws a bare `Error` with a message and nothing else —
 * no cursor, no line, and `hasSqlDetails` is false for the plpgsql pass. What
 * the message does carry is `at or near "…"`, quoting the source text verbatim,
 * so the token can be found in the file. First occurrence, because the parser
 * stops at the first error and everything before it parsed: for
 * `at or near "picked_rows"` in the two search migrations the first occurrence
 * IS the CTE that opens without a comma.
 *
 * A guess, and it is only ever used to sharpen an annotation. `null` when the
 * token cannot be located, and the finding stands either way.
 */
export function lineOf(sql, message) {
  const token = /\bat or near "((?:[^"\\]|\\.)*)"/.exec(message)?.[1]
  if (!token) return null
  const at = sql.indexOf(token)
  if (at === -1) return null
  return (sql.slice(0, at).match(/\n/g) ?? []).length + 1
}

/**
 * Both passes over one file's text.
 *
 * Two passes and not one, because they see different things. The grammar pass
 * reads `create function … as $$ … $$` as a statement whose body is a string
 * and stops there; the plpgsql pass compiles that string. A file with no
 * plpgsql in it passes the second trivially, which is the correct answer.
 *
 * @returns {Promise<Array<{pass: string, message: string, line: number|null}>>}
 */
export async function syntaxErrors(sql) {
  const out = []
  for (const [pass, run] of [
    ['statement grammar', parse],
    ['plpgsql body', parsePlPgSQL],
  ]) {
    try {
      await run(sql)
    } catch (error) {
      out.push({ pass, message: error.message, line: lineOf(sql, error.message) })
    }
  }
  return out
}

/** Every finding across a migration directory, in filename order. */
export async function findings(dir = MIGRATIONS) {
  const out = []
  for (const file of migrationFiles(dir)) {
    const sql = readFileSync(file, 'utf8')
    for (const error of await syntaxErrors(sql)) {
      out.push({ ...error, file: relative(REPO_ROOT, file).split('\\').join('/') })
    }
  }
  return out
}

async function main() {
  const files = migrationFiles(MIGRATIONS)
  const problems = await findings()
  for (const problem of problems) {
    const where = problem.line === null ? '' : `,line=${problem.line}`
    console.error(
      `::error file=${problem.file}${where}::Postgres would reject this file — ` +
        `${problem.pass}: ${problem.message}. Per #148 the migration series is not the ` +
        `apply path, so nothing has ever parsed it.`,
    )
  }
  if (problems.length > 0) {
    console.error(`\n${problems.length} migration file(s) Postgres cannot parse.`)
    process.exit(1)
  }
  console.log(
    `ok — all ${files.length} migration files parse. Syntax only: this says Postgres ` +
      'would accept the text, not that the statements would succeed, and not that these ' +
      'files are what production ran.',
  )
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
