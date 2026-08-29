#!/usr/bin/env node
/**
 * #148 — `npm run replay:migrations`. Can the series rebuild the schema?
 *
 * The question #148 could not answer, because answering it needs an EMPTY
 * database and this repository had no route to one: `supabase db reset` wants
 * Docker, and the hosted project is the thing being reproduced, not a target to
 * reproduce it into. A local Postgres 17 is that route, costs nothing, and
 * touches no Supabase project:
 *
 *   brew install postgresql@17 pgvector
 *   LC_ALL="en_US.UTF-8" pg_ctl -D /opt/homebrew/var/postgresql@17 start
 *   npm run replay:migrations
 *
 * `LC_ALL` is not decoration — without it Postgres 17 on this macOS refuses to
 * start with `postmaster became multithreaded during startup`.
 *
 * WHAT IT DOES. Drops and recreates a throwaway database, applies
 * `replay-prelude.sql` (the slice of a Supabase project the migrations actually
 * reference — roles, `auth.uid`/`auth.jwt`, `auth.users`, `storage.buckets`,
 * `storage.objects`, `vector`), then runs every file in
 * `supabase/migrations/` in filename order, each in its own transaction, and
 * reports what failed.
 *
 * ONE TRANSACTION PER FILE, which is what Supabase does, and it is the detail
 * that makes the result mean something: a migration that creates a table and
 * then asserts a row count rolls the table back when the assertion fires. That
 * is not a hypothetical — it is why `stakeholders` is missing from a replay.
 *
 * WHY IT IS NOT A CI JOB. It needs a Postgres server, which the workflows do
 * not have, and it takes minutes. It is a local instrument, and the ratchet it
 * writes is the part that travels: `docs/reference/migration-replay-baseline.json`
 * records the set of files that cannot replay today, and this check fails when
 * a file joins it. Repairing one is a deletion from that file.
 *
 * Usage:
 *   npm run replay:migrations                 replay, and hold the ratchet
 *   npm run replay:migrations -- --update     re-record the baseline from this run
 *   npm run replay:migrations -- --verbose    print every failure, not the summary
 */

import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  classifyFailure,
  errorMessage,
  ratchetFailures,
  summariseReplay,
} from './postgres-replay.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations')
const PRELUDE = path.join(ROOT, 'scripts', 'replay-prelude.sql')
const BASELINE = path.join(ROOT, 'docs', 'reference', 'migration-replay-baseline.json')

const DATABASE = process.env.REPLAY_DATABASE ?? 'uno_replay'

/**
 * Homebrew's Postgres is keg-only, so the binaries are installed and not on
 * `PATH` — `which psql` says "not found" while `psql` sits in
 * `/opt/homebrew/opt/...`. That lie is what kept #148 blocked, so the paths are
 * searched here rather than trusted to the shell.
 */
const BIN_DIRS = [
  '/opt/homebrew/opt/postgresql@17/bin',
  '/opt/homebrew/opt/libpq/bin',
  '/usr/local/opt/postgresql@17/bin',
  '/usr/local/opt/libpq/bin',
]

function resolveBinary(name) {
  for (const dir of BIN_DIRS) {
    const candidate = path.join(dir, name)
    if (fs.existsSync(candidate)) return candidate
  }
  return name
}

const PSQL = resolveBinary('psql')
const CREATEDB = resolveBinary('createdb')
const DROPDB = resolveBinary('dropdb')

function run(binary, args) {
  return spawnSync(binary, args, { encoding: 'utf8' })
}

function requireServer() {
  const probe = run(PSQL, ['-d', 'postgres', '-tAc', 'select 1'])
  if (probe.status === 0) return
  const detail = (probe.stderr ?? '').trim() || probe.error?.message || 'unknown error'
  console.error(
    `[replay] no Postgres to replay into: ${detail}\n` +
      `[replay] start one with:\n` +
      `           brew install postgresql@17 pgvector\n` +
      `           LC_ALL="en_US.UTF-8" pg_ctl -D /opt/homebrew/var/postgresql@17 start`,
  )
  process.exit(1)
}

