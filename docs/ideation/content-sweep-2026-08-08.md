# Blueprint Content Plan — 2026-08-08 (rev 2)

Reorganized from the five-source sweep (Supabase audit × Notion × Slack × Figma × CMU-PLUS/web-app). **Primary focus: the supervisor (backstage) role across existing scenarios** — the lanes exist everywhere but hold 1–4 generic one-liner cells per scenario, almost all without descriptions or links. Everything below is a concrete proposed change with its evidence. Raw per-source reports: session scratchpad `sweep/01–05`.

Legend — **Where**: scenario › lane › step (existing unless marked NEW). **Today**: current cell content in the DB. **Evidence**: source to cite in the cell's description/links.

---

## A. Supervisor-lane enrichment (the main event)

### Pre-session phase

| Where | Today | Proposed change | Evidence |
|---|---|---|---|
| Session Sign Up › Back Stage Actions › Sign up | "Dev Team takes that scheduling info and stores it in a Google Spreadsheet." | **Likely outdated — verify then rewrite**: recurring sign-up lives in the app; shift slot capacity syncs from Acuity | GitHub `AcuitySessionStatsItem`; Figma Pre-Session §2 (`223:194705`) |
| Session Sign Up › Back Stage Actions › Review scheduling | "Supervisor team receives and reviews Google Spreadsheet from Dev Team." | Rewrite: supervisor manages recurring sign-ups in admin UI; soft-conflict sign-ups (<20 min overlap) allowed — supervisor gets **heads-up email, not an approval step** | Figma Supervisor Pre-Session (`206:149220`); Notion decision row + Slack Brittany 2026-07-23 |
| Standard Scheduling › Back Stage Actions › Review schedules | "Supervisor team receives and reviews tutor schedules from the Dev Team." | Add description: reconfirmation loop — tutors must reconfirm (`ReconfirmState` PENDING/AVAILABLE), supervisor monitors via All-Sessions views | GitHub `TutorSession.ReconfirmState`; Figma Supervisor section future All-Sessions states |
| Standard Scheduling › Back Stage Actions › NEW cell(s) | — (1 cell total in lane) | Add supervisor session-lifecycle actions: create / edit / cancel / revert session; each cancel scope (single/date/range/shift-range/all-future) triggers scoped tutor emails | Figma Supervisor Pre-Session; GitHub `TutorScheduleServlet` cancel scopes + `EmailHelper` cancellation templates |
| Fill-in Request › Back Stage Actions › Initial request | "Supervisor team receives call off request and reviews tutor availabilities." | Add description: unfilled sessions **auto-add to fill-in list at 72h before start** (changed from 12h); coverage hunting uses "View All Sessions" toggle — lead tutors asked to fill in but **lack the toggle** (known gap) | Slack DM Ishan 2025-11-03 (72h rule); Slack Harry Gilliland 2025-10-27 (toggle gap) |
| Fill-in Request › Back Stage Actions › Finalize assignment | "Supervisor team adds tutor to session if tutor confirms request." | Add links: in-session fill-in PRD (Request Fill-In modal → editable Slack message → live 0/N slot tracking) | Notion Fill-In PRD (`2c5b7cca…`) |
| Call-off Request › Back Stage Actions › Early call-off | "Supervisor team reviews Google Form request for shift swap." | Add description: real volume ~20/month; flow = Slack coverage request → Google Form → supervisor manually records in `pl2_db.tutor_absence` with `attendance_notes`; **no un-call-off path exists** | Notion call-off & shift swap process (`12fb7cca…`) |
| Call-off Request › Back Stage Actions › Internal decision | "Supervisor may or may not find replacement… determines excused or unexcused." | Add description: system side — reason taxonomy (Illness, Family Emergency, Job Conflict, Transportation, Academic Commitment, Signed Up By Mistake, Other), PENDING→APPROVED/REJECTED with supervisor notes, withdrawal eligibility by hours-before-session; Figma splits >12h vs <12h call-off flows | GitHub `CallOffRequestServiceImpl`; Figma Pre-Session §5 |
| Before Students Join › Back Stage Actions › NEW cell (assignment) | — (only "sets up session details" + "sets up Zoom link") | Add: supervisor prepares tutor–student assignments; auto-assignment algorithm (tiers: non-lead before lead, baseLoad fill, load → continuity → proficiency mix, round-robin fallback); supervisor gets **email digest for out-of-DB students** | GitHub `chooseRecipientForStudent`; Notion card 1629 — ⚠ Notion V1 ≠ shipped code, reconcile before authoring |

