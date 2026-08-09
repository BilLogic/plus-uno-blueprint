# Warm-Up — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › In-session › Warm-Up · Path(s): Happy Path (9 steps, with screen share), Alternate Path (8 steps, without "Ask Student to Share Screen")
Status of scenario today: 89 cells across two near-identical paths. Regular Tutor lane is complete and correct (enter room → greet → mark present → engagement → mark helped → leave → next). The Partner Action: Teacher and Lead Tutor lanes are copy-pasted verbatim from Help Request and are misaligned with these steps; attendance/engagement system behavior is undocumented.

## 1. Revise existing cells

Cell ids below are Happy Path; the Alternate Path twin (id pattern …0006xxxx) gets the identical change.

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Regular Tutor › Mark Student Present | a0000000-0000-4000-8000-000000040503 | description | (empty) | "Marking attendance in the student dashboard unlocks the engagement dropdown for that student. 2026 production data: 83.4% of rostered students get an attendance record, but only 31.8% of sessions are fully covered — completing this per student is the main data-quality lever." | Metabase validation 2026-08-08 (report 09 #4); Slack Alex Houk 2026-03-09 gave 88.4%/38%, slightly better than actuals; Zoom Engagement Tracking card 2307 (disabled-not-hidden) |
| Regular Tutor › Select Engagement level | a0000000-0000-4000-8000-000000040603 | description | (empty) | "Engagement is defined as observable Zoom behavior only, with sub-options such as joined late, unresponsive, left early. The control is disabled (not hidden) until attendance is recorded. Internally this field is being renamed from Engagement to Responsiveness." | Notion Zoom Engagement Tracking card 2307 (report 04a); Slack Meryem 2026-03-06 (rename, disabled until attendance) |
| Regular Tutor › Select Engagement level | a0000000-0000-4000-8000-000000040603 | links | 2 | Add: `[{"type":"url","label":"Zoom Engagement Tracking (card 2307)","url":"https://app.notion.com/p/Zoom-Engagement-Tracking-Iteration-313b7cca498280a8b735d4a2394faff4"},{"type":"url","label":"Figma — Attendance & Engagement components","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=9974-340408"}]` | Reports 04a, 05 |
| Regular Tutor › Mark Student Helped | a0000000-0000-4000-8000-000000040703 | description | (empty) | "'Mark Helped' is one arm of the goal-setting study: sessions in the non-goals condition show Mark Helped where goals-condition sessions show the Goals CTA. The condition is scoped to session_id, so it can differ between occurrences of the same recurring series." | Slack #plus-goal-setting 2025-08→2026-02 (report 02 #12) |
| Front Stage Tech › Mark Student Present ("PLUS App") | 1d04eb28-605e-4386-bd00-9f215799f157 | links | [] | `[{"type":"url","label":"Figma — Attendance / Dropdown","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1952-149731"}]` | Report 05 / metadata pull |
| Front Stage Tech › Select Engagement level ("PLUS App") | 4443340f-0df2-409b-a901-a156f8514145 | links | [] | `[{"type":"url","label":"Figma — Engagement / Dropdown","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1952-149739"}]` | metadata pull |
| Regular Tutor › Move to Next Student | a0000000-0000-4000-8000-000000040903 | description | (empty) | "The dashboard lists students in an order set by researchers; tutors work top-to-bottom so coverage and study conditions stay consistent across tutors." | Existing Back Stage Actions cell; Slack #plus-dev sequential-room protocol |

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Back Stage Tech › Mark Student Present | content | "Attendance write enables engagement field" | Card 2307; Slack Meryem 2026-03-06 |
| (same cell) | description | "SessionAttendance is written per student; the engagement (Responsiveness) selector stays disabled until it exists. Videoconf entities later reconcile Zoom attendance against these records." | Report 03 (SessionAttendance, Videoconf* entities); card 2307 |
| Back Stage Tech › Mark Student Helped | content | "Session condition decides Goals vs Mark Helped" | Slack #plus-goal-setting (report 02 #12) |
| (same cell) | description | "The goal-setting RCT condition is scoped to session_id and maintained by the research team's external ETL — the same recurring class can flip arms week to week. (Note: the app's test_condition table is a different experiment — assessment-item variants — not this one; Metabase report 09 #9.)" | Report 02 #12 (session_id-scoped condition, external ETL); Metabase report 09 #9 |
| Back Stage Actions › Mark Student Present | content | "Supervisors monitor attendance completeness" | Slack 2026-03-09 stats (88.4%/38%) |

## 3. Structural changes (steps / triggers / paths / lanes)
- Fix the Partner Action: Teacher lane: its six cells ("Circulate and quietly observe…", "Receives information that student is absent…", "Escalates unresolved issues to tutors@tutor.plus promptly.") are the Help Request teacher lane pasted in and drift out of column alignment (e.g. "Handles student tech problems" sits under Mark Student Helped). Either rewrite per column (observe → keep students working → verify rooms → n/a → n/a for marking steps) or thin the lane to the 2–3 cells that genuinely co-occur with warm-up.
- Same for Lead Tutor: "Rename students to match roster name" / "Add un-rostered students" / "Manually assign unpaired students" are session-start actions duplicated from Help Request; they belong to Before Students Join / Student Just Joined. Keep at most a "monitors main room during warm-up rotation" cell here.
- Path descriptions: make explicit that Happy Path = student shares screen, Alternate Path = warm-up without screen share (currently the only difference is the missing "Ask Student to Share Screen" step; the path names don't say so).

## 4. Divergences & open questions (Bill decides)
- Rename "Select Engagement level" → "Responsiveness": **verified NOT shipped** (no "Responsiveness" string anywhere in dev-branch UI code, 2026-08-08 grep). Keep "Engagement" in labels; mention the planned rename in description only.
- The teacher-lane cleanup above deletes content; confirm you'd rather trim than rewrite (the current cells are not wrong as teacher behavior, just not warm-up-specific).
- The #plus-goal-setting "teacher-set-goal warmup phase" (teachers setting goals ahead of the cycle) touches Warm-Up but is really Goal Setting material — I put the full treatment in the Goal Setting plan and only the Mark Helped condition note here.
