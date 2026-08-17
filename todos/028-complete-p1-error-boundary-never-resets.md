---
status: complete
priority: p1
issue_id: 028
tags: [code-review, mobile, desktop, crash, resilience]
dependencies: []
---

# EditorErrorBoundary never resets — one throw wedges the whole app permanently

## Problem Statement

`EditorErrorBoundary` sets `state.error` and has no path back. There is no
reset key, no `componentDidUpdate` reset, no router to remount on navigation,
and the only affordance is a manual `window.location.reload()`. It is also
mounted *above* `EditorShell`, so it replaces the entire app — header, nav,
tab bar — not just the surface that threw.

The consequence: **any single recoverable throw is indistinguishable from a
hard crash**, because no gesture the user makes can clear it. This is the
amplifier that turns one intermittent bug into "the app crashes a lot."

## Findings

- `src/components/EditorErrorBoundary.tsx:29-52` — `render()` returns the
  fallback whenever `state.error` is non-null; nothing ever restores it to
  `null`. Line 46 is a reload button.
- `src/App.tsx:28` — mounted once, wrapping the whole editor, so the fallback
  swallows the chrome along with the content.
- After the first throw, tapping Journey, Map, ☰, or ✦ all do nothing — the
  fallback card stays until a manual reload.

Note the boundary's own docstring anticipates "a mobile tab running out of
memory mid-render" and correctly observes that a true OOM kills the tab
outright, which no boundary can catch — that presents as a blank page or a
Safari tab reload rather than the fallback card. Both failure shapes are in
play; see todo 023 for the memory pressure source.

## Proposed Solutions

**A. Reset on navigation.** Accept a `resetKey` prop (`surface + selectedScenarioId`
on mobile, the active tab key on desktop) and clear `error` when it changes.
*Pros:* restores the user's instinct — "go somewhere else and try again."
*Cons:* a genuinely broken surface will re-throw; acceptable, since the user
can then navigate away again.
*Effort:* Small. *Risk:* Low.

**B. Move the boundary inside the shell**, wrapping the content surface only,
so the chrome survives and the user always has a way out.
*Effort:* Small-Medium. *Risk:* Low.

**C. Add a "try again" button** that clears the error without a full reload,
preserving in-memory state (agent session, view state).
*Effort:* Small. *Risk:* Low.

**D. Report throws.** Nothing currently records that a boundary fired, which
is part of why this went unexplained. Log to the console at minimum.

## Recommended Action

_(triage)_ — A + B + C together; they are one small change to one file and
they convert a dead-end into a recoverable state. D if there is anywhere to
send it.

## Technical Details

- `src/components/EditorErrorBoundary.tsx:29-52`
- `src/App.tsx:28`
- Consumers: `EditorShell.tsx:83` fork (both shells inherit the boundary)

## Acceptance Criteria

- [ ] After a thrown error, navigating to another surface clears the fallback
- [ ] The app chrome (nav, tabs) remains usable when a content surface throws
- [ ] "Try again" recovers without discarding the agent session
- [ ] A fired boundary leaves a console record

## Work Log

- 2026-08-16: Found by the crash root-cause investigation. Identified as the
  amplifier behind the "crashes a lot" reports rather than a cause in itself.

## Resources

- Related: todo 023 (the memory/churn source most likely to trigger throws)
