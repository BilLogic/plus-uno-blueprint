# #737 owner-approved deletes

The owner asked on November 1, 2026 for the deletes the content reviews left
for the owner to be applied. This batch deletes exactly those rows and nothing
else: 11 operations, 9 cell deletes, 1 path membership and 1 lane. Live values
were re-read on November 1, 2026 (reads only) and match the reviews that
listed them.

## A. The five G13 Teacher escalation cells (#756, rule R7)

`0756-review.md` marks each of these "clear — no step fits" (R7), and
`0756-g13-review.md` § Clears left for the owner names the same five ids. The
rest of the Teacher sequence was moved by the G13 batches and verified there,
so these are the leftovers. Each is live, at position 0, with the content
"Escalates unresolved issues to support@tutors.plus promptly."

| Cell | Path | Step | Cascades |
|---|---|---|---|
| `…0000001f0701` | No prior goals | Fill out goal achievement strategy with the student | 2 `leads_to` (`…9b006` from `…1f0601`, `…9b041` to `…1f0101`) |
| `…000000a00701` | Mid-cycle check | Leave breakout room | 2 `leads_to` (`…9c006`, `…9c041`) |
| `…000000b00701` | New cycle, goals exist | Fill out goal achievement strategy with the student | none |
| `…000000c00701` | Missed last session, no goals | Fill out goal settings and quantity with the student | 2 `leads_to` (`…9f006`, `…9f041`) |
| `…000000d00701` | Missed last session, has goals | Fills out goal settings and quantity with the student | 2 `leads_to` (`…9e006`, `…9e041`) |

None has a placement or resource. On each path the chain loses its last two
edges: "Handles student tech problems" no longer leads back round to
"Circulates and quietly observes".

## B. The 12+ hours ahead late call-off column (#752 row 29)

`0752-row29-review.md` deprecated these four cells and left the membership
removal to the owner, because `path_step_keeps_saved_cells` refuses it while
cells sit there. Path `…0808`, step `…0942` "Files late call-off (<12h,
immediate removal)":

| Cell | Lane | Content | Cascades |
|---|---|---|---|
| `…00170303` | Regular Tutor | If it is less than 12 hours before session, tutor emails supervisor. | 2 resources |
| `…00170304` | Front Stage Actions | Tutor supervisor receives email request for shift swap. | none |
| `…00170306` | Front Stage Touchpoints | Email | 1 placement (`72c9ce89…`) |
| `…00170310` | Storyboard | blank | none |

Then `remove_step` takes the step off `…0808` only. Its other membership,
Under 12 hours (`b0000000-…0809`, position 2) and that path's three live cells
stay. The step row stays because it still has that membership. The RPC also
renumbers what is left on `…0808`: its five other steps go from positions 1–5
to 0–4, same order.

## C. The empty Lead Tutor lane on Fill-in Request › Slot gets covered

Lane `6afdaba8…` (position 1, no cells) was added by `add_lane` in #744, which
puts a lane on every path. `remove_lane(scenario_id, lane_name)` deletes by
name across the scenario, which would also take Requested mid-session's Lead
Tutor lane (`02363ff7…`) and its 3 cells. So the runner calls
`remove_lanes([6afdaba8…])` instead, and guards that other lane and its cells.

## What the deletes leave and how to recover

Each RPC archives what it destroys into `authoring_changes` (the trash view),
in the same transaction, and returns that row's id. There is no restore RPC:
recovery is a reviewed manual re-insert from the payload. The cell payload
holds the cell row alone; the 8 edges, 2 resources and 1 placement above are
not in the trash, and the runner's receipt holds them as captured checks. The
nine evidence rows on these cells stay: evidence has no foreign key to cells.

## Runner

The runner gained `delete_cell`, `remove_step` and `remove_lane` for this batch,
with tests in `scripts/tests/content-changeset-database.test.mjs`.

## Dry-run, apply and verify (November 1, 2026)

| Mode | Result |
|---|---|
| Dry-run | `ok`, no failures, 11 entries, ledger 858→858 |
