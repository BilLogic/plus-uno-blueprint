# Blueprint Content Plan — 2026-08-08 (rev 3, verified)

Reorganized from the five-source sweep (Supabase audit × Notion × Slack × Figma × CMU-PLUS/web-app), then **triangulated**: every ops claim cross-checked against newest Slack evidence and dated git history (dev@`da68dbb`, 2026-08-07). **Primary focus: the supervisor (backstage) role across existing scenarios** — the lanes exist everywhere but hold 1–4 generic one-liner cells per scenario, almost all without descriptions or links. Raw reports: session scratchpad `sweep/01–07` (06 = ops verification, 07 = code verification).

**⚠ Staleness meta-finding:** the blueprint itself (and Notion pages derived from it) documents **pre-migration ops** — Acuity, Google Form call-offs, spreadsheet scheduling all retired since Aug 2025–Feb 2026. Bill acknowledged this in Slack (2026-05-18: "the blueprint is a little out-dated"). Rule for authoring: prefer code on dev HEAD + 2026 Slack over undated Notion pages; treat Notion process docs written before Fall 2025 as historical until re-verified.

Legend — **Where**: scenario › lane › step (existing unless marked NEW). **Today**: current cell content in the DB. **Evidence**: source to cite in the cell's description/links.

---

## A. Supervisor-lane enrichment (the main event)

### Pre-session phase

| Where | Today | Proposed change | Evidence |
|---|---|---|---|
| Session Sign Up › Back Stage Actions › Sign up | "Dev Team takes that scheduling info and stores it in a Google Spreadsheet." | **CONFIRMED OUTDATED — rewrite**: recurring sign-up is fully in-app (Sign-up tab; separate Fill-in tab), live in production by Feb 2026. Acuity is retired (dead code, zero callers); no Sheets integration ever existed in code — spreadsheet step was manual ops, now gone | Slack Bill 2026-05-18 ("legacy app… stopped using it"); code: fill-in tab card2192 (2026-02-04), signup metrics via `ShiftService` not Acuity |
| Session Sign Up › Back Stage Actions › Review scheduling | "Supervisor team receives and reviews Google Spreadsheet from Dev Team." | Rewrite: supervisor manages recurring sign-ups in admin UI. Soft-conflict overlap rule is **NOT shipped** — active design proposal, threshold revised 20→**10 min** (warn/acknowledge under 10, supervisor-named gate at 10+). Don't author as current behavior | Figma Supervisor Pre-Session (`206:149220`); Slack Bill 2026-08-04 (ts 1785871990) corrected analysis |
| Standard Scheduling › Back Stage Actions › Review schedules | "Supervisor team receives and reviews tutor schedules from the Dev Team." | Add description: reconfirmation loop — tutors reconfirm (`ReconfirmState` PENDING/AVAILABLE/UNAVAILABLE), supervisor monitors. **Brand-new**: shipped 2026-08-06 (Session Functionality v3, Card2452) — author as current | Code eb7d440a 2026-08-06; `TutorScheduleServlet:199` |
| Standard Scheduling › Back Stage Actions › NEW cell(s) | — (1 cell total in lane) | Add supervisor session-lifecycle actions: create / edit / cancel / revert session; each cancel scope (single/date/range/shift-range/all-future) triggers scoped tutor emails | Figma Supervisor Pre-Session; GitHub `TutorScheduleServlet` cancel scopes + `EmailHelper` cancellation templates |
| Fill-in Request › Back Stage Actions › Initial request | "Supervisor team receives call off request and reviews tutor availabilities." | Add description: unfilled sessions **auto-add to fill-in list at 72h before start** — **VERIFIED in code** (`FILL_IN_THRESHOLD_HOURS = 72L`; active call-off bypasses the threshold). Toggle-gap claim (lead tutors lack "View All Sessions") is from Oct 2025 — re-verify before authoring | Code `TutorSessionServiceImpl:71`; Slack Ishan 2026-02-04 confirms live |
| Fill-in Request › Back Stage Actions › Finalize assignment | "Supervisor team adds tutor to session if tutor confirms request." | Add links: in-session fill-in PRD (Request Fill-In modal → editable Slack message → live 0/N slot tracking) | Notion Fill-In PRD (`2c5b7cca…`) |
| Call-off Request › Back Stage Actions › Early call-off | "Supervisor team reviews Google Form request for shift swap." | **CONFIRMED OUTDATED — rewrite**: call-off is fully in-app since ~Nov 2025 (Session Functionality V2). One-time/fill-in call-offs >12h out are **auto-approved**; recurring call-offs go through supervisor review; <12h emergencies via Slack with logging. Notion page `12fb7cca…` describes the retired Google Form flow — cite only as historical | Code first commit 2025-11-04, 27 commits since; Slack Ishan #plus-bug-report 2026-02-17 |
| Call-off Request › Back Stage Actions › Internal decision | "Supervisor may or may not find replacement… determines excused or unexcused." | Add description: reason taxonomy (Illness, Family Emergency, Job Conflict, Transportation, Academic Commitment, Signed Up By Mistake, Other), PENDING→APPROVED/REJECTED with supervisor notes, withdrawal eligibility by hours-before-session; **on approval, students auto-reassign from the absent tutor** (Card 2349, Apr 2026); Figma splits >12h vs <12h flows | GitHub `CallOffRequestServiceImpl` + `a79f7996`; Figma Pre-Session §5 |
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
| Reporting an Issue › Back Stage Actions › Resolve concern | "PLUS supervisor team is able to resolve concern." (only cell; 0% desc in scenario) | Add description: reflection form's multi-select "areas" chips are **live in production** (adaptive to rating); the fuller redesign (escalation chips, AI follow-up questions) is **still in design iteration as of Jul 2026 — do not author as current**. School-side behavioral incidents escalate via email under draft School-PLUS Policy Agreement; formal ticketing **pending tool decision** | Code `reflection.js:438` (live chips); Slack Cassie thread 2026-07-15 (redesign unshipped); Policy Agreement (`388b7cca…`); Slack Alex Houk 2026-06-18 |
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
| Zoom/Pencil attendance matching (Videoconf entities), edtech data feeds (10 platforms), LLM microservice (lesson feedback + TutorAiInsight) | Back Stage Tech | GitHub sweep report |
| ~~Acuity~~ — do NOT add; retired. Dead code remains (`AcuitySessionStatsItem`, zero callers) + one stale UI tooltip (`tutor_coach_charts.js:95` still says "from Acuity") | — | Verification reports 06/07 |

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

