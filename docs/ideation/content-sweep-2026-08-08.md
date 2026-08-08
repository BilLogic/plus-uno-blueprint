# Blueprint Content Changes — 2026-08-08

Planned edits to blueprint content (Supabase), from a five-source sweep verified against code (web-app `dev`, 2026-08-07) and newest Slack. Everything below is already triangulated — each row states the change and where the fact comes from.

**Authoring rule:** several existing blueprint cells describe retired ops (Acuity, Google Forms, spreadsheets). When in doubt, trust dev-branch code and 2026 Slack over old Notion pages.

---

## 1. Fix outdated cells (highest priority — currently wrong)

| Cell (scenario › step) | Says now | Change to | Source |
|---|---|---|---|
| Session Sign Up › Sign up | "Dev Team stores scheduling info in a Google Spreadsheet" | Tutors sign up in-app: Sign-up tab (recurring) + Fill-in tab (one-time). Live since Feb 2026. | Slack 2026-05-18; code card2192 |
| Session Sign Up › Review scheduling | "Supervisor reviews Google Spreadsheet from Dev Team" | Supervisor manages recurring sign-ups in the app's admin views. | Figma Supervisor Pre-Session `206:149220` |
| Call-off Request › Early call-off | "Supervisor reviews Google Form request" | In-app call-off (Session Functionality V2, Nov 2025): one-time/fill-in call-offs >12h out auto-approve; recurring call-offs need supervisor review; <12h emergencies go through Slack. | Code Nov 2025–Jun 2026; Slack 2026-02-17 |
| Call-off Request › Internal decision | "…determines excused or unexcused" (keep, add detail) | Add: reason taxonomy (Illness, Family Emergency, Job Conflict, Transportation, Academic Commitment, Signed Up By Mistake, Other); PENDING→APPROVED/REJECTED with notes; withdrawal eligibility by hours-before-session; approval auto-reassigns the tutor's students. | `CallOffRequestServiceImpl`; Card 2349 |
| Any cell mentioning Acuity | — | Remove/replace: Acuity retired; all scheduling in-app. | Slack 2026-05-18; code (dead, zero callers) |

## 2. Enrich supervisor lanes (add descriptions + links to existing cells)

| Cell | Add | Source |
|---|---|---|
| Standard Scheduling › Review schedules | Reconfirmation loop: tutors reconfirm availability (PENDING/AVAILABLE/UNAVAILABLE); shipped 2026-08-06. | Card2452 (Session Functionality v3) |
| Fill-in Request › Initial request | Unfilled sessions auto-add to fill-in list **72h** before start; an active call-off bypasses the threshold. | `TutorSessionServiceImpl:71`; Slack 2026-02-04 |
| Fill-in Request › Finalize assignment | Link the in-session Fill-In PRD (Request Fill-In modal → Slack message → live slot tracking). | Notion `2c5b7cca…` |
| Before Students Join › (new cell) | Auto-assignment algorithm: non-lead before lead, fill to baseLoad, then load → continuity → proficiency; supervisor gets email digest for out-of-DB students. | Code `chooseRecipientForStudent` (Notion card 1629 diverges — use code) |
| Interview & Offer › all 4 backstage cells | 6-stage pipeline: application → interview invite → soft offer → acceptance form → **CPO clearance** (gates all app access) → onboarding. Offer paperwork via Workday. Link group-interview design doc. | Slack 2026-04-01; Notion hiring docs |
| Discovery › 3 backstage cells | Required info session acts as first interview; Intercom for candidate comms. | Notion "Hiring process revisions"; canvas F07K8G0U96Y |
| Reporting an Issue › Resolve concern | Reflection "areas" chips (live) feed supervisor triage; school incidents escalate by email under draft School-PLUS Policy Agreement; ticketing tool decision pending. | Code `reflection.js:438`; Notion `388b7cca…`; Slack 2026-06-18 |
| Reporting Hours › Approve hours | Context: attendance data incomplete (complete in only 38% of sessions); call-off absences recorded in `tutor_absence`. | Slack 2026-03-09 |
| Onboarding scenarios › backstage cells | Supervisor monitors Training Progress in admin tool; clearance gates access. | Notion Tutor Admin Iteration; Figma `3408:120455` |

## 3. Add missing supervisor cells (lanes currently empty)

| Where | Add | Source |
|---|---|---|
| Student Just Joined › Back Stage Actions (0 cells) | Late joiners can land in wrong breakout rooms; any co-host can move students → attendance drift; app auto-places via `placeSingleStudent`. | Slack #plus-dev; code |
| Warm-Up › Back Stage Actions (0 cells) | Supervisor maintains assignment data; lead tutor assigns + DMs regular tutors via Slack/Zoom at start. | Slack 2025-07-24; Notion Module 11 |
| Wrap-Up › Support Actions (lane missing) | Add the lane (only path without it) or note why absent. | DB audit |
| Post-session scenarios › (new cells) | Weekly class report: reflections + goal-reward eligibility → per-class Mailchimp email to teachers. TutorAiInsight coaching generated from reflections. | Notion card 2106; code |

## 4. Mechanical fixes

- Wire or delete Help Request orphan step `…000986`
- Add triggers to Goal Setting "Update Goals" (66 cells, 0 triggers)
- Finish or archive "New In-Cycle Check-In" (13/72 cells, 0 triggers)
- Fill 149 empty cell labels (18.6%)

## 5. Do NOT author (unshipped or unknown)

| Topic | Status |
|---|---|
| Reflection redesign (AI follow-ups, escalation chips) | Design iteration only, unshipped (Jul 2026) — current form has ratings + area chips + recording upload |
| Soft-conflict overlap rule | Proposal only; threshold moving 20→10 min (Aug 2026) |
| Attendance/call-off policy, semester schedule creation, student-side journey, post-session triage runbook, payroll link, ticketing | No source documents these — mark as open questions, don't invent |

## 6. Optional later: new unhappy paths (your call)

Best-evidenced candidates: no/few students join (Notion article is step-by-step) · session cancelled/reverted · call-off rejected · teacher-side failures (may need a Teacher lane).

---
*Raw sweep + verification reports: session scratchpad `sweep/01–07`. Side find for web-app repo: stale "from Acuity" tooltip at `tutor_coach_charts.js:95`.*
