---
status: pending
priority: p1
issue_id: 034
tags: [code-review, database, migration, data-integrity]
dependencies: []
---

# The service_lifecycles rename never reached the function bodies

## Problem Statement

`20260821340000_retire_lifecycle.sql` renamed `service_lifecycles` → `services` and
`service_lifecycle_id` → `service_id`, then asserted success against
`information_schema.columns`. That view cannot see plpgsql function bodies, which are
stored as text and resolved at call time. The assertion passed while three functions broke.

Confirmed against the live database (`pg_proc.prosrc ~ 'service_lifecycle'`):

| Function | Reference | Blast radius |
| --- | --- | --- |
| `mint_cell_key` | `join public.service_lifecycles sl on sl.id = ph.service_lifecycle_id` | Called by `upsert_cell` — the write path for **every cell**, panel editor and agent `update_cell` alike |
| `create_phase` | existence check, duplicate-name check, `max(position)` probe, insert column list | Phase creation, UI and agent |
| `rename_phase` | sibling-name check reads the column twice | Phase rename |

Every prior rename in this series (`20260820080000`, `090000`, `120000`, `140000`) carried a
`pg_get_functiondef` sweep. `340000` did not.

## Findings

- Verified live: `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','semantic_search') and p.prosrc ~ 'service_lifecycle'` returns exactly those three.
- `mint_cell_key` is `called_by_n_functions = 1` (`upsert_cell`).
- `create_phase`'s **parameter** is still named `lifecycle_id`. That is the wire name
  `src/lib/authoringRpc.ts:248` passes and the agent registry mirrors — renaming it is a
  cross-repo change, not part of this repair.

## Proposed Solutions

### Option A — pg_get_functiondef sweep (recommended)
Follow the pattern the four prior renames established: fetch each definition, targeted
`replace`, assert the fragment matched, `execute`. Written already:
`supabase/migrations/20260821370000_the_rename_reaches_the_functions.sql`.
- Pros: matches repo convention; targeted replaces cannot corrupt neighbouring columns; includes a probe that actually *calls* `mint_cell_key` on a real row rather than trusting it to compile.
- Cons: none material.
- Effort: Small (written, not applied). Risk: Low — function bodies only, no data touched.

### Option B — recreate the three functions from source
- Pros: bodies end up matching the repo's `.sql` files exactly.
- Cons: those files are themselves several sweeps stale; would silently revert the layers→lanes and description→summary rewrites.
- Effort: Medium. Risk: High.

## Recommended Action

## Technical Details

- Affected: `supabase/migrations/20260821370000_the_rename_reaches_the_functions.sql` (new, unapplied)
- Database objects: `public.mint_cell_key`, `public.create_phase`, `public.rename_phase`

## Acceptance Criteria

- [ ] Migration applied to the live database
- [ ] `pg_proc` sweep query returns zero rows in both `public` and `semantic_search`
- [ ] `mint_cell_key` returns a non-empty key when called with a real cell's `(path_id, lane_id, step_id)`
- [ ] A cell edit saved from the panel succeeds end to end
- [ ] `create_phase` succeeds from the UI

## Work Log

### 2026-08-21
Found during `/ce:review` of `refactor/agent-tool-surface`; the data-integrity agent flagged it
and it was confirmed directly against the live database. Migration written. Both `apply_migration`
and a Bash read were blocked by the auto-mode classifier, so it is staged for the user to apply.

**Learning:** an assertion is only as good as what it can observe. `information_schema.columns`
cannot see function bodies, so a rename migration that asserts against it reports success while
leaving every function that names the old identifier deployable and broken. The four prior renames
in this series knew that; the fifth forgot. Any future rename needs the sweep *and* an assertion
that calls the function, not merely one that compiles it.

## Resources

- Sweep pattern: `supabase/migrations/20260820080000_*.sql`
- Broken by: `supabase/migrations/20260821340000_retire_lifecycle.sql`
