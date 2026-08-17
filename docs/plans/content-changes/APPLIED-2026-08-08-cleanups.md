# Applied 2026-08-08 — Remaining Content Cleanups
Database: supabase-plus (PLUS Uno Blueprint). Backups: `backup_20260808_*`. Each scenario applied in its own transaction and verified before/after.

## 1. Empty cell labels — nothing to fill (finding, not a skip)
The "~148 empty labels" turned out to be **entirely Visual-lane cells**. After the structural
jobs below (which removed one empty Visual cell on the retired call-off column), the DB holds
**147 cells with `content = ''` and every single one is on a `layer_role = 'visual'` lane** —
Bill's illustration strip, which this pass deliberately does not touch.

Verified two ways:
- `cells WHERE content='' AND layer_role NOT IN ('visual','step_visual')` → 0 rows.
- Whitespace-only / 1–2 character labels anywhere → 0 rows.

**Labels filled: 0 per scenario (none needed). Left-empty log: all 147 empties are Visual-lane
by design** (per-path spread: Goal Setting 61 across its 6 paths, Warm-Up 17, Tech Setup 8,
Onboarding Modules 7, Help Request 7, Before Students Join 6, Discovery 6, Call-off 5,
Interview & Offer 5, Wrap-Up 4, Fill-in 4, Reporting an Issue 4, and the rest ≤3 each).
No actor/tech/support lane is missing a label anywhere in the DB.

## 2. Reporting Hours — "Missed hours" sad path created
Decision applied (Bill, 2026-08-08, post-session-reporting-hours.md §4): both mechanisms —
supervisor follows up manually (Slack/email) AND tutor self-fixes in Workday next cycle.

- Path `b0000000-0000-4000-8000-000000000812`, `path_type='unhappy'`, name **"Missed hours"**,
  under scenario Reporting Hours (`…000208`). Description cites the Workday boundary: hours are
  self-reported; PLUS session/attendance data is not connected to Workday, so nothing flags the gap.
- Layers: mirrors the 8-lane Post-session layout (Visual / Lead Tutor / Regular Tutor /
  Front Stage Tech / Front Stage Actions / Back Stage Tech / Back Stage Actions / Support Actions),
  ids `b0000000-…-0930`–`0937`, same roles/row order as the happy path.
- Steps: 3 new — **Miss reporting deadline** (`…0996`), **Supervisor follow-up** (`…0997`),
  **Correct hours (late entry or next cycle)** (`…0998`) — plus reused happy-path step
  **Receive paycheck** (`a0000000-…-0995`) as column 4.
- 10 cells (ids `b0000000-0000-4000-8000-0000001e1xxx`):
  - Col 1: Lead + Regular Tutor "Misses the weekly Workday deadline" (desc: no reminder/cross-check,
    report 03 no-payment-integration + report 04b payroll gap); Back Stage Tech
    "No automated alert — PLUS data not linked to Workday" (deliberate boundary cell).
  - Col 2: Back Stage Actions "Supervisor notices missing hours and follows up manually"
    (manual reconciliation, no system cross-check); Front Stage Tech "Slack / email".
  - Col 3: Lead + Regular Tutor "Enters missed hours late or self-corrects next pay cycle"
    (desc cites the 2026-08-08 both-mechanisms decision); Front Stage Tech "Workday";
    Back Stage Actions "Approves the corrected hours".
  - Col 4: Regular Tutor "Pay for corrected hours lands on a later biweekly paycheck".
- No Visual cells created (no PLUS-owned surface; per plan doc, no pictures for Workday).

## 3. Warm-Up — teacher/lead lane hygiene (per in-session-warm-up.md §3)
Applied to both paths (Happy `…0300`, Alternate `…0350`); Regular Tutor lane untouched.

**Partner Action: Teacher** — kept the doc's per-column trio, which the first three cells already
matched: "Circulate and quietly observe the students." / "Remind students to keep working while
waiting." / "Checks if all students are in the correct breakout room." Deleted the four
Help-Request-boilerplate cells per path under the marking steps (doc: "n/a for marking steps"):
"Receives information that student is absent…", "Alerts lead tutor about unassigned…",
"Handles student tech problems…", "Escalates unresolved issues to tutors@tutor.plus…"
(cells `…040401/040501/040601/040701` and `…060401/060501/060601/060701`).

**Lead Tutor** — doc says "Keep at most a 'monitors main room during warm-up rotation' cell here";
the rename/add-unrostered/assign cells belong to Before Students Join / Student Just Joined.
Rewrote the col-1 cell (`…040102`, `…060102`) to **"Monitors main room during warm-up rotation"**
and deleted the rest per path: "Rename students to match roster name.", "Add any un-rostered
students to attendance list.", "Manually assign unpaired students…", "Inform classroom teacher
about students that are absent.", "Respond to classroom teachers 'ask for help' request."
(cells `…040202/040302/040402/040502` and `…060202/060302/060402/060502`).

Log — judgment call: the absence-notify and help-request-response lead cells were not named in the
doc's removal list, but the doc's "at most one cell" recommendation was followed; they are also
Help-Request material and survive in that scenario. Net: Happy 49→41 cells, Alternate 43→35.

## 4. Call-off Request — late-branch column removed from original happy path
The late-call-off content lives on exception path `b0000000-0000-4000-8000-000000000809`.
On the original happy path `a0000000-0000-4000-8000-000000000808`:
- Deleted its 4 cells at step "Files late call-off (<12h, immediate removal)" (`…0942`):
  Regular Tutor `…170303`, Front Stage Actions `…170304`, Front Stage Tech `…170306`,
  Visual `…170310` (empty).
- Removed the path_steps row (path 808 / step 0942) and closed the gap: columns 4–6 shifted to 3–5.
  Happy path now: Initial need → Files call-off (12h+, auto-approved) → Coverage via fill-in pool →
  Supervisor review (pending/excuse) → Final notification.
- Step row `…0942` **kept** — the exception path references it (2 paths used it before, 1 now).
- §3.1 step retitles were already applied in a prior pass; no further renames needed.
- Verified after: exception path renders intact — 5 path_steps (cols 1–5, no gaps), all 13 cells
  present, 0 empty labels. Happy path 25→21 cells.

## Net changes
| Job | Inserted | Updated | Deleted |
|---|---|---|---|
| 1 Labels | 0 | 0 | 0 |
| 2 Missed-hours path | 1 path, 8 layers, 3 steps, 4 path_steps, 10 cells | — | — |
| 3 Warm-Up lanes | — | 2 cells (content) | 16 cells |
| 4 Call-off column | — | 3 path_steps (positions) | 4 cells, 1 path_step |
