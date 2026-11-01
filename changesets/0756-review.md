# #756 deferred Goal Setting work (G4, G14, G9, G10; G13 proposal)

Prepared and dry-run only. **Apply requires owner approval** of the exact
runner hash below on #756. Nothing in this batch has been written.

The batch has 32 operations: 12 `rename_step`, 10 `insert_cell_at_position`
and 10 `add_evidence`. It has no `move_cell` operations. G13 is a placement
proposal for the owner to approve, below. Clears are human-only.

## Live values

Every expected value was re-read from production on October 31, 2026, as the
dev authoring user (reads only). Goal Setting has 7 paths, 60 steps, 63 lanes
and 375 cells, and the durable ledger holds 341 rows. All seven paths are live,
and Mid-cycle check stays live (a path check guards this). Each maintained path
has its own steps, with two exceptions. *Next student* is shared by All
conditions and No prior goals; no step in this batch touches it. Every
Mid-cycle check step is shared with the Goal data looks wrong exception path
that #741 G12 created.

## G4 and G14 step renames

Each rename guards the exact prior name, the scenario and the complete
`path_steps` membership list. A membership added, removed or reordered since
this read fails preflight.

| Key | Step | Before | After | Affected paths [position] |
|---|---|---|---|---|
| G4-step-9a07 | `…9a07` | If prompted, fill out goal achievement strategy with the student | Fill out goal achievement strategy with the student | No prior goals [7] |
| G4-step-9d07 | `…9d07` | If prompted, fill out goal achievement strategy with the student | Fill out goal achievement strategy with the student | New cycle, goals exist [7] |
| G4-step-9f08 | `…9f08` | If prompted, fill out goal achievement strategy with the student | Fill out goal achievement strategy with the student | Missed last session, no goals [8] |
| G4-step-9e08 | `…9e08` | If prompted, fill out goal achievement strategy with the student | Fill out goal achievement strategy with the student | Missed last session, has goals [8] |
| G14-step-9a02 | `…9a02` | Click on Set Goals CTA in the Action column | Click on Set goals CTA in the Action column | No prior goals [2] |
| G14-step-9b02 | `…9b02` | Click on 'Check Goals' CTA in the Action column | Click on 'Check goals' CTA in the Action column | Goal data looks wrong [2], Mid-cycle check [2] |
| G14-step-9b05 | `…9b05` | Once goal review is done, clicks on 'Check Goals' button | Once goal review is done, clicks on 'Check goals' button | Goal data looks wrong [5], Mid-cycle check [5] |
| G14-step-9d02 | `…9d02` | Click on 'Update Goals' CTA in the Action column | Click on 'Update goals' CTA in the Action column | New cycle, goals exist [2] |
| G14-step-9e02 | `…9e02` | Sees action color in dashboard is warning and CTA copy is 'Update Goals' within a mid-cycle goal check-in session. | Sees action color in dashboard is warning and CTA copy is 'Update goals' within a mid-cycle goal check-in session. | Missed last session, has goals [2] |
| G14-step-9e03 | `…9e03` | Click on 'Update Goals' CTA in the action column | Click on 'Update goals' CTA in the action column | Missed last session, has goals [3] |
| G14-step-9f02 | `…9f02` | Sees action color in dashboard is warning and CTA copy is 'Set Goals' within a mid-cycle goal check-in session. | Sees action color in dashboard is warning and CTA copy is 'Set goals' within a mid-cycle goal check-in session. | Missed last session, no goals [2] |
| G14-step-9f03 | `…9f03` | Click on 'Set Goals' CTA in the action column | Click on 'Set goals' CTA in the action column | Missed last session, no goals [3] |

G4 drops "If prompted" from the four maintained strategy steps (All conditions'
*Complete goal strategy* is out of scope). G14 changes only the label's case to
"Set goals", "Update goals" or "Check goals". The rest of each name is left as
it is, including the inconsistent quoting and "action column" casing.

Two renames reach a sixth path. `G14-step-9b02` and `G14-step-9b05` rename
shared Mid-cycle check steps, so they also rename the same columns on Goal data
looks wrong (positions 2 and 5). That is the same moment, so the shared rename
is correct, but it touches a path outside the five maintained paths.

