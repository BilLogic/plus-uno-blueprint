# Applied: Pre-session content revisions — 2026-08-08

Scenarios: Standard Scheduling, Fill-in Request, Call-off Request.
Applied via supabase-plus MCP `execute_sql`, one transaction per scenario. All §1 target cell_ids were SELECT-verified first; every "Current" value matched the docs, so nothing was skipped on identity grounds. Backups `backup_20260808_*` pre-existed; none created.

## Standard Scheduling (scenario `…126`, path `…806`)

**Applied**
- §1: all 9 revision rows — `…140203` (content/description/links), `…140206` (description), `…140204` (content), `…140108` (content/description/links replaced), `…140107` (content), `…140109` (description).
- §3.1 step renames: `…894` "Review schedules" → "Sessions loaded & managed"; `…896` "Receive schedule" → "Views schedule & syncs calendar".
- §3.2 (DECIDED 2→3 steps): new step `b0000000-0000-4000-8000-000000000901` "Reconfirm availability" at column_position 3.
- §2 new cells: `b…140303` (Regular Tutor × Reconfirm), `b…140306` (Front Stage Tech × Reconfirm, 3 Figma links), `b…140308` (Back Stage Tech × Reconfirm, ReconfirmState machine), `b…140208` (Back Stage Tech × Views schedule, calendar feed + reminder emails). All reconfirmation cells carry the shipping/not-in-prod caveat per doc.
- §3.3 trigger: `…140107` → `b…140303`, kind=trigger, label "Supervisor edits/reverts session → Reconfirm availability (shipping)". (A pre-existing trigger `…140107` → `…140204` was left untouched.)

**Deferred**
- Trigger "Session Sign Up confirmed → schedule visible": source cell lives in the Onboarding › Session Sign Up scenario, outside this task's scope — source cell not identified, per rule 6.
- Trigger "Reconfirm = Unavailable → Fill-in Request": the Fill-in doc (§3.2) explicitly says to create this only once the reconfirmation flow deploys (dev-only today). Docs conflict on timing; deferred to the conservative reading.
- §3.4 Visual-lane pictures: skipped per rules (picture properties out of scope).

**Stats** — before: 1 path, 9 cells, 4 with description (44%), 2 links. After: 1 path, 13 cells, 8 with description (62%), 9 links, 3 steps.

## Fill-in Request (scenario `…127`, path `…807`)

**Applied**
- §1: all 16 revision rows across 12 cells — `…150106` (content/description/links replaced), `…150203`, `…150206` (content only; Slack link entries retained as doc says keep Slack secondary), `…150303`, `…150306` (content + links replaced with §2.2/§2.3 Figma, Slack/Email dropped), `…150204`, `…150304`, `…150403`, `…150108`, `…150107`, `…150407`, `…150109`.
- §2 new cells: `b…150208` (Back Stage Tech × Tutor browses Fill-In tab — Slack bridge, urgent coverage), `b…150307` (Back Stage Actions × Tutor takes the slot — reassignment/LEAD promotion). `…150409` links: kept + appended Supervisor Pre-Session Figma link.
- §3.1 step re-titles: `…897`→"Session enters fill-in pool", `…898`→"Tutor browses Fill-In tab", `…899`→"Tutor takes the slot", `…900`→"Roster updated, tutor joins".
- §3.2 cross-scenario trigger (also Call-off doc §3.3 trigger-out): `…170508` (Call-off › call-off pipeline) → `…150108` (72-hour auto-add job), kind=trigger, label "Call-off executed → session enters fill-in pool".

**Deferred**
- Second trigger-in from Standard Scheduling reconfirm — doc says only once deployed (dev-only today).
- §3.3 "Nobody fills in" unhappy path — recommended, not DECIDED; no specced cells.
- §4 path-description note (covering-tutor vs calling-off-tutor split) — open question, not a stamped decision.

**Minor note**: doc listed `…150106` current description as "Google Form blurb"; live description was empty. Replacement value applied regardless (content matched).

**Stats** — before: 1 path, 20 cells, 3 with description (15%), 7 links. After: 1 path, 22 cells, 6 with description (27%), 9 links, 4 steps.

## Call-off Request (scenario `…128`, paths `…808` + new `b…809`)

