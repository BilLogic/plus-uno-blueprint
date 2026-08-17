# Goal Setting — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › In-session › Goal Setting · Path(s): Happy Path, Set Goals, Set Goals Edge Case, Update Goals, Update Goals Edge Case, Check Goals, New In-Cycle Check-In
Status of scenario today: the biggest scenario in the blueprint (381 cells, 47.5% of all cells, 7 paths). Frontstage lanes are rich; the whole scenario has ZERO Back Stage Tech cells, the Back Stage Actions lane is one repeated sentence ("Researchers set goal setting activities."), and two paths have broken/absent trigger wiring. This plan is deliberately not cell-by-cell — it covers the mechanical fixes and the system-lane enrichment.

Path inventory (live DB, 2026-08-08):

| Path | id | cells | triggers | steps | desc/note |
|---|---|---:|---:|---:|---|
| Happy Path | a0000000-…-00000000080c | 46 | 19 | 7 | yes/yes |
| Set Goals | a0000000-…-000000000811 | 66 | 38 | 11 | yes/yes |
| Set Goals Edge Case | a0000000-…-000000000816 | 70 | 40 | 12 | yes/yes |
| Update Goals | a0000000-…-000000000815 | 66 | **0** | 11 | yes/yes |
| Update Goals Edge Case | a0000000-…-000000000817 | 72 | 40 | 12 | yes/yes |
| Check Goals | a0000000-…-000000000814 | 48 | 32 | 8 | yes/yes |
| New In-Cycle Check-In | b1c77ef1-76ce-456c-aed1-8bb0faca56d3 | **13** | **0** | 8 | **no/no** |

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Back Stage Actions › (all ~40 "Researchers set goal setting activities." cells across paths, e.g. a0000000-…-0000001a0307, …-0000001f0407, …-000000b00407) | various | description | (empty) | "Which activity a session shows (Set / Update / Check Goals vs. Mark Helped) is a study condition assigned by the research team, scoped to session_id — the same recurring class can be in different arms on different dates. The condition is maintained by the team's external ETL pipeline, not by the app's own experiment tables. Coordination happens in #plus-goal-setting." | Slack #plus-goal-setting C07PZJD3HD5, threads 2025-08→2026-02 (report 02 #12); Metabase report 09 #9 (test_condition ≠ goal-setting) |
| Front Stage Tech cells labeled "PLUS App" on goal steps (per path) | various | links | mostly 0 | `[{"type":"url","label":"Figma — Goal Setting (Toolkit / In-Session)","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3377-227478"},{"type":"url","label":"Figma — Goal Setting screens","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=5920-79843"},{"type":"url","label":"Figma — Goal / Student Goal Setting Modal","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=157-180717"}]` — pick per step (modal steps get the modal link; dashboard steps get the screens link) | Report 05; metadata pull (Goals components 9974:340407; goal-setting modal with note-taking 9786:101640) |
| "Save goal" Front Stage Tech cells (Set/Update paths) | various | links | 0 | Add `{"type":"url","label":"Figma — Goal / CTAs (save states)","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=157-180613"}` | metadata pull (save goals enabled/disabled variants) |
| Update Goals › "Review last goal cycle overview and system suggestion" Front Stage Tech | (per path) | links | 0 | Add `{"type":"url","label":"Figma — Goal / System Suggestion (under/on/over target)","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=157-180606"}` | metadata pull (System Suggestion states) |

## 2. New cells

