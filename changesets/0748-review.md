# #748 12.1 go-live: student-safe goal view and goal-exempt students

Four batches, applied in order after #756's G13 moves:

| Batch | What it does | Operations |
|---|---|---|
| `0748-a-review-before-sharing.json` | Moves *Review last goal cycle overview and system suggestion* ahead of *Share screen* on New cycle, goals exist and Missed last session, has goals | 2 `set_path_steps` |
| `0748-b-student-safe-view-cells.json` | Student-safe view cells on the five maintained paths | 7 `update_cell_content`, 10 `insert_cell_at_position`, 17 `add_evidence` |
| `0748-c-goal-exempt-path.json` | New exception path *Student is goal-exempt* (audit row F19) with its three cells | 1 `create_path_at_status`, 1 `add_step`, 3 `upsert_cell_at_status`, 3 `add_evidence` |
| `0748-d-goal-exempt-columns.json` | Trims the new path's columns to the ones it uses | 1 `set_path_steps` |

The reorder goes in its own batch because every insertion and edit after it
captures each path's step order, and a reorder in the same batch would fail
those preservation checks. The column trim comes after the path exists,
because the runner cannot preflight an edit to a path it has not created yet.

## Gate

Checked in the PLUS Notion roadmap on November 1, 2026:

- Card 2482 "Goal-Setting Iteration (Student-Facing Screen-Share Surface)"
  (`37ab7cca-4982-8088-ba61-ff6957494f18`): Dev Status **Deployed**, Release
  Version "12.1 (next)", Design Status Shipped.
- Card 2641 "Penn Wood: students not in goal setting"
  (`3e2b7cca-4982-8052-9f40-c7751d7e1c35`): Dev Status **Deployed**, Release
  Version "12.1 (next)", Design Status Shipped.

Both are Deployed, so the student-safe view and the goal-exempt part both go
ahead at `live`. The Release Version label still reads "(next)"; Dev Status is
what the status rule reads.

## Sources read

- Draft Module 9 (`32cb7cca-4982-8080-ab2f-efa7f0908fe5`), § How to do Goal
  Support: privately review tutor-only information before sharing; wait until
  the app confirms the student-safe view is ready; follow the app's prompts
  for when to begin and stop sharing.