## G9 and G10 Regular Tutor insertions

Each insertion goes at position 1 in an exact vacant slot, beside the existing
position-0 goal conversation in the same Regular Tutor square. The runner
refuses an occupied slot and never upserts. Every existing conversation is
guarded by identity, `cell_key`, position and content. Each per-path cell set
is checked row for row, before and after, so nothing else moves or changes.
Each new cell gets one evidence row, citing the sources the #741 audit names.

| Key | Path | Step [path pos] | Existing position-0 conversation (kept) | New position-1 cell | Status |
|---|---|---|---|---|---|
| G9-9a05 | No prior goals | Once student understands, starts setting first goal while sharing screen [5] | `…1f0503` Starts setting the first goal while sharing screen once the student understands. | Sees how many sessions are left in the student's goal cycle, then sets, updates or checks the goal. | live |
| G9-9b04 | Mid-cycle check | Review goals that were set with student [4] | `…a00403` Reviews the goals that were set with the student. | Sees how many sessions are left in the student's goal cycle, then sets, updates or checks the goal. | live |
| G9-9d05 | New cycle, goals exist | Once student understands, starts updating goal for the next goal cycle while sharing screen [5] | `…b00503` Starts updating the goal for the new goal cycle while sharing screen once the student understands. | Sees how many sessions are left in the student's goal cycle, then sets, updates or checks the goal. | live |
| G9-9f06 | Missed last session, no goals | Once student understands, starts setting first goal while sharing screen [6] | `…c00603` Starts setting the first goal while sharing screen once the student understands. | Sees how many sessions are left in the student's goal cycle, then sets, updates or checks the goal. | live |
| G9-9e06 | Missed last session, has goals | Once student understands, starts updating goal for the next goal cycle while sharing screen [6] | `…d00603` Reviews last week's outcome and sets this week's goal. | Sees how many sessions are left in the student's goal cycle, then sets, updates or checks the goal. | live |
| G10-9a09 | No prior goals | Finalize goal setting with student [9] | `…1f0903` Finalizes goal setting with the student. | Writes private, auto-saved notes about the student in the goal-setting window. | live |
| G10-9b06 | Mid-cycle check | Finalize checking goal with the student. [6] | `…a00603` Finalizes checking the goal with the student. | Writes private, auto-saved notes about the student in the goal-setting window. | live |
| G10-9d09 | New cycle, goals exist | Finalize updating goal with the student [9] | `…b00903` Finalizes updating the goal with the student. | Writes private, auto-saved notes about the student in the goal-setting window. | live |
| G10-9f0a | Missed last session, no goals | Finalize goal setting with student [10] | `…c01003` Finalizes goal setting with the student. | Writes private, auto-saved notes about the student in the goal-setting window. | live |
| G10-9e0a | Missed last session, has goals | Finalize updating goal with student [10] | `…d01003` Finalizes updating the goal with the student. | Writes private, auto-saved notes about the student in the goal-setting window. | live |

**Wording and placement need owner confirmation.** The Notion and Figma
sources could not be read in this session, because the Notion connectors failed
to connect. Each cell's wording is the #741 audit's own G9 or G10 text,
unchanged, and each status is the audit's `live`. That status rests on the
Deployed12.0 cards and Figma5641:60939 as the #741 review records them; this
batch does not re-verify them. The production `student_session_note` counts
(40 rows, 17 tutors) are #741 audit evidence and were not freshly queried.
Nothing here implies the 12.1 student-safe view is deployed. The audit names
the slots only as "set/check goal step" (G9) and "goal-window step" (G10), so
each step was chosen as follows:

- G9 goes where the tutor starts setting, updating or checking the goal in the
  goal window: the first-goal or update step, or *Review goals* on Mid-cycle
  check.
- G10 goes on the finalize step, the last goal-window moment before the tutor
  leaves the breakout room.

## G13 Teacher / Lead Tutor placement (proposal, no operations)

