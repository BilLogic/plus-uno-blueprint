# #756 G13 Teacher / Lead Tutor placement moves

Applies the G13 placement table in `0756-review.md`, which the owner approved
as written. 45 identity-preserving `move_cell` operations, each followed by an
`add_evidence` row, split by path into two batches under the ~60-operation
limit:

| Batch | Paths | Operations |
|---|---|---|
| `0756-g13-a-placement-moves.json` | No prior goals, Mid-cycle check, New cycle, goals exist | 27 moves + 27 evidence (stopped after 7; see below) |
| `0756-g13-a-recovery.json` | The rest of batch A | 23 moves + 24 evidence |
| `0756-g13-b-placement-moves.json` | Missed last session, no goals; Missed last session, has goals | 18 moves + 18 evidence |

## Live values

Re-read from production on November 1, 2026, as the dev authoring user (reads
only), after #756's G4/G14 renames. Goal Setting has 7 paths, 60 steps, 63
lanes and 385 cells; the ledger held 426 rows. Every Teacher and Lead Tutor
cell sits exactly where the approved table says (one per column from column 1,
position 0), so every expected value is the table's "current" column with
today's step names. All 45 proposed destinations are still vacant, so no
destination was substituted.

## What moves

Per path, using the same rules as the approved table:

| Lane | Cell suffix | Destination | Rule |
|---|---|---|---|
| Teacher | `…0301` Checks if all students are in the correct breakout room. | Join breakout session, pos 1 | R2 |
| Teacher | `…0201` Reminds students to keep working while waiting. | Join breakout session, pos 2 | R3 |
| Teacher | `…0401` Receives information that a student is absent from the session. | Join breakout session, pos 3 | R4 |
| Teacher | `…0501` Alerts lead tutor about unassigned or miss-assigned students… | Join breakout session, pos 4 | R5 |
| Teacher | `…0601` Handles student tech problems as they arise. | Share screen, pos 1 | R6 |
| Lead Tutor | `…0202` Adds any un-rostered students to the attendance list. | Join breakout session, pos 1 | R9 |
| Lead Tutor | `…0302` Manually assigns unpaired students to available tutors. | Join breakout session, pos 2 | R10 |
| Lead Tutor | `…0402` Inform classroom teacher about students that are absent. | Join breakout session, pos 3 | R11 |
| Lead Tutor | `…0502` Respond to classroom teachers "ask for help" request. | Join breakout session, pos 4 | R12 |

Cell prefixes: No prior goals `1f`, Mid-cycle check `a0`, New cycle `b0`,
Missed (no goals) `c0`, Missed (has goals) `d0`. The `…0101` and `…0102` cells
stay (R1, R8). Content, status, `cell_key`, evidence, touchpoints and
dependencies are preserved; every incident `leads_to` edge stays within its
path, so no move violates one. Each per-lane check lists every Teacher and
Lead Tutor row before and after.

Share screen on the Mid-cycle check path is shared with Goal data looks wrong,
but cells are per path; nothing on that path moves.

## Partial apply of batch A and its recovery

Batch A stopped at its eighth operation, `G13-1f0501-evidence`. Four moves
(`…1f0301`, `…1f0201`, `…1f0401`, `…1f0501`) and three evidence rows had
landed and were verified, each with its durable change. The failed write
was the evidence insert for `…1f0501`: that cell has no `cell_key`, the
changeset passed `null`, and the evidence table requires one, so nothing was
written. The batch stopped as designed and its receipt stays in place, so a
separate `--verify` of batch A reports it incomplete.

`0756-g13-a-recovery.json` is the rest of batch A, regenerated from a fresh
read. It skips the four cells already at their destination and the three
evidence rows already written. For a cell without a `cell_key` it uses the
cell id as the evidence `cell_key`, which is the convention the existing
evidence rows on keyless cells follow. Batch B was regenerated the same way
(its `…0402` and `…0502` cells have no key either).

## Clears left for the owner (R7)

Deletes are human-only. Remove these five Teacher support-escalation cells
("Escalates unresolved issues to support@tutors.plus promptly.") in the app.
Each has one evidence row (#739 row 56) and `leads_to` edges to and from
neighbouring Teacher cells, which the delete also removes:

- No prior goals: `a0000000-0000-4000-8000-0000001f0701`
- Mid-cycle check: `a0000000-0000-4000-8000-000000a00701`
- New cycle, goals exist: `a0000000-0000-4000-8000-000000b00701`
- Missed last session, no goals: `a0000000-0000-4000-8000-000000c00701`
- Missed last session, has goals: `a0000000-0000-4000-8000-000000d00701`

## Dry-run, apply and verify (November 1, 2026)

| Batch | SHA-256 | Result |
|---|---|---|
| A | `6df8c31785373ad5f1f7847418e00578933b2bd80f01c59c37c026f61c48c69a` | Dry-run `ok`; apply stopped after 7 of 54 operations (above). Its separate verify reports the incomplete receipt and the keyless-cell evidence it never wrote, as expected |
| A recovery | `abbe04f76f6984501f6d8698848db6c87fb74b28e27a2b4df991505c423ea3af` | Dry-run `ok` (47 entries, ledger 580→580); apply 47/47; separate verify `ok: true`, no failures |
| B | `f86aedf2d93aa57341849400f8bd8ba2c0d576b83328d7345fce931e61027131` | Dry-run `ok` (36 entries, ledger 627→627); apply 36/36; separate verify `ok: true`, no failures |

All 45 moves and 45 evidence rows are in place. Batch B's hash changed from the
first draft because it was regenerated with the keyless-cell fix.