function freshDatabase() {
  run(DROPDB, ['--if-exists', DATABASE])
  const created = run(CREATEDB, [DATABASE])
  if (created.status !== 0) {
    console.error(`[replay] could not create ${DATABASE}: ${(created.stderr ?? '').trim()}`)
    process.exit(1)
  }
  // `vector` lands in `extensions`, and three migrations name the type bare.
  execFileSync(PSQL, ['-q', '-d', DATABASE, '-c', `alter database ${DATABASE} set search_path = public, extensions`])
  const prelude = run(PSQL, ['-q', '-X', '-v', 'ON_ERROR_STOP=1', '-d', DATABASE, '-f', PRELUDE])
  if (prelude.status !== 0) {
    console.error(`[replay] the prelude itself failed:\n${(prelude.stderr ?? '').trim()}`)
    process.exit(1)
  }
}

function replay(files) {
  const failures = []
  let applied = 0
  for (const file of files) {
    const result = run(PSQL, [
      '-q',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-d',
      DATABASE,
      '--single-transaction',
      '-f',
      path.join(MIGRATIONS, file),
    ])
    if (result.status === 0) {
      applied += 1
      continue
    }
    const error = (result.stderr ?? '')
      .split('\n')
      .find((line) => line.includes('ERROR:'))
    failures.push({ file, error: error ?? (result.stderr ?? '').trim().split('\n')[0] ?? '' })
  }
  return { applied, failures }
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
  const verbose = process.argv.includes('--verbose')

  const files = fs
    .readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  if (files.length === 0) {
    console.error('[replay] no migration files found. Nothing to replay.')
    process.exit(1)
  }

  requireServer()
  freshDatabase()

  const { applied, failures } = replay(files)
  const summary = summariseReplay({ applied, failures })

  console.log(
    `[replay] ${summary.applied}/${summary.total} applied, ${summary.failed} failed ` +
      `(syntax ${summary.byClass.syntax}, assertion ${summary.byClass.assertion}, ` +
      `data ${summary.byClass.data}, structure ${summary.byClass.structure})`,
  )
  if (summary.first) {
    // The only failure guaranteed not to be a consequence of another one.
    console.log(`[replay] first failure: ${summary.first.file} — ${errorMessage(summary.first.error)}`)
  }
  const syntax = failures.filter((failure) => classifyFailure(failure.error) === 'syntax')
  for (const failure of syntax) {
    console.log(`[replay] cannot have run anywhere: ${failure.file} — ${errorMessage(failure.error)}`)
  }
  if (verbose) {
    for (const failure of failures) {
      console.log(`  ${classifyFailure(failure.error).padEnd(9)} ${failure.file} — ${errorMessage(failure.error)}`)
    }
  }

  if (update) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true })
    fs.writeFileSync(
      BASELINE,
      `${JSON.stringify(
        {
          why:
            'Files that cannot replay against an empty database (#148). The set may ' +
            'shrink and never grow: a NEW entry is a migration written against an ' +
            'apply path that does not work, which is the gap #148 describes happening ' +
            'again. Delete entries as they are repaired — the check reports any that ' +
            'are no longer true.',
          recorded: summary,
          failing: failures.map((failure) => failure.file),
        },
        null,
        2,
      )}\n`,
    )
    console.log(`[replay] baseline written: ${failures.length} file(s) recorded as unable to replay.`)
    return
  }

  const baseline = readBaseline()
  if (!baseline) {
    console.error(
      '[replay] no baseline recorded. Record one with ' +
        '`npm run replay:migrations -- --update` so this can start failing on new drift.',
    )
    process.exit(1)
  }

  const { newlyFailing, stale } = ratchetFailures(failures, baseline)
  for (const file of stale) {
    console.log(`[replay] no longer failing (drop it from the baseline): ${file}`)
  }
  if (newlyFailing.length > 0) {
    console.error(
      `[replay] ${newlyFailing.length} migration(s) newly unable to replay:\n  ` +
        `${newlyFailing.join('\n  ')}\n` +
        '[replay] a migration that cannot run against an empty database has not been ' +
        'tested by anything. Fix it, or record it deliberately with --update and say why.',
    )
    process.exit(1)
  }
  console.log('[replay] no new files joined the unable-to-replay set.')
}

main()