System-lane enrichment — add once to Happy Path and once to each of Set Goals / Update Goals (the Edge Case twins can inherit via link rather than duplication if you prefer):

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Back Stage Tech › Set or check goal (Happy Path a0000000-…-080c) | content | "Session-scoped RCT condition gates the Goals CTA" | Report 02 #12 |
| (same cell) | description | "The goal-setting condition is keyed to session_id, not the recurring shift, so condition can vary within a series. It is assigned and refreshed by the research team's external ETL; where exactly it is stored app-side is unconfirmed (the app's test_condition table is a different, assessment-item experiment)." | Report 02 #12; Metabase report 09 #9 |
| Back Stage Tech › Save goal (Set Goals path) | content | "Goal + Usage entities persist per edtech platform" | Report 03 (Goal+Usage entities for ALEKS, DreamBox, i-Ready, IXL, MATHia, …) |
| (same cell) | description | "Saved goals are stored per student per platform; institution admins set per-platform defaults. MATHia has its own goal status banner in the UI." | Report 03; metadata pull (MATHia / Goal Status Banner 5208:74889) |
| Back Stage Tech › Review last goal cycle overview (Update Goals path) | content | "Weekend ETL refreshes goal progress; teacher emails Monday" | Slack #plus-goal-setting (report 02 #12) |
| (same cell) | description | "Goal-update ETL scripts run Sundays to compute cycle progress and system suggestions; teacher-facing goal emails go out Mondays. A teacher-set-goal warm-up phase precedes some cycles." | Slack #plus-goal-setting 2025-08→2026-02: ETL Sun/Mon scripts, teacher emails, teacher-set-goal warmup phase |
| (same cell) | links | `[{"type":"url","label":"Slack #plus-goal-setting","url":"https://devoli.slack.com/archives/C07PZJD3HD5"}]` | Report 02 |

## 3. Structural changes (steps / triggers / paths / lanes)
1. **Update Goals triggers (mechanical):** 66 cells, 0 triggers, while sibling Update Goals Edge Case (72 cells, same 11+1 step spine) has 40. Mirror the Edge Case trigger pattern column-by-column onto Update Goals — same source/target lanes, dropping the edges that touch the Edge-Case-only step. This is a copy job, not authoring.
2. **New In-Cycle Check-In — finish or archive:** 13/72 cells (18%), 0 triggers, no path description or note; several of its 13 cells are again the Help Request boilerplate ("Rename students to match roster name", "Checks if all students are in the correct breakout room"). Its distinctive content (Check Goals CTA in Action column, real-time student progress display while screen-sharing) overlaps heavily with the existing Check Goals path (48 cells, 32 triggers, complete). Recommendation: fold the two genuinely new Front Stage Tech ideas ("PLUS App (Real-time student progress display)", cell 44aa93f5-725e-4b6d-be33-452004604c00) into Check Goals as description/link material, then archive/delete this path. If it instead reflects a designed-but-distinct new flow, it needs: path description, note, ~59 cells, and trigger wiring before it renders as anything but a stub.
3. **Path descriptions:** all six other paths have description+note; whatever survives of New In-Cycle Check-In must too.

## 4. Divergences & open questions (Bill decides)
- **DECIDED (Bill, 2026-08-08): demote Happy Path to a thin overview** whose description points at the named paths; stop maintaining its 46 duplicate cells.
- **DECIDED (Bill, 2026-08-08): new Back Stage Tech cells go on parent paths only** (Set/Update/Check), not the Edge Case copies.
- Do you want the goal RCT condition surfaced at all in a partner-visible blueprint? It's accurate but exposes study mechanics; could live in description (detail panel) only, never in grid labels — which is how I've written it.
- New In-Cycle Check-In — **DECIDED (Bill, 2026-08-08): fold into Check Goals** (move the two novel Front Stage Tech ideas as description/link material), then delete the skeleton path.
- **Condition-storage location is an open question:** Metabase confirmed test_condition holds assessment-item conditions (MCQ / open-response / AI variants, student-scoped via student_test_map, 105 students) — NOT the goal-setting experiment (report 09 #9). Do not cite test_condition on any goal-setting cell. Bill (2026-08-08): condition lives in another in-app table, exact location unknown — acceptable to leave unresolved; word descriptions as "assigned by the research team's ETL into the app's database" without naming a table.
