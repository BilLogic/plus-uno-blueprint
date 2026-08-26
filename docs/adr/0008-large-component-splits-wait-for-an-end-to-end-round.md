---
status: accepted
audience: developers
summary: Three components are long enough to be worth splitting and are deliberately not split, because the tests that would catch a split going wrong do not exist yet — the hold has an exit condition, not an excuse.
---

# Large component splits wait for an end-to-end round

Three components have been flagged as too large since the 2026-08-08 harness
review, and re-measured today:

| file | then | now |
|---|---|---|
| `src/components/editor/CanvasAnnotationLayer.tsx` | 2157 lines | 2174 |
| `src/components/blueprint/BlueprintCellDetailPanel.tsx` | 1479 lines | 1444 |
| `src/components/editor/AgentPanel.tsx` | 19 `useState` | 13 |

They are deliberately not split. This records why, and what would change it,
because a hold with no stated exit is indistinguishable from neglect — and
because the *reason* is easy to get backwards.

## The reason is test coverage, not size

A split of this kind is a pure refactor: the behaviour is supposed to be
identical afterwards. That makes it exactly the change a test suite is for, and
exactly the change that is dangerous without one. The suite here is substantial
— 709 tests as of this writing — but it is strongest at the seams these files do
not sit on. `CanvasAnnotationLayer` is drag, pointer capture and geometry;
`AgentPanel` is a long-running session with its own state machine; the cell
panel is a form over an authoring ledger with identity-keyed inverses.

None of the three is well covered end to end. Splitting them now would move code
between files with no instrument that can tell whether behaviour moved with it.

## What this estate has learned about doing it anyway

Two recent findings are the argument in miniature.

A CSS at-rule was renamed and browsers dropped its entire block silently. The
contract test guarding it kept passing, because it read the file rather than the
computed cascade — so `touch-action` computed `auto` across the whole board with
every check green.

A lane chip set `backgroundColor` to a role key rather than a colour. Invalid
CSS, dropped by the browser, no error anywhere. It rendered untinted from the
day it shipped until a deduplication pass happened to read the line.

Both are the failure mode of a refactor without behavioural cover: the code
looks right, the guards are green, and the thing is broken in the browser.

## The exit condition

Split them when a green end-to-end round covers the three flows they own —
annotation drag, an agent session, and a cell edit with its revert. That round
is the prerequisite, not a nice-to-have, and it is worth doing on its own merits
regardless of whether the split follows.

Until then, prefer extracting a genuinely independent piece — one with its own
tests, the way `AgentSettingsFields.tsx` came out of the settings rail — over a
structural split of the whole file.

## What this is not

This is not a claim that the files are fine. They are long, and the length
costs. It is a claim about ordering: the instrument comes before the surgery.
