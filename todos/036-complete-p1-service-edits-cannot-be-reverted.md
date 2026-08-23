---
status: complete
priority: p1
issue_id: 036
tags: [code-review, correctness, authoring]
dependencies: []
---

# Service edits record a revert that calls a Postgres function that does not exist

## Problem Statement

`src/lib/serviceSpecMutations.ts:46` and `:89` record revert specs with
`fn: 'update_service_summary'` and `fn: 'update_business_model'`. Both are **direct table
writes** (`.from('services')`, `.from('business_model')`), but `executeRevert`
(`src/lib/revertChange.ts`) has no case for either name, so both fall through to the
`default:` branch at line 303, which does `client.rpc(revert.fn, revert.args)`.

No Postgres function with either name exists in `supabase/migrations/` — grep returns zero.

Every service-panel edit therefore records a ledger entry whose "take back" button always
fails with a PostgREST 404. The agent's scoped `revert_my_changes` hits the same wall.

The business-model revert args are additionally camelCase (`deliveryCost`, `revenueModel`),
so even a future RPC with snake_case parameters would reject them.

## Findings

- The branch gave `WriteFn` a compile-time exhaustiveness test — but it covers `describeChange`,
  **not** `executeRevert`. The switch that actually performs the undo has no such guarantee.
- Two independent reviewers (TypeScript, architecture) found this separately.

## Proposed Solutions

### Option A — add explicit cases to executeRevert (recommended)
Add cases calling `updateServiceSummary` / `updateBusinessModel` with `{ record: false }`,
mirroring the existing `update_cell_content` case, and fix the camelCase args.
- Pros: matches the established pattern for direct-table mutations.
- Cons: leaves the underlying gap — the next direct-table mutation can repeat this.
- Effort: Small. Risk: Low.

### Option B — Option A plus a test that fires every RevertSpec.fn through the switch
Enumerate every `fn` any mutation module can record and assert `executeRevert` handles it.
- Pros: closes the class, not the instance. The exhaustiveness test that exists proves the team
  already believes in this technique — it was just pointed at the wrong switch.
- Cons: needs a registry of recordable fns, or a type-level derivation.
- Effort: Medium. Risk: Low.

## Recommended Action

## Technical Details

- Affected: `src/lib/revertChange.ts:303`, `src/lib/serviceSpecMutations.ts:40-50,83-93`
- Related: `src/lib/authoringSession.ts:129` — `DESTRUCTIVE` is an untyped `Set<string>`, the same
  missing-compile-time-guarantee shape

## Acceptance Criteria

- [ ] Editing the service summary, then reverting from the session ledger, restores the old value
- [ ] Same for every business_model field
- [ ] A test covers every `RevertSpec.fn` a mutation module can record

## Work Log

### 2026-08-21
Found during `/ce:review`. **Learning:** the exhaustiveness pattern was applied to the switch that
writes the ledger *sentence* but not to the switch that performs the *undo* — so the branch had a
compile-time guarantee protecting the cosmetic half and nothing protecting the functional half.
When adding a type-level guard, check it points at the switch whose failure actually costs data.

## Resources

- Pattern to mirror: the `update_cell_content` case in `src/lib/revertChange.ts`
