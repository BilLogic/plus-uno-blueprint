# #754 Unavailable-response cell move

Two staged changesets: an identity-preserving `move_cell`, then a content
edit at the new location. Exact expected values were read through dev
authentication on October 31, 2026. Prepared and dry-run only; apply
requires Bill's approval on the ticket.

## Why two files

The runner refuses to write a row that has changed since its preflight. A
move followed by a content edit of the same cell in one batch would fail at
the second operation, because the first one changes that row. The content
edit therefore lives in its own file, with expected values written against
the post-move state. Stage B dry-runs only after stage A is applied and
verified. Its dry-run today fails on exactly the coordinates stage A changes,
and the destination path's cell count.

## Stage A: `0754-a-move-unavailable-response.json`

Cell `734293a2-9018-4a80-a355-4999451c6c82` moves within Standard Scheduling
at Reconfirm availability (`b0000000-0000-4000-8000-000000000901`), position
0:

- from Created in the app (`f0000000-…0806`, variant, proposed) / Back Stage
  Actions (`0eae4ce7-…`)
- to Schedule as issued (`a0000000-…0806`, happy, live) / Back Stage
  Actions (`a0000000-…0889`)

The destination square is vacant, and both paths carry the step at position
3. The cell has no placements, resources or incident dependencies. Its two
evidence rows are guarded unchanged. Content, summary and status `built` are
unchanged by this stage.

## Stage B: `0754-b-unavailable-response-content.json`

Content changes from “Unavailable answer releases the tutor from the roster —
no call-off record, by design” to “Drops a tutor who answers Unavailable from
the roster, with no call-off record.” Status stays `built`, and the summary
stays as it is.

## Status is the owner's decision

#740's edit table proposed `live`, citing RM-2452 QA §10–11. The Notion
connection was down during this preparation, so RM-2452's current deployment
state could not be re-read, and status is kept at `built`. For reference, the
approved #740 review recorded RM-2452 as Deployed in Release 12.0, corroborated
by Figma node 11272:161737 (“Unavailable removes a tutor without a call-off
record”, shipped August 2026). Rows 21 and 22 went live on that evidence. If
Bill accepts it for this cell, stage B can carry `status: live` instead.

The existing summary opens “PLANNED (not shipped as of Aug 2026)”, which
conflicts with both `built` and `live`. #740 removed the same PLANNED wording
from its row 21 and 22 summaries. Clearing it here is outside this ticket's
stated scope and is flagged for the owner.

The two existing evidence rows keep `cell_key` text naming the old path
(`…/created-in-the-app/…`). That is evidence-row metadata, which the move
preserves rather than rewrites.

## Verification

Stage A dry-run passes with no failures, both affected paths enumerated,
ledger 341→341. Stage B dry-run fails only on the expected post-move
coordinates and count, ledger 341→341.
