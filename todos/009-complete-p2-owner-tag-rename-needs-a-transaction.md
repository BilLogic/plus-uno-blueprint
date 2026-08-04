---
status: complete
priority: p2
issue_id: "009"
tags: [code-review, data-integrity, owners, supabase]
dependencies: []
---

# Owner-tag rename should be one transactional RPC with an id-based revert

## Problem Statement
`renameEverywhere` in `src/components/blueprint/OwnerTagSelect.tsx` runs two
independent UPDATEs (`owner`, then `perceived_owner`). A failure between
them half-renames the vocabulary — the exact drift the tag dropdown exists
to prevent — and because `recordChange` only runs after both succeed, the
half that landed is untracked. The revert path in
`src/lib/revertChange.ts` (`rename_owner_tag`) has the identical two-write
hole, and it reverts *by name*, so any cell that legitimately carried the
new name before the rename would be corrupted on revert. (The client now
refuses renames onto an existing tag, which blocks the worst merge case,
but the transactional gap and the name-based revert remain.)

## Proposed Solutions
1. **`rename_owner_tag(from, to)` RPC** (recommended): one `security definer`
   function updating both columns in one transaction, returning affected
   cell ids; the client records those ids as the revert payload and reverts
   by id, not by name. ~15 lines of SQL + a grant. Effort: Small.
2. Client-side two-phase with compensation — rollback the first update if
   the second fails. Still a window; not recommended.

## Acceptance Criteria
- [ ] Rename is atomic (single RPC, single transaction)
- [ ] Revert restores exactly the cells the rename touched, by id
- [ ] Session entry records after the RPC succeeds, as with other RPCs

## Work Log
- 2026-08-04: Found by race + TS reviewers during /ce:review. Client-side
  merge-block and Enter-picks-existing shipped as mitigation.

- 2026-08-04 (later): DONE — `rename_owner_tag(from,to)` RPC applied to
  osybxeojvsqcwxkgnalm (migration 20260804120000), returns affected cell
  ids; client records `rename_owner_tag_scoped` revert executed via
  id-scoped updates.
