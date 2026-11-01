# #752 Onboarding gate move and Slack step rename

This batch has two operations, both through the sanctioned host capabilities
installed on 2026-10-31: one identity-preserving `move_cell` and one guarded
`rename_step`. Exact expected values were read through dev authentication on
October 31, 2026. No content, status, summary, evidence, placement or key
changes. Prepared and dry-run only; apply requires Bill's approval on the
ticket.

## Operations

- **Row 17, move Onboarding gate.** Cell `a0000000-0000-4000-8000-000000130208`
  (“Onboarding gate”, live) moves within Session Sign Up / No conflicts /
  Back Stage Touchpoints from Review scheduling (`…0892`) position 0 to
  Sign up (`…0891`) position 1. Sign up position 0 in that lane holds
  `a0000000-0000-4000-8000-000000130108`, “PLUS App database”, so the move
  uses the vacant secondary position and leaves that cell exactly as it is.
  The cell has no evidence rows, resources or incident dependencies. It keeps
  its one placement (`a0248c7e…`, touchpoint `2ab5eef0…`, position 1).
- **Row 41, rename the step.** Step `b2000000-0000-4000-8000-000000000022`
  in Student Just Joined changes from “Post in school Slack channel” to
  “Post in #in-session-support”. It is not shared: its one membership is
  Few or none by 10 min (`b2000000-0000-4000-8000-000000000001`), position 2.
  The dry-run's affected-path list confirms that single path. No step in the
  service already carries the new name. #739 already applied the step's cell
  wording (`…032`); its three cells are guarded unchanged.

## Sources

- Row 17: #739 audit row 17 cites Figma 11272:427878 and card 2494.
- Row 41: [Module 3](https://www.notion.so/26fb7cca498280dfa0daf291f2635b3f)
  and Help Center 333b/3a2b, as cited by #739 audit row 41. The channel name
  matches the cell text #739 applied after its own source review.

## Representation notes

- The cell keeps its stable `cell_key`,
  `…/back-stage-tech/review-scheduling`, which still names the old step. Keys
  are identity, so the move preserves it rather than rewriting it.
- The step keeps its summary, “The lead tutor posts in the school's Slack
  channel, where supervisors pick it up.” Changing it to name the channel is a
  separate `update_step_spec` edit, not in this ticket's scope.

## Out of scope: row 29 retirement

Original row 29 stays outside this batch. Retiring cells `…00170303`,
`…00170304`, `…00170306` and `…00170310` on the 12+ call-off path, and
removing that step from the path, needs production-data evidence under #737.
The audit cites Figma, TE2a and Attendance Procedures only. The owner has to
supply that evidence before a retirement changeset can be drafted. The
operations now exist for it: `update_cell_status` covers the blank storyboard
cell, and `set_path_steps` covers the membership removal. Evidence is the only
blocker. #752 stays open for row 29 after this batch lands.

## Verification

Dry-run passes with no failures, both affected paths enumerated, ledger
341→341. The pre-apply verifier fails as expected: the coordinates and name
are unchanged and no apply receipt exists. Nine scoped checks cover the
source path's cell count, the source and destination squares, the cell's
placement and evidence, the scenario's step count, the step's membership,
its three cells and the new name's absence before apply.
