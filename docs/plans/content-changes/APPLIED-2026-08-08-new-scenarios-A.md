# APPLIED 2026-08-08 — Three new scenario grids (batch A)

Applied to the PLUS Uno Blueprint Supabase DB via supabase-plus MCP, one transaction per scenario. All rows use `origin='app'` and fixed UUIDs prefixed `f1000000-0000-4000-8000-…` for traceability. Backups existed before the run.

Evidence base: sweep reports 08 (code validation + capability lists), 04a/04b (Notion), 05 (Figma node-ids), 10 (clearance procedure). Conventions copied from the existing Tech Setup grid: `view_type='side-by-side'`, single `path_type='happy'` path named "Happy Path", 7 lanes in order Visual / actor / Front Stage Tech / Front Stage Actions / Back Stage Tech / Back Stage Actions / Support Actions (Student lane replaces Back Stage Actions position-wise in scenario 3), sparse cells with 1–3 sentence descriptions, `links` as `[{"type":"url","label","url"}]`. Visual lane left entirely empty (Bill's illustration work).

## 1. Phase "Program Administration" + scenario "Supervisor Program Administration"

- New phase `f1…0001`, order_position 6 (after Post-session). No existing phases renumbered.
- Scenario `f1…0002`, path `f1…0003`. Judged one grid sufficient: the admin capability list (report 08, Job 2b) collapses cleanly into 6 steps, so the two-scenario split was not needed.
- Lanes: Visual, **Supervisor** (actor), Front Stage Tech, Front Stage Actions, Back Stage Tech, Back Stage Actions, Support Actions.
- Steps (6): Monitor tutors → Manage sessions → Manage students → Manage groups → Broadcast & export → Institution & system admin.
- 12 cells. Notable back-stage facts captured: edit-with-notify reconfirm fan-out; no session-creation UI (DB import only); per-event "New Student(s) Added" email to STUDENT_ROSTERING_SLACK_EMAIL bridge (StudentsServlet.java:1516-1537); group FK on session/shift (PR #1126); Students page SSE (PR #1113).
- Links: Figma Admin pages 3408-120455 (Tutors), 3408-120456 (Sessions), 3408-120457 (Students), 1-177 (Groups); Notion "Tutor Admin Iteration" PRD.

## 2. Scenario "Tutor Profile & Maintenance" (Onboarding, order 2)

- Scenario `f1…0021`, path `f1…0022`. Inserted after Tech Setup; existing Onboarding scenarios bumped: Onboarding Modules→3, Lesson Modules→4, Session Sign Up→5.
- Lanes: standard 7 with Regular Tutor actor.
- Steps (5): Complete profile at onboarding → Update identity details → Update background & languages → Change Slack email → Check Status & Clearance card. ("Keep identity current" split into two field-group steps — both evidence-backed in report 08 Job 2a — to reach the 5-step floor without padding.)
- 9 cells. Facts: MentorProfileServlet / Card 2134 / PR #1132; Slack-email change fires ops webhook (:237-258); Status & Clearance card read-only (mentor_profile.js:373-396), written only by the weekly CPO email → Friday 8pm ET script → plus_etl → advisor.clearance_status (report 10); corrections via help@tutors.plus (Support Actions cell).
- Links: Figma Profile page 1-181.

## 3. Scenario "Student Kickoff Interview" (In-session, order 3)

**Placement rationale (logged per instructions):** placed under **In-session**, not Onboarding. Report 08 Job 2g shows the interview is tutor-conducted with the student present (kickoff_interview.jsp, submitKickoffInterview) — it requires a live session, and its outputs (goals, achievement bars, progress plots) feed the per-student dashboard consumed by the existing In-session Goal Setting scenario. The blueprint's Onboarding phase covers the *tutor's* onboarding, not student intake. Inserted at order 3 (after "Student Just Joined", where a first-session interview naturally sits); Warm-Up→4, Goal Setting→5, Help Request→6, Wrap-Up→7.

- Scenario `f1…0041`, path `f1…0042`.
- Lanes (7): Visual, Regular Tutor, **Student** (first student-actor lane in the blueprint, named "Student"), Front Stage Tech, Front Stage Actions, Back Stage Tech, Support Actions.
- Steps (6): Open kickoff interview → Choose full or short variant → Conduct the interview → Record responses → Submit interview → Responses feed student dashboard.
- 9 cells, citing kickoff_interview.jsp, full/short variants, submitKickoffInterview, and the dashboard pipeline (~12 edtech goal platforms). No Figma or Notion URLs exist for this surface (checked reports 04a/04b/05), so links are empty and evidence lives in descriptions.

## Verification

Post-commit integrity selects (all pass):

| Scenario | paths | layers | steps | path_steps | cells |
|---|---|---|---|---|---|
| Supervisor Program Administration | 1 | 7 | 6 | 6 | 12 |
| Tutor Profile & Maintenance | 1 | 7 | 5 | 5 | 9 |
| Student Kickoff Interview | 1 | 7 | 6 | 6 | 9 |

- 0 cells whose layer/step belong to a different path/scenario (whole DB).
- 0 path_steps referencing steps of a different scenario (whole DB).
- 0 duplicate (phase_id, order_position) pairs.
- Phase order: Application 1, Onboarding 2, Pre-session 3, In-session 4, Post-session 5, Program Administration 6.
- Onboarding scenario order: Tech Setup 1, Tutor Profile & Maintenance 2, Onboarding Modules 3, Lesson Modules 4, Session Sign Up 5.
- In-session scenario order: Before Students Join 1, Student Just Joined 2, Student Kickoff Interview 3, Warm-Up 4, Goal Setting 5, Help Request 6, Wrap-Up 7.

## Rollback

```sql
begin;
delete from cells where path_id in ('f1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000022','f1000000-0000-4000-8000-000000000042');
delete from path_steps where path_id in ('f1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000022','f1000000-0000-4000-8000-000000000042');
delete from steps where service_scenario_id in ('f1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000021','f1000000-0000-4000-8000-000000000041');
delete from layers where path_id in ('f1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000022','f1000000-0000-4000-8000-000000000042');
delete from paths where id in ('f1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000022','f1000000-0000-4000-8000-000000000042');
delete from service_scenarios where id in ('f1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000021','f1000000-0000-4000-8000-000000000041');
delete from phases where id = 'f1000000-0000-4000-8000-000000000001';
update service_scenarios set order_position = order_position - 1 where phase_id='a0000000-0000-4000-8000-000000000102' and order_position >= 3;
update service_scenarios set order_position = order_position - 1 where phase_id='a0000000-0000-4000-8000-000000000104' and order_position >= 4;
commit;
```
