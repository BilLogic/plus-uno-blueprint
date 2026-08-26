---
audience: agents and authors
summary: The stable UUID map for the Warm-Up Happy Path seed — its nine lanes, nine steps, Regular Tutor chain and loop edge — read straight off supabase/seeds/warm_up_happy_path.sql.
sources: supabase/seeds/warm_up_happy_path.sql
last-reviewed: 2026-08-25
---

# Warm-Up Happy Path — stable ID map

Hierarchy: **Pre-Session** (`…000103`) → **Warm-Up** (`…000203`) → **Warm-Up Happy Path** (`…000300`)

Every value here is read off `supabase/seeds/warm_up_happy_path.sql`. When the
seed and this file disagree, the seed wins.

## Path

| Field | Value |
| --- | --- |
| UUID | `a0000000-0000-4000-8000-000000000300` |
| path_type | `happy` |

## Lanes (`lane_id` → UUID, `position`)

Nine lanes, in seed `position` order. `Storyboard` sits at position 0 and is
easy to miss — it carries the step captions, not journey content.

| lane_id | UUID | name | position |
| --- | --- | --- | --- |
| storyboard | `…000310` | Storyboard | 0 |
| partner_action_teacher | `…000301` | Partner Action: Teacher | 1 |
| lead_tutor | `…000302` | Lead Tutor | 2 |
| regular_tutor | `…000303` | Regular Tutor | 3 |
| front_stage_tech | `…000306` | Front Stage Tech | 4 |
| front_stage_actions | `…000304` | Front Stage Actions | 5 |
| back_stage_tech | `…000308` | Back Stage Tech | 6 |
| back_stage_actions | `…000307` | Back Stage Actions | 7 |
| support_actions | `…000309` | Support Actions | 8 |

## Steps (`id` → UUID, `position`)

Nine steps. Note that the last two are **not** in UUID order: `…000319` is
step 8 and `…000318` is step 9, because Leave Breakout Room was inserted after
Move to Next Student had already taken its id.

| id | UUID | title | position |
| --- | --- | --- | --- |
| enter_breakout_room | `…000311` | Enter Breakout Room | 1 |
| greet_student | `…000312` | Greet Student | 2 |
| ask_student_share_screen | `…000313` | Ask Student to Share Screen | 3 |
| remind_student_can_ask_help | `…000314` | Remind Student They Can Ask for Help | 4 |
| mark_student_present | `…000315` | Mark Student Present | 5 |
| select_engagement_level | `…000316` | Select Engagement level | 6 |
| mark_student_helped | `…000317` | Mark Student Helped | 7 |
| leave_breakout_room | `…000319` | Leave Breakout Room | 8 |
| move_to_next_student | `…000318` | Move to Next Student | 9 |

## Step 1 → step 2 dependencies

| Lane | Source cell | Target cell |
| --- | --- | --- |
| Partner Action: Teacher | `…040101` | `…040201` |
| Lead Tutor | `…040102` | `…040202` |
| Regular Tutor | `…040103` | `…040203` |

## Step 2 → step 3 dependencies

| Lane | Source cell | Target cell |
| --- | --- | --- |
| Partner Action: Teacher | `…040201` | `…040301` |
| Lead Tutor | `…040202` | `…040302` |
| Regular Tutor | `…040203` | `…040303` |

## Regular Tutor cells (the chain, steps 1–9)

Cell ids follow `04{step}{lane}`, so the Regular Tutor cell for step N is
`…04N03`. Nine cells, eight forward links (`…050101`–`…050108`).

| Step | Cell UUID |
| --- | --- |
| enter_breakout_room | `…040103` |
| greet_student | `…040203` |
| ask_student_share_screen | `…040303` |
| remind_student_can_ask_help | `…040403` |
| mark_student_present | `…040503` |
| select_engagement_level | `…040603` |
| mark_student_helped | `…040703` |
| leave_breakout_room | `…040803` |
| move_to_next_student | `…040903` |

## Regular Tutor loop (step 9 → step 1)

| Source | Target |
| --- | --- |
| `…040903` (Move to Next Student) | `…040103` (Enter Breakout Room) |

The loop edge is `…050112`. It leaves from step **9**, not step 8 — a chain
that ends at `…040803` is short one link.

Seed file: [`supabase/seeds/warm_up_happy_path.sql`](../../supabase/seeds/warm_up_happy_path.sql)