On every maintained path, the Teacher and Lead Tutor lanes repeat the same
fixed sequence (seven Teacher cells, five Lead Tutor cells). The sequence is
stacked one per column from column 1, whatever moment each column describes.
For example, "Receives information that a student is absent" sits on the
strategy step. The proposal places each cell at the moment it describes. Ten
cells stay where they are, 45 move and 5 are cleared (the Teacher support
escalation on each path). The step names below are today's names, before
G4/G14. The proposed positions are vacant secondary slots in the destination
square, so the guarded `move_cell` preserves each cell's identity. Moves go
in a separate batch after owner approval. Clears are human-only and are not
part of any batch.

| Rule | Moment reasoning |
|---|---|
| R1 | Keep. Observing the room while tutors join is the session-start moment. |
| R2 | Room checks happen as students and tutors enter breakout rooms, before any goal work. |
| R3 | Students wait until their tutor joins; once the tutor is in the room, waiting is over. |
| R4 | Absence surfaces at pairing/join, not during the strategy or review conversation it now sits beside. |
| R5 | Unassigned or mis-assigned students are discovered at join; it pairs with the Lead Tutor response. |
| R6 | First moment the goal flow depends on the student's device (screen share); "as they arise" spans steps, so this is the closest single fit. |
| R7 | Support escalation is not a goal-setting moment; unexpected goal data has its own exception path (Goal data looks wrong). Clear is human-only. |
| R8 | Keep. Roster renaming precedes the tutor joining. |
| R9 | Attendance fixes happen at session start, alongside renaming. |
| R10 | Pairing precedes the tutor joining the student's breakout room. |
| R11 | Pairs with the Teacher absence cell; absence is known at join. |
| R12 | Answers the Teacher "ask for help" alert, which belongs at join. |