### In-session phase

| Where | Today | Proposed change | Evidence |
|---|---|---|---|
| Student Just Joined › Back Stage Actions | **no cells in lane** | Add: late joiners can land in wrong breakout rooms; any co-host can move students → attendance drift; live rebalancing hooks exist (`placeSingleStudent`, attendance-change handlers) | Slack #plus-dev threads (2026-07-08, 2026-04-01); GitHub rebalancing methods |
| Warm-Up › Back Stage Actions | **no cells in lane** | Add: supervisor keeps assignment spreadsheet current; lead tutor reads it at session start and manually assigns + DMs regular tutors via Slack/Zoom | Slack Alex Houk 2025-07-24; Notion Module 11 (lead-tutor protocol) |
| Help Request › Back Stage Actions › Next student | "Researchers set student order." | Add supervisor escalation cells: routing topology (lead tutor vs school Slack channel vs support channel per issue type); no/few students = wait 10 min → templated Slack post tagging 4 named supervisors, tutor **never dismisses alone** | Notion "Find the Right Support" (`3a2b7cca…8012`) + "When No or Few Students Join" (`333b7cca…`) |
| Help Request › (structure) | orphan step "Handles student tech problems…" (`…000986`) unwired | Wire into path via `path_steps` or delete | DB audit |
| Wrap-Up › Support Actions | **lane absent** (only path in DB without it) | Add lane, or record why absent; supervisor expectation-setting for reflection completion belongs here | DB audit; Notion reflection articles |

### Post-session phase

| Where | Today | Proposed change | Evidence |
|---|---|---|---|
| Reporting an Issue › Back Stage Actions › Resolve concern | "PLUS supervisor team is able to resolve concern." (only cell; 0% desc in scenario) | Add description: issues arrive as **escalation chips in reflection form** (e.g. "lead tutor absent/late") → supervisor triage; school-side behavioral incidents escalate via email under draft School-PLUS Policy Agreement; formal ticketing **pending tool decision** | Notion Reflection Enhancement (`218b7cca…8089`) + card 2067; Policy Agreement (`388b7cca…`); Slack Alex Houk 2026-06-18 |
| Reporting Hours › Back Stage Actions › Approve hours | "PLUS supervisor team reviews and approves hours." (0% desc) | Add description: attendance data feeding approval is incomplete — recorded for 88.4% of students but complete in only 38% of sessions; call-off absences recorded manually in `tutor_absence` | Slack Alex Houk 2026-03-09; Notion call-off process |
| Post-session › NEW backstage cells (both scenarios) | — | Add: weekly class report pipeline — reflections + goal-reward eligibility compiled into per-class Mailchimp email to teachers; AI coaching (`TutorAiInsight`) generated from reflections, surfaced in TutorCoach | Notion Weekly Class Report PRD (card 2106); GitHub TutorCoach/`TutorAiInsight`; Slack #proj-class-insight-report |

### Application + Onboarding phases (0% descriptions today)

