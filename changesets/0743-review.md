# #743 Add missing live Onboarding behaviour

Two batches. Batch a holds every row of the ticket. Batch b finishes four
cells that batch a inserts at an occupied square, and adds the second Regular
Tutor cell of the new AI path. The runner cannot edit a row in the batch that
creates it, so this work needs a second batch. Batch b is drafted from a live
read after batch a has been applied.

Every live value was read through the dev authoring client on November 1,
2026. Every new or changed cell gets one `add_evidence` row citing its sources.
Every status is `live`, and each one rests on a roadmap card that reads
Deployed, a 2026-08-08 Figma spec correction against the shipped app, or the
onboarding module pages.

## Batch a: `0743-a-onboarding-behaviour.json`, 39 operations

| Row | Where | Operation | Cell | Sources |
|---|---|---|---|---|
| 3 | Employment & Access › Standard › Send clearances › Back Stage Actions | new, pos 0 | "A script reads the CPO's shared clearance Google Sheet and updates each tutor's clearance status in PLUS." | card 3c0b (RM-2584, Deployed 12.0): 19 tutors updated on September 9; no cadence claimed |
| 4 | Tutor Profile › Update identity details › RT `a54e2f42` | content + summary | "Keeps preferred name, pronouns, photo, and additional email current." | Figma 11272:430456; card 2134 (Deployed 11.3) |
| 5 | Tutor Profile › Change Slack email › Back Stage Actions | new, pos 0 | "Ops team receives a Slack notification of the new Slack email." Evidence also on `e7895077` | Figma 11272:430456 |
| 6 | Tutor Profile › `0f73cd93`, `3c9d9d28` | evidence only | — | Figma 11272:430456 |
| 7 | Onboarding Modules › Module opening › Back Stage Actions | new, pos 0 | "Assigns the Lead Tutor Onboarding module automatically when a tutor is promoted; it does not gate Your Sessions." | cards 3abb (2548) and 3b2b-80ae (2561), both Deployed 12.0 |
| 9 | Onboarding Modules › Module completion › RT `…00110703` | evidence only | — | Modules 2–4 and 6–11: reflection in-app required; quiz on the same Google account |
| 10 | Onboarding Modules › Module completion › BST `…00000641` | evidence only | — | Figma 11272:427878; card 2494 (Deployed 12.0) |
| 11 | Lesson Modules › Work through questions › RT `…00120203` | content + summary | "Works through the lesson questions and rates each piece of AI feedback before revising or moving on." | card 3e6b (2651, Deployed 12.0), Change 3 |
| 12 | Lesson Modules, new exception path **AI returns no feedback** | create path; RT and BST at Work through questions | RT "Gets a Revise your response prompt…"; BST "LLM feedback service" | card 3e6b scenario table; Figma 12505:199982 and 12505:199987 |
| 13 | Lesson Modules › Open lesson › FST, and BSA `…00120107` | insert pos 1; content | FST "Lesson assignment email"; BSA "Tutor supervisor team assigns lessons; the app emails the tutor." | Figma 11272:427878 (assignment emails shipped, Email Templates 5.x and 6.x) |
| 14 | Lesson Modules › Finish lesson › Support Actions | insert pos 1 | "PLUS team tracks Accredible credential use and buys more before the paid limit runs out." | card 3dbb (2632, Deployed): 100 credentials added 2026-10-20 |
| 15 | Session Sign Up › No conflicts › Sign up › Front Stage Actions | insert pos 1 (pos 0 is the #747 Sign-Ups count cell) | "Emails the tutor a confirmation after each successful recurring sign-up." | card 3b2b-8118 (2566, Deployed 12.0) |
| 16 | Session Sign Up › No conflicts › Sign up › BST | insert pos 2 | "Clash check" | card 2234 (Deployed 10.1); card 2239 is Triage and cited as context only |
| 18 | Session Sign Up, new exception path **Onboarding incomplete** | create path; RT, FST and BST at Sign up; edge retype | RT "Cannot reach Your Sessions or the schedule until onboarding modules are complete."; FST "PLUS App"; BST "Onboarding gate"; `9aeb3883` leads_to → enables | card 2494; Figma 11272:427878; card 2530 (Triage) is the path note's open question |

The two exception paths are created with `create_path_at_status`. Lanes and
step order are copied from their happy path: Standard `…0802` and No
conflicts `…0805`. Each is named for its condition, with kind `exception` and
status `live`.

### Deviations from the ticket text

- **Row 16 cell text.** The cell reads "Clash check". The rule "same weekday
  and start time, recurring sign-ups only" goes in its evidence, and batch b
  adds it as the summary. A touchpoint cell's lines become registry names, and
  a parenthetical would add a one-off registry entry.
- **Row 12 second Regular Tutor cell.** "Sees a system-issue message when the
  AI call fails, then retries or moves on with no rating." goes in batch b.
  It sits at position 1 on a path that batch a creates, and the guarded
  insert cannot preflight a parent from the same batch.
- **Row 18 edge.** `9aeb3883` is retyped in place, keeping its id, so the old
  `leads_to` is not left drawn. Its note now reads "Finishing the onboarding
  modules unlocks Your Sessions; sign-up depends on it rather than following
  it as a handoff."
- **Row 11 evidence.** Metabase `lesson_llm_feedback` is cited as the audit
  cited it. It was not re-queried.
- **Row 13 evidence.** The Figma correction note names the shipped Email
  Templates 5.x and 6.x section. The individual 6.1–6.2 frame ids were not
  read.

### Runner change: `update_cell_dependency`

The runner could create a path but could not retype an edge. `set_cell_dependency`
upserts on (source, target, kind), so a new kind inserts a second row and
leaves the first one drawn. The pinned package already ships
`updateCellDependency`, the panel's in-place edit, and the hosted
`update_cell_dependency` RPC has applied the one-service rule since
20261031160000. The new operation wraps that function and nothing else.

- It addresses the existing edge by id. `expected` guards the source, the
  target, the kind and the note.
- It requires `input.expected_source` and `input.expected_target`. Both ends
  are read through to their service and must still match, as for
  `set_cell_dependency`.
- It refuses a no-op write, and an existing edge of the new kind between the
  same cells.
- After the write, the RPC's reported prior row must equal the preflight row.
  The logged record must carry exactly the reviewed args and the self-inverse
  `update_cell_dependency` back to the prior kind and note.

The tests came first: a fixture RPC modelled on the hosted function, then a
retype that applies and verifies separately. Further tests cover four refusals
with no write, a concurrent edit refused before the write, and validation unit
tests.

### Verification

- Production dry-run: `ok: true`, no failures. Durable change count is
  unchanged (663 → 663 on the final pre-apply run). The first draft put row 15
  at position 0. While it waited for the apply lock, #747 wrote its Sign-Ups
  count cell into that square, and the in-lock dry-run refused the batch. Row
  15 moved to position 1, and the snapshot and checks were re-read.
- `scripts/tests/content-changeset-database.test.mjs` runs this exact file on
  `scripts/tests/fixtures/0743-onboarding-board.json`, a trimmed read-only
  snapshot of the five touched scenarios. It runs dry-run (reads only), then
  apply (one inverse per durable row, one `update_cell_dependency`, two live
  exception paths, 12 new cells, no duplicate edge), then a separate verify.
- There are 68 checks: path and step counts per scenario; cell, lane and
  membership counts per existing path; copied lanes, memberships and cells on
  both new paths; evidence counts per cell; placements per new cell; and the
  source cell's three outgoing edges with the retyped kind and note.

## Batch b: `0743-b-onboarding-follow-up.json`

This batch is drafted after batch a is applied; see that file and the PR
comments for its dry-run. It does three things:

- It inserts the row 12 failure cell at position 1 of the new path.
- It adds summaries to `lesson-email`, `accredible-limit`, `clash-check` and
  `signup-confirmation`.
  Each summary edit syncs the cell's placement, so the two touchpoint cells
  land in the registry.
- It adds the failure cell's evidence row.

## Left for the owner

- **No deletes.** Both new paths copy every step of their happy path, so AI
  returns no feedback has empty Open lesson and Finish lesson columns, and
  Onboarding incomplete has an empty Review scheduling column. Trimming a
  copied path to its one step is a `set_path_steps` edit, if wanted.
- **Card 2530.** It is Triage and asks what counts toward the gate for
  returning tutors. The path note records it as open.
