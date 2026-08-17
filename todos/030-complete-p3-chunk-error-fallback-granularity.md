---
status: complete
priority: p3
issue_id: 030
tags: [code-review, reliability]
dependencies: [029]
---

# One failed blueprint chunk discards all successful chunks

## Problem Statement
`useCanvasBlueprints` swaps the ENTIRE board to static fallbacks when any
chunk errors (`if (anyError) return staticFallbacks`). With ~14 requests
instead of 1, tail-timeout exposure is ~14×, and one loss throws away up
to 13 fetched chunks.

## Proposed Solutions
- Per-chunk fallback: derive from successful chunks, static-fallback only
  the scenarios inside failed chunks. Effort: S–M.
- Or enable 1 retry for chunk queries (global `retry: false` stays).

## Acceptance Criteria
- [ ] A single chunk timeout degrades only that chunk's scenarios.

## Resources
- src/hooks/useCanvasBlueprints.ts (derived memo)
