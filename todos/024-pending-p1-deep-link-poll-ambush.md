---
status: pending
priority: p1
issue_id: 024
tags: [code-review, mobile, race-condition, deep-links]
dependencies: []
---

# Deep-link poll outlives its navigation and ambushes the user

## Problem Statement

`useCellDeepLink` starts a 150ms DOM poll that lives as long as the shell,
hunting for a cell whose surface lives only as long as the current scenario.
The two lifetimes are unrelated and nothing reconciles them, so the poll can
fire seconds after the user has navigated somewhere of their own choosing —
scrolling the reader and slamming a bottom sheet open on a cell nobody
touched. Worst-case window is ~20 seconds (10s query race + 10s poll).

These links are shared by uno-bot into Slack, which mostly opens on phones,
so this lands on the least forgiving surface.

## Findings

1. **No navigation guard on the panel open.**
   [useCellDeepLink.ts:79-111](src/hooks/useCellDeepLink.ts:79). The hook's own
   comment at lines 20-22 states the correct doctrine — `seedBaseSelection`
   "no-ops once the user has navigated, so a slow resolve cannot yank someone
   away from a place they chose" — and that doctrine is then not applied to
   the code twenty lines below that actually moves the screen.

2. **`openedRef` latches on attempt, not success.**
   [useCellDeepLink.ts:78-86](src/hooks/useCellDeepLink.ts:78). A refetch
   failure (phone returning from background triggers these constantly) makes
   `scenarioId` null, cleanup cancels the poll, and the retry hits the latch
   and returns early. The deep link then silently does nothing, with no
   warning — the warning only fires from inside the poll that was cancelled.
   Also breaks under StrictMode double-mount in dev.

## Proposed Solutions

**A. Guard on current selection + latch on success.**
Bail when `selectedScenarioId !== scenarioId`; move `openedRef.current = cellId`
to the branch where the element was actually found (and to a genuine timeout
give-up, so it is not retried forever).
*Pros:* small, surgical, matches the doctrine already written in the file.
*Cons:* none material. *Effort:* Small. *Risk:* Low.

**B. Add a wall-clock budget.** A deep link unresolved ~3s after its scenario
appears has lost its claim on the user's attention. 10s is not a poll timeout,
it is an ambush window.

**C. Replace polling with a mount callback** — have the reader signal when its
cells are published rather than having the hook hunt the DOM.
*Effort:* Medium. *Risk:* Medium (touches the reader's contract).

## Recommended Action

_(triage)_ — A + B together; C as a later cleanup.

## Technical Details

- `src/hooks/useCellDeepLink.ts:70-111`
- `src/lib/supabaseFetchTimeout.ts:2` — the 10s query race
- Consumers: `MobileShell.tsx:58`, desktop equivalent

## Acceptance Criteria

- [ ] Under throttled network, navigating during resolution cancels the link
- [ ] A failed-then-successful refetch still opens the panel
- [ ] Deep link works in dev under StrictMode double-mount
- [ ] Give-up path emits the existing console warning

## Work Log

- 2026-08-16: Found by frontend-races review during mobile crash investigation.

## Resources

- Related: todo 023 (surface remount), 025 (boot slice)
