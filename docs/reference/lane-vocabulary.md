---
audience: agents and authors
summary: The closed list of teams a lane's owner_team may name, the actor/team split the stakeholders registry enforces, and the reasoning four 2026-08-21 migrations carried out.
sources: supabase/migrations/20260821280000_the_registry_gains_teams.sql, supabase/migrations/20260821290000_every_lane_that_owns_work_names_its_team.sql, supabase/migrations/20260821300000_a_team_is_not_a_stakeholder_kind.sql, supabase/migrations/20260821320000_perceived_owner_where_it_differs.sql, supabase/migrations/20260821380000_no_outsider_owns_a_lane.sql
last-reviewed: 2026-08-25
---

# Lane vocabulary — the team list

`docs/reference/spec-house-style.md` says `lanes.owner_team` must come **"from
the closed list"**. This is that list.

> **This document has been carried out.** It was written as a proposal while
> `owner_team` was empty on every lane. Four migrations on 2026-08-21 executed
> it — two of them citing this file by name — so read the reasoning as the
> record of a decision, not as a plan. What shipped: `20260821280000` gave
> `stakeholders` its `parent_id`; `20260821290000` filled `owner_team` by the
> rule below (158 lanes) and installed the trigger that enforces it;
> `20260821300000` added the `team` kind and moved the ten teams onto it;
> `20260821320000` wrote `perceived_owner` on the Reporting-an-Issue cells;
> `20260821380000` then NULLed three outsider-owned lanes, leaving **155**.

Not to be confused with the installed package's
`references/lane-vocabulary.md`, which tells parallel drafting agents how to
converge on lane *roles* and *actor
labels*. This one names the teams a lane can be owned by.

> *Revised 2026-08-21 with the team list as given by Bill. The previous draft
> was reverse-engineered from cell content and got two teams wrong by inventing
> them from spellings, and missed two that exist. Where the given list and the
> board's content disagree, the disagreement is written down below rather than
> resolved by guessing.*

**Status: written.** See the migrations above.

---

## One registry, not two vocabularies

Teams and stakeholders were drafted as two separate lists. They are not — a
party is a party. **`public.stakeholders` already exists** — `id`,
`service_id`, `name`, `kind`, `note`, `aliases`, plus the `parent_id` and
`updated_at` it has since gained (`useValueAudiences` reads two of those
columns: `name, aliases`) — so this was one table gaining a parent link, not a
new one being invented.

```
Design ──┬── Product Design
         ├── Design Ops
         ├── Instructional Design
         └── Marketing
Dev
Product
Research
Tutor Supervisors
Partnership

Regular Tutor · Lead Tutor · Teacher · Student      (actors)
CMU HR · CPO                                        (partners, outside PLUS)
```

`lanes.owner_team` becomes a reference into that table. Every row is available
as a value; which ones are *sensible* values is a matter of kind, not of a
second list:

`20260821300000` settled this by splitting the axis rather than answering per
kind: it added a `team` kind to the CHECK and moved the ten teams onto it. The
rule now reads off the column comment:

| kind | Can be a lane's `stakeholder_id`? | Can be its `owner_team`? |
| --- | --- | --- |
| `team` | **no** | yes |
| `partner` | yes | yes |
| `staff` / `recipient` / `provider` | yes | **no** |

So `staff`, `recipient` and `provider` are **actors** — they can be a lane's
stakeholder. `team` is a group accountable for work and is never a stakeholder.
`partner` is the one kind on both sides, because CPO both acts in a lane and
owns one. (`20260821380000` then narrowed that in practice, NULLing the three
outsider-owned lanes; the constraint still allows it.)

The registry's missing **parent link** — the one that makes Instructional Design
roll up to Design — shipped as `stakeholders.parent_id` in `20260821280000`,
asserted at exactly four sub-teams, one level deep. Plan `2026-08-20-009` is
`status: completed`.

---

## The list

