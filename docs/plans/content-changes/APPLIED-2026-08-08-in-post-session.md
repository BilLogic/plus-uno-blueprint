# Applied — In-session + Post-session content revisions
Date: 2026-08-08 · DB: supabase-plus (PLUS Uno Blueprint) · Backups: `backup_20260808_*` (pre-existing; none created here)
Scenarios covered: Before Students Join, Student Just Joined, Warm-Up, Goal Setting, Help Request, Wrap-Up, Reporting an Issue, Reporting Hours. One transaction per scenario; all targets SELECT-verified before write, all matched (no forced writes).

Note: the live schema has drifted past `supabase/schema.reference.sql` — `cells` now has `slot_position` (unique is `layer_id, step_id, slot_position`) and `origin` ('import'/'app'). Multi-cell slots (e.g. two Front Stage Tech cells in one column) use slot_position, not duplicate layers.

## Per-scenario results

### Before Students Join (Happy Path)
- Applied §1: 7 descriptions (…180102, …180302, …180402, …180602, …180303, …180106, …180107) + links on …180102 (Module 11 Notion, Figma Lead Tutor) and …180207 (Figma Admin/Session).
- Applied §2: 3 new Back Stage Tech cells (assignment algorithm w/ PRD link, Zoom link + host key, live rebalancing) + Support Actions › Prepare breakout rooms ("Dev team / Design team").
- Deferred: §1 pruning of the repeated 5-link bundle on Regular Tutor cells (no per-cell spec); §3 triggers (doc says "Consider", not decided); no reconfirm behavior authored (per §4).
- Stats: cells 36→40, desc 11→18 (28%→45%), triggers 21 (unchanged).

### Student Just Joined (Happy Path + new path)
- Applied §1: 3 descriptions (…190302, …190303, …190102) + links on …190303 (Figma Regular Tutor, Help Center late-joiners) and …190106 (Figma In-Session Modal).
- Applied §2: 4 new cells — Regular Tutor › Students join, Regular Tutor › Share screen and log in (w/ MATHia/IXL/i-Ready failure-mode desc), Back Stage Tech › Students join (placeSingleStudent), Back Stage Tech › Raise hand for help.
- Applied §3: trigger placeSingleStudent → Regular Tutor "Move student to breakout room".
- **DECIDED applied: new path "No or Few Students Join"** (path_type=unhappy, id b2000000-…-0001): 9 mirrored layers, 3 new steps (Wait 10 minutes → Post in school Slack channel → Await supervisor decision), 5 cells (lead ×3 incl. Notion article link, FST Slack, Back Stage Actions supervisors), 3 triggers. Built from the "When No or Few Students Join" Help Center flow as documented in the plan.
- Deferred: "wrong name / un-rostered" extra column (§3, "could also absorb" — not decided).
- Stats: happy cells 13→17, desc 1→8; new path 5 cells / 3 triggers; scenario paths 1→2.

### Warm-Up (Happy + Alternate)
- Applied §1 to Happy Path AND Alternate twins (…04xxxx / …06xxxx): descriptions on Mark Present, Select Engagement, Mark Helped, Move to Next Student (both paths); links on Select Engagement (card 2307 + Figma A&E components, both paths), FST PLUS App cells 1d04eb28/bf950894 (Attendance dropdown) and 4443340f/4342e7b0 (Engagement dropdown).
- Applied §2 to Happy Path: Back Stage Tech › Mark Student Present (attendance write enables engagement), Back Stage Tech › Mark Student Helped (session condition Goals vs Mark Helped), Back Stage Actions › Mark Student Present (supervisors monitor completeness). Alternate-path duplicates NOT created — §2 carried no twin instruction; flagged for Bill if parity wanted.
- Applied §3: path descriptions rewritten to state the actual split — Happy = with screen share, Alternate = without "Ask Student to Share Screen".
- Deferred: teacher-lane and Lead-Tutor lane cleanup (§3 offers either/or, Bill to choose trim vs rewrite). "Responsiveness" kept out of labels per §4 (rename not shipped).
- Stats: Happy cells 46→49, desc 5→18; Alternate cells 43 (desc 8→15).

