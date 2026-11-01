# #737 cleanup: stale cells left by the #743–#748 batches

The owner approved this cleanup. It fixes the stale cells the #743–#748 agents
flagged but left, and trims the copied columns of the paths created today.
There are two batches, because the runner refuses a path status change right
after a spec edit on the same row:

- `0737-cleanup-a-cell-and-path-text.json`: 11 cell edits, each with its own
  `add_evidence` row, and 3 path summary edits. 25 operations.
- `0737-cleanup-b-path-status-and-columns.json`: 1 `set_path_status` and
  4 `set_path_steps` column trims. 5 operations.

Every expected value was read live on November 1, 2026, by the dev authoring
user, with reads only. Notion sources were read through the PLUS connection
on the same day. Expected values quote the current text in full, so some of
them still hold the names this batch removes. The new values hold none.

## Batch A: cells

| Cell | Where | Change | Source |
|---|---|---|---|
| `b3…033` | In-session › Help Request › Routed out, Regular Tutor | Routing follows the Help Center. Classroom-side and session-wide issues go to #in-session-support, because school channels are retired. App problems go to #plus-app-bug-reporting. A serious concern goes to the supervisor and PLUS staff | Help Center 3a2b |
| `…00180402` | In-session › Before Students Join, Lead Tutor, Prepare breakout rooms | The lead now reminds tutors to start the recording in their first room. Before, the lead started it | Module 11 steps 4 and 8–9; Module 4 |
| `1099b78d` | Interview & Offer › Supervisor-registered clearance | "PLUS staff" replaces the person's name. Stays `proposed`: card 2612 has supervisors enter the tutor fields, so the candidate form did not ship | Card 2612 |
| `dbfb6712` | same path | "PLUS staff" replaces the person's name. Stays `proposed`: the shipped clearance route is the CPO sheet sync | Card 2584 |
| `b0cc2c00` | same path, Account invite | Now `live`. The invite path exists: an add or CSV import sends the invite, and the record stays pending until the profile is complete | Card 2612 (Deployed, 12.1) |
| `0eb57a27` | Session Sign Up › Soft-conflict gate, Overlap threshold | A warning at 1–10 minutes; from 11 minutes the tutor names the supervisor. The decision's figures replace the old 11–20 minute framing and the owner's name. Stays `proposed` | Decisions 3b1b…8137 and 3b1b…817d (#747 F9) |
| `27068c9b` | same path, Regular Tutor, Sign up | "PLUS staff" replaces the person's name | Decision 3b1b…8137 |
| `…0001d0103` | Post-session › Reporting an Issue, Regular Tutor, Reach out | "PLUS staff" replaces the staff member's name in the content and the summary, as #746 did on the lead's cell | Help Center 3a2b; Module 11 |
| `c1432d1c` | Supervisor Program Administration, Manage sessions, Back Stage Touchpoints | Summary added. The sync adds the registry touchpoint **Cancellation emails** and places it | Figma 11272:431151; card 2452 |
| `07cb61c0` | same, Broadcast & export | Summary added. The sync adds the registry touchpoint **Tutor broadcast email** | Figma 11272:431151 |
| `20457188` | same, Manage students | Summary added. The sync adds the registry touchpoint **Students-added email** | Figma 11272:431151 |

### The three email touchpoints

Creating these needs no new runner capability. A content edit on a
touchpoint-lane cell runs `sync_cell_touchpoints`. That inserts any name it
does not find in the registry, then places it. #759 got
"plus_etl send-student-reports" the same way, and #747 batch C used it for
its four inserted cells. Each cell's content stays as it is, and only a
summary is added. The names follow the registry's existing pattern of
"what" plus "email", as in Weekly schedule email and Lesson assignment
email. The runner cannot read the `touchpoints` table in a check, so each
cell's `cell_touchpoints` count is asserted to go from 0 to 1. The three
registry rows are confirmed by a read-back after apply.

The Figma email-types frame is cited the way #746 read it today. This batch
did not reopen it.

## Batch A: paths

- **Supervisor-registered clearance** (`…0702`): the summary named a staff
  member and said "ship status unknown". It now separates what is live
  (import, invite, account and profile from 12.1, plus the CPO sheet sync
  from 12.0) from what is still proposed (the candidate info form, and
  direct CPO or school confirmation).
- **Soft-conflict gate** (`…0805`): the summary had "under 10 minutes" warn
  and "10 minutes or more" gated. It now reads warn at 1–10 and gate from 11,
  matching the accepted decision. "Awaiting triage" was dropped.
- **Reporting an Issue › Standard** (`…080f`): "PLUS staff" replaces the
  person's name.

## Batch B

- **Supervisor-registered clearance → `live`.** The route's distinguishing
  steps run in production: cards 2612 (Deployed, 12.1) and 2584 (Deployed,
  12.0). After batch A, four of its ten cells are `live`. The other six
  keep their own `proposed` status: the candidate form, direct
  confirmation, and prototype-era framing that the sources do not show
  shipped. Several live paths already hold proposed
  cells, Lesson Modules › Standard for one, so a mixed path is nothing new.
- **Column trims.** Each kept list is the steps that hold cells on that path,
  in their current order. Steps stay on their other paths. No cell moves.

| Path | Before → after | Steps removed from this path |
|---|---|---|
| Lesson Modules › AI returns no feedback | 3 → 1 | Open lesson, Finish lesson |
| Session Sign Up › Onboarding incomplete | 2 → 1 | Review scheduling |
| Fill-in Request › Requested mid-session | 4 → 3 | Tutor browses Fill-In tab |
| Call-off Request › Recurring withdrawal | 5 → 2 | Initial need, Coverage via fill-in pool, Final notification |
| Goal Setting › Student is goal-exempt | 4 → 2 | Leave breakout room, Move on to the next student |

Session Reflection › Edits a submitted reflection was already trimmed: two
steps, and both hold cells. Onboarding incomplete keeps its note, which
leaves card 2530 (Triage) as an open question. #748 had deliberately kept
the last two goal-exempt columns. The trim rule drops them because they hold
no cells there. Restore them in the app if the owner wants the path to show
the rejoin.

## Names scan

The scan covered every cell's text and spec fields, path summaries and
notes, scenario and step text, lanes and the touchpoint registry. It looked
for staff first and last names, then for any two capitalized words in a row.
Only the six cells and two paths above named a person. All of them are fixed
here.

Not fixable by this runner (there is no evidence edit operation), so they are
left for the owner. These evidence titles still carry a staff member's name:

- on `6afc27c3`: "…, Jun 2026 design (2026-06-02)"
- on `3649eff8`: two Slack citations
- on `3351f41b`: the trust-redesign citation
- on `49d5700f`: the trust-redesign citation

## Optional deletes for the owner

Nothing here deletes a row. Consider, in the app:

- the empty Lead Tutor lane on Pre-session › Fill-in Request › Slot gets
  covered;
- the four deprecated cells on the 12+ late call-off route that #752 retired;
- the five G13 Teacher escalation cells.

## Not changed, and why

- `3649eff8` ("Completes PA Act 153 clearances with the CPO") and
  `49d5700f` still carry PROTOTYPE summaries on the now-live path. No source
  read here says whether the candidate's own steps changed, so they are left.
- The other PROTOTYPE summaries on the Soft-conflict gate path (`94e40a7e`,
  `0ddb493e`, `646cabf1`, `c75fb345`) were left as they are. Each still
  describes the proposal accurately.

## Verification

- Both dry-runs end `ok: true` with no expected-current mismatches.
- The checks assert, for each edited cell, its evidence count going up by
  one and its placement count, which goes from 0 to 1 on the three email
  cells. For each trimmed path they assert the `path_steps` rows before and
  after, an unchanged cell count and an unchanged scenario step count.
