#!/usr/bin/env node
/**
 * #148 — `npm run check:migration-ledger:live`.
 *
 * `supabase/migrations/` holds 826 files. `supabase_migrations.schema_migrations`
 * holds 696 rows. Not one repository version appears in that ledger, and nothing
 * has ever compared the two — which is how a directory of 826 files came to be
 * documented as the apply path for a schema it has never reproduced.
 *
 * The comparison, the two ledger populations it has to handle, and why it is a
 * ratchet rather than a threshold are all written once, in
 * `scripts/migration-ledger.mjs`. This file is the database and the filesystem.
 *
 * WHY `psql` AND NOT PostgREST. `supabase_migrations` is not in the exposed
 * schema, so no anon or service-role HTTP route reaches it — the same reason
 * `check-rls-posture.mjs` takes a direct connection to read `pg_catalog`, and
 * the same `SUPABASE_DB_URL`.
 *
 * WHY IT IS `:live` AND NOT A CI JOB. This repository has a standing rule that a
 * privileged database credential never belongs in its workflows — it is written
 * out in `gates.yml`, and it is why `check:identifiers:live`,
 * `check:contract:live` and `check:rls-posture:live` are all manual
 * counterparts to static gates. This is one more of them. The static half of
 * #148 is `check:migration-syntax`, which already runs on every PR; what needs a
 * database is only the comparison against what was actually applied.
 *
 * Usage:
 *   npm run check:migration-ledger:live              compare, and hold the ratchet
 *   npm run check:migration-ledger:live -- --update  re-record the baseline from this run
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ledgerDrift, parseMigrationFiles, ratchetFailures, staleBaselineEntries } from './migration-ledger.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations')
const BASELINE = path.join(ROOT, 'docs', 'reference', 'migration-ledger-baseline.json')

const LEDGER_SQL = `
  select coalesce(
    json_agg(json_build_object('version', version, 'name', name) order by version),
    '[]'::json
  )
  from supabase_migrations.schema_migrations
`

/** The ledger over a direct connection. Throws rather than returning empty. */
export function readLedger(url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL) {
  if (!url) {
    throw new Error(
      'this check needs SUPABASE_DB_URL (a direct postgres:// connection). ' +
        '`supabase_migrations` is not in the exposed schema, so there is no anon or ' +
        'service-role HTTP route to the apply ledger.',
    )
  }
  let raw
  try {
    raw = execFileSync('psql', [url, '-At', '-c', LEDGER_SQL], { encoding: 'utf8' })
  } catch (error) {
    // ENOENT reads as a bare `spawnSync psql ENOENT` and sends the reader looking
    // for a bug in this file. `check:rls-posture:live` needs the same binary for
    // the same reason and this repository has no local Postgres.
    throw new Error(
      error.code === 'ENOENT'
        ? 'psql is not on PATH. It is how this repository reaches a direct connection at ' +
          'all — install the Postgres client, or run this from a machine that has one.'
        : `psql: ${error.stderr?.toString().trim() || error.message}`,
    )
  }
  const ledger = JSON.parse(raw)
  // An empty ledger is the shape a wrong database, a wrong schema and a silently
  // failed query all produce, and every assertion downstream passes vacuously on
  // it — while reporting 826 files that never ran, which reads like a finding.
  if (!Array.isArray(ledger) || ledger.length === 0) {
    throw new Error(
      'the apply ledger came back empty. That is not a clean comparison, it is a ' +
        'connection pointed somewhere else — or a role that cannot see ' +
        '`supabase_migrations`.',
    )
  }
  return ledger
}

function readBaseline() {
  try {
    return JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  } catch {
    return null
  }
}

function main() {
  const update = process.argv.includes('--update')

  const files = parseMigrationFiles(fs.readdirSync(MIGRATIONS))
  if (files.length === 0) {
    console.error('[ledger] no migration files found. Nothing to compare.')
    process.exit(1)
  }

  let ledger
  try {
    ledger = readLedger()
  } catch (error) {
    console.error(`[ledger] ${error.message}`)
    process.exit(1)
  }

  const drift = ledgerDrift({ files, ledger })

  if (update) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true })
    fs.writeFileSync(
      BASELINE,
      `${JSON.stringify(
        {
          why:
            'Recorded drift between supabase/migrations/ and the apply ledger (#148). ' +
            'The set may shrink and never grow: a NEW file with no ledger row is a file ' +
            'written and never applied, which is the gap happening again. Delete entries ' +
            'as they are reconciled — the check reports any that are no longer true.',
          recorded: drift,
        },
        null,
        2,
      )}\n`,
    )
    console.log(
      `[ledger] baseline written: ${drift.neverApplied.length} file(s) with no ledger row, ` +
        `${drift.notInRepo.length} row(s) with no file, ${drift.duplicateNames.length} duplicated name(s).`,
    )
    return
  }

  const baseline = readBaseline()?.recorded ?? null
  const failures = ratchetFailures(drift, baseline)
  const stale = baseline ? staleBaselineEntries(drift, baseline) : []

  if (stale.length) {
    failures.push(
      `${stale.length} baseline entr(ies) describing drift that no longer exists:\n` +
        stale.map((s) => `       ${s}`).join('\n') +
        '\n     Someone reconciled them. Delete the entries, so the file stops asserting ' +
        'something untrue and the ratchet cannot readmit them silently.',
    )
  }

  if (failures.length) {
    console.error(`[ledger] ${failures.length} problem(s):`)
    for (const f of failures) console.error(`  -> ${f}`)
    process.exit(1)
  }

  console.log(
    `[ledger] ${drift.files} migration file(s) against ${drift.ledgerRows} ledger row(s): ` +
      `${drift.neverApplied.length} never applied, ${drift.notInRepo.length} applied without a file, ` +
      `${drift.duplicateNames.length} duplicated name(s), ${drift.versionMatches} version(s) in agreement — ` +
      'all within the recorded baseline.',
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()
