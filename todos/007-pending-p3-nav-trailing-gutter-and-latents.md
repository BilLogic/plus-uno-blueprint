---
status: pending
priority: p3
issue_id: "007"
tags: [code-review, sidebar, canvas]
dependencies: []
---

# Small review leftovers: trailing gutter, multi-viewport keys, token staleness

## Problem Statement
Three benign-today items from the 2026-08-03 review, recorded so the
assumptions are explicit:

1. `SlideNav` passes an always-truthy fragment as `trailing`, so read-only
   rows reserve a dead gutter (finding #13).
2. Every mounted `useZoomPanViewport` binds ⌘+/−/0 and a window wheel
   listener; safe while one viewport mounts per screen, wrong the day the
   comparison view mounts two (review notes; wheel now uses
   stopImmediatePropagation but keyboard zoom would double-fire).
3. `RenameSliceDialog` uses the list entry's `updated_at` captured at
   menu-open; a background refetch between open and save yields a spurious
   conflict message.

## Acceptance Criteria
- [ ] trailing is undefined when both halves are empty
- [ ] keyboard/wheel binding strategy decided before comparison view ships
- [ ] rename conflict either retries with a fresh read or keeps this message
      deliberately

## Work Log
- 2026-08-04: Item 1 investigated — NavRow renders `{trailing}` inline; a
  fragment of nulls renders nothing and flex gap ignores it, so there is no
  dead gutter in practice. No change. Items 2–3 remain deliberate deferrals.
