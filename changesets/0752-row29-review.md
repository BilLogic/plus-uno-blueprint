# #752 row 29: retire the email call-off cells on 12+ hours ahead

This batch has eight operations: four `update_cell_status` writes through
the sanctioned host capability, plus one `add_evidence` row on each of the
four cells. Exact expected values were read through dev authentication on
October 31, 2026. No content, summary, structural key, placement, resource
or membership changes. Prepared and dry-run only. Apply requires Bill's
approval of this exact hash on the ticket.

## Decision and evidence

The owner decided to take the late call-off email/form step off the 12+
hours path. The production code supports that decision:
[`CallOffRequestServiceImpl.java:138`](https://github.com/CMU-PLUS/web-app/blob/c78ac8abddc16bf45104940cd4dc0fa87d09d3bd/java/source/edu/cmu/pl2/service/impl/CallOffRequestServiceImpl.java#L138)
on web-app `dev` (c78ac8a) sets `requiresApproval = hoursBefore < 12.0`. A
call-off 12 or more hours ahead is auto-approved. One inside 12 hours goes to
manual review in the app, with a Slack notification to supervisors. Neither
branch routes to an email or a form. Slack confirms that the old form/email
route was replaced. This is the production evidence #737 asks for before a
retirement, which the Figma, TE2a and Attendance Procedures sources alone did
not supply.

## Operations

Step `a0000000-0000-4000-8000-000000000942`, “Files late call-off (<12h,
immediate removal)”, in Call-off Request. On 12+ hours ahead
(`a0000000-0000-4000-8000-000000000808`) it sits at position 6 and holds
exactly these four cells:

| Cell | Lane | Content | Status |
| --- | --- | --- | --- |
| `…00170303` | Regular Tutor | “If it is less than 12 hours before session, tutor emails supervisor.” | live → deprecated |
| `…00170304` | Front Stage Actions | “Tutor supervisor receives email request for shift swap.” | live → deprecated |
| `…00170306` | Front Stage Touchpoints | “Email” | live → deprecated |
| `…00170310` | Storyboard | blank | live → deprecated |

Each cell also gains one `doc` evidence row titled “KB audit #752 row 29 —
…00170xxx”, citing the web-app line and the Slack confirmation. These cells
have no `cell_key`, so the evidence pairs on the cell id, as in the #750
recovery batch. The blank storyboard cell goes through `update_cell_status`,
which writes status alone and needs no label, so no label is invented.

## The step stays on Under 12 hours

The step is shared. Its other membership is Under 12 hours
(`b0000000-0000-4000-8000-000000000809`), position 2, where its two cells are
current: “Files the late call-off in the app; removal is immediate and review
decides excused or unexcused.” and “PLUS App”. That membership and both cells
are guarded unchanged.

## Not in this batch: removing the step from 12+ hours ahead

The membership removal is not drafted, because the database refuses it while
the four cells sit on that step. The `path_step_keeps_saved_cells` trigger
blocks any write that removes a path-step holding cells, `set_path_steps`
included (“This step has saved cells on this path”). Only two routes remove
it, and both delete the four cells:

- the app's confirmed path removal (`change_step_path` with the confirmed
  cells), which archives the cells, placements and resources in a receipt
  and can be undone; or
- deleting the four cells first, then `set_path_steps`.

Deletes are a human action, so neither belongs in this changeset. A
`set_path_steps` op would pass dry-run, because dry-run never calls the RPC,
and then fail at apply after the four status writes. Deprecation is the part
the runner can do. Taking the step off the path stays with the owner, through
the confirmed removal in the app. If the owner does that removal, these
status writes become history with the archived cells. The deprecation is
then optional, but harmless.

## Verification

Dry-run passes with no failures, ledger 416→416. Eleven scoped checks cover
each cell's evidence (0→1), the four cells' statuses, both memberships of the
step, the two Under 12 hours cells, the path's six steps, the step name, the
two resources on `…00170303` and the touchpoint placement on `…00170306`.