### Goal Setting (7→6 paths)
- Applied §1a: RCT-condition description on all 21 "Researchers set goal setting activities." Back Stage Actions cells (doc estimated ~40; actual 21) across surviving paths.
- Applied §1b (links on FST "PLUS App" cells, per-step pick): CTA/dashboard steps → Toolkit + Goal Setting screens; modal-work steps (fill out settings/strategy, starts setting/updating, set-or-check) → Toolkit + Student Goal Setting Modal; Save goal steps → CTAs (save states); Review last goal cycle → System Suggestion. Note: Update Goals (parent) has no FST cell at "Review last goal cycle…" — System Suggestion link went on the Edge Case cell 386c3875 only; parent logged as unmapped.
- Applied §2 (DECIDED: parent paths only): Back Stage Tech cells on Happy Path › Set or check goal (RCT condition), Set Goals › Save goal (Goal+Usage entities), Update Goals › Review last goal cycle (weekend ETL + Slack #plus-goal-setting link). No table named for condition storage, per Bill's §4 ruling.
- Applied §3(i) **Update Goals trigger mirror**: 0→39 triggers copied from Update Goals Edge Case by (layer name × column) mapping (EC column 2 "Sees action color…" is edge-only; mapped EC col c→UG col c−1 for c≥3 — step names drift slightly between the paths, e.g. "with student" vs "with the student", so column mapping was used instead of exact name match). Unmapped (logged, intentionally dropped): 6 EC edges touching the edge-only column (Join→Sees-warning and Sees-warning→Click-CTA in Teacher/Lead/Regular lanes). End state verified: every UG trigger corresponds 1:1 to an EC edge; 0 cross-path edges.
- Applied §3(ii) **DECIDED: New In-Cycle Check-In folded + deleted**: the two novel FST ideas (44aa93f5 "Real-time student progress display", 6330b1c1 "Student Progress Dashboard") captured as a description on Check Goals FST › Share screen (77d1fd51); path b1c77ef1 deleted (13 cells cascade-removed; shared 9b0x steps untouched — still used by Check Goals). Check Goals had no FST cell at "Review goals…" so the fold landed on the Share screen cell, covering both ideas.
- Applied §3(iii) **DECIDED: Happy Path demoted**: description replaced with overview text pointing at the named paths; its 46 cells left intact (demotion is description-level).
- Stats: paths 7→6; Update Goals triggers 0→39; scenario cells 381→371 (−13 deleted path, +3 BST parents); BSA descriptions 0→21.

### Help Request (Happy + new Escalation path)
- Applied §1: 5 descriptions (…1b0103, …1b0403, …1b0502, …1b0603, …1b0701) + links on …1b0103 (Figma Regular Tutor) and …1b0403 (routing table + tricky situations Notion).
- Applied §3.1 **orphan step deleted**: step …000986 "Handles student tech problems as they arise" — verified 0 cells and 0 path_steps referenced it; deleted per doc verdict (text already lives in Teacher cell …1b0601).
- Applied §3.2: step …000987 renamed "Escalates unresolved issues to tutors@tutor.plus promptly." → "Escalate unresolved issues"; the address now lives in cell content only.
- §3.4 trigger teacher …1b0501 → lead …1b0502: already existed; no-op.
- **DECIDED applied: "Escalation" alternate path** (id b3000000-…-0001): 9 mirrored layers; 4 columns reusing scenario steps (Receive help request → Visit student → Resolve issue → Escalate unresolved issues); 7 cells — Regular Tutor ×3 (incl. routing-table desc + links), FST "Slack (school + support channels)" w/ urgent-issues link, Back Stage Actions supervisors-monitor, Support Actions triage (ticketing pending), Partner Teacher "Escalates unresolved issues to tutors@tutor.plus by email."; 5 triggers chaining the flow.
- Deferred: lane hygiene (§3.3 — moving session-start Lead cells to other scenarios; cross-scenario ownership call for Bill).
- Stats: happy cells 33 (desc 6→11); new path 7 cells / 5 triggers; scenario paths 1→2; steps 8→7 (orphan removed).

### Wrap-Up (Happy Path)
- Applied §1: 6 descriptions (…1c0102, …1c0402, …1c0403, …1c0406, …1c0302) + links on …1c0403 (Figma Reflections entry, Notion reflections article).
- Applied §2 + 4e: **Support Actions layer created** (row_position 8 — restores lane parity, was the only In-session path missing it) with "Dev team / Design team" cell at Complete wrap-up; Back Stage Tech › Complete wrap-up (Videoconf reconciliation w/ 2026 stats), Back Stage Tech › Close breakout sessions (notes auto-save), Back Stage Actions › Complete wrap-up (supervisors track reflection completion).
- §3 cross-scenario link to Reporting an Issue: handled via description (the …1c0302 debrief description routes onward per Reporting an Issue), per the doc's "at minimum" option — no cross-scenario trigger rows created.
- Deferred: recording→storage Back Stage Tech cell (acknowledged Notion gap; doc chose not to invent). Live-form-only wording used throughout per §4.
- Stats: cells 20→24, desc 3→9, layers 8→9.

### Reporting an Issue (Happy Path)
- Applied §1: descriptions on …1d0102, …1d0104, …1d0207, …1d0106; **actor fix**: …1d0402 and …1d0403 content → "Receives status update on the reported issue."; links on …1d0102 (urgent issues + routing table Notion).
- Applied §2: FST › Reach out third cell "Reflection form" (slot_position appended alongside Slack/Email) w/ reflections-as-intake desc; Back Stage Tech › Follow up (Slack webhooks + email service).
- Applied §3: trigger Reflection form → Front Stage Actions › Reach out (supervisor-discovered intake).
- Skipped per rules: Visual › Reach out picture (picture properties out of scope); step-order re-keying (§3 says rendering is right; no change); no unhappy path (doc proposes none).
- Stats: cells 16→18, desc 0→6, triggers 10→11.

### Reporting Hours (Happy Path)
- Applied §1: 5 descriptions (…1e0102, …1e0103 same text, …1e0307, …1e0106, …1e0202).
- Applied §2: Front Stage Actions › Report hours (deadline reminder); Back Stage Tech › Report hours boundary cell ("PLUS session data not linked to Workday" + open-question desc).
- Deferred: the missed/rejected-hours sad path — §4 is ANSWERED (both mechanisms: supervisor chase + next-cycle self-fix) so it *can* now be authored, but it was not in the decided structural work list and no step/cell spec exists in the doc; left for a follow-up authoring pass. Also open: "CMU tutors" scope label (Bill's call).
- Stats: cells 11→13, desc 0→6, triggers 7 (unchanged).

## Rollup

| Scenario | Paths | Cells before→after | Desc% before→after | Triggers before→after |
|---|---|---|---|---|
| Before Students Join | 1 | 36→40 | 31%→45% | 21→21 |
| Student Just Joined | 1→2 | 13→22 | 8%→50% | 8→12 |
| Warm-Up | 2 | 89→92 | 15%→36% | 66→66 |
| Goal Setting | 7→6 | 381→371 | ~5%→~37% | 169→208 |
| Help Request | 1→2 | 33→40 | 18%→35% | 28→33 |
| Wrap-Up | 1 | 20→24 | 15%→38% | 15→15 |
| Reporting an Issue | 1 | 16→18 | 0%→33% | 10→11 |
| Reporting Hours | 1 | 11→13 | 0%→46% | 7→7 |

All link values are `[{"type":"url","label":…,"url":…}]` appended via `links || '…'::jsonb`. No picture properties touched; no unspecced future paths created; no reconfirm/redesign-stage behavior authored as current.