| Path | Lane | Cell | Content | Current step [path pos], cell pos | Proposed | Rule |
|---|---|---|---|---|---|---|
| No prior goals | Teacher | `…1f0101` | Circulates and quietly observes the students. | Join breakout session [1], pos 0 | unchanged (Join breakout session [1], pos 0) | R1 |
| No prior goals | Teacher | `…1f0301` | Checks if all students are in the correct breakout room. | Share screen [3], pos 0 | Join breakout session [1], pos 1 | R2 |
| No prior goals | Teacher | `…1f0201` | Reminds students to keep working while waiting. | Click on Set Goals CTA in the Action column [2], pos 0 | Join breakout session [1], pos 2 | R3 |
| No prior goals | Teacher | `…1f0401` | Receives information that a student is absent from the session. | Explain to student what goal setting is [4], pos 0 | Join breakout session [1], pos 3 | R4 |
| No prior goals | Teacher | `…1f0501` | Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert. | Once student understands, starts setting first goal while sharing screen [5], pos 0 | Join breakout session [1], pos 4 | R5 |
| No prior goals | Teacher | `…1f0601` | Handles student tech problems as they arise. | Fill out goal settings and quantity with the student [6], pos 0 | Share screen [3], pos 1 | R6 |
| No prior goals | Teacher | `…1f0701` | Escalates unresolved issues to support@tutors.plus promptly. | If prompted, fill out goal achievement strategy with the student [7], pos 0 | clear — no step fits | R7 |
| No prior goals | Lead Tutor | `…1f0102` | Renames students to match roster names. | Join breakout session [1], pos 0 | unchanged (Join breakout session [1], pos 0) | R8 |
| No prior goals | Lead Tutor | `…1f0202` | Adds any un-rostered students to the attendance list. | Click on Set Goals CTA in the Action column [2], pos 0 | Join breakout session [1], pos 1 | R9 |
| No prior goals | Lead Tutor | `…1f0302` | Manually assigns unpaired students to available tutors. | Share screen [3], pos 0 | Join breakout session [1], pos 2 | R10 |
| No prior goals | Lead Tutor | `…1f0402` | Inform classroom teacher about students that are absent. | Explain to student what goal setting is [4], pos 0 | Join breakout session [1], pos 3 | R11 |
| No prior goals | Lead Tutor | `…1f0502` | Respond to classroom teachers "ask for help" request. | Once student understands, starts setting first goal while sharing screen [5], pos 0 | Join breakout session [1], pos 4 | R12 |
| Mid-cycle check | Teacher | `…a00101` | Circulates and quietly observes the students. | Join breakout session [1], pos 0 | unchanged (Join breakout session [1], pos 0) | R1 |
| Mid-cycle check | Teacher | `…a00301` | Checks if all students are in the correct breakout room. | Share screen [3], pos 0 | Join breakout session [1], pos 1 | R2 |
| Mid-cycle check | Teacher | `…a00201` | Reminds students to keep working while waiting. | Click on 'Check Goals' CTA in the Action column [2], pos 0 | Join breakout session [1], pos 2 | R3 |
| Mid-cycle check | Teacher | `…a00401` | Receives information that a student is absent from the session. | Review goals that were set with student [4], pos 0 | Join breakout session [1], pos 3 | R4 |
| Mid-cycle check | Teacher | `…a00501` | Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert. | Once goal review is done, clicks on 'Check Goals' button [5], pos 0 | Join breakout session [1], pos 4 | R5 |
| Mid-cycle check | Teacher | `…a00601` | Handles student tech problems as they arise. | Finalize checking goal with the student. [6], pos 0 | Share screen [3], pos 1 | R6 |
| Mid-cycle check | Teacher | `…a00701` | Escalates unresolved issues to support@tutors.plus promptly. | Leave breakout room [7], pos 0 | clear — no step fits | R7 |
| Mid-cycle check | Lead Tutor | `…a00102` | Renames students to match roster names. | Join breakout session [1], pos 0 | unchanged (Join breakout session [1], pos 0) | R8 |
| Mid-cycle check | Lead Tutor | `…a00202` | Adds any un-rostered students to the attendance list. | Click on 'Check Goals' CTA in the Action column [2], pos 0 | Join breakout session [1], pos 1 | R9 |
| Mid-cycle check | Lead Tutor | `…a00302` | Manually assigns unpaired students to available tutors. | Share screen [3], pos 0 | Join breakout session [1], pos 2 | R10 |
| Mid-cycle check | Lead Tutor | `…a00402` | Inform classroom teacher about students that are absent. | Review goals that were set with student [4], pos 0 | Join breakout session [1], pos 3 | R11 |
| Mid-cycle check | Lead Tutor | `…a00502` | Respond to classroom teachers "ask for help" request. | Once goal review is done, clicks on 'Check Goals' button [5], pos 0 | Join breakout session [1], pos 4 | R12 |
| New cycle, goals exist | Teacher | `…b00101` | Circulates and quietly observes the students. | Join breakout session [1], pos 0 | unchanged (Join breakout session [1], pos 0) | R1 |
| New cycle, goals exist | Teacher | `…b00301` | Checks if all students are in the correct breakout room. | Share screen [3], pos 0 | Join breakout session [1], pos 1 | R2 |
| New cycle, goals exist | Teacher | `…b00201` | Reminds students to keep working while waiting. | Click on 'Update Goals' CTA in the Action column [2], pos 0 | Join breakout session [1], pos 2 | R3 |
| New cycle, goals exist | Teacher | `…b00401` | Receives information that a student is absent from the session. | Review last goal cycle overview and system suggestion [4], pos 0 | Join breakout session [1], pos 3 | R4 |
| New cycle, goals exist | Teacher | `…b00501` | Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert. | Once student understands, starts updating goal for the next goal cycle while sharing screen [5], pos 0 | Join breakout session [1], pos 4 | R5 |
| New cycle, goals exist | Teacher | `…b00601` | Handles student tech problems as they arise. | Fills out goal settings and quantity with the student [6], pos 0 | Share screen [3], pos 1 | R6 |
| New cycle, goals exist | Teacher | `…b00701` | Escalates unresolved issues to support@tutors.plus promptly. | If prompted, fill out goal achievement strategy with the student [7], pos 0 | clear — no step fits | R7 |
| New cycle, goals exist | Lead Tutor | `…b00102` | Renames students to match roster names. | Join breakout session [1], pos 0 | unchanged (Join breakout session [1], pos 0) | R8 |
| New cycle, goals exist | Lead Tutor | `…b00202` | Adds any un-rostered students to the attendance list. | Click on 'Update Goals' CTA in the Action column [2], pos 0 | Join breakout session [1], pos 1 | R9 |
| New cycle, goals exist | Lead Tutor | `…b00302` | Manually assigns unpaired students to available tutors. | Share screen [3], pos 0 | Join breakout session [1], pos 2 | R10 |
| New cycle, goals exist | Lead Tutor | `…b00402` | Inform classroom teacher about students that are absent. | Review last goal cycle overview and system suggestion [4], pos 0 | Join breakout session [1], pos 3 | R11 |
| New cycle, goals exist | Lead Tutor | `…b00502` | Respond to classroom teachers "ask for help" request. | Once student understands, starts updating goal for the next goal cycle while sharing screen [5], pos 0 | Join breakout session [1], pos 4 | R12 |
| Missed last session, no goals | Teacher | `…c00101` | Circulates and quietly observes the students. | Join breakout session [1], pos 0 | unchanged (Join breakout session [1], pos 0) | R1 |
| Missed last session, no goals | Teacher | `…c00301` | Checks if all students are in the correct breakout room. | Click on 'Set Goals' CTA in the action column [3], pos 0 | Join breakout session [1], pos 1 | R2 |
| Missed last session, no goals | Teacher | `…c00201` | Reminds students to keep working while waiting. | Sees action color in dashboard is warning and CTA copy is 'Set Goals' within a mid-cycle goal check-in session. [2], pos 0 | Join breakout session [1], pos 2 | R3 |
| Missed last session, no goals | Teacher | `…c00401` | Receives information that a student is absent from the session. | Share screen [4], pos 0 | Join breakout session [1], pos 3 | R4 |
| Missed last session, no goals | Teacher | `…c00501` | Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert. | Explain to student what goal setting is [5], pos 0 | Join breakout session [1], pos 4 | R5 |
| Missed last session, no goals | Teacher | `…c00601` | Handles student tech problems as they arise. | Once student understands, starts setting first goal while sharing screen [6], pos 0 | Share screen [4], pos 1 | R6 |
| Missed last session, no goals | Teacher | `…c00701` | Escalates unresolved issues to support@tutors.plus promptly. | Fill out goal settings and quantity with the student [7], pos 0 | clear — no step fits | R7 |
| Missed last session, no goals | Lead Tutor | `…c00102` | Renames students to match roster names. | Join breakout session [1], pos 0 | unchanged (Join breakout session [1], pos 0) | R8 |
| Missed last session, no goals | Lead Tutor | `…c00202` | Adds any un-rostered students to the attendance list. | Sees action color in dashboard is warning and CTA copy is 'Set Goals' within a mid-cycle goal check-in session. [2], pos 0 | Join breakout session [1], pos 1 | R9 |
| Missed last session, no goals | Lead Tutor | `…c00302` | Manually assigns unpaired students to available tutors. | Click on 'Set Goals' CTA in the action column [3], pos 0 | Join breakout session [1], pos 2 | R10 |
| Missed last session, no goals | Lead Tutor | `…c00402` | Inform classroom teacher about students that are absent. | Share screen [4], pos 0 | Join breakout session [1], pos 3 | R11 |
| Missed last session, no goals | Lead Tutor | `…c00502` | Respond to classroom teachers "ask for help" request. | Explain to student what goal setting is [5], pos 0 | Join breakout session [1], pos 4 | R12 |
| Missed last session, has goals | Teacher | `…d00101` | Circulates and quietly observes the students. | Join breakout session [1], pos 0 | unchanged (Join breakout session [1], pos 0) | R1 |
| Missed last session, has goals | Teacher | `…d00301` | Checks if all students are in the correct breakout room. | Click on 'Update Goals' CTA in the action column [3], pos 0 | Join breakout session [1], pos 1 | R2 |
| Missed last session, has goals | Teacher | `…d00201` | Reminds students to keep working while waiting. | Sees action color in dashboard is warning and CTA copy is 'Update Goals' within a mid-cycle goal check-in session. [2], pos 0 | Join breakout session [1], pos 2 | R3 |
| Missed last session, has goals | Teacher | `…d00401` | Receives information that a student is absent from the session. | Share screen [4], pos 0 | Join breakout session [1], pos 3 | R4 |
| Missed last session, has goals | Teacher | `…d00501` | Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert. | Review last goal cycle overview and system suggestion [5], pos 0 | Join breakout session [1], pos 4 | R5 |
| Missed last session, has goals | Teacher | `…d00601` | Handles student tech problems as they arise. | Once student understands, starts updating goal for the next goal cycle while sharing screen [6], pos 0 | Share screen [4], pos 1 | R6 |
| Missed last session, has goals | Teacher | `…d00701` | Escalates unresolved issues to support@tutors.plus promptly. | Fills out goal settings and quantity with the student [7], pos 0 | clear — no step fits | R7 |
| Missed last session, has goals | Lead Tutor | `…d00102` | Renames students to match roster names. | Join breakout session [1], pos 0 | unchanged (Join breakout session [1], pos 0) | R8 |
| Missed last session, has goals | Lead Tutor | `…d00202` | Adds any un-rostered students to the attendance list. | Sees action color in dashboard is warning and CTA copy is 'Update Goals' within a mid-cycle goal check-in session. [2], pos 0 | Join breakout session [1], pos 1 | R9 |
| Missed last session, has goals | Lead Tutor | `…d00302` | Manually assigns unpaired students to available tutors. | Click on 'Update Goals' CTA in the action column [3], pos 0 | Join breakout session [1], pos 2 | R10 |
| Missed last session, has goals | Lead Tutor | `…d00402` | Inform classroom teacher about students that are absent. | Share screen [4], pos 0 | Join breakout session [1], pos 3 | R11 |
| Missed last session, has goals | Lead Tutor | `…d00502` | Respond to classroom teachers "ask for help" request. | Review last goal cycle overview and system suggestion [5], pos 0 | Join breakout session [1], pos 4 | R12 |

