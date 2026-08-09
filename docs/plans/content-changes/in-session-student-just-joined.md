# Student Just Joined — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › In-session › Student Just Joined · Path(s): Happy Path
Status of scenario today: the thinnest In-session scenario — 13 cells over 3 steps, 48% slot fill, only one Regular Tutor cell and one links entry in the whole grid. Backstage lanes (Back Stage Tech / Back Stage Actions / Support Actions) are all empty despite the late-joiner placement logic living exactly here.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Lead Tutor › Raise hand for help (label "Ping tutor if they missed moving student to breakout room for late joiners.") | a0000000-0000-4000-8000-000000190302 | description | (empty) | "Late joiners land in the main room (or the wrong breakout) and wait until someone moves them. The lead watches the main room and pings the assigned tutor over Zoom chat if a late student is stranded." | Slack #plus-dev Alex Houk 2025-07-24 (late joiners land in wrong rooms; report 02 #10) |
| Regular Tutor › Raise hand for help (label "Move student to breakout room.") | a0000000-0000-4000-8000-000000190303 | description | (empty) | "The tutor (as co-host) moves the student into their breakout room. Any co-host can move any student, so out-of-list moves are a known source of attendance drift." | Report 08 (co-host moves cause attendance drift) |
| Regular Tutor › Raise hand for help | a0000000-0000-4000-8000-000000190303 | links | 4 existing (unlabeled bundle) | Keep, plus add: `[{"type":"url","label":"Figma — Tutor In-Session Mgmt › Regular Tutor","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1691-119583"},{"type":"url","label":"Help Center: Handle Students Who Join Late","url":"https://app.notion.com/p/24dadbad35c847fa8b3d48a28184bdd5"}]` | Report 05; report 04b (Tutor Help Center Content DB — "Handle Students Who Join Late" article) |
| Lead Tutor › Students join (label "Greet students as they join.") | a0000000-0000-4000-8000-000000190102 | description | (empty) | "Lead greets students in the main room, checks Zoom names against the roster, and renames students who joined under nicknames so the assignment list matches." | Module 11 Notion (roster marking); Warm-Up lead-lane content |
| Front Stage Tech › Students join ("Zoom/Pencil") | a0000000-0000-4000-8000-000000190106 | links | [] | `[{"type":"url","label":"Figma — Session / In-Session Pop-up Modal","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=631-205351"}]` | Report 05 (In-Session components) |

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Regular Tutor › Students join | content | "See newly joined student appear on assignment list" | Report 08 §b (session roster in app) |
| Regular Tutor › Share screen and log in | content | "Confirm student is logged into the math software" | Teacher lane mirror; Slack teacher-side failure modes (Erin Gatz 2026-01-20: work not assigned in MATHia/IXL/iReady) |
| (same cell) | description | "If the student can't log in or has no work assigned in the math platform (MATHia/IXL/i-Ready), the tutor flags the teacher — a top documented failure mode is students arriving with nothing assigned." | Slack #plus-core Erin Gatz 2026-01-20 (report 02 #15) |
| Back Stage Tech › Students join | content | "placeSingleStudent assigns the late joiner" | Report 08: placeSingleStudent (TutorStudentSessionAssignmentServiceImpl) for late joiners |
| (same cell) | description | "When a student joins after initial assignment, placeSingleStudent slots them onto the tutor with capacity using the same tiering rules (load, continuity, proficiency mix), so the app list stays authoritative even for late arrivals." | Report 08 §5 (auto-assignment tiers; placeSingleStudent for late joiners) |
| Back Stage Tech › Raise hand for help | content | "Attendance-change handlers rebalance assignments" | Report 03 (live rebalancing incl. attendance-change handlers) |

## 3. Structural changes (steps / triggers / paths / lanes)
- Add a trigger Back Stage Tech › "placeSingleStudent" → Regular Tutor › "Move student to breakout room" (system assigns, human moves).
- Propose an unhappy path for this scenario: "No or Few Students Join" — wait 10 minutes → post in the school Slack channel with teacher/time/expected count, tag the 4 supervisors, never dismiss the session alone; 3 message templates exist. This is fully documented and currently has no blueprint home. Source: Notion "When No or Few Students Join" (https://app.notion.com/p/333b7cca4982805e99b6e012fe9e94eb), report 04b.
- With only 3 steps this scenario could also absorb a "Student joins under wrong name / un-rostered" column (lead renames + adds to attendance list, currently only represented inside Warm-Up's lead lane).

## 4. Divergences & open questions (Bill decides)
- Should "No or Few Students Join" be a second path here or its own scenario? It maps 1:1 onto a Help Center article and the eval DB treats no-shows as a distinct case.
- The teacher lane says "Ask students to share screen and log into math software" but the tutor lane has no counterpart cell until my proposed addition — confirm the intended actor split (teacher prompts in-room, tutor verifies in-breakout).
- Attendance drift from co-host moves is stated in two scenarios now (here and Before Students Join); fine to repeat, but decide which one carries the canonical description.
