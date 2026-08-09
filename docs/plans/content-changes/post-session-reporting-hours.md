# Reporting Hours — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › Post-session › Reporting Hours · Path(s): Happy Path
Status of scenario today: the smallest Post-session scenario — 11 cells over 3 steps (report → approve → paycheck), 0% descriptions, 27% empty labels, happy-only. It is entirely a Workday process outside the PLUS app; the blueprint's job here is to say so precisely and mark the boundaries.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Lead Tutor › Report hours | a0000000-0000-4000-8000-0000001e0102 | description | (empty) | "Tutors log their tutoring hours in Workday by the weekly deadline. Hours are self-reported — the PLUS app's session and attendance records are not connected to Workday, so payroll does not automatically reflect sessions worked, called off, or cancelled." | Report 03 (no payment integration anywhere in web-app); Notion gap: compensation/payroll tie-in to attendance/fill-ins is an open question (report 04b) |
| Regular Tutor › Report hours | a0000000-0000-4000-8000-0000001e0103 | description | (empty) | Same text as Lead cell above. | Same |
| Back Stage Actions › Approve hours | a0000000-0000-4000-8000-0000001e0307 | description | (empty) | "Supervisors review submitted hours in Workday and approve them for payroll. There is no system cross-check against PLUS attendance data — with 22–41% of sessions cancelled per month in 2026 and fill-ins/call-offs at 300–640/month, reconciliation is manual judgment." | Metabase report 09 (2026 cancellation rates; call-off volumes); report 04b payroll gap |
| Front Stage Tech › Report hours ("Workday") | a0000000-0000-4000-8000-0000001e0106 | description | (empty) | "CMU's Workday instance — the same system used for hiring paperwork (Workday form + SSN form at offer/clearance). Applies to CMU-employed tutors; non-CMU campuses (Pitt/Duquesne/Rwanda/Qatar) have their own arrangements, undocumented." | Notion "Capture CMU hiring process" (223b7cca-4982-806f-9223-e6ef739fdba5, report 04); Notion gap list: payroll + non-CMU campus variants (report 04) |
| Lead Tutor › Receive paycheck | a0000000-0000-4000-8000-0000001e0202 | description | (empty) | "Pay arrives on CMU's biweekly payroll cycle via direct deposit." | Existing cell content ("Receives biweekly paycheck"); Front Stage Tech "Bank" cell |

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Front Stage Actions › Report hours | content | "Supervisors remind tutors of the weekly deadline" | Mirrors the deadline in the tutor cells; keeps the approval lane (Back Stage) distinct from the nudge (Front Stage) |
| Back Stage Tech › Report hours | content | "PLUS session data not linked to Workday" | Report 03 (no payment integration); report 04b payroll gap |
| (same cell) | description | "Deliberate boundary cell: attendance, call-offs, and fill-ins live in the PLUS DB; hours live in Workday. Any future comp tie-in (e.g. paying fill-ins differently) requires bridging these — flagged as an open question in the fill-in PRD." | Report 04b (compensation/payroll tie-in open question) |

No picture proposals — there is no PLUS-owned surface here, and screenshotting Workday isn't appropriate for a shareable blueprint.

## 3. Structural changes (steps / triggers / paths / lanes)
- Step-id/order note: "Receive paycheck" carries id suffix …02xx but renders at column 3 — rendering (report → approve → paycheck) is correct; no change needed, just don't re-key by id.
- No new steps or paths. The one candidate sad path (hours rejected / missed deadline) has no documentation anywhere in the sweeps — do not invent it; listed as an open question instead.
- Keep the 8-lane Post-session layout as is; this scenario legitimately has nothing for Support Actions (no dev/design surface).

## 4. Divergences & open questions (Bill decides)
- What actually happens when hours are missed or rejected? Zero sources across Slack/Notion/code. Needs one answer from ops before a sad path can be authored.
- Scope label: should the scenario be titled/annotated "CMU tutors" explicitly? Non-CMU campus payroll variants are an acknowledged Notion gap and the current cells silently assume CMU/Workday.
- The attendance-completeness problem (83.4% of students recorded, 31.8% of sessions fully covered — Metabase report 09 #4) means PLUS-side data couldn't currently support payroll verification even if a bridge were wanted. Worth stating in the Back Stage Tech boundary cell, or too editorial for the blueprint?
- tutor_absence records stopped after Apr 2025 and the call-off system now carries absence data (Metabase report 09 #2/#3) — if a comp tie-in is ever built, the call-off table is the source, not tutor_absence. Note kept here so the boundary cell ages well.