## Open owner decisions

1. **Approve this exact batch.** Reply **approved** on #756 for runner
   SHA-256 `59ae980c479dde46f775850173e16eb1adc483e1470d404af5848502f310ecf3`.
2. **G14 casing versus UI copy.** If the PLUS App button literally reads "Set
   Goals", a quoted sentence-case label no longer quotes the UI. Confirm that
   sentence case is wanted inside the quotes. Cell text that still says
   'Check Goals' and similar is out of scope for this batch.
3. **Shared Mid-cycle renames** also rename Goal data looks wrong columns 2 and
   5. Accept, or split them out.
4. **G9/G10 wording, step choice and live status.** Confirm against the
   Deployed12.0 cards and Figma, which this session could not read.
5. **G13.** Approve the table, or amend it, before a separate move batch is
   prepared. Two choices in it are judgement calls:
   - Tech problems go to *Share screen*. The alternative is to clear them.
   - Support escalation is cleared. The alternative is to put it beside tech
     problems.
   You perform the five clears yourself.

## Dry-run

Read-only against production. `ok: true`, with no failures and no
expected-current mismatches. 32 diff entries; ledger 341→341. Affected paths
are reported for every rename. The runner's canonical SHA-256 is
`59ae980c479dde46f775850173e16eb1adc483e1470d404af5848502f310ecf3`.
No apply or verify was run.

## Sources re-read (October 31, 2026)

Re-read through the PLUS Notion connection; the batch is unchanged.

- RM-2569 (Goal cycle counts sessions, not days), RM-2158 (In-session tutor
  note-taking) and RM-2650 (goal-setting controls re-enable at session start)
  are all Dev Status Deployed, Release 12.0 (live). That supports `live` for
  the G9 and G10 cells.
- G9's wording matches RM-2569's badge spec ("{#} Sessions Left", sessions
  rather than days).
- G10's wording matches the Help Center article (3edb…0430): private,
  auto-saved, at the top of the goal-setting window, in-progress sessions only.
- That article tells tutors to select **Set goals**, so sentence case matches
  the product's own copy (decision 2).
