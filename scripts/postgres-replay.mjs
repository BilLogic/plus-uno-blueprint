/**
 * What a from-scratch replay of `supabase/migrations/` **in Postgres** means.
 *
 * NOT `migration-replay.mjs`, and the difference is the point. That one is a
 * static model: it reads the files, matches statement heads, treats every
 * `$$ … $$` body as opaque text, and reports what the repository CLAIMS the
 * schema is. Its own docstring says so — *"Do not read a clean run as evidence
 * that the series would replay in Postgres."* This is the other half: the files
 * handed to a real server, which is the only thing that can find a malformed
 * literal, an unaliased target table, or a `create table` rolled back by an
 * assertion three statements later.
 *
 * #148 asked whether the series can rebuild the schema. Nothing could answer
 * it: `supabase db reset` needs Docker, and this repository's machine has none.
 * A local Postgres 17 with a small Supabase-shaped prelude answers it without
 * Docker and without touching a hosted project, and the answer is **no** — 188
 * of 826 files fail against an empty database.
 *
 * THE NUMBER ON ITS OWN IS MISLEADING, which is why this module exists rather
 * than a bare failure count. The failures are not 188 independent defects; they
 * are a handful of causes with long tails, and the classes stay apart because
 * each one has a different answer:
 *
 * - **data** — a foreign key violation, or a structural trigger raising. The
 *   overwhelming majority. Every one descends from the first:
 *   `20250603170000_warm_up_step2_cells.sql` inserts a cell pointing at a layer
 *   and a step that **no migration in the repository ever creates**. Those rows
 *   exist only in production. So the series was never a complete seed, and no
 *   amount of fixing SQL makes it one.
 *
 * - **assertion** — a migration's own `raise exception 'expected N …'` firing
 *   because the data above is missing. These matter more than their count
 *   suggests: several sit in the same transaction as DDL, so a missing seed row
 *   rolls back a `create table`. `20260820170000_stakeholders.sql` creates
 *   `stakeholders`, seeds six rows, asserts six, finds zero, and takes the table
 *   down with it — which is why four later migrations report
 *   `relation "public.stakeholders" does not exist`.
 *
 * - **structure** — a reference to a column, relation or function that is not
 *   there. Almost always downstream of an assertion rollback above.
 *
 * - **syntax** — the file cannot be parsed, or its literals are invalid. The
 *   only class that is a defect in the file itself, independent of everything
 *   else, and there are two. Both mean the file has never run anywhere,
 *   production included.
 *
 * WHY A RATCHET, not a threshold. A check that goes red on 188 files from its
 * first run is a check people route around. The recorded set may shrink and
 * never grow: what it stops is the *next* migration written against an apply
 * path that does not exist.
 */

/** The four ways a migration fails a from-scratch replay. */
export const FAILURE_CLASSES = ['syntax', 'assertion', 'data', 'structure']

const SYNTAX = [
  /syntax error/i,
  /invalid input syntax for type/i,
  /missing FROM-clause entry/i,
  /column reference .* is ambiguous/i,
]

const DATA = [
  /violates foreign key constraint/i,
  /violates not-null constraint/i,
  /violates unique constraint/i,
  /duplicate key value/i,
]

const STRUCTURE = [
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /function .* does not exist/i,
  /type .* does not exist/i,
  /constraint .* does not exist/i,
  /permission denied/i,
]

/**
 * Which class a failure belongs to.
 *
 * ORDER MATTERS AND IS NOT ALPHABETICAL. A structural trigger raises
 * `cells: layer_id does not exist`, which ends in the same four words as a
 * genuinely absent column — so the deliberate raises have to be recognised
 * before the structural patterns get a look. Reversed, the report claims
 * fifteen missing columns that are all one trigger firing fifteen times.
 */
export function classifyFailure(errorText) {
  const text = String(errorText ?? '')
  if (SYNTAX.some((pattern) => pattern.test(text))) return 'syntax'
  // A raise from inside the schema's own guards: `raise exception 'expected …'`,
  // the structural triggers, which prefix the table name, and the rename
  // migrations' `N rows in the map match no path`.
  if (/ERROR:\s+expected /i.test(text)) return 'assertion'
  if (/ERROR:\s+[a-z_]+:\s/i.test(text)) return 'assertion'
  if (/ERROR:\s+\d+ (rows|mapped)/i.test(text)) return 'assertion'
  if (DATA.some((pattern) => pattern.test(text))) return 'data'
  if (STRUCTURE.some((pattern) => pattern.test(text))) return 'structure'
  return 'structure'
}

/** Just the message, without psql's `file:line:` prefix. */
export function errorMessage(errorText) {
  const match = String(errorText ?? '').match(/ERROR:\s+(.*)$/m)
  return match ? match[1].trim() : String(errorText ?? '').trim()
}

/**
 * A replay reduced to what a reader needs: the totals, the split, and the
 * FIRST failure — the only one guaranteed not to be a consequence of another.
 */
export function summariseReplay({ applied, failures }) {
  const byClass = Object.fromEntries(FAILURE_CLASSES.map((name) => [name, 0]))
  for (const failure of failures) byClass[classifyFailure(failure.error)] += 1
  return {
    total: applied + failures.length,
    applied,
    failed: failures.length,
    byClass,
    first: failures[0] ?? null,
  }
}

/**
 * Files failing now that were not failing when the baseline was recorded.
 *
 * The baseline records the SET, not a count. A count nets out — repair ten,
 * write ten more that cannot replay, and it reports green — and it cannot name
 * which file is new, which sends the reader to diff 188 filenames by hand.
 */
export function ratchetFailures(failures, baseline) {
  if (!baseline) return { newlyFailing: [], stale: [] }
  const recorded = new Set(baseline.failing ?? [])
  const now = new Set(failures.map((failure) => failure.file))
  return {
    newlyFailing: [...now].filter((file) => !recorded.has(file)).sort(),
    stale: [...recorded].filter((file) => !now.has(file)).sort(),
  }
}
