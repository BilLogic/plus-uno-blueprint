# #758 Goal Setting leads to the Weekly Class Report (#742 row80)

Prepared and dry-run only. Nothing is applied. Applying requires Bill's
approval of this exact file on the ticket.

## Operations, in order

1. `set_cell_dependency` adds a `leads_to` from the Goal Setting email cell to
   the first cell of the Weekly Class Report scenario.
2. `add_evidence` adds one row on the source cell recording why the link
   exists and which tickets scope it.

| End | Cell | Scenario / path | Lane / step | Content |
|---|---|---|---|---|
| Source | `3c359d25-ac54-4310-bfe6-e458a916ec1d` | Goal Setting / New cycle, goals exist (`…0815`) | Back Stage Touchpoints / Review last goal cycle overview and system suggestion, position 1 | Weekly Class Report email |
| Target | `944a2e40-b411-4704-acd9-a44d245f42a6` | Weekly Class Report / Report sent (`611a7139…`) | Regular Tutor / Build report, position 0 | Records attendance, engagement and goals that feed the teacher report. |

The target is the one #758 names: the Regular Tutor cell at Build report,
which is the first step of Report sent. #759 created it on October 31. The
note on the edge reads "The weekly email is the Weekly Class Report, which
starts from the attendance, engagement and goal records tutors keep."

## Why it can be written now

#758 was blocked because `set_cell_dependency` refused any edge whose cells
sat on different paths. Migration 20261031160000, applied November 1, 2026
from template v2.9.0 (ADR 0035), replaced that rule with one service: both
cells reach the same service through path, scenario and phase. Goal Setting
is in the In-session phase and Weekly Class Report in Program Administration,
and both phases belong to service `…0001`.

## Runner change

The runner already registered `set_cell_dependency`, but it checked only that
both cells existed. It now guards a link the way the other capabilities guard
their writes:

- The operation requires `input.expected_source` and `input.expected_target`.
  Each names at least the reviewed `path_id`, `lane_id`, `step_id` and
  `scenario_id`; this file also pins position, content, status and the
  target's `cell_key`. Dry-run and apply both read each end through to its
  service and refuse any field that has drifted.
- A link whose ends sit in different services is refused at dry-run, before
  the RPC would refuse it.
- The diff shows both ends and their shared service. Apply refuses if they
  differ from the reviewed preflight.
- The RPC upserts. Preflight requires no edge on (source, target, kind), so a
  result that reports an update means one appeared since. Apply then stops
  without claiming the write, because that inverse would restore a row rather
  than clear it.

The inverse of the insert is `clear_cell_dependency` on the new row's id. The
pinned `deriveRevert` records it, and the runner reads it back.

## Verification

- A production dry-run passes: `ok: true`, no failures, ledger count
  unchanged at 424 → 424, no receipt written, authenticated as the dev author.
  SHA-256 `cd0ca7f5d63a9a0c3822d22f43eb85aae2c3b561c4a4018b62a4c1ca9db47229`.
- A pre-apply `--verify` fails as it should: both operations find no row, the
  edge and evidence counts are unchanged, and there is no receipt.
- Live reads before drafting: the source has no incoming or outgoing edges and
  one evidence row (#742 row52). The target has none and one evidence row
  (#759 build-tutor).
- `scripts/tests/content-changeset-database.test.mjs` adds a fixture
  `set_cell_dependency` modelled on the hosted RPC: one-service check,
  self-edge refusal, upsert reporting `inserted` and `previous`. It covers:
  - A link across two phases of one service dry-runs read-only, applies with
    one `clear_cell_dependency` inverse, and verifies separately.
  - Refusals at dry-run and apply with no write: a cross-service target, a
    source moved since review, a target in another scenario than reviewed, a
    missing endpoint, and an endpoint without its path and scenario.
  - An edge created between preflight and write is refused, not claimed.
  - This exact file runs through dry-run, apply and verify on a board seeded
    with its real identities.
- The checks assert one outgoing edge on the source with its kind, null name
  and note, one incoming on the target, none in the other directions, and
  evidence counts of 1 → 2 on the source and 1 → 1 on the target.

## Owner decisions

- Approve the runner change.
- Confirm the target, Regular Tutor at Build report, as #758 names it. The
  Teacher's Receive email cell is the other plausible end, if the arrow should
  land on the email the teacher reads rather than the records that feed it.
- Confirm the edge note wording, and `leads_to` rather than `enables`.
- Confirm one evidence row on the source cell is wanted. Evidence attaches to
  cells, not edges, so this is the closest place to record the link.