## E. Verification ledger (claims triangulated 2026-08-08)

| Claim from sweep | Verdict | Basis |
|---|---|---|
| Acuity used for shift slots | **OUTDATED** — retired; in-app since ~Feb 2026 | Slack 2026-05-18 + code (zero callers, metrics via ShiftService) |
| Call-off = Slack → Google Form → manual entry | **OUTDATED** since ~Nov 2025 — in-app V2 | Code 2025-11-04→2026-06-22 + Slack 2026-02-17 |
| Sign-up via dev-team Google Spreadsheet | **OUTDATED** — in-app tabs; Sheets never in code | Code grep + Slack |
| 72h fill-in auto-add threshold | **CURRENT** | Code constant `72L` + Slack 2026-02-04 |
| ReconfirmState reconfirmation loop | **CURRENT** — shipped 2026-08-06 (v3) | Commit eb7d440a |
| Reflection redesign | **PARTIAL** — ratings/chips/recording-upload live; AI follow-ups + escalation redesign unshipped | Code + Slack 2026-07-15 |
| Soft-conflict <20-min rule | **NOT SHIPPED** — proposal; threshold now 10 min | Slack 2026-08-04 |
| Notion matching PRD (card 1629) | **DIVERGES from shipped algorithm** — reconcile before authoring | Code `chooseRecipientForStudent` |

Incidental fix for web-app repo: stale Acuity tooltip at `tutor_coach_charts.js:95`.

## F. Known voids — mark open, don't invent

No source documents these; add as open questions in blueprint rather than authoring content: clearance workflow detail · offer letters/rejection comms · semester schedule creation · attendance/call-off policy (Notion page exists but **empty**) · student-side journey · post-session supervisor triage runbook/SLAs · payroll link to attendance · ticketing (tool decision pending).
