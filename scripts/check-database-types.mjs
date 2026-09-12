#!/usr/bin/env node
/**
 * `npm run check:database-types:live` — does this deployment's database still
 * satisfy the types the application was compiled against?
 *
 * THE SUBJECT CHANGED WHEN THE APPLICATION MOVED INTO THE PACKAGE, and the
 * check got stronger rather than weaker. It used to ask whether a
 * hand-maintained `src/types/database.ts` still described the database — two
 * artifacts in one repository, both editable here, and the answer was mostly
 * about whether somebody had remembered to regenerate.
 *
 * There is no local copy now. `types/database.ts` is the PACKAGE's, and the
 * v1.42.0 release notes say why it has no config seam: every import of it is a
 * TYPE import, so it is the application's compile-time statement of the schema
 * its code needs — satisfied by HAVING that schema, not by swapping a module
 * underneath code that was typechecked against it.
 *
 * So the question this asks now is the one that actually matters to a
 * deployment: is this database a runtime superset of what the application it
 * imports expects? A missing column here is not a stale file, it is a read
 * that fails in production. Extra tables and extra functions of this
 * deployment's own are fine and expected — this database has always been
 * ahead of the template's.
 *
 * The comparison, and why nothing else could have caught the drift it exists
 * for, are written once in `scripts/database-types.mjs`. This file is the
 * database and the filesystem.
 *
 * WHY `psql` AND NOT PostgREST. The column list and the argument lists live in
 * `information_schema` and `pg_catalog`, which no anon or service-role HTTP
 * route reaches — the same reason `check:migration-ledger:live` and
 * `check:rls-posture:live` take a direct connection, and the same
 * `SUPABASE_DB_URL`.
 *
 * WHY IT IS `:live` AND NOT A CI JOB. This repository has a standing rule that
 * a privileged database credential never belongs in its workflows. It is one
 * more manual counterpart, and it is the only check that can tell a
 * hand-maintained types file from a generated one.
 *
 * Usage:
 *   npm run check:database-types:live
 *   SUPABASE_DB_URL=postgresql://…/uno_replay npm run check:database-types:live
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { functionsInFile, tablesInFile, typesDrift } from './database-types.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TYPES_RELATIVE = 'node_modules/agentic-service-blueprinting/src/types/database.ts'
const TYPES = path.join(ROOT, TYPES_RELATIVE)

const COLUMNS_SQL = `
  select coalesce(json_agg(json_build_object(
    'table_name', c.table_name, 'column_name', c.column_name, 'nullable', c.is_nullable = 'YES'
  )), '[]'::json)
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
   and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public'
`

// prokind 'f' is a plain function: trigger functions ('t' in pg_proc terms are
// still 'f' but return trigger) are dropped by the rettype filter, because the
// generator does not emit them either — nothing can call one over the wire.
const FUNCTIONS_SQL = `
  select coalesce(json_agg(json_build_object(
    'name', p.proname, 'args', pg_get_function_arguments(p.oid)
  )), '[]'::json)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.prorettype <> 'trigger'::regtype
`

function query(url, sql) {
  try {
    return JSON.parse(execFileSync('psql', [url, '-At', '-c', sql], { encoding: 'utf8' }))
  } catch (error) {
    throw new Error(
      error.code === 'ENOENT'
        ? 'psql is not on PATH. It is how this repository reaches a direct connection ' +
          'at all — install the Postgres client, or run this from a machine that has one.'
        : `psql: ${error.stderr?.toString().trim() || error.message}`,
    )
  }
}

/** `{ name: Set<'arg'|'arg?'> }` from what `pg_get_function_arguments` prints. */
function parseArguments(text) {
  const args = new Set()
  if (!text.trim()) return args
  // Split on the commas between arguments, not the ones inside a DEFAULT.
  let depth = 0
  let current = ''
  const parts = []
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current)
  for (const part of parts) {
    const name = part.trim().split(/\s+/)[0]
    args.add(name + (/\bDEFAULT\b/i.test(part) ? '?' : ''))
  }
  return args
}

function main() {
  const url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error(
      'this check needs SUPABASE_DB_URL (a direct postgres:// connection). The column\n' +
        'list and the argument lists live in information_schema and pg_catalog, which no\n' +
        'HTTP route reaches.',
    )
    process.exit(2)
  }

  const columns = query(url, COLUMNS_SQL)
  const functions = query(url, FUNCTIONS_SQL)
  // An empty catalogue is the shape a wrong database, a wrong schema and a
  // silently failed query all produce, and every comparison below passes
  // vacuously on it while reporting the whole types file as extra.
  if (columns.length === 0 || functions.length === 0) {
    console.error(
      'the catalogue came back empty. That is not a clean comparison, it is a\n' +
        'connection pointed somewhere else.',
    )
    process.exit(2)
  }

  const dbTables = new Map()
  for (const row of columns) {
    if (!dbTables.has(row.table_name)) dbTables.set(row.table_name, new Map())
    dbTables.get(row.table_name).set(row.column_name, row.nullable)
  }
  const dbFunctions = new Map(
    functions.map((row) => [row.name, parseArguments(row.args ?? '')]),
  )

  if (!fs.existsSync(TYPES)) {
    console.error(
      `The application's types are not on disk at ${TYPES_RELATIVE}. This ` +
        `deployment reads the application out of agentic-service-blueprinting, ` +
        `so there is nothing to compare the database against — which is a ` +
        `broken check, not a passing one. Run npm ci.`,
    )
    process.exit(1)
  }
  const source = fs.readFileSync(TYPES, 'utf8')
  const problems = typesDrift({
    fileTables: tablesInFile(source),
    fileFunctions: functionsInFile(source),
    dbTables,
    dbFunctions,
    fileSource: source,
  })

  if (problems.length === 0) {
    console.log(
      `this database satisfies the application's types: ${dbTables.size} table(s), ` +
        `${dbFunctions.size} function(s).`,
    )
    return
  }
  for (const problem of problems) console.error(problem)
  console.error(
    `\n${problems.length} disagreement(s). Regenerate the file rather than patching it — ` +
      'its header says which generator works here and which two hand-applied layers to put back.',
  )
  process.exit(1)
}

main()
