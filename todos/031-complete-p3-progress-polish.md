---
status: complete
priority: p3
issue_id: 031
tags: [code-review, quality]
dependencies: []
---

# Load-progress polish: creep reset + merged-arrow dedupe key

## Problem Statement
Two small ce:review leftovers:
1. `CanvasLoadProgress` creep never resets downward — if `units.total`
   grows mid-session (scenario set changes while mounted), `display =
   max(percent, creep)` overstates until real percent catches up.
2. Merged arrow dedupe keys only `source target`; two semantically
   different triggers between the same remapped pair (distinct label/kind)
   collapse to the first path's stroke.

## Proposed Solutions
1. Reset creep when `percent` drops below it (or key the bar on a load
   session id). Effort: S.
2. Include kind+label in the dedupe key, or dedupe only identical trigger
   rows. Effort: S.

## Acceptance Criteria
- [ ] Bar never shows a higher percent after `total` grows.
- [ ] Distinct-label triggers between one pair both render (or a decision
      is recorded that geometry-identical arrows dedupe regardless).

## Resources
- src/components/editor/CanvasLoadProgress.tsx
- src/components/blueprint/MergedCompareGrid.tsx (arrowDataByPath)
