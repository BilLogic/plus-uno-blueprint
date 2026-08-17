# Help Request — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › In-session › Help Request · Path(s): Happy Path
Status of scenario today: 33 cells over 8 steps (one step orphaned, never rendered), 52% slot fill. The Regular Tutor rotation (receive → finish in 1–2 min → visit → resolve → leave → next) is clean; the Teacher and Lead lanes carry session-start content that also appears verbatim in Warm-Up, and one step is literally named with a full sentence. Escalation routing — the richest documented part of this scenario — is absent.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Regular Tutor › Receive help request | a0000000-0000-4000-8000-0000001b0103 | description | (empty) | "Students signal with the Zoom 'raise hand' emoji (teachers coach this at session start); the request also shows on the tutor's student dashboard. Tutors wrap up their current conversation within 1–2 minutes rather than dropping it." | Student Just Joined teacher cell (raise-hand coaching); existing step sequence |
| Regular Tutor › Receive help request | a0000000-0000-4000-8000-0000001b0103 | links | 1 | Add: `[{"type":"url","label":"Figma — Tutor In-Session Mgmt › Regular Tutor","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1691-119583"}]` | Report 05 |
| Regular Tutor › Resolve issue | a0000000-0000-4000-8000-0000001b0403 | description | (empty) | "Content questions the tutor handles in-room. Anything else follows the routing table: lead tutor for roster/room problems, the school Slack channel for classroom-side issues, the support channel for app/tech problems — with message templates and privacy rules for each." | Notion "Find the Right Support During a Session" (report 04b) |
| Regular Tutor › Resolve issue | a0000000-0000-4000-8000-0000001b0403 | links | 1 | Add: `[{"type":"url","label":"Find the Right Support During a Session (Notion)","url":"https://app.notion.com/p/3a2b7cca4982801283b9f129bbf89444"},{"type":"url","label":"Tricky situations training list (Notion)","url":"https://app.notion.com/p/372b7cca498280f59f00c026f9973c57"}]` | Report 04b |
| Lead Tutor › Leave breakout room (label "Respond to classroom teachers 'ask for help' request.") | a0000000-0000-4000-8000-0000001b0502 | description | (empty) | "Teacher-initiated requests reach the lead through the 'ask for help' mechanism; the lead triages — moving students, reassigning, or escalating to supervisors — while regular tutors stay in rotation." | Existing teacher-lane cell …0501; Module 11 Notion |
| Regular Tutor › Next student | a0000000-0000-4000-8000-0000001b0603 | description | (empty) | "After a help request is resolved the tutor re-enters the researcher-set rotation order where they left off." | Existing Back Stage Actions cell …0607 |
| Partner Action: Teacher › (step "Escalates unresolved issues to tutors@tutor.plus promptly.") | a0000000-0000-4000-8000-0000001b0701 | description | (empty) | "For issues neither the tutors nor the routing channels resolve in-session, teachers escalate by email to tutors@tutor.plus. A dedicated ticketing/servicedesk tool is being selected but is not yet in place." | Slack Alex Houk 2026-06-18 (ticketing selection in progress, report 02 #18) |

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Front Stage Tech › Resolve issue (second cell alongside "Zoom/Pencil") | content | "Slack (school + support channels)" | Notion routing table (report 04b) |
| (same cell) | description | "Escalations leave Zoom: classroom-side issues go to the school's Slack channel, app/tech issues to the support channel, each with its own template. Urgent issues have separate contacts and expected wait behavior." | Notion "Find the Right Support…"; "Report Urgent Session Issues" (https://app.notion.com/p/3a2b7cca498280b9b30dfc740b9a54ce) |
| Back Stage Actions › Resolve issue | content | "Supervisors monitor school Slack channels during sessions" | Notion "When No or Few Students Join" (4 supervisors tagged; report 04b) |
| Support Actions › Resolve issue | content | "Support channel triage (ticketing tool pending)" | Slack 2026-06-18 (report 02 #18) |

## 3. Structural changes (steps / triggers / paths / lanes)
1. **Orphan step — wire or delete:** step "Handles student tech problems as they arise" (id suffix …000986) exists on the scenario but is in no path_steps row, so it never renders. Its text already appears as the Teacher-lane cell under "Next student" (a0000000-0000-4000-8000-0000001b0601). Recommendation: delete the orphan step; the content is covered. Alternative: wire it as a real column between "Resolve issue" and "Leave breakout room" if teacher tech-triage deserves its own beat — but then the Teacher-lane cells need re-spreading.
2. **Rename sentence-step:** the last step is named "Escalates unresolved issues to tutors@tutor.plus promptly." — a sentence duplicating its own Teacher cell. Rename the step to "Escalate unresolved issues" (short noun-ish imperative, consistent with other step names).
3. **Lane hygiene:** Lead Tutor cells at cols 1–4 ("Rename students…", "Add un-rostered students…", "Manually assign unpaired students…", "Inform teacher about absent students") are session-start actions shared verbatim with Warm-Up. Keep them in exactly one scenario (they fit Student Just Joined / Before Students Join best) and slim this lane to triage actions (cols 5+).
4. Trigger to add: Partner Teacher "ask for help" (…0501) → Lead Tutor respond (…0502) if not already present.

## 4. Divergences & open questions (Bill decides)
- Is tutors@tutor.plus still the escalation endpoint of record? It's baked into a step name today; the pending ticketing decision (Slack 2026-06-18) will obsolete it. Suggest keeping the address in cell content, not step names, so the swap is one edit.
- Escalation-through-reflection ("lead tutor absent/late" chips, card 2067) is design-stage per report 06 #5 — deliberately NOT authored here as a current channel.
- **DECIDED (Bill, 2026-08-08): add "Escalation" alternate path** — happy = content help resolved in-room; alternate = routed out (school Slack / support / urgent). Move tutors@tutor.plus out of the step name into cell content.
