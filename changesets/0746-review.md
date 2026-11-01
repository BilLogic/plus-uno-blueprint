# #746 Post-session and Program Administration live behaviour

Two files, applied in order. `0746-a-post-session-and-admin.json` has 27
operations: eight `update_cell_content` edits, four `insert_cell_at_position`
cells, one `create_path_at_status` and fourteen `add_evidence` rows.
`0746-b-edit-reflection-path.json` has nine operations: one `set_path_steps`,
four `upsert_cell_at_status` cells and four `add_evidence` rows. It is
generated from a live read after `0746-a` lands. A new path's step list
cannot be preflighted while the path is still pending, so B has to wait for A.

Expected values were read through dev authentication on November 1, 2026.
Every short id resolved to exactly one live row, and each matched the
ticket's quoted current text. The Weekly Class Report scenario is untouched.

## Rows

| # | Cell | Change | Status |
|---|---|---|---|
| 59 | `c3…151` Session Reflection › Filed in one sitting › Submit › RT | "Submits the reflection, ticking Escalate report for a serious concern." | live |
| 60 | new path Edits a submitted reflection (variant) | Path in A; in B, steps Open the form + Submit, RT reopen, FST Reflection form, RT save, BST Session reflection | live |
| 61 | `c3…112` Recording upload | Evidence only: folder upload removed Apr 2026; size limit left alone | — |
| 63 | `…001d0102` Reporting an Issue › Reach out › LT | Lead tutor checks the supervisor and PLUS staff were messaged, reminds about Escalate report | live |
| 64 | `…001d0207` Resolve concern › BSA | Severity, school contact, tutor follow-up, state-report help | live |
| 68 | new, Read AI growth insights › BSA, position 1 | Dev team loads the research team's insights from a sheet | live |
| 69 | `c2…033` | **Skipped** (see below) | — |
| 70 | `c2…032` Review time allocation | Evidence only; stays proposed | — |
| 71 | `69fdaa24` Manage sessions › Supervisor | Calendar or table view, attendees, cancel/revert scopes | live |
| 72 | `aabdb0ed` Manage sessions › FSA | Join from session details, opens 15 minutes before start | live |
| 73 | new, Manage sessions › BST, position 2 | "Cancellation emails"; the scope note is in its evidence | live |
| 75 | new, Broadcast & export › BST, position 0 | "Tutor broadcast email", plus the same evidence on `3b975e06` | live |
| 76 | new, Manage students › BST, position 2 | "Students-added email" | live |
| 77 | `f44303f7` Manage students › Supervisor | Adds the per-student dashboard | live |
| 78 | `7cc4119b` Institution & system admin › Supervisor | Edtech goals, system-admin duties | live |
| 79 | `7b1b1687` Monitor tutors › Supervisor | Evidence only | — |

## Sources re-read (November 1, 2026)

- Card 2225 Tutor Reflection Form Editing: Deployed, 11.2.
- Card 2266 Calendar View: Deployed, 12.0 (live).
- Card 2452 Session Functionality v3: Update Sessions: Deployed, 12.0 (live).
- Card 2067 Escalate Session through Reflection: Deployed, 10.1.
- Card 2639 (`3dfb…`) AI Coach: Load insights for all tutors: Deployed,
  12.0 (live).
- Card 2521 (`3a3b…8068`) Tutor Admin: preferred names in Tool Usage:
  Deployed, 12.0 (live).
- Card 2686 (`3fbb…816c`) AI Coach: Quick tutor interviews is Dev Backlog. It
  is cited only for the fall-round detail (66 own excerpts, 109 shared), not
  as a shipping claim.
- Training Modules 8, 10 and 11, and the Help Center page Complete and Manage
  Session Reflections (`392b…c435`), step 7. Page `392b…6ccc`, Manage Your
  Tutoring Schedule, has no step 7.
- Figma nodes 11272:251700, 11272:425460, 11272:431151, 11276:107 and
  12386:527100, all in the Web App Specs file.

## Wording that differs from the ticket

- Rows 63 and 64 name a staff member in the ticket's text, and the source
  modules name the same person. No person's name goes into data, so both
  cells say "PLUS staff".
- In row 60 the RT Submit cell reads "Saves the edited reflection." instead of
  "Resubmits the reflection.", because the Help Center's step 7 says "save".
- The row 68 cell drops "fall". The loading card, 2639, names spring
  transcripts, while card 2686 calls the round the fall round, so the word was
  ambiguous. The actor is written as "The dev team" and "the research team".
- Row 73's note ("Sent to affected tutors for the chosen cancel scope; the old
  all-future template is unused.") goes into the evidence row.
  `insert_cell_at_position` takes no summary.
- In row 78, "supervisor accounts" is the ticket's word. Figma says
  "tutor-admins".
- Row 77 keeps "via CSV" from the existing cell; Figma 11276:107 does not
  mention it.

## Skipped

- **Row 69** (`c2…033`, evidence only): "rating overwrites the row and each
  submission is logged; 1 of 66 own-excerpt insights rated". Neither card 2639
  nor card 2686 says anything about overwriting or logging. The 1-of-66 figure
  is a Metabase count that could not be re-queried. No evidence row is written.

## Not verified here

- The Metabase figures in rows 68 and 70 (175 tutors, 66 with their own
  excerpt; `tutor_time_allocation` has 0 rows). They are quoted in the
  evidence as reported by #746, not re-queried.

## Structure and placements

- The new path copies lanes and step order from Session did not happen. It
  copies the eight lanes, and the steps Open the form, Mark it did not happen,
  Pick a reason and explain, and Submit. B's `set_path_steps` then leaves
  exactly Open the form (position 0) and Submit (position 1). Both are
  existing shared steps, the same pattern the Session did not happen path
  uses, and no new steps are created.
- The four new cells in A sit in occupied squares, except Broadcast & export
  BST, so they use the guarded insertion at an explicit vacant position.
  Insertion attaches no registry placement. The three email cells therefore
  have none: "Cancellation emails", "Tutor broadcast email" and
  "Students-added email" are not in the touchpoint registry. Adding them is
  the owner's call: link them in the app, or run a follow-up content edit that
  syncs them.
- B's two touchpoint cells carry a summary, so the content mutation syncs
  their placements onto the existing registry rows Reflection form and
  Session reflection.

## Deletes for the owner

None.
