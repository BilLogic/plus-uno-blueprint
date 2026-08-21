# Lane vocabulary — the closed team list

`docs/reference/spec-house-style.md` says `lanes.owner_team` must come **"from
the closed list"**. This is that list. Until now it did not exist, which is why
`owner_team` is empty on all 306 lanes: the field had a rule and no vocabulary
to satisfy it.

Not to be confused with `src/lib/agent/skill/references/lane-vocabulary.md`,
which is a different document with a similar name — that one tells parallel
drafting agents how to converge on lane *roles* and *actor labels*. This one
names the teams a lane can be owned by. Read that one before drafting a new
phase; read this one before writing `owner_team`.

**Status: DRAFT, not ratified.** Nothing below has been written to the
database. Three questions at the bottom need answering first.

---

## Team ≠ stakeholder

Two different columns, easy to conflate:

| | `stakeholders` | `lanes.owner_team` |
| --- | --- | --- |
| Answers | who appears in the blueprint as an actor | who is accountable for what happens in this row |
| Holds | Regular Tutor, Lead Tutor, Teacher, Student, Supervisor, PLUS | the eight teams below |
| A row can have | one, via `lanes.stakeholder_id` | one, as text from this list |

`Supervisor` is in both, and correctly: it is a **person** in the room of the
blueprint (one lane, in Supervisor Program Administration) and the work of that
lane is owned by the **Tutor Supervisor Team**. A stakeholder is a who; an
owner team is an accountable group. They coincide here and mostly do not.

---

## The list

Every team below is named in the blueprint's own cell content. The count is how
many cells name it; the aliases are the spellings actually in use, which is the
drift this list exists to end.

| Team | Owns | Recognise it by | Seen in content as |
| --- | --- | --- | --- |
| **Tutor Supervisor Team** | Recruiting, clearance chasing, session and roster administration, call-off decisions, hours approval, reflection follow-up. The default owner of `backstage_actions` in most scenarios. | Anything a named PLUS staff member does to a tutor's record, schedule or pay. | `Tutor supervisor team` (25) · `Supervisors` (18) · `PLUS staff` (3) · `PLUS supervisor team` (2) · `PLUS tutor supervisor team` (1) |
| **Dev Team** | The PLUS app itself — every servlet, job and integration behind a `frontstage_tech` or `backstage_tech` pill. | A pill that is a piece of software PLUS built. | `Dev Team` (21) |
| **Design Team** | The screens and flows the tutor sees, and the design system behind them. | Figma, the branding guidelines, anything described as a screen or a flow rather than as code. | `Design Team` |
| **Research Team** | Study design and its inputs into the product — the student ordering, the session condition, the engagement baseline, the reflection questions as a research instrument. | Anything whose reason for existing is a study rather than a service need. | `Researchers` (17) |
| **Instructional Design Team** | Onboarding modules, lesson modules, quizzes, supplementary materials, and the reflection questions as pedagogy. | Content a tutor learns from. | `Instructional design team` (6) |
| **Marketing Team** | The public face — the marketing site, social channels, the Handshake posting. | Anything a person sees before they are a tutor. | `Marketing team` (1) |
| **CMU HR** | Employment, the I-9, payroll in Workday. **Outside PLUS.** | Anything where the counterparty is the university as an employer. | `CMU HR` (4) |
| **CPO** | Act 153 clearances and their verification. **Outside PLUS.** | Anything PLUS is legally not allowed to verify itself. | `CPO` (2) |

The last two are on the list because a blueprint that only names teams PLUS
controls hides its two hardest dependencies. Both gate the Application and
Onboarding phases, and neither answers to anyone here.

---

## Lanes that take no team

`owner_team` stays NULL on these, and that is the correct value — not a gap to
fill later.

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

---

## Before this can be written

**1. Is `Supervisors` the same group as `Tutor supervisor team`?**
49 cells name this group across five spellings. If it is one group, the list
above is right and the content should converge on one label. If `Supervisors`
sometimes means school-side supervisors or someone else, the list needs a
second entry and the content needs disambiguating cell by cell.

**2. Is there an `Ops` team distinct from the Tutor Supervisor Team?**
Two cells mention ops obliquely — a Slack webhook "so ops can reach them" — and
nothing else. Naming it would create a ninth team on evidence thin enough that
it may just be the supervisors under another name. Left off the list
deliberately.

**3. What owns `Discovery › Back Stage Actions`?**
That one lane holds three teams at once: *"Design team manages content and
messaging on the website; the dev team implements it in code"* alongside
*"Marketing team creates social media posts…"*. `owner_team` takes one value.
Either the lane splits, or one team is named the accountable one and the others
stay in the prose.

---

## What happens once it is ratified

Roughly 110 of the 173 (scenario, lane) groups become fillable — about 200 of
306 rows. The rest are the actor and storyboard lanes above, which stay empty
by rule.

`owner_team` is **per scenario, not per lane name**. `Back Stage Actions` is
owned by the supervisors in six scenarios, the Research Team in Goal Setting
and Help Request, and the Instructional Design Team in the two module
scenarios. A blueprint-wide mapping from lane name to team would be wrong in a
quarter of the board.
