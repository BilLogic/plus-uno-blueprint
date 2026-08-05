---
status: complete
priority: p1
issue_id: 013
tags: [code-review, cache, tanstack-query, correctness]
dependencies: []
---

# `scenario-paths:*` cache never invalidated by any path mutation

## Problem Statement

The TanStack Query migration (merge `dc6975f`) set `staleTime: Infinity` /
`gcTime: Infinity` — revalidation is explicit-only via `invalidateQueries`.
No path mutation invalidates the `scenario-paths` prefix, so the paths
catalog is stale forever after any path write.

## Findings

- Key: `scenario-paths:${scenarioId}` — `src/hooks/useScenarioPaths.ts:21`
- Consumers: `PathsSidebarSection.tsx:63`; feeds `CreateVersionDialog` as its
  `versions` list (duplicate-source picker + name-uniqueness check,
  `CreateVersionDialog.tsx:73`)
- Mutation sites and what they actually invalidate:
  - `CreateVersionDialog.tsx:96` (createPath/duplicatePath) → only `'lifecycle-phases'`
  - `StructureRowMenu.tsx:88` (duplicatePath), `:217` (renamePath) → only `'lifecycle-phases'`
  - `DeleteStructureDialog.tsx:134-135` (deletePath) → `'lifecycle-phases'`, `'slices'`
- User-visible failure: create a path, reopen "New path" — stale duplicate
  list; the uniqueness check misses the new name, second same-name create
  goes to the server. After a rename, old name still "taken", new one isn't.

## Proposed Solutions

1. **Add `invalidateQueries('scenario-paths')` at all four sites** (prefix,
   not scoped). Pros: one-liners, matches house pattern. Cons: refetches
   other scenarios' path lists too (cheap). Effort: Small. Risk: Low.
2. Scoped ``invalidateQueries(`scenario-paths:${scenarioId}`)``. Pros:
   minimal refetch. Cons: scenarioId must be threaded to each site. Effort:
   Small-Medium. Risk: Low.

## Recommended Action

Option 1 — fixed in the review-fix commit on feat/derived-layer-slices.

## Acceptance Criteria

- [ ] All four mutation sites invalidate `scenario-paths`
- [ ] Create → reopen dialog shows the new path; rename frees the old name

## Work Log

- 2026-08-05: Found by architecture reviewer during /ce:review of the
  design-system merge. Fixed same session.
