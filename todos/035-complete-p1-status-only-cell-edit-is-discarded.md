---
status: complete
priority: p1
issue_id: 035
tags: [code-review, correctness, panels]
dependencies: []
---

# A status-only cell edit is silently discarded on Save

## Problem Statement

`src/components/blueprint/CellPanelEditor.tsx:235` computes `contentChanged` from text,
description, owner and perceivedOwner — but not `status`. The write that carries `status`
(line 279) is gated on `(cellId && contentChanged)` at line 270.

So: open an existing cell, change only the `StatusSelect` this branch just shipped, click Save.
The button is enabled (it gates only on `busy || blocked`), `handleSave` runs, **no mutation
fires**, invalidations run, the panel closes — and the old status paints back.

Silent, and it lands on the one field the whole entity_status refactor exists to make editable.

## Findings

- `contentChanged` (lines 235–239) omits `form.status !== baseline.status`.
- `StatusSelect` renders at line 390, so the control is present and appears to work.
- No error surfaces; the failure is indistinguishable from success until the next paint.

## Proposed Solutions

### Option A — add status to the comparison (recommended)
Add `form.status !== baseline.status` to `contentChanged`.
- Pros: one line, matches how every other field is handled.
- Cons: none.
- Effort: Small. Risk: Low.

### Option B — derive `changed` from a whole-object comparison
Replace the hand-listed field comparison with a shallow compare of `form` against `baseline`.
- Pros: the next added field cannot be forgotten — this bug class ends.
- Cons: needs stable field ordering and null/'' normalisation to avoid false positives.
- Effort: Small-Medium. Risk: Low-Medium.

## Recommended Action

## Technical Details

- Affected: `src/components/blueprint/CellPanelEditor.tsx:235`
- Related: the same hand-listed-comparison shape is copied across the five panels (see todo 037)

## Acceptance Criteria

- [ ] Changing only the status on an existing cell writes and persists across a reload
- [ ] A test covers a status-only edit
- [ ] Save stays disabled when genuinely nothing changed

## Work Log

### 2026-08-21
Found during `/ce:review`, reported independently by the TypeScript reviewer and confirmed in the
code. Option B is worth considering because this is the second time a hand-maintained field list
has silently dropped a column on this branch (the first was the mapper in `normalizeBlueprint.ts`).

## Resources

- Sibling bug class: `docs/plans/2026-08-21-001-refactor-skeleton-loading-fidelity-plan.md`
