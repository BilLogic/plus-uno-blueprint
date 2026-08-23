# Before Students Join — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › In-session › Before Students Join · Path(s): Happy Path
Status of scenario today: 36 cells, actor lanes have decent short labels but almost no descriptions and no citations outside a repeated 5-link bundle on Regular Tutor cells. The Back Stage Tech lane has zero cells even though this is where auto-assignment, session import, and the Zoom-link plumbing all fire.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Lead Tutor › Set up classroom | a0000000-0000-4000-8000-000000180102 | description | (empty) | "Lead opens the session detail page in the PLUS App to review the roster and tutor list before start. Sessions are only joinable from the app within 15 minutes of start time (Join Session gate)." | Report 08 §b (Sessions admin, Join Session 15-min gate); Module 11 Notion |
| Lead Tutor › Set up classroom | a0000000-0000-4000-8000-000000180102 | links | [] | `[{"type":"url","label":"Module 11: Lead Tutor Session Responsibilities (Notion)","url":"https://www.notion.so/3b1b7cca498280909264cf0bb51239fb"},{"type":"url","label":"Figma — Tutor In-Session Mgmt › Lead Tutor","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1691-119582"}]` | Report 04 (Module 11), 05 |
| Lead Tutor › Share Zoom link (label "Take tutor attendance") | a0000000-0000-4000-8000-000000180302 | description | (empty) | "Lead marks which tutors have arrived. In 2026 production data, 83.4% of rostered students end up with an attendance record but only 31.8% of sessions are fully covered — the roster check here is the first defense." | Metabase validation 2026-08-08 (report 09 #4: 1,631 sessions 2026, 31.8% fully covered, 83.4% pairs recorded) |
| Lead Tutor › Prepare breakout rooms | a0000000-0000-4000-8000-000000180402 | description | (empty) | "Lead creates breakout rooms in Zoom using the breakout calculator from training, grants co-host to regular tutors, and starts the recording. Rooms are visited sequentially per tutor." | Module 11 Notion (co-host grants, breakout calculator, recording); Slack #plus-dev Alex Houk 2025-07-24 (sequential rooms) |
| Lead Tutor › Distribute breakout list | a0000000-0000-4000-8000-000000180602 | description | (empty) | "The app's assignment list is the source of truth, but distribution is manual today: the lead relays each tutor's student list via Zoom chat or Slack DM. Tutors then hunt for matching names in the Zoom participant list." | Slack #plus-dev Alex Houk 2025-07-24 / 2026-07-08 (report 02 #10) |
| Regular Tutor › Share Zoom link (label "Sign in with lead tutor and confirms they have co-host permissions.") | a0000000-0000-4000-8000-000000180303 | description | (empty) | "Co-host is required to self-move between breakout rooms. Note: any co-host can move students, which is one source of attendance drift when moves happen outside the assignment list." | Report 08 (co-host moves cause attendance drift); Slack #plus-dev 2026-04-01 |
| Front Stage Tech › Set up classroom ("PLUS App") | a0000000-0000-4000-8000-000000180106 | description | (empty) | "Session detail page: roster, assigned tutors, Zoom link, and Join Session button (enabled within 15 minutes of start)." | Report 08 §b |
| Back Stage Actions › Set up classroom | a0000000-0000-4000-8000-000000180107 | description | (empty) | "Supervisors edit, cancel, or revert sessions from the Sessions admin (scopes: single / recurring / date range). There is no in-app session creation — session records arrive via DB import at semester setup." | Report 08 §8: editSession TutorScheduleServlet:2034; no creation flow; sessions via DB import |
| Back Stage Actions › Open session | a0000000-0000-4000-8000-000000180207 | links | [] | `[{"type":"url","label":"Figma — Admin / Session","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3408-120456"}]` | Report 05 |

Also: the 5-link bundle repeated on every Regular Tutor cell (…180103/180203/180303/180503/180603) should be pruned per cell to the one or two links that actually match the step (session detail page vs. Zoom join vs. roster review), rather than the same batch everywhere.

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Back Stage Tech › Set up classroom | content | "Assignment algorithm pairs students to tutors" | Report 08 §5: TutorStudentSessionAssignmentServiceImpl.java:694-745 |
| (same cell) | description | "Automatic tiering: non-lead tutors fill before the lead, each up to baseLoad = floor(students/tutors), then overflow. Within a tier the algorithm prefers lowest current load, then highest prior history with the student (continuity fast-path), then a balanced proficiency mix; emergency round-robin as fallback." | Report 08 §5: computeBaseLoad :640, continuity fast-path :271-309 |
| (same cell) | links | `[{"type":"url","label":"Tutor Student Assignment PRD (card 1629)","url":"https://app.notion.com/p/1c2b7cca4982807cbb31f440494c1348"}]` | Report 04a |
| Back Stage Tech › Open session | content | "Zoom link + host key stored on session record" | Report 03 (SessionItem URL + zoom host key) |
| (same cell) | description | "Each session record carries its videoconference URL and Zoom host key; Videoconf entities later match videoconference attendance back to the session." | Report 03 backstage integrations |
| Back Stage Tech › Distribute breakout list | content | "Live rebalancing handles roster changes" | Report 08 §2c |
| (same cell) | description | "If a tutor calls off or is absent, reassignStudentsFromAbsentTutor redistributes their students, and a lead-capable regular tutor is promoted to LEAD automatically; integrateJoiningTutor absorbs a tutor who joins late." | Report 08: executeCallOff :654 → reassignStudentsFromAbsentTutor :683; LEAD promotion :679-681 |
| Support Actions › Prepare breakout rooms | content | "Dev team\nDesign team" | Lane parity with existing Support cells in this path |

## 3. Structural changes (steps / triggers / paths / lanes)
- Add the three Back Stage Tech cells above — the lane exists in the 9-lane In-session layout but is completely empty in this path.
- Consider a trigger from Back Stage Tech › "Assignment algorithm" to Lead Tutor › "Distribute breakout list" (the app list is what the lead relays), and from Lead Tutor › "Take tutor attendance" back to Back Stage Tech › "Live rebalancing" for the absent-tutor case.
- No new paths proposed here; the no-show/absent-tutor branch belongs to Help Request / a future unhappy path rather than this scenario.

## 4. Divergences & open questions (Bill decides)
- Back Stage Actions currently says "Tutor supervisor team sets up session details" — code has no session-creation UI; sessions arrive via DB import and supervisors only edit/cancel/revert (report 08 §8). Keep the label but the description should stop implying in-app creation, or reword the label to "Supervisor team maintains session details".
- The manual spreadsheet + Slack-DM distribution choreography (Slack #10) is the documented reality, while the app's assignment list is the intended source of truth. Which do you want the grid to present as the primary flow?
- Reconfirmation (ReconfirmState, Card2452) exists on the dev branch but is NOT deployed to prod — the prod tutor_session table has no reconfirm column (Metabase report 09 #5). Do not author reconfirm behavior as current anywhere in this scenario; the dev-only edge (reconfirm-UNAVAILABLE drops a tutor with no call-off record, TutorSessionServiceImpl.java:236) becomes relevant only after deployment. Flag for the Call-off Request owner too.
- Session cancellation is a large real-world factor: 22–41% of sessions were cancelled per month in 2026 (Mar: 322/793, Metabase report 09). Worth a Back Stage Actions description note ("many scheduled sessions never run") if you want the blueprint to reflect operating reality.
