# APPLIED 2026-08-08 — New scenarios (batch B)

Three missing scenario grids created in the PLUS Uno Blueprint Supabase DB (supabase-plus).
Backups from earlier today (`backup_20260808_*`) predate these inserts. All rows use `origin='import'`,
`view_type='side-by-side'`, single Happy Path (`path_type='happy'`), explicit UUIDs with prefixes
`c1/c2/c3…`, cell_keys in the `plus-application/<scenario>/happy-path/<lane>/<step>` convention,
and jsonb link arrays pointing at real GitHub (`CMU-PLUS/web-app@dev`) file paths. Visual lanes were
created but left empty (Bill's work). Only evidence-backed cells were filled — grids are deliberately sparse.

## 1. Session Prep & Resources — Pre-session, position 4 (after Call-off Request)
- Scenario `c1000000-0000-4000-8000-000000000001`, path `…0002`.
- Lanes (6): Visual, Tutor, Student, Front Stage Tech, Back Stage Actions, Back Stage Tech.
- Steps (5): Browse resource library → Consult Resource Assistant → Review resource detail →
  Assign resources to students → Student sees resources in portal.
- Cells: 9. Evidence: ResourceLibraryServlet / ResourceAssistantServlet / ResourceServlet +
  resource_library.jsp / wizard/*.jsp / pl2_student.jsp (sweep report 08, Job 2c/2e);
  resource_assigned 6,245 lifetime (report 09). No Figma page exists — description and Front Stage
  Tech cells note the figma-sync backlog (docs/plans/figma-sync/08-new-coverage.md, proposed page A).

## 2. Post-Session Growth Loop — Post-session, position 3 (after Reporting Hours)
- Scenario `c2000000-0000-4000-8000-000000000001`, path `…0002`.
- Lanes (6): Visual, Tutor, Front Stage Tech, Front Stage Actions, Back Stage Actions, Back Stage Tech.
- Steps (6): Review impact → Review time allocation → Read AI growth insights → Complete training
  lessons → Claim certification badge → Share badge.
- Cells: 10. Evidence: TutorReviewServlet + tutor_review/*.js, LessonServlet + LessonLLMFeedback,
  BadgesServlet + BadgeToUserMap/Accredible (report 08, Job 2f). Volumes authored explicitly as
  pilot-scale: 882 insights / 148 tutors in the 8-week spring 2026 pilot, 116 feedback ~75% positive;
  208 badge claims lifetime / 2 badge defs (report 09). Figma gap noted (proposed page D).

## 3. Student Session Experience — In-session, position 8 (after Wrap-Up)
- Scenario `c3000000-0000-4000-8000-000000000001`, path `…0002`.
- Lanes (6): Visual, **Student** (primary actor — first student lane in the blueprint), Tutor,
  Front Stage Tech, Back Stage Actions, Back Stage Tech.
- Steps (6): Open student home → Open assigned resource → Work in math software → Mark resource as
  used → Message tutor → Give feedback.
- Cells: 9. Evidence: pl2_student.jsp, PL2StudentResourcesServlet/PL2StudentResourceServlet,
  PL2StudentMessageServlet + PL2MessageServlet (tutor side), local_only_login.jsp (report 08, Job 2e);
  edtech goal/usage feeds (report 03). Messaging cell and scenario description state plainly that
  messaging is essentially unused — 643 rows lifetime (report 09). No Figma coverage (proposed page C).

## Concurrency note
While this batch ran, the concurrent agent inserted "Student Kickoff Interview" at In-session
position 3, shifting Warm-Up…Wrap-Up to 4–7. Student Session Experience was initially written at
position 7 (colliding with Wrap-Up) and corrected to 8. Final ordering verified unique per phase.
Onboarding and Program Administration phases were not touched.

## Verification
Per-scenario integrity query (paths / lanes / steps / path_steps / cells / bad_cells):
- Session Prep & Resources: 1 / 6 / 5 / 5 / 9 / 0
- Post-Session Growth Loop: 1 / 6 / 6 / 6 / 10 / 0
- Student Session Experience: 1 / 6 / 6 / 6 / 9 / 0
No null layer/step/cell_key references, all `links` are jsonb arrays, no duplicate order_position
in Pre-session / In-session / Post-session.