| Team | Owns | Recognise it by |
| --- | --- | --- |
| **Design** | The screens and flows the tutor sees, the design system behind them, how the service is taught, and how it is presented to the outside world. Four sub-teams — see below. | Figma, branding, module content, the marketing site. |
| **Dev** | The PLUS app itself — every servlet, job and integration behind a `frontstage_touchpoints` or `backstage_touchpoints` touchpoint. | A touchpoint that is software PLUS built. |
| **Product** | What gets built and in what order. Roadmap, requirements, the decision that a flow should exist. | Anything whose answer is a prioritisation rather than an artefact. |
| **Research** | Study design and its inputs to the product — student ordering, session condition, engagement baseline, the reflection questions as a research instrument. | Anything whose reason for existing is a study rather than a service need. |
| **Tutor Supervisors** | Recruiting, clearance chasing, session and roster administration, call-off decisions, hours approval, reflection follow-up. The default owner of `backstage_actions` in most scenarios. | Anything a named PLUS staff member does to a tutor's record, schedule or pay. |
| **Partnership** | The relationship with schools and districts, and the public face that reaches people before they are tutors. | Anything where the counterparty is an institution rather than a tutor. |

### Design's sub-teams

Design is the one team with named parts, and the parts are worth recording as
values in their own right — a lane owned by Instructional Design says something
a lane owned by "Design" does not.

| Sub-team | Owns |
| --- | --- |
| **Product Design** | The screens and flows a tutor moves through. |
| **Design Ops** | The design system, the libraries, and how design work ships. |
| **Instructional Design** | Onboarding modules, lesson modules, quizzes, supplementary materials, and the reflection questions as pedagogy. |
| **Marketing** | The public face — the marketing site, social channels, the Handshake posting. |

`owner_team` takes the **most specific** value that is true. *"What does Design
own?"* is answered by rolling the four up, which is what the parent link in the
registry is for.

### Lanes that take no team

`owner_team` stays NULL on these, and that is the correct value — not a gap.

| Lane | Rows | Why |
| --- | ---: | --- |
| `Regular Tutor` | 37 | The spine actor. A student employee doing the work, not a group accountable for it. |
| `Lead Tutor` | 19 | Same population, a rota role. The app distinguishes lead from regular only for eligibility. |
| `Teacher` | 16 | School staff, outside PLUS entirely. |
| `Student` | 2 | The person the service is for. |
| `Storyboard` | 22 | A row of frames. No work happens in it, and its own cells are empty: each draws the strip its neighbours carry. |

Rule: **an actor lane names a person, so it has no owning team; a tech or
actions lane names work, so it does.** Where an actor lane's own work is
administered by a team — `Supervisor` in Program Administration — the team goes
on the lane, because there the actor *is* the team's staff.

### Outside PLUS

Two bodies gate the Application and Onboarding phases and answer to nobody here.
They are **not** teams and do not belong in `owner_team`; they belong in the
cell content and, once it exists, the stakeholder registry as `partner`.

| | Gates |
| --- | --- |
| **CMU HR** | Employment, the I-9, payroll in Workday. |
| **CPO** | Act 153 clearances and their verification — what PLUS is legally not allowed to verify itself. |

A blueprint that only names groups PLUS controls hides its two hardest
dependencies, so they stay visible — just not as owners.

---

## Resolved: what `Supervisors` and `PLUS staff` are

**`Supervisors` = `Tutor Supervisors`.** One group, five spellings across 49
cells — `Tutor supervisor team` (25), `Supervisors` (18), `PLUS staff` (3),
`PLUS supervisor team` (2), `PLUS tutor supervisor team` (1). The content
converges on **Tutor Supervisors**.

**`PLUS staff` is not a seventh team — it is the tutor's name for the same
people.** Every occurrence is in a tutor-perspective cell:

> *"Reaches out to PLUS staff with any concerns."* — Reporting an Issue, Regular Tutor
> *"PLUS staff request assistance if needed."* — Reporting an Issue, Front Stage Actions

A tutor does not know the org chart. They know there is a PLUS, and someone at
it answers `help@tutors.plus`. That is the Tutor Supervisors seen from outside.

