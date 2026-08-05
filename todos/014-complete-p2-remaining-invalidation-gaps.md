---
status: complete
priority: p2
issue_id: 014
tags: [code-review, cache, tanstack-query]
dependencies: []
---

# Remaining cache-invalidation gaps after the TanStack migration

Same root cause as 013 (`staleTime: Infinity`, explicit-only revalidation);
lower blast radius.

## Findings

1. **`lane-sources` never invalidated.** Key at
   `CreateBlueprintDialog.tsx:46`; `addLane`/`removeLane` in
   `BlueprintLaneHandles.tsx:118` invalidate only `'lifecycle-phases'` +
   `'canvas-blueprints'` (`:123-125`). Create Blueprint's lane picker goes
   permanently stale after lane add/remove.
2. **Evidence list serves pre-insert data after remount.**
   `useEvidence.ts:18` keys on `evidence:${cellId}:${reloadToken}`; token is
   component-local state (`CellEvidenceTab.tsx:259-260`), resets to 0 on
   remount — reopening the panel serves the cached `…:0` pre-insert list
   forever. Pre-merge every mount refetched. Also the only unbounded
   dead-key producer under `gcTime: Infinity`.
3. **`value-audiences` never invalidated.** Key at
   `useValueAudiences.ts:15`; `CellPanelEditor.tsx:325-329` invalidates five
   prefixes, not this one. Autocomplete suggestions stale for the session —
   free-text still works.

## Proposed Solutions

1/3: add the missing `invalidateQueries(...)` calls at the mutation sites.
2: drop the reloadToken from the key; call
`invalidateQueries(\`evidence:${cellId}\`)` after insert/delete instead.
Effort: Small each. Risk: Low.

## Recommended Action

All three — fixed in the review-fix commit on feat/derived-layer-slices.

## Acceptance Criteria

- [ ] Lane add/remove refreshes Create Blueprint picker
- [ ] Evidence panel shows the inserted source after close/reopen
- [ ] New audience appears in suggestions after save

## Work Log

- 2026-08-05: Found by architecture reviewer during /ce:review of the
  design-system merge. Fixed same session.