**Applied**
- §1: all 14 revision rows — `…170103` (desc + links keep-and-add Figma §5), `…170203` (content/desc/links keep-and-add §5.1+§5.3), `…170206` (content/desc/links replaced), `…170303` (content/desc/links keep-and-add §5.2), `…170306` (content + links replaced §5.2), `…170403`, `…170406` (content + links replaced §2.2), `…170404`, `…170207`, `…170507`, `…170508` (content/desc/links replaced), `…170603` (desc), `…170606` (content + links replaced §5.4), `…170509` (desc).
- §2 new cells on original path: `b…170208` (Back Stage Tech × Early — Auto-approval rules), `b…170408` (Back Stage Tech × Peer — Fill-in pool 72h window), `b…170104` (Front Stage Actions × Initial need — flow guidance, swap marked planned).
- §3.1 step re-titles: `…941`→"Files call-off (12h+, auto-approved)", `…942`→"Files late call-off (<12h, immediate removal)", `…943`→"Coverage via fill-in pool", `…944`→"Supervisor review (pending/excuse)".
- §3.2 (DECIDED) path split: new path `b0000000-0000-4000-8000-000000000809` "Late call-off (<12h)", path_type=exception, with description; 7 layers (`b…1071`–`b…1077`) mirroring the original path's names/roles/row_positions; path_steps sharing scenario steps Initial need / Late call-off / Peer→coverage / Internal decision / Final notification at columns 1–5. Thirteen cells (`b…180103`, `b…180303`, `b…180306`, `b…180403`, `b…180404`, `b…180406`, `b…180408`, `b…180507`, `b…180508`, `b…180509`, `b…180603`, `b…180604`, `b…180606`) copied from the post-revision values of the corresponding original-path cells (no cells moved).
- §3.3 trigger-out "Call-off executed → fill-in pool": created (see Fill-in section).
- §3.4/§3.5 retirements: accomplished through §1 rewrites (Google Form / email / #shift-swap / tutor_absence no longer described anywhere).

**Logged choice**: the new path shares the scenario's existing steps rather than getting duplicates — the re-titled names ("Files late call-off (<12h, immediate removal)" etc.) are accurate on both paths, so no per-path step forks were created.

**Deferred**
- Removing the "Files late call-off" column (and its 4 cells) from the original 12h+ path: the doc/instructions say to rewrite the original as the standard flow but do not explicitly authorize deleting cells (deletes are human-only in this project). The original path still shows all 6 columns with revised content; dropping the late column from `…808` is left for Bill.
- Trigger "Approval → students auto-reassigned (In-session roster)": target cell in an In-session scenario not identifiable within scope.
- "Future" path (reconfirm-released absences, swap §5.5): skipped per rules — convention only, no specced cells.
- Visual-lane screenshots (§2 picture row): skipped per rules.

**Stats** — before: 1 path, 22 cells, 1 with description (5%), 15 links. After: 2 paths; original path 25 cells, 9 with description (36%), 20 links; new exception path 13 cells, 6 with description, 14 links.

## Verification

- Post-write SELECTs confirmed cell counts (13 / 22 / 25+13), description counts, link totals, path counts (1/1/2), step orders, and all three trigger rows (2 new + 1 cross-scenario) with correct kind/labels.
- All new ids use the `b0000000-0000-4000-8000-…` prefix to avoid colliding with seeded `a0000000-…` ranges.

---

## Amendment — 2026-08-16 (Standard Scheduling)

Applied via supabase-plus MCP `execute_sql`, one transaction, each `UPDATE`
guarded by a `length(content)` re-check so a drifted row would have been a
no-op. Read back and verified after commit.

- **`…140204`** (Front Stage Actions × Views schedule) — 257 → 59 chars. The
  cell reported as bleeding through its lane band. First sentence stays as
  content; the cancellation statistic and the reconfirmation caveat move to
  `description` (245 chars), which the detail panel already scrolls.
- **`…140107`** (Back Stage Actions × Sessions loaded & managed) — 282 → 65
  chars. Longer than the reported cell and previously unnoticed. Edit/cancel/
  revert scopes move to `description` (443 chars), and revert is reframed:
  Card 2452 is **in QA for release 11.4**, so it is an unreleased feature, not
  shipping code with no observed use.
- **`…140108`** (Back Stage Tech × Sessions loaded & managed) — description
  extended (610 chars) with the now-answered upstream provenance for eval flag
  **B3-SCHED-01**: the supervisor team builds a per-semester schedule workbook
  (one row per session slot), the dev team pushes it at each launch, and the
  annual partner calendar supplies launch/break dates while consuming app
  attendance data back. Roles named, not individuals, matching the lane style.

**Remaining sweep**: 12 cells still exceed the proposed 120-character content
cap, all with empty descriptions, longest 271 — two of them identical
271-char twins in Call-off Request (`…170507` / `…180507`). Same treatment
applies (lead sentence stays, detail to `description`); not yet applied.
