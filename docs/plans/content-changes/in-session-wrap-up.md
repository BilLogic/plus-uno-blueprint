# Wrap-Up — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › In-session › Wrap-Up · Path(s): Happy Path
Status of scenario today: 20 cells over 4 steps, frontstage lanes only — Wrap-Up is the sole In-session path missing the Support Actions lane, and it also has zero Back Stage Tech/Actions cells. Content is correct but thin (75% pictures, 15% descriptions), and the "Complete wrap-up" step is where the In→Post-session handoff (notes → reflection, recording) actually happens.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Lead Tutor › Close breakout sessions | a0000000-0000-4000-8000-0000001c0102 | description | (empty) | "Lead closes all breakout rooms from the Zoom host controls, returning everyone to the main room, and stops the session recording per the lead protocol." | Module 11: Lead Tutor Session Responsibilities (Notion 3b1b7cca-4982-8090-9264-cf0bb51239fb) |
| Lead Tutor › Complete wrap-up | a0000000-0000-4000-8000-0000001c0402 | description | (empty) | "Lead reminds tutors before they drop off: upload the Zoom recording and complete the reflection form. Reflections are found under Your Sessions › Reflections; tutors on back-to-back shifts often defer them, which is why the reminder is scripted here." | Module 11; Slack Cassie Ha series 2026-02→07 (back-to-back shifts make reflections a chore, report 02 #13) |
| Regular Tutor › Complete wrap-up | a0000000-0000-4000-8000-0000001c0403 | description | (empty) | "The live reflection form is multi-section with 1–5 star button ratings, adaptive 'areas' chips, and recording upload (up to 5 files / 1GB total, with editing support after submission). In-session notes typed in the note-taking field resurface inside the reflection form. Tutors submit roughly 1,500–2,000 reflections per month in season, but about 80% leave the free-text notes empty — the structured ratings/chips carry most of the signal." | Report 08 §6 (reflection live state; NO AI follow-ups); Notion In-session Note-taking Tool (notes surface in reflection) |
| Regular Tutor › Complete wrap-up (volumes evidence) | a0000000-0000-4000-8000-0000001c0403 | — | — | (see description above; 13,438 reflections all-time, 79.9% empty notes all-time, 832–1,987/mo in 2026) | Metabase report 09 #10 |
| Regular Tutor › Complete wrap-up | a0000000-0000-4000-8000-0000001c0403 | links | 3 | Add: `[{"type":"url","label":"Figma — Post-Session 01 Entry (Reflections page)","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=20-5809"},{"type":"url","label":"Complete and Manage Session Reflections (Notion)","url":"https://app.notion.com/p/392b7cca4982804cb6bdf4a0c7f9c435"}]` | Report 05 (metadata pull: 01 Entry = 20:5809); report 04b |
| Front Stage Tech › Complete wrap-up ("PLUS App") | a0000000-0000-4000-8000-0000001c0406 | description | (empty) | "Reflections tab in Your Sessions plus the reflection form itself; the upload widget accepts the Zoom recording files." | Report 08 §1 (tab set incl. Reflections, tutor_schedule.js:50-56) |
| Lead Tutor › Debrief with tutors | a0000000-0000-4000-8000-0000001c0302 | description | (empty) | "Short main-room debrief: flag students to watch, coverage problems, and anything to escalate. Items that need staff attention route onward per Reporting an Issue." | Module 11; Help Request routing table |

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Back Stage Tech › Complete wrap-up | content | "Videoconf attendance reconciled to session records" | Report 03 (Videoconf* entities match videoconf attendance to sessions) |
| (same cell) | description | "After the meeting ends, videoconference attendance is matched against SessionAttendance; gaps from co-host room moves show up here, which feeds the completeness stats supervisors track (2026 actuals: 83.4% of rostered students recorded, only 31.8% of sessions fully covered)." | Report 03; Metabase report 09 #4 (2026 production figures) |
| Back Stage Tech › Close breakout sessions | content | "In-session notes auto-saved for reflection prefill" | Notion In-session Note-taking Tool (shipped v1, auto-save; report 04b) |
| Back Stage Actions › Complete wrap-up | content | "Supervisors track reflection completion" | Report 08 §b (Tutors admin: reflection export, performance tabs) |
| Support Actions › Complete wrap-up | content | "Dev team\nDesign team" | Lane parity with the other In-session scenarios |

## 3. Structural changes (steps / triggers / paths / lanes)
- **Add the Support Actions lane** — Wrap-Up is the only path in the lifecycle missing it (report 01 §5). One cell (above) restores parity.
- Add Back Stage Tech and Back Stage Actions cells per §2; both lanes exist in the layer set but are empty.
- Add a cross-scenario trigger/note from Regular Tutor › Complete wrap-up to the Post-session Reporting an Issue scenario (reflection is one of the two channels issues arrive through) — or at minimum say so in the description.

## 4. Divergences & open questions (Bill decides)
- The reflection-form redesign (AI follow-up questions per section, escalation chips, Self Reflection every 10th, Form Feedback every 3 weeks) is design-stage, not shipped (reports 06 #5, 07 #5). Everything proposed above describes the live form only. When the redesign ships, cells …1c0403/…1c0406 are the ones to touch.
- "Upload Zoom recording" flow changed twice in 2026 (folder upload added 2026-02-13, removal 2026-04-29, editing Card2225) — the description states the current 5-file/1GB cap; confirm that's still accurate at import time.
- Should recording-handling (recording → storage pipeline) get a Back Stage Tech cell? The post-session backstage runbook (recording→Box) is an acknowledged Notion gap (report 04b), so I left it out rather than invent one.