| Where | Today | Proposed change | Evidence |
|---|---|---|---|
| Interview & Offer › Back Stage Actions (4 cells, no desc) | "creates/manages application form", "reviews application", "takes notes", "reviews interview data" | Add descriptions from the canonical 6-stage pipeline: application form → interview invite → soft offer → acceptance form → **CPO clearance** → onboarding access. Clearance gate = no app/training access until cleared. Offer paperwork = Workday + SSN forms | Slack Alex Houk 2026-04-01; Notion "Hiring process revisions", "Capture CMU hiring process" |
| Interview & Offer › Back Stage Actions › Group interviews | "takes notes for group interview" | Add link: 20-min group interview design (2–5 candidates, intro-slide task, breakout math-walkthrough script, assessment goals) | Notion "Process for Tutor Group Interviews" |
| Discovery › Back Stage Actions (3 cells, no desc) | marketing posts / website / Handshake postings | Add descriptions + links: required info session as de-facto 1st interview; Intercom for candidate comms; school-side: one-pager, ratio model, partner calendar | Notion hiring revisions + one-pager; Slack canvas F07K8G0U96Y, #plus-core spreadsheets |
| Onboarding scenarios › Back Stage Actions (1–4 cells each, no desc) | generic | Add: supervisor monitors Training Progress in admin tool; module pipeline = Tutor Team → Design → Dev; clearance gates app access | Notion Tutor Admin Iteration + module-creation cards; Figma Admin/Tutor (`3408:120455`) |

---

## B. Cross-cutting supervisor tooling (spans scenarios)

The supervisor's own frontstage — the admin tool — is barely represented in Back Stage Tech lanes anywhere.

| What to add | Where it lands | Evidence |
|---|---|---|
| Admin surfaces: Tutors Overview (performance, status & warnings, tool usage, training progress), Sessions table, Students table, Groups | Back Stage Tech cells in relevant scenarios | Figma Admin pages (`3408:120455–120457`, `1:177`); GitHub `/PLUS/Admin`, `/PLUS/Trends` |
| Email machinery: full taxonomy (welcome, students-added, assignment, broadcast, feedback, cancellation ×5 scopes) + 10 designed templates | Back Stage Tech, per matching scenario | GitHub `EmailHelper`/`MailUtils`; Figma Email Templates (`5670:6714`) |
| Zoom/Pencil attendance matching (Videoconf entities), Acuity sync, edtech data feeds (10 platforms), LLM microservice | Back Stage Tech | GitHub sweep report |

---

## C. Possible structural additions (your call — flagged, not assumed)

DB currently has **zero unhappy/exception paths**; 15/17 scenarios single-path. Strongest evidence-backed candidates if/when you add paths:

| Candidate new path | Scenario | Evidence strength |
|---|---|---|
| No/few students join | Before Students Join or Help Request | ★★★ Notion article is already a step-by-step path |
| Tutor no-show / emergency coverage | Fill-in Request | ★★★ Slack toggle-gap thread + 72h rule |
| Session cancelled / reverted | Standard Scheduling | ★★★ Slack revert flow + GitHub cancellation cascade |
| Call-off rejected / unexcused | Call-off Request | ★★ GitHub state machine; policy page empty |
| Teacher-side failures (work not assigned, Zoom link missing) | Before Students Join | ★★★ Slack Erin Gatz field notes — but may need a Teacher lane in 7-lane scenarios |

## D. Quick mechanical fixes (do anytime)

| Fix | Detail |
|---|---|
| Wire/delete orphan step | Help Request `…000986` |
| Add triggers to Goal Setting "Update Goals" | 66 cells, 0 triggers (sibling has 40) |
| Finish or archive "New In-Cycle Check-In" | 13/72 cells, 0 triggers; source: #plus-goal-setting |
| Fill 149 empty cell labels | 18.6% of all cells |
| Wrap-Up Support Actions lane | only path missing it |

## E. Known voids — mark open, don't invent

No source documents these; add as open questions in blueprint rather than authoring content: clearance workflow detail · offer letters/rejection comms · semester schedule creation · attendance/call-off policy (Notion page exists but **empty**) · student-side journey · post-session supervisor triage runbook/SLAs · payroll link to attendance · ticketing (tool decision pending).
