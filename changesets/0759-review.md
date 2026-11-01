# #759 Weekly Class Report scenario (#742 row80)

Prepared and dry-run only. Nothing is applied. Applying requires Bill's
approval of this exact file on the ticket.

## Operations, in order

1. `create_scenario` Weekly Class Report under Program Administration, stacked,
   one happy path Report sent, lanes copied from Goal Setting's No prior goals
   path (`…0811`), `step_count` 1. The RPC generates the column Step 1 at
   path position 0.
2. Four `add_step` operations: Receive email, Read report, Distribute rewards
   and Contact support at positions 1–4, each with a summary.
3. `rename_step` renames the generated Step 1 to Build report, then
   `update_step_spec` gives it a summary.
4. Nine `upsert_cell_at_status` cells, each followed by its `add_evidence` row.

There is no mobile path and no cross-scenario edge; the leads_to from Goal
Setting remains #758.

## How the placeholder is handled

The rename addresses the placeholder by its membership, path position 0 of
Report sent, through a `path_steps` lookup that returns `step_id`. Its
expected values are the name Step 1 and the new scenario's id. It lists the one
reviewed membership `{ Report sent, 0 }`.

Two small runner changes make this expressible, both tested:

- A lookup may name `field`, so it can return an identity column from a row
  that has no `id` of its own.
- Dry-run cannot read a row the batch has not created yet. A `rename_step` or
  `update_step_spec` on a pending target is now deferred: the diff shows the
  declared `expected` with a `deferred` note. At apply time the runner reads
  the generated row, refuses any expected field that differs, and runs the
  capability's membership and preservation capture before writing. Any other
  edit on a pending row still fails preflight.

The rename comes after the four `add_step` operations because of how
preservation capture works. The rename captures the whole scenario, and every
later write has to account for its own changes in that capture. `add_step`'s
`path_steps` row is a side effect the projection does not advance.

## Verification

- A production dry-run passes with no expected-current mismatches. The ledger
  count is unchanged at 341 → 341, no receipt was written, and the
  authenticated user is the dev author.
- A pre-apply `--verify` fails as it should: 76 differences, with the scenario
  absent.
- The fixture test in `scripts/tests/content-changeset-database.test.mjs` runs
  this exact file through dry-run, apply and separate verify. The fixture is
  modelled on the hosted RPCs: one Step 1 placeholder even when `step_count`
  is 0, copied lanes, shifting `add_step`, and touchpoint-lane sync. The run
  ends with exactly Build report / Receive email / Read report /
  Distribute rewards / Contact support, no Step 1, one Report sent path, nine
  cells, nine evidence rows, one `rename_step` inverse and no deletes. A
  second test renames the placeholder to something else after creation; the
  batch then stops before any `rename_step` request.
- A SQL replay against a disposable local Postgres 17 used the repository's
  migrations and was rolled back. In it, `create_scenario(step_count 1)` →
  `rename_step` → four `add_step` calls left exactly five steps, in that order,
  with no Step 1. A cell written through `upsert_cell_at_status` received a
  minted `cell_key`, which the evidence rows reference.
- The checks assert that the new scenario takes position 2 next to Supervisor
  Program Administration. They assert one path, five steps and five
  memberships (Build report at 0), nine copied lanes, nine cells with their
  text, one evidence row per cell, and placements: two on the back-stage
  systems cell and one on the email cell. They also assert zero Step 1 rows,
  an unchanged lane-source path, and zero outgoing edges on the Goal Setting
  email cell.

## Sources

The cell text and evidence follow the audited #742 row80 table. Card 2106 is
Deployed. The Teacher Help Center pages (3aab…2f78, 3aab…bd51b, 379b) cover
the weekly email with one PDF per class, rewards and the support address.
Figma 12666:58 is the report section. Fall-preparation card 3d6b is Testing,
so it supports only school-specific timing ("usually its first tutoring
day"), not global shipping. The sources were read for #742 on 2026-10-21 and
were not re-read for this preparation.

## Owner decisions

- Approve the two runner changes and the rename placement.
- Decide whether to re-read the Notion and Figma sources before applying, or
  to accept the 2026-10-21 audit.
- Confirm status live for all nine cells.
- Confirm that the two new registry touchpoints the sync creates are wanted:
  plus_etl send-student-reports and Goal setting sheet.
