# Lane vocabulary — the team list

`docs/reference/spec-house-style.md` says `lanes.owner_team` must come **"from
the closed list"**. This is that list. Until now it did not exist, which is why
`owner_team` is empty on all 306 lanes: the field had a rule and no vocabulary
to satisfy it.

Not to be confused with `src/lib/agent/skill/references/lane-vocabulary.md`,
which tells parallel drafting agents how to converge on lane *roles* and *actor
labels*. This one names the teams a lane can be owned by.

> *Revised 2026-08-21 with the team list as given by Bill. The previous draft
> was reverse-engineered from cell content and got two teams wrong by inventing
> them from spellings, and missed two that exist. Where the given list and the
> board's content disagree, the disagreement is written down below rather than
> resolved by guessing.*

**Status: the list is settled. Three mappings are not.**

---

## One registry, not two vocabularies

Teams and stakeholders were drafted as two separate lists. They are not — a
party is a party, and the same row can be a lane's owner in one place and an
actor in another. **`public.stakeholders` already exists** (`useValueAudiences`
reads it today: `id, service_id, name, kind, note, aliases`), so this is one
table gaining a parent link, not a new one being invented.

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

| kind | Can own a lane? | Why |
| --- | --- | --- |
| `staff` | yes | A team accountable for work. |
| `partner` | see open question 3 | Real work, outside PLUS's control. |
| `recipient` | no | The person the service is for. |
| actor rows (Regular Tutor, Lead Tutor, Teacher) | no | Name a person doing the work, not a group accountable for it. |

The one column the registry is missing is the **parent link** that makes
Instructional Design roll up to Design. Adding it is the change to fold into
plan `2026-08-20-009`.

---

## The list

| Team | Owns | Recognise it by |
| --- | --- | --- |
| **Design** | The screens and flows the tutor sees, the design system behind them, how the service is taught, and how it is presented to the outside world. Four sub-teams — see below. | Figma, branding, module content, the marketing site. |
| **Dev** | The PLUS app itself — every servlet, job and integration behind a `frontstage_tech` or `backstage_tech` pill. | A pill that is software PLUS built. |
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
| `Storyboard` | 22 | A picture row. No work happens in it. |

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

**This is the first real use for `perceived_owner`.** The board has `owner` and
`perceived_owner` side by side and `perceived_owner` is empty everywhere. These
cells are exactly the distinction those two columns were built for:

| | |
| --- | --- |
| `owner` | Tutor Supervisors |
| `perceived_owner` | PLUS staff |

So the phrase stays in the tutor-facing content — it is *true* about how the
service is experienced — and never appears in `owner_team`.

---

## Three mappings still open

The list is settled, and Instructional Design and Marketing are placed. Three
questions remain, each blocking a group of lanes.

**1. Product is never named anywhere on the board.**
Zero cells mention a product team, product manager or PM. Either the work it
owns is currently attributed to Design or Dev, or the board genuinely does not
depict it. Which lanes should carry it?

**2. `Discovery › Back Stage Actions` names three teams at once.**
*"Design team manages content and messaging on the website; the dev team
implements it in code"* alongside *"Marketing team creates social media
posts…"*. `owner_team` takes one value. Split the lane, or name one accountable
and leave the rest in prose?

**3. Does an external body ever own a lane?**
Interview & Offer has clearance work that is genuinely CPO's, not the
supervisors'. NULL, or a `partner` value outside the team list?

---

## Once these are closed

Roughly 110 of the 173 (scenario, lane) groups become fillable — about **200 of
306 rows**. The rest are the actor and storyboard lanes above, which stay empty
by rule.

`owner_team` is **per scenario, not per lane name**. `Back Stage Actions` is
owned by the Tutor Supervisors in six scenarios, by Research in Goal Setting and
Help Request, and by whoever owns instructional design in the two module
scenarios. A blueprint-wide mapping from lane name to team would be wrong in a
quarter of the board.

**Display:** `owner_team` renders as a **badge**, not text — see
[panel-affordances.md](./panel-affordances.md) § Badge or text. Six teams
across 306 lanes is a vocabulary a reader learns by seeing it repeat, and
"which lanes does Research own?" is a scanning question.
