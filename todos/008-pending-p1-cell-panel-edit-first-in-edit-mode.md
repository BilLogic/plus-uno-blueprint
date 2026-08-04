---
status: pending
priority: p1
issue_id: "008"
tags: [code-review, panel, editing, design]
dependencies: []
---

# The cell panel should be an editor when the canvas is in Edit mode

## Problem Statement
Opening a cell from Edit mode shows the same read-first panel View gets:
prose rendered as text, "Specify function & form" as the only entry into
editing, and several fields (title/content, lane, tech items, pictures,
links) with no editing affordance at all. The user asked directly: in Edit
mode the panel should open *in* edit state, and every field it shows should
be configurable.

## Findings
- Panel: `src/components/blueprint/BlueprintCellDetailPanel.tsx` — reads
  `useCanvasModeValue()` nowhere today.
- Existing write surfaces to reuse: `CellContentEditor`,
  `CellDependencyEditor`, `CellContentSection`, `upsertCell`,
  `updateSliceMeta` patterns, the session change log.
- Constraint: tech items are one text field on a bundled cell until the
  tech-cell split lands — field-level editing for pills should follow the
  split, not precede it.

## Proposed Solutions
1. Mode-aware panel: same drawer, but Edit mode renders input variants of
   each field (content textarea, description, links editor), saving through
   existing RPCs on blur, recorded in the session log. Medium-Large.
2. Separate edit drawer component sharing sections. Larger, cleaner split.

## Acceptance Criteria
- [ ] Panel opened from Edit mode starts editable, no extra click
- [ ] Every visible field either edits in place or states why not
- [ ] Writes appear in the session change counter
- [ ] View mode panel unchanged