**This was the first real use for `perceived_owner`**, and it shipped as
written: `20260821320000` writes it on exactly these cells and asserts that no
cell sets `perceived_owner` equal to `owner`. The board has `owner` and
`perceived_owner` side by side, and these cells are the distinction those two
columns were built for:

| | |
| --- | --- |
| `owner` | Tutor Supervisors |
| `perceived_owner` | PLUS staff |

So the phrase stays in the tutor-facing content — it is *true* about how the
service is experienced — and never appears in `owner_team`.

---

## Resolved: Product, Discovery, and external bodies

**Product owns nothing on this board — and that is not a gap.**
Zero cells name a product team, manager or PM. A service blueprint depicts the
service as it is experienced and operated; deciding *what gets built and in what
order* does not appear as a lane in any scenario. Product stays in the registry
as a valid value so a future board can use it, and is written on no lane today.

**`Discovery › Back Stage Actions` is owned by Design.**
The cell names three groups — *"Design team manages content and messaging on the
website; the dev team implements it in code"* and *"Marketing team creates social
media posts"* — but Design owns the whole of it in fact, and Marketing is one of
its sub-teams. One row, one value, no split. Dev's implementation stays in the
prose where it belongs: it describes how the work lands, not who is accountable
for the row.

**No external body owns a lane, because no lane is theirs.**
The question was whether CPO and CMU HR sit below the line of visibility. They
do not — and the board is unambiguous about it. Every clearance cell, by lane
role:

| Lane | Role | Cell |
| --- | --- | --- |
| Regular Tutor | `customer_actions` | *"Completes PA Act 153 clearances with the CPO."* |
| Front Stage Actions | `frontstage_actions` | *"CMU HR department sends clearance materials."* |
| Back Stage Actions | `backstage_actions` | *"Tutor supervisor team forwards accepted candidates to the CPO."* |
| Support Actions | — | *"Child protection laws"* |

The tutor deals with the CPO **directly, in their own lane** — that is above the
line of interaction, not below visibility. CMU HR appears in **Front Stage
Actions**, which the tutor sees by definition. What is genuinely below the line
is the *supervisors* forwarding and chasing, and that work is theirs, not the
CPO's. And the support lane holds *"Child protection laws"* — the regulation,
not the organisation.

So: **external bodies are actors inside cells, never lane owners.** The clearance
lanes go to **Tutor Supervisors**, who are the group you can actually ask about
a stuck clearance. Where a single cell's doer really is external — the CMU HR
one above — that is what the cell-level `owner` override exists for.

---

## What this unlocks

The projection was roughly 110 of the 173 (scenario, lane) groups, about 200
rows. The rule as run filled **158**, and `20260821380000` took three back:
**155**. The rest are the actor and storyboard lanes above, which stay empty by
rule. (Counts in this file are quoted as "306 lanes" throughout; three
`partner_actions` lanes were added by `20260821260000` after that count was
taken, so read 306 as the order of magnitude, not the current total.)

`owner_team` is **per scenario, not per lane name**. `Back Stage Actions` is
owned by the Tutor Supervisors in six scenarios, by Research in Goal Setting and
Help Request, by Design in Discovery, and by whoever owns instructional design
in the two module scenarios. A blueprint-wide mapping from lane name to team
would be wrong in a quarter of the board.

**Enforced:** `20260821290000` installs a trigger
(`lanes_owner_team_is_a_party()`) that rejects an `owner_team` naming nobody in
the registry. The closed list is a database constraint, not a convention.

**Display:** `owner_team` *should* render as a **badge**, not text — see
[panel-affordances.md](./panel-affordances.md) § Badge or text. A short team
vocabulary is one a reader learns by seeing it repeat, and "which lanes does
Research own?" is a scanning question.
⚠️ **Not what the code does today**: `LanePanel.tsx:228-257` renders Owner team
as an `<Input list="lane-owner-tags">` when editable and plain prose when not.
Nothing checks the rule. Whether the badge is still wanted now that the value is
a registry reference rather than free text is an open UI question — filed, not
swept.
