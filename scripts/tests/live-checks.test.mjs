/**
 * The machinery behind `scripts/check-live-coverage.mjs`, exercised directly.
 *
 * The check is GREEN against this repository, and a green headline proves
 * nothing on its own — a check that found no workflows at all would print the
 * same line. So what is asserted here is that it goes RED on each shape the
 * ticket is actually about.
 *
 * The fourth case is the one worth the file. A privileged database credential
 * named by a workflow a pull request can trigger is not a style problem: a
 * same-repo pull request is handed the repository's secrets and supplies the
 * workflow that reads them, so the credential is printable by any branch
 * author. Until this existed the rule was a sentence in a comment, and a
 * sentence in a comment is what `check:identifiers:live` had for a policy when
 * two retired column names sat in production for a fortnight.
 */
import assert from 'node:assert/strict'
import { test } from 'vitest'

import { coverageFailures } from '../check-live-coverage.mjs'
import { LIVE_CHECKS, coverage, unverifiedHere } from '../live-checks.mjs'

const PULL_REQUEST = 'on:\n  pull_request:\n  push:\n    branches: [main]\n'
const SCHEDULED = 'on:\n  schedule:\n    - cron: "45 7 * * *"\n  workflow_dispatch:\n'
const BOTH = `${PULL_REQUEST}  schedule:\n    - cron: "45 7 * * *"\n`

/** A `pull_request` narrowed to a path list, beside a schedule — the `alsoOn` shape. */
const filtered = (paths) =>
  `on:\n  pull_request:\n    paths:\n${paths.map((path) => `      - ${path}\n`).join('')}` +
  '  schedule:\n    - cron: "15 8 * * *"\n'

/**
 * The declaration as it stands, rendered into workflows that satisfy it.
 *
 * A file's triggers are decided by everything it hosts, not by the first entry
 * that named it: `bot-contract-probe.yml` really does carry a pull-request
 * check and a scheduled one at once, and a fixture that modelled it as either
 * alone would assert a repository this is not. An entry with `alsoOn` adds a
 * third shape — a schedule and a `pull_request` filtered to the paths the
 * entry names — for the same reason: `offline-board.yml` really is both.
 */
function workflowsSatisfying(checks = LIVE_CHECKS) {
  const byPath = new Map()
  for (const check of checks) {
    for (const path of check.runsIn) {
      const onPullRequests = checks.some(
        (other) => other.status === 'pull-request' && other.runsIn.includes(path),
      )
      const alsoOn = checks.filter((other) => other.runsIn.includes(path)).flatMap((other) => other.alsoOn ?? [])
      const opening = alsoOn.length > 0 ? filtered(alsoOn) : onPullRequests ? BOTH : SCHEDULED
      const existing = byPath.get(path) ?? opening
      byPath.set(path, `${existing}      - run: npm run ${check.script}\n`)
    }
  }
  return [...byPath].map(([path, text]) => ({ path, text }))
}

const SCRIPTS = Object.fromEntries(LIVE_CHECKS.map((check) => [check.script, 'node scripts/x.mjs']))

test('the declaration this repository ships is internally consistent', () => {
  assert.deepEqual(coverageFailures({ scripts: SCRIPTS, workflows: workflowsSatisfying() }), [])
})

test('a new :live script nobody declared is a finding', () => {
  const failures = coverageFailures({
    scripts: { ...SCRIPTS, 'check:embeddings:live': 'node scripts/x.mjs' },
    workflows: workflowsSatisfying(),
  })
  assert.equal(failures.length, 1)
  assert.match(failures[0], /check:embeddings:live/)
})

test('a declared check that names a workflow which never runs it is a finding', () => {
  const workflows = workflowsSatisfying().map((w) =>
    w.path === '.github/workflows/live-schema.yml'
      ? { ...w, text: w.text.replace('npm run check:identifiers:live', 'npm run check:identifiers') }
      : w,
  )
  const failures = coverageFailures({ scripts: SCRIPTS, workflows })
  assert.ok(failures.some((f) => /check:identifiers:live.*never runs it/.test(f)))
})

test('a check declared manual that CI actually runs is a finding', () => {
  // The declaration is the thing a pull request prints. A manual entry CI runs
  // would have every pull request announcing an absence that is not real,
  // which teaches a reader to stop reading the announcement.
  const manual = LIVE_CHECKS.find((check) => check.status === 'manual')
  const workflows = [
    ...workflowsSatisfying(),
    { path: '.github/workflows/extra.yml', text: `${SCHEDULED}      - run: npm run ${manual.script}\n` },
  ]
  assert.ok(coverageFailures({ scripts: SCRIPTS, workflows }).some((f) => /is not manual/.test(f)))
})

test('an `alsoOn` path no workflow filters on is a finding', () => {
  // The entry is what a pull request's coverage summary reads from, so a path
  // it claims and the YAML does not list is a pull request told it was covered
  // by a job that never started.
  const entry = LIVE_CHECKS.find((check) => check.alsoOn?.length)
  const workflows = workflowsSatisfying().map((w) =>
    entry.runsIn.includes(w.path) ? { ...w, text: w.text.replace(`      - ${entry.alsoOn[0]}\n`, '') } : w,
  )
  const failures = coverageFailures({ scripts: SCRIPTS, workflows })
  assert.ok(failures.some((f) => new RegExp(`also runs on a pull request touching ${entry.alsoOn[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(f)))
})

test('a pull-request workflow that names a privileged credential is a finding', () => {
  const workflows = [
    ...workflowsSatisfying(),
    {
      path: '.github/workflows/tempting.yml',
      text: `${PULL_REQUEST}      - run: npm run check:identifiers:live\n        env:\n          SUPABASE_DB_URL: \${{ secrets.SUPABASE_DB_URL }}\n`,
    },
  ]
  assert.ok(coverageFailures({ scripts: SCRIPTS, workflows }).some((f) => /can be triggered by a pull request/.test(f)))
})

test('a scheduled workflow may name it, which is the whole point of the carve-out', () => {
  const workflows = workflowsSatisfying().map((w) =>
    w.path === '.github/workflows/live-schema.yml'
      ? { ...w, text: `${w.text}        env:\n          SUPABASE_DB_URL: \${{ secrets.SUPABASE_DB_URL }}\n` }
      : w,
  )
  assert.deepEqual(coverageFailures({ scripts: SCRIPTS, workflows }), [])
})

test('coverage reads the credentials in hand, not the intentions', () => {
  const dark = coverage({})
  assert.ok(dark.every((check) => check.needs.length === 0 || !check.covered))
  const lit = coverage({
    SUPABASE_URL: 'u',
    SUPABASE_ANON_KEY: 'k',
    VITE_SUPABASE_URL: 'u',
    VITE_SUPABASE_ANON_KEY: 'k',
    SUPABASE_DB_URL: 'postgres://…',
  })
  assert.ok(lit.every((check) => check.covered))
})

test('what a pull request prints names the subject, not only the script', () => {
  // A warning that says "check X did not run" and stops there is the silent
  // skip with extra steps: the reader still has to go and find out what X was
  // for. Every sentence carries what went unverified.
  for (const check of LIVE_CHECKS.filter((one) => one.status !== 'pull-request')) {
    const said = unverifiedHere(check)
    assert.ok(said.includes(check.script), `${check.key} names its script`)
    assert.ok(said.includes(check.unverified), `${check.key} says what went unverified`)
  }
})
