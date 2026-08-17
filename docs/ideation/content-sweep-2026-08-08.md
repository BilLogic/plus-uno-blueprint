# Blueprint Content Sweep — Index (2026-08-08)

Five-source sweep (Supabase audit × Notion × Slack × Figma × CMU-PLUS/web-app code × Metabase production data), triangulated. Source authority: **code (dev) = shipped truth · Metabase = deployed/production truth · Notion may run ahead · Figma lags the app in places**. Key global caveat: **dev-shipped ≠ prod-deployed** (e.g. reconfirmation Card 2452 is on dev only — prod schema has no reconfirm column).

## Per-scenario revision plans → [docs/plans/content-changes/](../plans/content-changes/)

Each doc: exact cell placement (lane › step, cell_id) · per-property proposals (content / description / links / picture) with ready-to-paste text · structural changes · decision items for Bill.

| Phase | Docs |
|---|---|
| Application | [discovery](../plans/content-changes/application-discovery.md) · [interview-and-offer](../plans/content-changes/application-interview-and-offer.md) |
| Onboarding | [tech-setup](../plans/content-changes/onboarding-tech-setup.md) · [onboarding-modules](../plans/content-changes/onboarding-onboarding-modules.md) · [lesson-modules](../plans/content-changes/onboarding-lesson-modules.md) · [session-sign-up](../plans/content-changes/onboarding-session-sign-up.md) |
| Pre-session | [standard-scheduling](../plans/content-changes/pre-session-standard-scheduling.md) · [fill-in-request](../plans/content-changes/pre-session-fill-in-request.md) · [call-off-request](../plans/content-changes/pre-session-call-off-request.md) |
| In-session | [before-students-join](../plans/content-changes/in-session-before-students-join.md) · [student-just-joined](../plans/content-changes/in-session-student-just-joined.md) · [warm-up](../plans/content-changes/in-session-warm-up.md) · [goal-setting](../plans/content-changes/in-session-goal-setting.md) · [help-request](../plans/content-changes/in-session-help-request.md) · [wrap-up](../plans/content-changes/in-session-wrap-up.md) |
| Post-session | [reporting-an-issue](../plans/content-changes/post-session-reporting-an-issue.md) · [reporting-hours](../plans/content-changes/post-session-reporting-hours.md) |

## Figma sync plans → [docs/plans/figma-sync/](../plans/figma-sync/)

One per Figma page, live-verified structure + out-of-sync tables + action items: [01 Pre-Session](../plans/figma-sync/01-toolkit-pre-session.md) · [02 In-Session](../plans/figma-sync/02-toolkit-in-session.md) · [03 Post-Session](../plans/figma-sync/03-toolkit-post-session.md) · [04 Admin pages](../plans/figma-sync/04-admin-pages.md) · [05 Training](../plans/figma-sync/05-training-onboarding-lessons.md) · [06 Profile+Home](../plans/figma-sync/06-profile-home.md) · [07 Universal/Login/MISC](../plans/figma-sync/07-universal-login-misc.md) · [08 New coverage](../plans/figma-sync/08-new-coverage.md) (proposes 5 new pages; Student Portal first — the missing student actor)

## Decisions (Bill, 2026-08-08)

1. **Future-state convention: dedicated "Future" path** per affected scenario (reconfirmation rollout, session creation, reflection redesign, soft-conflict rule) — current path stays as-is, future path diverges where roadmap changes behavior.
2. **Call-off Request: split into 2 paths** — "Standard call-off (12h+)" + "Late call-off (<12h)" exception (matches Figma §5.1/§5.2).
3. **Goal Setting "New In-Cycle Check-In": fold into Check Goals**, delete skeleton path.
4. **Goal-setting condition**: stored in another in-app table, exact location unknown — fine to leave; don't cite `test_condition`.
5. **No Intercom anywhere** — fully out of date; purged from all plans.
6. **Live form URLs confirmed**: tutor sign-up = Become-a-Tutor Google Form; school/misc contact = Get-PLUS-Tutoring Google Form (both wired into Discovery doc, verified against live tutors.plus nav).
7. **Before Students Join: app assignment system = primary flow**; manual spreadsheet/Slack-DM choreography captured in descriptions as current practice.
8. **Goal-setting RCT condition: description-only** — grid labels neutral, study mechanics in detail panel.
9. **Reconfirm decline ≠ call-off (by design)** — reconfirm fires only on supervisor-initiated session changes; Future-path material once deployed.
10. **Clearance: procedure reconstructed** (sweep/10) — acceptance form → supervisor adds to CPO roster → CPO↔tutor directly (Act 153 trio, ~2wks) → CPO weekly email → Friday-8pm ETL writes `advisor.clearance_status` → app access.
11. **Figma sync: text/spec corrections EXECUTED 2026-08-08** — 16 amber "[sync 2026-08-08]" annotations across 11 pages (log: figma-sync/00-execution-log.md); frame/visual restructuring stays with design team.
12. **Notion call-off page updated** — superseded-banner with verified current process + production stats prepended (history + comments preserved).
13. **Clearance placement ADOPTED**: own step/sub-sequence appended to Interview & Offer, wait-state trigger into Tech Setup; CPO = external actor.
14. **Goal Setting**: demote Happy Path to thin overview; add new system cells to parent paths only (not Edge Case copies).
15. **Help Request**: add Escalation alternate path; move tutors@tutor.plus from step name into cell content.
16. **"No or Few Students Join" = second path under Student Just Joined.**
17. **Standard Scheduling grows 2→3 steps** (reconfirmation column; Future-path until prod deploy). **Soft-conflict rule = Future-path cell** in Session Sign Up (10-min gate design).
18. **Onboarding modules: 11 canonical** per Notion hub (M10 Handling Difficult Situations, M11 Lead Tutors; archived Florida-specific M10 explains Slack numbering drift).
19. **Missed/rejected hours**: supervisor follows up manually AND tutor self-fixes in Workday next cycle — sad path can be authored from both.

