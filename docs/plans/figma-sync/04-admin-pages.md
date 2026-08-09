# Figma Sync — Admin / Tutor · Admin / Session · Admin / Student · Admin / Group
Date: 2026-08-08 · Page links:
- Admin/Tutor: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3408-120455
- Admin/Session: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3408-120456
- Admin/Student: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3408-120457
- Admin/Group: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1-177

## Current page contents (verified via metadata)
**Admin / Tutor** — Tutor section 201:38365 → Screens 108:89234: 16 "Tutors / Overview (Tutor performance)" variants, Tutors / Status & Warnings 481:168261, Tutors / Tool Usage 481:174536, Tutors / Training Progress 481:176420. Plus **[wip] Unsorted — Tutor Overview drafts (needs triage)** 9997:465117 (7 more Overview drafts + Tabs/Tab Pills experiments). Components 108:89224.

**Admin / Session** — Session section 309:125961 → Screens 309:126410: 3 "Sessions" screens (992:83473 with modal open, 992:84527, 992:85661) + Session Details Filtered 997:79444 (time-allocation donuts by student group/needs). Components 309:125962 incl. Sessions / Table, Sessions / Modal Container, Session Admin / Container.

**Admin / Student** — Student section 317:126097 → Screens 317:126546: 4 "Students" screens (1006:262755, 1006:263841 w/ Info modal, 1006:264384 w/ Sessions modal, 1006:263298). Components 317:126098 incl. Students / Table, Students / Modal (Info, Sessions).

**Admin / Group** — Group section 322:155298 → Screens 322:155747: Groups / Group Info 531:63123, Groups / Training Progress 531:63839. Components 322:155299 incl. Groups / Table, Training Admin / By Lesson (3-level expandable).

All four have Context blocks with empty Roadmap/PRD refs and archived-responsive tombstones.

## Out of sync with shipped app
| Gap | App reality (evidence) | Proposed Figma change |
|---|---|---|
| Admin/Session shows table view only | Calendar view shipped Aug 2026 (Card 2266 / #1135) (08 §b, §h) | Add Sessions calendar-view screen(s) to Admin/Session |
| Session details actions | Details → edit/cancel/revert/roster; Join Session gated to 15 min before start (08 §b). Cancel scopes: single/shiftDateRange/dateRange only; revert via revertSessionsWithScope (08 §Job1-8) | Spec details panel actions incl. Join gate; align cancel/revert scopes with doc 01 |
| Admin/Tutor missing shipped actions | Add tutor, edit, Email Tutors broadcast, copy contacts, CSV export, reflection export, training progress, performance + tool-usage tabs (08 §b) | Audit 16 Overview variants against shipped tab set; add broadcast/export flows if absent; TRIAGE the [wip] Unsorted section (9997:465117) |
| Tutor performance charts sourced from Acuity | Acuity retired; signup-rate now computed in-app via ShiftService.getSignupRateInTimeframe; stale "from Acuity" tooltip persists in code (07 §1; 06 §1) | Purge Acuity wording from chart specs; note in-app signup-rate source |
| Admin/Student missing shipped actions | Add student + CSV template, goals view, saveStudentProfile, preferred name; Students page uses SSE live updates (#1113); per-event "New Student(s) Added" email to Slack bridge — NO digest (08 §b, §Job1-5b, §h) | Add add-student/CSV flow, goals view; annotate SSE freshness + Slack-bridge notification in system lane |
| Admin/Group missing shipped actions | Create/edit/delete group, add students, map group→lesson, lesson time goal (08 §b); Group FK added on session/shift (#1126) — groups becoming a scheduling dimension (08 §h) | Group Info covers table; add create/edit/delete + lesson-mapping flows; annotate group-as-scheduling-dimension trajectory |
| Assignment algorithm undocumented | chooseRecipientForStudent priority tiers (non-lead first, baseLoad fill, continuity, proficiency mix) drives rosters admins see (08 §Job1-5; 03 §Behavioral-1) | Add backstage/system annotation to Session details roster spec |
| Trends nav | Shipped but hidden (d-none) (08 §Passing) | Do not spec Trends as live; if drafts exist, tombstone |
| SystemAdmin / ResearchAdmin / institution dashboards | Shipped admin surfaces with no Figma page (08 §b) | Out of scope here — new page proposed in doc 08 |

## Blueprint dependency
These pages are the backstage-supervisor lane evidence (05 rows Admin/*). Blueprint supervisor cells for session oversight, tutor management, student rostering, and group/training progress link here; the calendar view and SSE behaviors are needed before Aug-2026 scenarios can cite accurate screens. Call-off review UI is specced on Toolkit/Pre-Session (doc 01), not here.

## Action items
- [ ] Add Sessions calendar view (Card 2266) to Admin/Session
- [ ] Spec session details actions incl. 15-min Join gate; align cancel/revert scopes
- [ ] Triage [wip] Unsorted Tutor Overview drafts — promote or archive
- [ ] Add tutor broadcast-email, CSV/reflection export flows to Admin/Tutor
- [ ] Purge Acuity references from performance-chart specs
- [ ] Add add-student/CSV + goals flows; annotate SSE + Slack-bridge rostering notify
- [ ] Add group create/edit/delete + group→lesson mapping flows
- [ ] Annotate assignment-algorithm system lane on roster specs
- [ ] Fill all four Context blocks with card refs (2266, 2452, #1113, #1126)
