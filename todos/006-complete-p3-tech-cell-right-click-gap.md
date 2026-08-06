---
status: complete
priority: p3
issue_id: "006"
tags: [code-review, canvas]
dependencies: []
---

# Right-click between pills of a tech cell gets the browser menu

## Problem Statement
The context menu requires `[data-blueprint-cell-interactive]`, which the
pills-cell wrapper div never carries — right-clicking the background of a
tech cell (between pills) is inconsistent with every other cell face.

## Findings
- `src/components/editor/CanvasCellContextMenu.tsx` target selector
- Review finding #12. Likely dissolved entirely by the tech-cell split —
  check before building anything.

## Acceptance Criteria
- [ ] Right-click anywhere on a tech cell offers the cell menu, or the
      tech-cell split has landed and made the wrapper a real cell.

## Work Log
- 2026-08-04: Dissolved by the tech-cell split (stages 1-3 shipped). Every
  pill is its own cell button carrying data-blueprint-cell-interactive, so
  right-click hits a real cell everywhere in the lane.
