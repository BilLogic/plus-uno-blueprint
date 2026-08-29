/**
 * #148 — what `supabase/migrations/` claims and what the database recorded.
 *
 * 826 files. 696 rows in `supabase_migrations.schema_migrations`. **Not one
 * repository version appears in that ledger**, and the reason is structural
 * rather than accidental: ledger versions are wall-clock apply times to the
 * second, repository versions are round and hand-chosen. One query says it
 * without sampling —
 *
 *   select count(*) filter (where version like '%0000') from …schema_migrations
 *   -- 0 of 696
 *
 * — while every repository filename's version ends in at least four zeros. That
 * is the signature of `apply_migration` over MCP, which stamps `version = now()`
 * and takes `name` from its argument, with the file written separately
 * afterwards and its timestamp picked by hand.
 *
 * SO THE COMPARISON IS BY NAME, NOT BY VERSION. Version equality is known to be
 * empty and asserting it would only restate the ticket. What a name comparison
 * answers is the question that still matters: did this file ever run at all?
 *
 * THE LEDGER HAS TWO POPULATIONS, and a comparison that misses this is wrong in
 * both directions:
 *
 *   13 rows   `name` carries the full version prefix   `20250602160000_initial`
 *   683 rows  `name` is bare                           `retire_lifecycle`
 *
 * The first are the CLI era, when `supabase db push` wrote the filename stem.
 * The second are the MCP era. A join on the bare name alone silently drops the
 * 13; a join on the prefixed form alone drops the 683.
 *
 * AND 12 NAMES ARE DUPLICATED — the same name applied more than once, at
 * different versions. Any repair keyed on name has to decide what that means,
 * so this reports them rather than letting a join quietly multiply rows.
 */

/**
 * `20260828140000_a_lane_position_is_unique_within_its_path.sql`
 *   -> { version: '20260828140000', name: 'a_lane_position_is_unique_within_its_path' }
 *
 * A filename that does not match is returned with `version: null` rather than
 * skipped: a file the convention cannot parse is a finding, not a non-event.
 *
 * @param {string[]} filenames
 */
export function parseMigrationFiles(filenames) {
  return filenames
    .filter((f) => f.endsWith('.sql'))
    .map((f) => {
      const m = /^(\d{14})_(.+)\.sql$/.exec(f)
      return m ? { file: f, version: m[1], name: m[2] } : { file: f, version: null, name: null }
    })
}

/**
 * Whether a ledger row records a given repository file.
 *
 * Both populations, in one place, so no caller can accidentally handle only one.
 */
function records(row, migration) {
  return row.name === migration.name || row.name === `${migration.version}_${migration.name}`
}

/**
 * @typedef {{version: string, name: string}} LedgerRow
 * @typedef {{file: string, version: string|null, name: string|null}} Migration
 *
 * @param {{files: Migration[], ledger: LedgerRow[]}} o
 */
export function ledgerDrift({ files, ledger }) {
  const unparsable = files.filter((f) => f.version === null).map((f) => f.file)
  const parsed = files.filter((f) => f.version !== null)

  const neverApplied = parsed
    .filter((f) => !ledger.some((row) => records(row, f)))
    .map((f) => f.file)

  const notInRepo = ledger
    .filter((row) => !parsed.some((f) => records(row, f)))
    .map((row) => `${row.version}  ${row.name}`)

  const seen = new Map()
  for (const row of ledger) seen.set(row.name, (seen.get(row.name) ?? 0) + 1)
  const duplicateNames = [...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name).sort()

  // Reported, not asserted. It is expected to be 0 and the ticket explains why;
  // a number that suddenly rose would mean someone had started applying files
  // through `db push` after all, which is worth knowing either way.
  const versionMatches = parsed.filter((f) => ledger.some((row) => row.version === f.version)).length

  return {
    files: parsed.length,
    ledgerRows: ledger.length,
    unparsable,
    neverApplied,
    notInRepo,
    duplicateNames,
    versionMatches,
  }
}

/**
 * The ratchet.
 *
 * A check that fails on every file without a ledger row is red on ~130 of them
 * from its first run and stays red, which is a gate people route around rather
 * than a gate. A check that only reports is not a gate at all. So the recorded
 * set may shrink and never grow — the same shape as the a11y baseline and
 * `check:negation` over in `plus-uno`, and for the same reason: the backlog is
 * real, nobody can clear it in one commit, and the thing worth stopping is the
 * NEXT file that is written and never applied.
 *
 * THE BASELINE RECORDS THE SET, NOT A COUNT. A count nets out — reconcile ten
 * files, write ten more that never run, and the gate reports green. It also
 * cannot say WHICH file is new, and "the number went up by one" sends the reader
 * to diff 130 filenames by hand. This is the same reason `check:storybook`'s
 * a11y baseline is keyed per story rather than kept as a total.
 *
 * `unparsable` is deliberately not ratcheted. A filename the convention cannot
 * read is cheap to fix and there is no backlog of them.
 *
 * @param {ReturnType<typeof ledgerDrift>} drift
 * @param {{neverApplied: string[], notInRepo: string[], duplicateNames: string[]}|null} baseline
 * @returns {string[]} failures, empty when the ratchet holds
 */
export function ratchetFailures(drift, baseline) {
  const failures = []

  if (drift.unparsable.length) {
    failures.push(
      `${drift.unparsable.length} migration file(s) do not match <version>_<name>.sql: ` +
        `${drift.unparsable.join(', ')}. Nothing can compare a file it cannot name.`,
    )
  }

  if (!baseline) {
    failures.push(
      'no baseline is recorded, so this check has nothing to hold to. Run it once ' +
        'with --update against a database and commit the result.',
    )
    return failures
  }

  const check = (key, label, detail) => {
    const recorded = new Set(baseline[key] ?? [])
    const added = drift[key].filter((x) => !recorded.has(x))
    if (!added.length) return
    failures.push(
      `${added.length} new ${label}:\n` +
        added.map((x) => `       ${x}`).join('\n') +
        `\n     ${detail}`,
    )
  }

  check(
    'neverApplied',
    'migration file(s) with no ledger row',
    'A file was written and never applied — the gap #148 describes, happening again. ' +
      'Apply it, or reconcile the ledger.',
  )
  check(
    'notInRepo',
    'ledger row(s) with no migration file',
    'Something was applied to the database that this repository has no record of.',
  )
  check(
    'duplicateNames',
    'duplicated ledger name(s)',
    'The same migration name was applied more than once, at different versions.',
  )

  return failures
}

/**
 * Entries the baseline still claims that are no longer true.
 *
 * A baseline that never shrinks is a backlog wearing a ratchet's clothes. When
 * someone reconciles a file, the entry has to go — otherwise the file is
 * readmitted silently the day it drifts again.
 *
 * @param {ReturnType<typeof ledgerDrift>} drift
 * @param {{neverApplied: string[], notInRepo: string[], duplicateNames: string[]}} baseline
 */
export function staleBaselineEntries(drift, baseline) {
  const stale = []
  for (const key of ['neverApplied', 'notInRepo', 'duplicateNames']) {
    const live = new Set(drift[key])
    for (const entry of baseline[key] ?? []) {
      if (!live.has(entry)) stale.push(`${key}: ${entry}`)
    }
  }
  return stale
}
