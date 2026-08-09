# Reporting an Issue — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › Post-session › Reporting an Issue · Path(s): Happy Path
Status of scenario today: 16 cells over 4 steps, 0% descriptions, 25% empty labels, happy-only. Two actor cells have the wrong actor (tutor lanes saying "Processes request and follows up on request"), the step ordering is scrambled relative to column order, and the second real channel issues arrive through — the reflection form — is absent.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Lead Tutor › Reach out | a0000000-0000-4000-8000-0000001d0102 | description | (empty) | "After the session, tutors raise anything unresolved — student wellbeing concerns, roster errors, repeated tech failures — via the school or support Slack channel, or by email for non-urgent items. Urgent issues have separate contacts and expected response behavior." | Notion "Report Urgent Session Issues" (https://app.notion.com/p/3a2b7cca498280b9b30dfc740b9a54ce); "Find the Right Support During a Session" routing table (report 04b) |
| Lead Tutor › Reach out | a0000000-0000-4000-8000-0000001d0102 | links | 1 | Add: `[{"type":"url","label":"Report Urgent Session Issues (Notion)","url":"https://app.notion.com/p/3a2b7cca498280b9b30dfc740b9a54ce"},{"type":"url","label":"Find the Right Support During a Session (Notion)","url":"https://app.notion.com/p/3a2b7cca4982801283b9f129bbf89444"}]` | Report 04b |
| Lead Tutor › Follow up (label "Processes request and follows up on request.") | a0000000-0000-4000-8000-0000001d0402 | content | "Processes request and follows up on request." | "Receives status update on the reported issue." | Wrong actor — processing is staff work (Front/Back Stage Actions already cover it); the tutor-side event is hearing back |
| Regular Tutor › Follow up | a0000000-0000-4000-8000-0000001d0403 | content | "Processes request and follows up on request." | "Receives status update on the reported issue." | Same actor error |
| Front Stage Actions › Reach out | a0000000-0000-4000-8000-0000001d0104 | description | (empty) | "Supervisors monitor the school and support Slack channels; behavioral-incident communication with school partners follows the draft School–PLUS policy agreement (currently blocked on the ticketing-tool decision)." | Notion Project 8&9 School-PLUS Policy Agreement (report 04a); Slack Alex Houk 2026-06-18 |
| Back Stage Actions › Resolve concern | a0000000-0000-4000-8000-0000001d0207 | description | (empty) | "Resolution is tracked informally today — there is no ticketing system; a servicedesk tool selection is in progress. Escalation infrastructure is not yet formalized." | Slack Alex Houk 2026-06-18 (report 02 #18) |
| Front Stage Tech › Reach out ("Slack") | a0000000-0000-4000-8000-0000001d0106 | description | (empty) | "Per-school Slack channels for classroom-side issues; the support channel for app/tech problems; message templates and privacy rules govern what may be posted (no student details in open channels)." | Notion routing table (report 04b) |

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Front Stage Tech › Reach out (third cell alongside Slack/Email) | content | "Reflection form" | Report 08 §6; Metabase report 09 #10 |
| (same cell) | description | "Issues also surface through session reflections — the form's structured ratings and area chips flag problem sessions even though ~80% of free-text notes are left empty (13,438 reflections all-time; 1,500–2,000/month in season). Supervisors export and review reflections from the Tutors admin." | Metabase report 09 #10 (79.9% empty notes all-time); report 08 §b (reflection export in Tutors admin) |
| Back Stage Tech › Follow up | content | "Slack webhooks + email service carry notifications" | Report 03 (email microservice; Slack webhooks) |
| (same cell) | description | "Follow-ups ride the same plumbing as other comms: the async email microservice (EmailHelper templates) and Slack webhook bridges — there is no dedicated issue-tracking system yet." | Report 03; report 08 (CALL_OFF_SLACK_EMAIL-style email-to-Slack bridges as the pattern) |
| Visual › Reach out | picture | Screenshot of the support-routing table from Notion "Find the Right Support During a Session" | Report 04b (obvious screenshot source) |

## 3. Structural changes (steps / triggers / paths / lanes)
- **Step order/id mismatch:** "Resolve concern" carries id suffix …02xx but renders at column 4 (after Follow up at column 3, id …04xx). Rendering is right; just confirm path_steps stays authoritative if cells are re-keyed, and consider whether "Follow up" should come after "Resolve concern" (report → assist → resolve → follow up reads more naturally than the current report → assist → follow up → resolve).
- Add a trigger from the new "Reflection form" Front Stage Tech cell to Front Stage Actions › Reach out (reflections are a supervisor-discovered intake, not tutor-initiated).
- No unhappy path proposed yet — the meaningful split (urgent vs. non-urgent) is better handled as two triggers out of "Reach out" with the urgent contacts in the description, until the ticketing tool lands and gives the sad path real structure.

## 4. Divergences & open questions (Bill decides)
- Escalation-through-reflection chips ("lead tutor absent/late", card 2067) are part of the unshipped reflection redesign (reports 06 #5, 07 #5) — NOT authored here. The reflection-as-intake cell above describes only the live form.
- Ticketing/servicedesk tool: everything in this scenario changes when it's chosen. Recommend keeping descriptions tool-agnostic ("no ticketing system yet") so the swap is additive.
- Phase-level note for Post-session (out of this scenario's scope but surfaced by the same data pull): shipped post-session features with no blueprint home — AI Coach (882 insights across 148 tutors in the 8-week spring 2026 pilot, 116 ratings, 75% positive), Badges (208 lifetime claims, 2 types via Accredible), and messaging (643 rows lifetime — effectively unused). If a "Post-Session Growth Loop" scenario gets created (report 08 §f), author AI Coach as pilot-scale, not steady-state.
