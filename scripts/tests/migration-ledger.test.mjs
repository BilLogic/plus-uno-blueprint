/**
 * #148 — the comparison between `supabase/migrations/` and the apply ledger.
 *
 * Every fixture below is shaped from the real numbers, measured against
 * production on 2026-08-29: 826 files, 696 ledger rows, 13 of them carrying a
 * version-prefixed name from the CLI era and 683 bare from the MCP era, 12
 * duplicated names, and zero version overlap — no ledger version ends in four
 * zeros while every repository version does.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  ledgerDrift,
  parseMigrationFiles,
  ratchetFailures,
  staleBaselineEntries,
} from '../migration-ledger.mjs'

const file = (v, n) => `${v}_${n}.sql`
const row = (v, n) => ({ version: v, name: n })

describe('parseMigrationFiles', () => {
  it('splits the convention into version and name', () => {
    expect(parseMigrationFiles([file('20260828140000', 'a_lane_position')])).toEqual([
      { file: '20260828140000_a_lane_position.sql', version: '20260828140000', name: 'a_lane_position' },
    ])
  })

  it('reports a filename it cannot parse rather than skipping it', () => {
    // Skipping would make the file invisible to every assertion below, which is
    // the failure mode this whole ticket is about.
    const [parsed] = parseMigrationFiles(['not_a_migration.sql'])
    expect(parsed.version).toBeNull()
  })

  it('ignores anything that is not .sql', () => {
    expect(parseMigrationFiles(['README.md', '.keep'])).toEqual([])
  })
})

describe('ledgerDrift', () => {
  it('matches a bare ledger name — the MCP era, 683 of 696 rows', () => {
    const drift = ledgerDrift({
      files: parseMigrationFiles([file('20260821340000', 'retire_lifecycle')]),
      ledger: [row('20260821205607', 'retire_lifecycle')],
    })
    expect(drift.neverApplied).toEqual([])
    expect(drift.notInRepo).toEqual([])
  })

  it('matches a version-prefixed ledger name — the CLI era, the other 13', () => {
    // A join on the bare name alone silently drops these, and they would be
    // reported as 13 files that never ran.
    const drift = ledgerDrift({
      files: parseMigrationFiles([file('20250602160000', 'initial')]),
      ledger: [row('20250602160000', '20250602160000_initial')],
    })
    expect(drift.neverApplied).toEqual([])
  })

  it('a file with no ledger row is reported', () => {
    const drift = ledgerDrift({
      files: parseMigrationFiles([file('20260826100000', 'never_ran')]),
      ledger: [row('20260821205607', 'something_else')],
    })
    expect(drift.neverApplied).toEqual(['20260826100000_never_ran.sql'])
  })

  it('a ledger row with no file is reported', () => {
    const drift = ledgerDrift({
      files: [],
      ledger: [row('20260821205607', 'applied_by_hand')],
    })
    expect(drift.notInRepo).toEqual(['20260821205607  applied_by_hand'])
  })

  it('duplicated ledger names are reported once each, sorted', () => {
    // 12 of them in production. A join keyed on name multiplies rows on these,
    // so a repair has to decide what they mean.
    const drift = ledgerDrift({
      files: [],
      ledger: [row('1', 'twice'), row('2', 'twice'), row('3', 'once'), row('4', 'also'), row('5', 'also')],
    })
    expect(drift.duplicateNames).toEqual(['also', 'twice'])
  })

  it('version equality is counted, and is zero on the real shape', () => {
    // Repository versions are round; ledger versions are wall-clock. The count
    // is reported rather than asserted — a rise would mean someone had started
    // using `db push` after all, which is worth knowing either way.
    const drift = ledgerDrift({
      files: parseMigrationFiles([file('20260820060000', 'search_blueprint_include_fidelity')]),
      ledger: [row('20260820174339', 'search_blueprint_include_fidelity')],
    })
    expect(drift.versionMatches).toBe(0)
    expect(drift.neverApplied).toEqual([])
  })

  it('counts what it compared, so a vacuous pass is visible', () => {
    const drift = ledgerDrift({ files: parseMigrationFiles([file('20260101000000', 'x')]), ledger: [] })
    expect(drift.files).toBe(1)
    expect(drift.ledgerRows).toBe(0)
  })
})

describe('ratchetFailures', () => {
  const baseline = { neverApplied: ['20260101000000_known.sql'], notInRepo: [], duplicateNames: [] }
  const driftWith = (neverApplied) =>
    ledgerDrift({
      files: parseMigrationFiles(neverApplied),
      ledger: [],
    })

  it('holds when the recorded backlog is unchanged', () => {
    expect(ratchetFailures(driftWith(['20260101000000_known.sql']), baseline)).toEqual([])
  })

  it('holds when the backlog shrinks', () => {
    // The whole point of a ratchet: reconciling a file must not fail the build.
    expect(ratchetFailures(driftWith([]), baseline)).toEqual([])
  })

  it('fails on a NEW file that never ran, and names it', () => {
    const failures = ratchetFailures(
      driftWith(['20260101000000_known.sql', '20260829000000_written_never_applied.sql']),
      baseline,
    )
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('20260829000000_written_never_applied.sql')
    expect(failures[0]).not.toContain('20260101000000_known.sql')
  })

  it('fails with no baseline rather than passing vacuously', () => {
    const failures = ratchetFailures(driftWith([]), null)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('--update')
  })

  it('fails on a filename the convention cannot read, baseline or not', () => {
    const drift = ledgerDrift({ files: parseMigrationFiles(['nonsense.sql']), ledger: [] })
    expect(ratchetFailures(drift, baseline)[0]).toContain('nonsense.sql')
  })
})

describe('staleBaselineEntries', () => {
  it('reports an entry the baseline claims that is no longer true', () => {
    // A baseline that never shrinks is a backlog wearing a ratchet's clothes.
    const drift = ledgerDrift({ files: [], ledger: [] })
    expect(staleBaselineEntries(drift, { neverApplied: ['20260101000000_reconciled.sql'] })).toEqual([
      'neverApplied: 20260101000000_reconciled.sql',
    ])
  })

  it('reports nothing when every entry is still true', () => {
    const drift = ledgerDrift({
      files: parseMigrationFiles(['20260101000000_known.sql']),
      ledger: [],
    })
    expect(staleBaselineEntries(drift, { neverApplied: ['20260101000000_known.sql'] })).toEqual([])
  })
})

describe('the real corpus', () => {
  const MIGRATIONS = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'supabase',
    'migrations',
  )

  it('every migration file on disk matches the naming convention', () => {
    // Not a fixture. If a file is ever added that the parser cannot read, it
    // becomes invisible to the ledger comparison — which is exactly the class of
    // silence #148 is about — and this fails before that can happen.
    const parsed = parseMigrationFiles(fs.readdirSync(MIGRATIONS))
    const unparsable = parsed.filter((p) => p.version === null).map((p) => p.file)
    expect(unparsable).toEqual([])
    expect(parsed.length).toBeGreaterThan(800)
  })

  it('the version sets are compared, not assumed disjoint', () => {
    // A tempting shortcut, measured and REJECTED: repository versions look
    // hand-chosen and ledger versions look like wall-clock apply times, so it is
    // easy to argue they cannot collide. The numbers do not support it —
    // 818 of 826 repository versions end in `00`, but so do 10 of 696 ledger
    // versions, and 8 repository versions do not. Roundness is a strong tendency
    // and not a proof, so disjointness is something the comparison establishes
    // rather than something it assumes.
    const drift = ledgerDrift({
      files: parseMigrationFiles([file('20260820060000', 'x')]),
      ledger: [row('20260820060000', 'x')],
    })
    expect(drift.versionMatches).toBe(1)
  })
})
