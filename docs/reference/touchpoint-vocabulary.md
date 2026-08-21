# Touchpoint vocabulary

Every name a tech pill is allowed to carry, and what it means. A pill is a
**name** — what happens at that touchpoint belongs in the cell's `summary`,
and why it matters in `function`. Reuse a name from this list before minting
a new one; a second name for one system is how a blueprint stops being
searchable.

Counted 2026-08-20, after the touchpoint sweep (`20260820190000`).

## Front stage — what the tutor, student or teacher touches

| Name | Cells | What it is |
|---|---:|---|
| `PLUS App` | 83 | The tutor-facing app. WHICH surface — Fill-In tab, My Sessions, Call-Offs — goes in the cell's summary, not the pill. |
| `Zoom` | 83 | The session's videoconference, in a session and out of one. It was `Zoom/Pencil` until Aug 2026; PLUS no longer runs sessions on Pencil, so the pair collapsed to the tool that is left. `zoom/pencil` survives as an alias so an older slice still resolves. |
| `Email` | 11 | Any transactional email the person receives. |
| `Slack` | 6 | A Slack channel the person posts in or reads — the school channel, the support channel, the tutor workspace. |
| `Workday` | 5 | CMU payroll, employee side. |

| `Notion` | 3 | Training and onboarding content. |
| `Reflection form` | 2 | The post-session reflection. |
| `Acceptance form (Google Form)` | 1 | Offer acceptance. |
| `Bank` | 1 | Where the paycheck lands. |
| `Clearance obtainment guide` | 1 | The document CMU HR sends. |
| `Google Docs/Slides` | 1 | Supplementary lesson material. |
| `Google Form Application` | 1 | The post-info-session application. |
| `Google Quiz` | 1 | The onboarding module quiz. |
| `Handshake` | 1 | The job board, candidate side. |
| `Kickoff interview page` | 1 | `kickoff_interview.jsp`. |
| `Marketing Website` | 1 | plus.cs.cmu.edu and its recruiting pages. |
| `On-campus booth` | 1 | The job-fair table. |
| `PLUS AI Debrief Summaries` | 1 | Lead-tutor debrief surface. |
| `PLUS Reflection Automated Notification` | 1 | The auto-prompt to start a reflection. |
| `PLUS Session Sign-Off & Submission Tracker` | 1 | Lead-tutor submission matrix. |
| `PLUS Wrap-Up Dashboard` | 1 | Room attendance at close. |
| `Posters` | 1 | Campus recruiting print. |
| `Profile page` | 1 | Tutor profile. |
| `Sessions admin` | 1 | Admin › Sessions. |
| `Social Media` | 1 | Recruiting posts. |
| `Students admin page` | 1 | Admin › Students. |
| `Tutor sign-up form (Google Form)` | 1 | The interest form. |
| `Tutors admin page` | 1 | Admin › Tutors. |

## Back stage — the systems behind the work

| Name | Cells | What it is |
|---|---:|---|
| `Notion` | 5 | Where staff author content and keep interview notes. |
| `Accredible` | 2 | External credentialing; issues the badge. |
| `Figma` | 2 | Design files behind a surface. |
| `Fill-in pool` | 2 | The 72-hour coverage pool. |
| `LessonLLMFeedback` | 2 | Grades written lesson answers. |
| `No Workday link` | 2 | A named ABSENCE: PLUS session data and Workday hours are not bridged. Deliberate, and worth a cell. |
| `Onboarding gate` | 2 | What module completion unlocks. |
| `PLUS App` | 2 | The app acting on its own behalf rather than as a surface. |
| `PLUS App database` | 2 | Where the semester's sessions arrive by import. |
| `RCT condition` | 2 | The session-scoped goal-setting arm, set by the research team's ETL. |
| `Slack bridge` | 2 | Email-to-Slack bridges for rostering and call-off notices. |
| `Slack webhook` | 2 | Direct webhooks to ops channels. |
| `Workday` | 2 | Payroll, employer side. |
| `72-hour auto-add job` | 1 | Puts a session with capacity into the fill-in pool. |
| `Assignment algorithm` | 1 | Pairs students to tutors. |
| `Attendance-change handlers` | 1 | Rebalance assignments when attendance changes. |
| `Auto-approval rules` | 1 | Approve a call-off filed 12+ hours out. |
| `Calendar feed` | 1 | Per-tutor GCal/iCal subscription. |
| `Clearance ETL` | 1 | Writes `advisor.clearance_status` from the weekly CPO email. |
| `Dev Tools` | 1 | The dev team's own toolchain. |
| `Email service` | 1 | The async email microservice. |
| `Follow-up question LLM` | 1 | One personalized follow-up per reflection section. |
| `Goal entity` / `Usage entity` | 1 each | Per-student, per-platform goal and usage records. |
| `Goal-update ETL` | 1 | Sunday cycle-progress run. |
| `Google OAuth` | 1 | How a tutor signs in. |
| `Group foreign key` | 1 | Makes a group a scheduling dimension. |
| `Handshake Employer Profile` | 1 | The employer side of the job board. |
| `In-session notes` | 1 | Auto-saved, prefills the reflection. |
| `Live rebalancing` | 1 | Redistributes students when a tutor goes absent. |
| `LLM microservice` | 1 | `llm-rest-api`; produces TutorAiInsight rows. |
| `Per-student dashboard` | 1 | What kickoff answers populate. |
| `placeSingleStudent` | 1 | Slots a late joiner onto a tutor. |
| `Reconfirmation fan-out` | 1 | Sends reconfirm requests when sessions are edited. |
| `Reconfirmation state machine` | 1 | ReconfirmState per affected session. |
| `Reminder emails` | 1 | 30-minute pre-session reminders. |
| `resource_assigned record` | 1 | Written when a tutor pins a resource to a student. |
| `Session record` | 1 | Carries the videoconference URL and host key. |
| `SessionAttendance` | 1 | Per-student attendance write; opens the engagement field. |
| `Slack webhooks` | 1 | Carry follow-up notifications. |
| `Teacher goal email` | 1 | Monday goal mail to teachers. |
| `Videoconf attendance` | 1 | Reconciled against SessionAttendance after a session. |
| `WizardSession` | 1 | One Resource Assistant run. |
| `Zoom` | 1 | Zoom used by staff rather than in a session. |

## Not in this list

Twelve cells still read `Planned — …`. That prefix is a MATURITY, not part of
a name, and no column holds one yet; dropping the word would make an unbuilt
surface read as shipped. See
`docs/plans/2026-08-20-010-refactor-touchpoint-cells-and-labels-plan.md`.
