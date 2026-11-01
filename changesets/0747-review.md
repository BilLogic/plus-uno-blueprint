# #747 Record future state (proposed / planned / built)

Two batches, split by phase so neither goes over about 60 operations, plus a recovery file and a placement follow-up (see Applied):

- `0747-a-onboarding-pre-session-admin.json`: 37 operations covering F1–F12 and F14.
- `0747-b-in-session-post-session.json`: 46 operations covering F15–F17, F20–F28.

F18 and F19 belong to #748, and F13 is left out (see below).

Every expected value was read from production on November 1, 2026, as the dev authoring user, reads only. The generated files were re-read just before each dry-run. A short id resolves to exactly one live row:

- `f…080e` is the Redesigned reflection path `f0000000-…-00000000080e`. It is not Rooms close on time, `a0000000-…-00000000080e`.
- `6afc27c3`, `b76e47fe`, `11184a22`, `696da250`, `e8a64bc5`, `f25c75e0` and `7d919b87` each match one cell.

## Statuses come from each card as it stands today

The roadmap was re-read on November 1, 2026, through the PLUS Notion connection. The status rule is: Deployed → `live`; Code Review, Testing or built but not deployed → `built`; Ready for Dev → `planned`; Triage or design only → `proposed`.

Rows whose status changed from the ticket:

| Row | Ticket | Now | Why |
|---|---|---|---|
| F1 | built | live | Card 2612 (tutor import and detail modal) is Deployed, 12.1 |
| F2 | built | live | The detail modal shipped in 2612. The Performance Details name search is 2272 (Code Review), so it is left out of the cell text and noted in its evidence |
| F4 | built | live | 2612 and 2685 (supervisor flag) are Deployed, 12.1. 2606 is the later UI update (Ready for Dev) |
| F6 | built | live | 2570 (TE3, the Sunday email) is Deployed, 12.1 |
| F8 | built | live | 2640 (Sign-Ups count) is Deployed, 12.1; the ticket had Code Review |
| F11 | built | live | 2626 (@channel on the request) is Deployed, 12.1; the ticket had Ready for Prod |
| F14 | built | live | 2568 (TE2b, the call-off decision email) is Deployed, 12.1 |
| F15 | built | live | 2243 (attendance search) is Deployed, 12.1 |
| F25 | built | live | 2637 (chunked upload) is Deployed, 12.1 |
| F28 | proposed | planned | 2609 has moved from Triage to Ready for Dev |

Rows that keep the ticket's status:

- F3 stays `built`. Supervisor reassignment shipped with 2612, but Remove tutor is 2272, still in Code Review.
- F5 stays `planned` (1956 is Ready for Dev).
- F7 stays `planned` (2638 is Ready for Dev).
- F9 stays `proposed`. It rests on decisions only.
- F12 stays `proposed` (2664 is Triage).
- F10 stays `built`. 2635 reads Open Tasks; the digest command exists with a testing section, but nothing shows it scheduled on prod.
- F16 stays `proposed` (2587 is Triage).
- F17 stays `proposed` (1778 is Dev Backlog, design WIP).
- F20–F23 stay `planned` (1733 is Ready for Dev).
- F24 stays `built`. 2551 is Testing. The naming-format part, 2668, is Deployed; the evidence says so.
- F26 stays `proposed`. It rests on Figma only.
- F27 stays `proposed` (2670 is Triage).

Because these 12.1 cards are already Deployed, this batch writes `live` directly. #748 does not need to move these cells from built to live.

## Where the wording departs from the ticket, and why

- **F6:** the card says the email goes out Sunday at 3 pm, with "the least-filled sessions that don't clash with their sign-ups". The cell uses that wording.
- **F7:** the Help Center button is in the app top bar on every page (2638, Figma 12136:827), not on the resource library. It is still placed at Browse resource library, as the ticket asks, and the evidence note records where it really sits.
- **F9:** decision 3b1b…8137 warns at 1–10 minutes and gates at 11 or more. Decision 3b1b…817d has the tutor name the supervisor. The old summary had 10 or more blocking; it is corrected.
- **F10:** the shipped interim digest picks sessions with open tutor spots, and ratio-based "most understaffed" moved to card 2698. So the cell says "sessions with open tutor spots".
- **F17:** the Try / Watch / Avoid direction comes from the Figma annotation 9998:385063, not from card 1778, which is the older PRD. It is recorded as the path note.
- **F21:** the card links the three child cards but gives no split date, so "(Aug 2026)" is dropped.
- **F22:** "rates the session" rests on decision 3abb…81f4 (keep the 5-point session rating). The other decisions cited are 3adb…81f7, 3adb…8150, 3abb…81c2 and 3abb…8139.
- **F26:**
  - The Toolkit › Reviews breadcrumb could not be confirmed in Figma, so the cell names AI Coach.
  - The under-5-sessions threshold is not visible, so no number is given.
  - The runner cannot insert a second cell on a path the same batch creates, so the two tutor cells share one cell: the Not Helpful comment and the limited-data notice.
