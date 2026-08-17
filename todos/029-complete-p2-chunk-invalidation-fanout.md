---
status: complete
priority: p2
issue_id: 029
tags: [code-review, performance, data]
dependencies: []
---

# Chunked blueprint fetch: invalidation fan-out + unstable chunk boundaries

## Problem Statement
`useCanvasBlueprints` now fetches in chunks of 4 scenarios (real progress
ticks). Two structural costs (ce:review 2026-08-17, performance-oracle):

1. **Write fan-out.** Every authoring write calls
   `invalidateQueries('canvas-blueprints')`, which prefix-matches ALL chunk
   keys — ~14 parallel PostgREST refetches per mutation on a 56-scenario
   board (auth/RLS overhead ×14, pooler slot pressure on hosted Supabase).
2. **Membership instability.** Chunks slice the sorted id list positionally;
   adding/removing one scenario shifts every later boundary, so all chunk
   keys change and the whole cache cold-starts on any create/delete.

## Proposed Solutions
- **A. Per-scenario invalidation predicate.** Key chunks structurally
  (`['canvas-blueprints:chunk', ...ids]`) and invalidate only chunks whose
  id list contains the mutated `service_scenario_id`; fall back to
  prefix-wide invalidation for membership changes. Effort: M. Risk: low.
- **B. Chunk size 1 (per-scenario queries).** Perfectly stable keys,
  per-scenario invalidation for free; cold board = 56 requests. Effort: S.
  Risk: request storm on cold load.
- **C. Hash-bucketed chunks.** Stable-ish membership under churn; boundary
  logic more complex. Effort: M.

## Acceptance Criteria
- [ ] A single cell edit refetches ≤1 chunk.
- [ ] Creating/deleting one scenario leaves untouched chunks cached.
- [ ] Progress bar still ticks on real request completions.

## Resources
- src/hooks/useCanvasBlueprints.ts, src/lib/queryClient.ts
- ce:review run 2026-08-17 (PR #24)