- Card 2482 Handoff Spec (`3a3b7cca-4982-8113-b7b3-c37275a66f86`): the modal's
  enter buttons (Start goal setting / check-in / update), Undo, the share
  banners ("Share your screen now — {FirstName} can safely see this view.",
  "Goals saved. / Goals checked. Stop sharing your screen — the rest is
  tutor-only."), notes shown only in the tutor views, and the Eligible for
  reward chip.
- Figma `W0qzhXWxFsMwSJzkdV2yal` node 157:180892 (Goal / Check-in Badges),
  read through the PLUS Figma connection: the Eligible for reward chip is
  "Shown at the start of a new cycle if the student met at least one of their
  two goals last cycle."
- Card 2641 body: the user flow (Figma 12200:250870 scenario 4, 12200:422358
  scenario 4.1, and frames 12200:250877, 12200:251773, 12200:420536 to
  12200:421937), the rules, and the reporting rules.

## Batch B: the five maintained paths

Every edited cell is guarded by its full prior value, and every insertion
needs an exact vacant slot. All new cells are Regular Tutor cells at `live`.

| Ticket item | Path | Step | Change |
|---|---|---|---|
| Tutor view before sharing | No prior goals | Click on Set goals CTA… | Insert pos 1: "Reviews tutor-only badges and notes, then presses Start goal setting." |
| | Mid-cycle check | Click on 'Check goals' CTA… | Insert pos 1: "… then presses Start goal check-in." |
| | Missed last session, no goals | Click on 'Set goals' CTA… | Insert pos 1: "… then presses Start goal setting." |
| | New cycle, goals exist; Missed, has goals | Review last goal cycle overview and system suggestion (now before Share screen) | `…b00403`, `…d00503` content → "Reviews last cycle's overview, the system suggestion and notes in the tutor-only view, then presses Start goal update." |
| System suggestion summary | same two cells | | Summary rewritten. It no longer says the tutor and student look at the suggested next goal; the student-safe view hides it |
| Share screen | all five | Share screen | `…1f0303`, `…a00303`, `…b00303`, `…c00403`, `…d00403` → "Shares screen once the app says the student-safe view is ready." Summary: the enter banner, and the student view hides suggestions and notes |
| After saving | No prior goals, New cycle, both Missed | Save goal | Insert pos 1: "Stops sharing when prompted, then finishes in the tutor view." |
| | Mid-cycle check | Once goal review is done, clicks on 'Check goals' button | Insert pos 1: same text |
| Undo on Goals checked | Mid-cycle check | same step | Insert pos 2: "Can press Undo to revert Goals checked." |
| Eligible-for-reward chip | New cycle, goals exist | Review last goal cycle overview… | Insert pos 1: "Sees an Eligible for reward chip when the student met at least one goal last cycle." |

Each changed or new cell gets one `add_evidence` row citing the sources above.

**One wording narrowed.** The ticket says the chip "clears when the cycle
closes". The Figma badge note says the chip shows at the start of a new cycle,
and neither the Handoff Spec nor the nodes read say when it clears. The cell
does not claim when it clears.

## Batch C and D: Student is goal-exempt

- `create_path_at_status` "Student is goal-exempt", kind `exception`, status
  `live`, lanes copied from Mid-cycle check. The RPC also copies Mid-cycle
  check's step memberships, so the new path shares *Join breakout session*,
  *Leave breakout room* and *Move on to the next student…*, as Goal data looks
  wrong already does.
- `add_step` "Help the student and mark them helped" at column 2.
- Cells, all `live`:
  - Lead Tutor on *Join breakout session*: "Sees a Goal-exempt count on Session
    info and a tag in Attendees."
  - Regular Tutor on the new step: "Sees Status unavailable, helps as usual,
    then marks them helped."
  - Back Stage Actions on the new step: "Goal-setting stats leave goal-exempt
    students out; Mark helped counts as a completed check-in."
- Batch D sets the path's columns to Join breakout session, the new step,
  Leave breakout room and Move on to the next student. That drops the five
  copied Mid-cycle goal columns, which have no cells on this path. Shared
  steps and every other path are unchanged; the guarded membership trigger
  refuses removing a column that holds cells.

## Not done here

- **#747 rows built → live (TE2b, TE3, 2243, 2626 and the rest).** #747 has
  not applied yet: production holds no #747 evidence rows or cells on
  November 1, 2026. There is nothing to move from `built` to `live`. This part
  of #748 stays open until #747's rows land.
- The All conditions overview path keeps its old "Shares screen." cell. That
  path is not maintained cell by cell.
- Mid-cycle check's *Share screen* PLUS App touchpoint still describes a
  "proposed iteration" Student Progress Dashboard. That is out of this
  ticket's scope.
- No deletes.

## Applied (November 1, 2026)

| Batch | SHA-256 | Result |
|---|---|---|
| A | `e5d5ebca0f60fcdb5de514b2d6b556ff19b24090b5d0b28265d64612d7134087` | Apply 2/2; separate verify `ok: true` |
| B | `e764a2f4c013a3dc7a02d8600cc550acaa1bfa67c67c412a4184ceb2294e4cca` | Apply 34/34. The apply and the separate verify each report the same two failures, and no others. Both are a fault in the changeset's own `checks`, not in the data (below) |
| C | `abaf553152a8d9ff1792d779a46a2bbdf525d9f864ea45e3ad314678a7d6c630` | Regenerated after B, because B's three new cells changed Mid-cycle check's cell count. Dry-run `ok`, ledger 816→816; apply 8/8; separate verify `ok: true` |
| D | `2aee8a6335179572621fe3dd16d0d6de497a9a8a09e81da03b648fc538f2c8fd` | Generated after C; dry-run `ok`, ledger 826→826; apply 1/1; separate verify `ok: true` |

**Batch B's two check failures.** Two insertions go into the same Mid-cycle
check square: *Once goal review is done, clicks on 'Check goals' button*,
Regular Tutor. They are `stop-share-9b05` at position 1 and `undo-9b05` at
position 2. The generator wrote one square check for each insertion, each
expecting 1 → 2 cells. After both insertions the square holds 3. A fresh read
shows exactly the intended rows: `…a00503` at position 0 (unchanged),
"Stops sharing when prompted, then finishes in the tutor view." at 1, and
"Can press Undo to revert Goals checked." at 2. Every operation's durable
record, inverse, content and the other 42 checks verify. The file stays as
applied, because its receipt is bound to this hash.

The new path is `a4e8ec9b-ed13-4afe-8c19-687a18677245` and its new step is
`03e76fc3-4008-426a-b8e3-d03877ec1abb`. After D, its columns are Join
breakout session, Help the student and mark them helped, Leave breakout room,
and Move on to the next student….