- **F28:** the sheet's own name, "Tutor to Student Ratios", is used for the touchpoint; "Ideal benchmarks sheet" does not appear on the card. The two teacher cells share one cell, for the same runner reason as F26.
- **F4:** "Tutor import" and "Supervisor flag" share one Back Stage Touchpoints cell, two lines, for the same reason; the step is new in this batch.
- **F2 and F3:** the ticket's summaries are carried in each cell's evidence note. Inserting at position 1 or more takes content and status only.

## Stale summaries replaced in passing

- F1's three cells and the eight Redesigned reflection cells lose their "PROTOTYPE (exploratory, not shipped as of Aug 2026)" summaries.
- The replacements drop the reviewers' names those summaries carried.
- The Cadence check-ins step summary now reads "at session 5 and every tenth session after".

## Rows skipped

F11 and F12 are not skipped. They sit on #744's *Requested mid-session* path, which #744 applied before this dry-run. They go in at position 1 of its Session enters fill-in pool step.

- **F13** is not supported by its source. Figma 4173:145289 is a "For future iterations — All Sessions fill-in states" section whose states read from the tutor's side ("Unfilled session I did not sign up for"). Nothing shows a supervisor filling sessions.

## For the owner (no deletes in this batch)

These were noticed but not changed:

- The *Supervisor-registered clearance* path is still `proposed` while its import and invite cells are now `live`. Its CPO-side prototype cells still name a person in their summaries: `1099b78d`, `dbfb6712`, and the evidence titles on `6afc27c3`.
- `b0cc2c00` (Account invite) still says "the invite path does not" exist.
- `0eb57a27` (Overlap threshold) still describes the 11–20 minute band.

## Verification

- Dry-run for both files ends `ok: true` with no expected-current mismatches.
- The checks assert:
  - every new cell's evidence and placement count,
  - per-path cell counts,
  - the new step and its membership,
  - lanes and memberships on the three new paths, copied from their source paths,
  - unchanged placements on edited touchpoint cells.

## Applied (November 1, 2026)

Every batch was applied under the shared apply lock. The changeset files were regenerated from a fresh read just before each run.

| File | Runner SHA-256 | Apply | Verify |
|---|---|---|---|
| `0747-a-onboarding-pre-session-admin.json` | `0ee3c8b5…a38e` | all 37 writes landed with durable inverses; the run reported 11 post-check failures | same 11 |
| `0747-b-in-session-post-session.json` | `ee7a4b83…fab` | stopped at `F20-path-status`; 10 writes before it landed | incomplete receipt, as expected |
| `0747-b2-recovery.json` | `55a7a3a1…52fc` | the remaining 36 operations | **pass** |
| `0747-c-placements-and-summaries.json` | `b00117bf…76c1` | all 6 writes landed | two `frame` differences |

What the failures were, and what the rows show:

- **Batch A, placement counts.** Placement counts read 0 on the four touchpoint cells inserted at position 1 or more: Weekly schedule email, Help Center button, and the two Email cells. `insert_cell_at_position` does not run the placement sync; `upsert` and content edits do. Batch C re-saves those four cells with a summary each, and that ran the sync. Each now has one placement.
- **Batch A, step memberships.** The preservation check on Supervisor Program Administration flagged the step memberships. That comes from `add_step` shifting positions after the F2/F3 inserts had captured them. The read-back shows the intended order: Add tutors at 1, then Monitor tutors through Institution & system admin at 2–7.
- **Batch B.** Its stop was the runner's re-check of a row edited by the operation before it, `F20-path-spec`. `b2` carries the rest, with re-read expected values.
- **Batch C, frames.** The sync filled the two Email cells' empty frames with the Email touchpoint's logo. That is the template's behaviour for a placed touchpoint, not a stray write.

The final read-back finds 38 #747 evidence rows, one on every new or changed cell. It also confirms:

- the statuses in the tables above,
- the three new variant paths: Student AI insights and Monthly Reviews list (`proposed`), and Insights Part 2 (`planned`),
- Redesigned reflection at `planned`.
