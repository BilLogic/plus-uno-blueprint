---
status: complete
priority: p2
issue_id: 015
tags: [code-review, quality, dead-code]
dependencies: []
---

# Dead style helpers rewritten during the merge instead of deleted

## Findings

1. `src/lib/blueprintCellStyle.ts:127-144` —
   `getBlueprintCellSurfaceStyle` + `getBlueprintCellSurfaceStyleFromLane`:
   zero external callers; the merge rewrote them onto the new CSS tokens and
   kept a doc comment describing consumers that do not exist. Delete both +
   then-unused `BlueprintLayerStyle` / `CSSProperties` imports (~30 LOC).
2. `src/lib/techPillTheme.ts:7-30` — `getTechPillStyle()` + `TechPillStyle`:
   last caller (`TechPillFace`) switched to `blueprintToneAttrs` in the same
   merge. Delete function + type + `BLUEPRINT_CELL_BORDER_COLOR` import.
3. After 2 the module is only `getTechPillToneFor`, a pass-through of
   `getTouchpointTone` whose `chosen?` param no caller passes
   (`BlueprintTechPill.tsx:33`, `TechPillFace.tsx:30`). Import
   `getTouchpointTone` directly and delete the file.

## Recommended Action

Delete all three — misleading comments make this P2, not P3. Fixed in the
review-fix commit.

## Acceptance Criteria

- [ ] `npm run build` + `npm test` green after deletion
- [ ] No references to the deleted names repo-wide

## Work Log

- 2026-08-05: Found by simplicity reviewer during /ce:review. Fixed same
  session.
