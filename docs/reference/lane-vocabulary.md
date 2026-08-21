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

**Status: the list is settled. Five mappings are not.**

---

## Team ≠ stakeholder

Two different columns, easy to conflate:

| | `stakeholders` | `lanes.owner_team` |
| --- | --- | --- |
| Answers | who appears in the blueprint as an actor | who is accountable for what happens in this row |
| Holds | Regular Tutor, Lead Tutor, Teacher, Student, Supervisor | the teams below |
| A row can have | one, via `lanes.stakeholder_id` | one, as a value from this list |

Tutors are the clearest case. **Regular Tutor** and **Lead Tutor** are the same
population in two rota roles — they are *actors*, the people the service is
staffed by, and they are never an owning team. The **Supervisor** stakeholder
and the **Tutor Supervisors** team coincide in exactly one place (Supervisor
Program Administration) and are distinct everywhere else.

---

## The list

| Team | Owns | Recognise it by |
| --- | --- | --- |
| **Design** | The screens and flows the tutor sees, and the design system behind them. | Figma, branding, anything described as a screen or a flow rather than as code. |
| **Dev** | The PLUS app itself — every servlet, job and integration behind a `frontstage_tech` or `backstage_tech` pill. | A pill that is software PLUS built. |
| **Product** | What gets built and in what order. Roadmap, requirements, the decision that a flow should exist. | Anything whose answer is a prioritisation rather than an artefact. |
| **Research** | Study design and its inputs to the product — student ordering, session condition, engagement baseline, the reflection questions as a research instrument. | Anything whose reason for existing is a study rather than a service need. |
| **Tutor Supervisors** | Recruiting, clearance chasing, session and roster administration, call-off decisions, hours approval, reflection follow-up. The default owner of `backstage_actions` in most scenarios. | Anything a named PLUS staff member does to a tutor's record, schedule or pay. |
| **Partnership** | The relationship with schools and districts, and the public face that reaches people before they are tutors. | Anything where the counterparty is an institution rather than a tutor. |

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

## Five mappings still open

The list is settled; where some existing content lands in it is not. Each of
these blocks a group of lanes.

**1. Instructional Design — 9 cells name it. Which team owns it?**
Onboarding modules, lesson modules, quizzes, supplementary materials, and the
reflection questions as pedagogy. It was its own team in the old draft and is
not on the given list. Product? Research? Or a seventh team that was simply
missed?

**2. Marketing — 11 cells name it. Is that Partnership?**
The marketing site, social channels, the Handshake posting. Grouped under
Partnership above on the reasoning that both are "reaching people before they
are tutors" — but that is my inference, not something the content says.

**3. Product is never named anywhere on the board.**
Zero cells mention a product team, product manager or PM. Either the work it
owns is currently attributed to Design or Dev, or the board genuinely does not
depict it. Which lanes should carry it?

**4. `Discovery › Back Stage Actions` names three teams at once.**
*"Design team manages content and messaging on the website; the dev team
implements it in code"* alongside *"Marketing team creates social media
posts…"*. `owner_team` takes one value. Split the lane, or name one accountable
and leave the rest in prose?

**5. Does an external body ever own a lane?**
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
