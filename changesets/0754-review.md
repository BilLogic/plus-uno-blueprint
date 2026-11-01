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
evidence rows are guarded unchanged. Content, summary and status are unchanged
by this stage.

## Stage B: `0754-b-unavailable-response-content.json`

Content changes from “Unavailable answer releases the tutor from the roster —
no call-off record, by design” to “Drops a tutor who answers Unavailable from
the roster, with no call-off record.” Status changes from `built` to `live`,
and the summary loses its stale PLANNED opening.

## Status and summary

RM-2452 (Session Functionality v3: Update Sessions) was re-read through the
PLUS Notion connection on October 31, 2026: Dev Status Deployed, Release
Version 12.0 (live), Design Status Shipped. Its QA checklist §10 says a tutor
who answers Unavailable "drops off roster". Stage B therefore sets status
`live`, matching rows 21 and 22 in #740.

Stage B also replaces the summary's "PLANNED (not shipped as of Aug 2026)"
opening, which contradicted the deployed card, the same way #740 cleared it
from rows 21 and 22. The rest of the summary's meaning is unchanged.

The two existing evidence rows keep `cell_key` text naming the old path
(`…/created-in-the-app/…`). That is evidence-row metadata, which the move
preserves rather than rewrites.

## Verification

Stage A dry-run passes with no failures, both affected paths enumerated,
ledger 341→341. Stage B dry-run fails only on the expected post-move
coordinates and count, ledger 341→341.

Stage A runner SHA-256: `6a1d3b1099842bad34647331ffd617358a82dcc34c07d3711a6bbca509fcd03c`.
Stage B runner SHA-256: `76ba8c09facb969e99f8b61ef93bef648fbad7150f0efde3459fde4038810e72`
(re-dry-run after stage A is applied and verified).