## APPLIED 2026-08-08 — revisions written to DB

All 17 scenarios applied (3 writer passes; per-scenario transactions; logs: content-changes/APPLIED-2026-08-08-*.md). Global before→after: cells 802→867 · paths 24→26 (+Late call-off exception, +Help Request Escalation, +No/Few Students Join, −New In-Cycle Check-In) · triggers 448→503 (incl. Update Goals 0→39) · descriptions 162→327 (20%→38%) · links 244→272 · new steps: info session, accepts-offer/clearance, complete-profile, reconfirm availability · Wrap-Up Support Actions lane added · orphan step deleted. Integrity verified: 0 orphan steps / bad refs / dangling triggers. Backup: backup_20260808_* tables.

**Wave 2 APPLIED (same day):** all remaining items except illustrations. Final state: **6 phases · 23 scenarios · 38 paths · 954 cells · 470 triggers · 45% descriptions · 314 linked cells · 0 integrity issues**. Added: new phase Program Administration + 6 new scenarios (Supervisor Admin, Tutor Profile & Maintenance, Student Kickoff Interview [In-session, rationale logged], Session Prep & Resources, Post-Session Growth Loop, Student Session Experience — first Student actor lanes); 5 "Future (roadmap)" paths (39 PLANNED-prefixed cells); Reporting Hours "Missed hours" unhappy path; Warm-Up boilerplate purged (16 cells); late column removed from original call-off path. **Empty-labels finding: all 147 remaining empty cells are Visual-lane — the illustration strip, Bill's work; zero non-Visual cells lack labels.** Figma: 5 new scaffold pages (Student Portal 11275:4, Resources 11275:5, Messaging 11275:6, AI Coach 11275:7, Admin/Program 11275:8), missing-case sections (revert flow, calendar view, recording states, badge claim), IA page 1:182 now the file's table of contents. Logs: APPLIED-2026-08-08-{cleanups,future-paths,new-scenarios-A,new-scenarios-B}.md + figma-sync/00-execution-log.md.

Remaining for Bill: Visual-lane illustrations (147 cells) + picture properties · designer work on the TO-SPEC placeholder frames · Roadmap/PRD slots in Figma context blocks.

## Top divergences for Bill to reconcile

1. **<12h call-off ≠ pending state** — tutor removed from roster immediately; review only decides excused/unexcused.
2. **Reconfirmation (resolved)** — fires only on supervisor-initiated session changes; declining ≠ call-off by design (Bill confirmed 2026-08-08). Dev-only today → Future path material, no policy issue.
3. **No session creation in app** — sessions arrive via DB import; Figma "create session" is fiction; semester-schedule creation undocumented anywhere.
4. **Call-off reality** — prod-live 2026-01-11, 300–640/month, 64% auto-approved; the "~20/month" Notion figure = old manual era.
5. **Notion matching PRD ≠ shipped algorithm** — author from code.
6. **test_condition ≠ goal-setting experiment** — goal-setting condition storage location unknown (open question).
7. **Notion ahead of code** — reflection redesign (AI follow-ups), soft-conflict rule (threshold now 10 min), match-history accordion: unshipped, don't author as current.
8. **Messaging near-unused** (643 rows lifetime) — deprioritize "Between-Session Communication" scenario.

## Missing scenarios/paths (app ships, blueprint lacks)

Supervisor Program Administration (Tutors/Sessions/Students/Groups admin) · Tutor Profile & Identity Maintenance · Student Kickoff Interview · Session Prep / Resource Selection · Post-Session Growth Loop (AI Coach + Accredible badges) · student portal journey (no student actor lane anywhere) · unhappy paths (zero exist; strongest candidates: no/few students, late call-off branch, cancellation/revert, nobody-fills-in).

## Production volumes worth citing (Metabase, spring 2026)

Sessions ~540–790/mo, 22–41% cancelled monthly · call-offs 300–640/mo (21% <12h; illness avg 30h notice) · fill-ins ≈10–12% of sign-ups · attendance: 83.4% of students recorded, only 31.8% of sessions fully covered · reflections 1,500–2,000/mo, ~80% empty notes · AI Coach 882 insights/148 tutors (8-week pilot) · badges 208 lifetime.

---
*Raw evidence: session scratchpad `sweep/01–09` (08 = code validation file:line; 09 = Metabase). Side find for web-app: stale "from Acuity" tooltip `tutor_coach_charts.js:95`.*
