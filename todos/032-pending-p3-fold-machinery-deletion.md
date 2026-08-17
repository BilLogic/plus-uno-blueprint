---
status: pending
priority: p3
issue_id: 032
tags: [code-review, cleanup]
dependencies: []
---

# Delete the dormant fold/pleat machinery

## Problem Statement
Fold is fully retired (human toggle, merged-entry auto-fold preset, and
the agent's collapse_shared/toggle_pleat commands are all gone), so
nothing can set `fold.folded` anymore. The machinery is dormant dead
code: `src/lib/compareFold.ts`, pleat tracks in `useCompareGridAxis`,
`ComparePleatCell` + pleat spacers in both grids, `expandComparePleat` /
`toggleComparePleat` / fold state in `compareReviewStore`,
`showPinGlyph`, and the fold line in the compare `get_ui_state` context.

## Proposed Solutions
- Single deletion pass removing the above + their tests; keep the
  divergence model/ledger untouched. Effort: M. Risk: low (nothing
  reachable sets fold=true; verify no persisted state can).

## Acceptance Criteria
- [ ] No references to fold/pleat remain outside docs history.
- [ ] Compare views render identically before/after (fold was already
      unreachable).

## Resources
- ce:review 2026-08-17 simplicity + agent-parity reports
